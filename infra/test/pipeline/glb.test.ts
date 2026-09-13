import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Findings } from "../../src/pipeline/findings";
import { validateGlb } from "../../src/pipeline/glb";
import { glb, glbFrom, jpeg, ktx2, png, triangleGltf, webp } from "./fixtures";

function run(bytes: Uint8Array) {
  const findings = new Findings();
  const result = validateGlb(bytes, findings);
  const rules = (level: "pass" | "warn" | "fail") => findings.list.filter((f) => f.level === level).map((f) => f.rule);
  return { findings, result, fails: rules("fail"), warns: rules("warn"), passes: rules("pass") };
}

describe("GLB validation", () => {
  it("accepts a valid embedded GLB and reports metrics", () => {
    const { findings, result, passes } = run(glbFrom(triangleGltf({ bytes: png(512, 256), mimeType: "image/png" })));
    assert.equal(findings.status, "pass", JSON.stringify(findings.list));
    assert.deepEqual(result?.metrics, { meshes: 1, primitives: 1, triangles: 1, materials: 1, textures: 1, images: 1, maxTextureDimension: 512 });
    assert.ok(passes.includes("gltf.embedded-resources"));
  });

  it("rejects files that are not valid GLB containers", () => {
    const valid = glbFrom(triangleGltf());
    const badMagic = Uint8Array.from(valid);
    badMagic[0] = 0x00;
    assert.deepEqual(run(badMagic).fails, ["glb.header"]);

    const badLength = Uint8Array.from(valid);
    new DataView(badLength.buffer).setUint32(8, valid.length + 4, true);
    assert.deepEqual(run(badLength).fails, ["glb.header"]);

    const version1 = Uint8Array.from(valid);
    new DataView(version1.buffer).setUint32(4, 1, true);
    assert.deepEqual(run(version1).fails, ["glb.header"]);

    assert.deepEqual(run(valid.subarray(0, 30)).fails, ["glb.header"]);
    assert.deepEqual(run(new Uint8Array(4)).fails, ["glb.header"]);
  });

  it("rejects malformed JSON chunks and glTF 1.0 assets", () => {
    const notJson = Buffer.from("not json    ");
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(20 + notJson.length, 8);
    header.writeUInt32LE(notJson.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    assert.deepEqual(run(new Uint8Array(Buffer.concat([header, notJson]))).fails, ["gltf.json"]);

    const v1 = triangleGltf();
    v1.json.asset = { version: "1.0" };
    assert.ok(run(glbFrom(v1)).fails.includes("gltf.asset"));
  });

  it("rejects external buffer and image URIs", () => {
    const externalBuffer = triangleGltf();
    externalBuffer.json.buffers = [{ uri: "https://cdn.example.com/scene.bin", byteLength: 36 }];
    const a = run(glb(externalBuffer.json));
    assert.ok(a.fails.includes("gltf.external-uri"));
    assert.equal(a.findings.status, "fail");

    const relativeImage = triangleGltf();
    relativeImage.json.images = [{ uri: "textures/wall.png" }];
    relativeImage.json.textures = [{ source: 0 }];
    assert.ok(run(glbFrom(relativeImage)).fails.includes("gltf.external-uri"));

    const traversal = triangleGltf();
    traversal.json.images = [{ uri: "../../../etc/passwd" }];
    assert.ok(run(glbFrom(traversal)).fails.includes("gltf.external-uri"));
  });

  it("rejects base64 data URIs in favour of the BIN chunk", () => {
    const dataUri = triangleGltf();
    dataUri.json.buffers = [{ uri: "data:application/octet-stream;base64,AAAA", byteLength: 3 }];
    assert.ok(run(glb(dataUri.json)).fails.includes("gltf.data-uri"));
  });

  it("rejects meshopt compression declared as used, required, or on a bufferView", () => {
    for (const ext of ["EXT_meshopt_compression", "KHR_meshopt_compression"]) {
      const used = triangleGltf();
      used.json.extensionsUsed = [ext];
      assert.ok(run(glbFrom(used)).fails.includes("gltf.meshopt"), `${ext} in extensionsUsed`);

      const required = triangleGltf();
      required.json.extensionsUsed = [ext];
      required.json.extensionsRequired = [ext];
      const r = run(glbFrom(required));
      assert.ok(r.fails.includes("gltf.meshopt"));
      assert.ok(!r.fails.includes("gltf.extensions-required"), "meshopt is reported once, specifically");
    }
    const onView = triangleGltf();
    (onView.json.bufferViews as Array<Record<string, unknown>>)[0].extensions = { EXT_meshopt_compression: { buffer: 0, byteLength: 36 } };
    assert.ok(run(glbFrom(onView)).fails.includes("gltf.meshopt"));
  });

  it("accepts Draco-compressed geometry without decoding it", () => {
    const draco = triangleGltf();
    draco.json.extensionsUsed = ["KHR_draco_mesh_compression"];
    draco.json.extensionsRequired = ["KHR_draco_mesh_compression"];
    const mesh = (draco.json.meshes as Array<{ primitives: Array<Record<string, unknown>> }>)[0];
    mesh.primitives[0].extensions = { KHR_draco_mesh_compression: { bufferView: 0, attributes: { POSITION: 0 } } };
    const { findings, result, passes } = run(glbFrom(draco));
    assert.equal(findings.status, "pass", JSON.stringify(findings.list));
    assert.equal(result?.compression.draco, true);
    assert.ok(passes.includes("gltf.draco"));
  });

  it("fails Draco primitives that do not declare the extension or point at a missing bufferView", () => {
    const undeclared = triangleGltf();
    (undeclared.json.meshes as Array<{ primitives: Array<Record<string, unknown>> }>)[0].primitives[0].extensions = {
      KHR_draco_mesh_compression: { bufferView: 0, attributes: {} },
    };
    assert.ok(run(glbFrom(undeclared)).fails.includes("gltf.draco"));

    const missingView = triangleGltf();
    missingView.json.extensionsUsed = ["KHR_draco_mesh_compression"];
    (missingView.json.meshes as Array<{ primitives: Array<Record<string, unknown>> }>)[0].primitives[0].extensions = {
      KHR_draco_mesh_compression: { bufferView: 9, attributes: {} },
    };
    assert.ok(run(glbFrom(missingView)).fails.includes("gltf.draco"));
  });

  it("recognises KTX2/Basis textures and requires KHR_texture_basisu", () => {
    const basis = triangleGltf({ bytes: ktx2({ width: 2048, height: 2048 }), mimeType: "image/ktx2" });
    basis.json.extensionsUsed = ["KHR_texture_basisu"];
    basis.json.textures = [{ extensions: { KHR_texture_basisu: { source: 0 } } }];
    const ok = run(glbFrom(basis));
    assert.equal(ok.findings.status, "pass", JSON.stringify(ok.findings.list));
    assert.equal(ok.result?.compression.ktx2Basis, true);
    assert.equal(ok.result?.metrics.maxTextureDimension, 2048);
    assert.ok(ok.passes.includes("gltf.ktx2"));

    const undeclared = triangleGltf({ bytes: ktx2({ width: 64, height: 64 }), mimeType: "image/ktx2" });
    assert.ok(run(glbFrom(undeclared)).fails.includes("gltf.images"));

    const gpuOnly = triangleGltf({ bytes: ktx2({ width: 64, height: 64, vkFormat: 37, scheme: 0 }), mimeType: "image/ktx2" });
    gpuOnly.json.extensionsUsed = ["KHR_texture_basisu"];
    assert.ok(run(glbFrom(gpuOnly)).warns.includes("gltf.images"));
  });

  it("requires EXT_texture_webp for WebP textures and rejects mislabelled image bytes", () => {
    const webpTexture = triangleGltf({ bytes: webp(256, 256, { lossless: false }), mimeType: "image/webp" });
    assert.ok(run(glbFrom(webpTexture)).fails.includes("gltf.images"));
    webpTexture.json.extensionsUsed = ["EXT_texture_webp"];
    assert.equal(run(glbFrom(webpTexture)).findings.status, "pass");

    const mislabelled = triangleGltf({ bytes: jpeg(64, 64), mimeType: "image/png" });
    assert.ok(run(glbFrom(mislabelled)).fails.includes("gltf.images"));

    const unsupported = triangleGltf({ bytes: png(8, 8), mimeType: "image/gif" });
    assert.ok(run(glbFrom(unsupported)).fails.includes("gltf.images"));
  });

  it("fails unsupported required extensions but only warns for unsupported optional ones", () => {
    const required = triangleGltf();
    required.json.extensionsUsed = ["VENDOR_magic"];
    required.json.extensionsRequired = ["VENDOR_magic"];
    assert.ok(run(glbFrom(required)).fails.includes("gltf.extensions-required"));

    const optional = triangleGltf();
    optional.json.extensionsUsed = ["VENDOR_magic"];
    const r = run(glbFrom(optional));
    assert.equal(r.findings.status, "warn");
    assert.ok(r.warns.includes("gltf.extensions-used"));
  });

  it("rejects bufferViews that point outside the embedded buffer", () => {
    const broken = triangleGltf();
    (broken.json.bufferViews as Array<Record<string, unknown>>)[0].byteLength = 10_000;
    assert.ok(run(glbFrom(broken)).fails.includes("gltf.buffer-views"));
  });

  it("warns when triangle or texture budgets are exceeded", () => {
    const heavy = triangleGltf({ bytes: png(8192, 8192), mimeType: "image/png" });
    (heavy.json.accessors as Array<Record<string, unknown>>)[0].count = 600_000 * 3;
    const r = run(glbFrom(heavy));
    assert.equal(r.findings.status, "warn");
    assert.ok(r.warns.includes("gltf.triangles"));
    assert.ok(r.warns.includes("gltf.texture-dimensions"));
  });
});
