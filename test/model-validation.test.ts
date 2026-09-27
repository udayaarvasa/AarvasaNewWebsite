/**
 * Upload-boundary model validation.
 *
 * The decision must rest on the bytes, never on the filename or the browser's
 * reported MIME type — both are attacker-controlled. These cases pin that down.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_LIMITS,
  hasExternalReferences,
  validateModelBytes,
} from "../src/lib/media/model-validation.ts";

/** A minimal well-formed GLB header declaring `size` total bytes. */
const glbHeader = (size: number, version = 2): Uint8Array => {
  const b = new Uint8Array(Math.max(size, 20));
  b.set([0x67, 0x6c, 0x54, 0x46]); // "glTF"
  const put = (at: number, v: number) => {
    b[at] = v & 0xff;
    b[at + 1] = (v >> 8) & 0xff;
    b[at + 2] = (v >> 16) & 0xff;
    b[at + 3] = (v >> 24) & 0xff;
  };
  put(4, version);
  put(8, size);
  return b;
};

const utf8 = (s: string) => new TextEncoder().encode(s);

test("a well-formed GLB is accepted", () => {
  const v = validateModelBytes(glbHeader(2048), 2048);
  assert.equal(v.ok, true);
  assert.equal(v.ok === true && v.kind, "glb");
});

test("an empty file is refused", () => {
  assert.equal(validateModelBytes(new Uint8Array(0), 0).ok, false);
});

test("a file over the size ceiling is refused before it reaches storage", () => {
  const v = validateModelBytes(glbHeader(64), MODEL_LIMITS.maxBytes + 1);
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.rejection, "TOO_LARGE");
});

test("glTF 1.0 is refused — the pipeline handles 2.0", () => {
  const v = validateModelBytes(glbHeader(2048, 1), 2048);
  assert.equal(v.ok === false && v.rejection, "UNSUPPORTED_VERSION");
});

test("a header whose declared length disagrees with the file is refused", () => {
  // Header claims 9999 bytes; the upload is 2048.
  const v = validateModelBytes(glbHeader(9999), 2048);
  assert.equal(v.ok === false && v.rejection, "MALFORMED_HEADER");
});

/* ── Identity comes from the bytes, not the name ───────────────────────── */

test("an FBX is refused however it is named", () => {
  const fbx = utf8("Kaydara FBX Binary  \0");
  const v = validateModelBytes(fbx, fbx.length + 1000);
  assert.equal(v.ok === false && v.rejection, "NOT_A_MODEL");
});

test("an OBJ is refused", () => {
  const obj = utf8("# Blender v3.0 OBJ File\nv 1.0 1.0 1.0\n");
  assert.equal(validateModelBytes(obj, obj.length).ok, false);
});

test("a renamed executable is refused", () => {
  // Mach-O magic, uploaded as "model.glb".
  const macho = new Uint8Array([0xcf, 0xfa, 0xed, 0xfe, 0x0c, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const v = validateModelBytes(macho, 2048);
  assert.equal(v.ok === false && v.rejection, "NOT_A_MODEL");
});

test("a JPEG renamed .glb is refused", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(validateModelBytes(jpeg, 4096).ok, false);
});

/* ── glTF JSON and external references ─────────────────────────────────── */

test("a self-contained glTF document is accepted", () => {
  const doc = utf8(JSON.stringify({ asset: { version: "2.0" }, meshes: [] }));
  const v = validateModelBytes(doc, doc.length);
  assert.equal(v.ok, true);
  assert.equal(v.ok === true && v.kind, "gltf-json");
});

test("a glTF with a data: URI is accepted — it carries its own bytes", () => {
  const doc = utf8(
    JSON.stringify({ asset: { version: "2.0" }, buffers: [{ uri: "data:application/octet-stream;base64,AAAA" }] }),
  );
  assert.equal(validateModelBytes(doc, doc.length).ok, true);
});

test("a glTF pointing at a remote URL is refused — it would make the worker fetch it", () => {
  const doc = utf8(
    JSON.stringify({ asset: { version: "2.0" }, images: [{ uri: "https://attacker.example/x.png" }] }),
  );
  const v = validateModelBytes(doc, doc.length);
  assert.equal(v.ok === false && v.rejection, "EXTERNAL_REFERENCES");
});

test("a glTF pointing at an internal address is refused", () => {
  const doc = utf8(
    JSON.stringify({ asset: { version: "2.0" }, buffers: [{ uri: "http://169.254.169.254/latest/meta-data/" }] }),
  );
  assert.equal(validateModelBytes(doc, doc.length).ok, false);
});

test("a glTF pointing at a sibling file is refused — only one file was uploaded", () => {
  const doc = utf8(JSON.stringify({ asset: { version: "2.0" }, buffers: [{ uri: "scene.bin" }] }));
  assert.equal(validateModelBytes(doc, doc.length).ok, false);
});

test("external-reference detection sees through unparseable documents", () => {
  assert.equal(hasExternalReferences('{"asset":{"ver  "uri" : "http://x/y.bin"'), true);
  assert.equal(hasExternalReferences('{"uri":"data:abc"}'), false);
  assert.equal(hasExternalReferences('{"asset":{"version":"2.0"}}'), false);
});
