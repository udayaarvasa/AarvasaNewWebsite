import type { Findings } from "./findings";
import { readMp4, type Mp4Info } from "./formats";

/**
 * MP4 validation for tour films.
 *
 * Passthrough: the file is published byte-for-byte, so the only question is
 * whether a visitor's browser can play what was uploaded. Nothing here decodes a
 * frame or re-encodes anything — there is no transcoder in this pipeline, and a
 * check that needed one would be checking something the pipeline does not do.
 */

/** Brands that mean "an MP4 file", as opposed to QuickTime or HEIC in the same box format. */
const MP4_BRANDS: ReadonlySet<string> = new Set([
  "isom", "iso2", "iso3", "iso4", "iso5", "iso6", "iso8", "iso9",
  "mp41", "mp42", "avc1", "M4V ", "mmp4", "dash", "MSNV",
]);

/** H.264: plays in every browser this site supports. */
const UNIVERSAL_CODECS: ReadonlySet<string> = new Set(["avc1", "avc3"]);
/** Plays in some browsers and not others. Allowed, but the uploader is told. */
const PARTIAL_CODECS: ReadonlySet<string> = new Set(["hvc1", "hev1", "av01", "vp09"]);

export interface VideoResult {
  readonly width: number;
  readonly height: number;
  readonly metrics: Readonly<Record<string, number | boolean | string | null>>;
}

export function validateMp4(bytes: Uint8Array, findings: Findings): VideoResult | null {
  const info: Mp4Info | null = readMp4(bytes);
  if (!info) {
    findings.fail("video.structure", "Not a readable MP4: the box structure is malformed or there is no moov");
    return null;
  }

  const brands = [info.majorBrand, ...info.compatibleBrands];
  if (!brands.some((b) => MP4_BRANDS.has(b))) {
    // QuickTime ('qt  ') and HEIC ('heic') share the container but are not MP4.
    findings.fail("video.brand", `Brand ${JSON.stringify(info.majorBrand)} is not an MP4 brand; export an MP4 (H.264)`);
    return null;
  }
  findings.pass("video.brand", `MP4 brand ${JSON.stringify(info.majorBrand)}`);

  if (!info.topLevel.includes("mdat")) {
    findings.fail("video.structure", "No media data (mdat): the file has a header and no video");
    return null;
  }

  if (info.videoCodec === null || info.width === null || info.height === null) {
    findings.fail("video.track", "No video track: an audio-only or empty MP4 is not a tour film");
    return null;
  }
  if (UNIVERSAL_CODECS.has(info.videoCodec)) {
    findings.pass("video.codec", `Video codec ${info.videoCodec} (H.264) plays in every supported browser`);
  } else if (PARTIAL_CODECS.has(info.videoCodec)) {
    findings.warn("video.codec", `Video codec ${info.videoCodec} does not play in every browser; H.264 does`);
  } else {
    findings.fail("video.codec", `Video codec ${JSON.stringify(info.videoCodec)} is not playable in a browser; export H.264`);
    return null;
  }

  if (info.width < 16 || info.height < 16) {
    findings.fail("video.dimensions", `Video is ${info.width}x${info.height}; too small to be a tour film`);
    return null;
  }

  if (info.faststart) {
    findings.pass("video.faststart", "Index precedes media data; playback can start while the file streams");
  } else {
    // Passthrough means this cannot be fixed here, but it can be named.
    findings.warn("video.faststart", "Index follows media data: playback waits for the whole file. Re-export with faststart");
  }

  /* A 2:1 frame is the shape of equirectangular footage. VIDEO is always shown as
     flat video, so a spherical clip uploaded here would play as a distorted
     rectangle — said now, rather than discovered on a property page. */
  const ratio = info.width / info.height;
  if (Math.abs(ratio - 2) < 0.02) {
    findings.warn("video.equirect-aspect", "2:1 frame: VIDEO assets are always shown as flat video, never as 360");
  }

  if (info.durationSeconds === null || !(info.durationSeconds > 0)) {
    findings.warn("video.duration", "Duration could not be read from the movie header");
  }

  const orientation = info.height > info.width ? "portrait" : info.width > info.height ? "landscape" : "square";
  return {
    width: info.width,
    height: info.height,
    metrics: {
      durationSeconds: info.durationSeconds === null ? null : Math.round(info.durationSeconds * 1000) / 1000,
      codec: info.videoCodec,
      majorBrand: info.majorBrand,
      faststart: info.faststart,
      hasAudio: info.hasAudio,
      orientation,
    },
  };
}
