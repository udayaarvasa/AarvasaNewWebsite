import { crc32, inflateRawSync } from "node:zlib";

/**
 * Minimal read-only ZIP reader for SOG bundles, with the defensive checks an
 * untrusted archive needs. No ZIP64, no encryption, stored/deflate only (the
 * same subset PlayCanvas's SOG bundle parser reads).
 */

export interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly flags: number;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

export class ZipError extends Error {}

export function readZipDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEocd = Math.max(0, bytes.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("End of central directory not found");

  const diskEntries = view.getUint16(eocd + 8, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ZipError("ZIP64 archives are not supported");
  if (diskEntries !== totalEntries || view.getUint16(eocd + 4, true) !== 0) throw new ZipError("Multi-disk archives are not supported");
  if (cdOffset + cdSize > eocd) throw new ZipError("Central directory overlaps the end record");

  const entries: ZipEntry[] = [];
  let offset = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL) throw new ZipError(`Corrupt central directory entry ${i}`);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    let name: string;
    try {
      name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
    } catch {
      throw new ZipError(`Entry ${i} has a non-UTF-8 name`);
    }
    entries.push({
      name,
      flags: view.getUint16(offset + 8, true),
      method: view.getUint16(offset + 10, true),
      crc32: view.getUint32(offset + 16, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Reads one entry, enforcing its declared size and CRC-32. */
export function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.localHeaderOffset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== LOCAL) throw new ZipError(`${entry.name}: bad local header`);
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const end = start + entry.compressedSize;
  if (end > bytes.length) throw new ZipError(`${entry.name}: data overruns the archive`);
  const raw = bytes.subarray(start, end);

  let data: Uint8Array;
  if (entry.method === 0) {
    data = raw;
  } else if (entry.method === 8) {
    try {
      data = inflateRawSync(raw, { maxOutputLength: Math.max(entry.uncompressedSize, 1) });
    } catch (error) {
      throw new ZipError(`${entry.name}: inflate failed or exceeded declared size (${(error as Error).message})`);
    }
  } else {
    throw new ZipError(`${entry.name}: unsupported compression method ${entry.method}`);
  }
  if (data.length !== entry.uncompressedSize) throw new ZipError(`${entry.name}: size does not match the central directory`);
  if (crc32(data) >>> 0 !== entry.crc32) throw new ZipError(`${entry.name}: CRC-32 mismatch`);
  return data;
}
