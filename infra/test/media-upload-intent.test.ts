import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  FORMATS_BY_KIND,
  INGEST_SOURCE_KEY_PATTERN,
  MEDIA_ASSET_FORMATS,
  MEDIA_FORMAT_SPECS,
  SINGLE_PUT_UPLOAD_MAX_BYTES,
  SOURCE_MAX_BYTES,
  UPLOAD_INTENT_QUOTA,
  UPLOAD_INTENT_TTL_SECONDS,
  buildIngestSourceKey,
  checkUploadSource,
} from "../../shared/media-asset";
import { PUBLISHED_CONTENT_TYPES } from "../../shared/media-contract";
import { createIngestUploadSigner, getIngestUploadSigner, readIngestStorageConfig, type UploadSigner } from "../../src/lib/media/ingest-storage";
import {
  UPLOAD_INTENT_FAILURE_MESSAGE,
  canCreateMediaFor,
  handleUploadIntent,
  randomUploadIdentifier,
  type UploadIntentDependencies,
  type UploadedMediaAssetData,
} from "../../src/lib/services/media-upload.service";
import { BYTE_BUDGETS } from "../src/media-budgets";
import { synthMediaApp } from "./helpers";

// ── Test doubles (no database, no AWS, no real credentials) ─────────────────

const USERS: Record<string, { id: string; role: string }> = {
  owner: { id: "owner", role: "USER" },
  other: { id: "other", role: "USER" },
  admin: { id: "admin", role: "ADMIN" },
  agent: { id: "agent", role: "AGENT" },
  builder: { id: "builder", role: "BUILDER" },
};
const PROPERTIES: Record<string, { id: string; ownerId: string }> = {
  "prop-1": { id: "prop-1", ownerId: "owner" },
  "reef-996-dubai-production-city": { id: "reef-996-dubai-production-city", ownerId: "builder" },
};
const PROJECTS: Record<string, { slug: string; published: boolean }> = {
  "reef-996-dubai-production-city": { slug: "reef-996-dubai-production-city", published: true },
  "reef-997-dubai-islands": { slug: "reef-997-dubai-islands", published: false },
};

const MEDIA_ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const UPLOAD_ID = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const NOW = new Date("2026-09-14T12:00:00.000Z");
const SHA256 = createHash("sha256").update("pilot bytes").digest("base64");

interface Harness {
  deps: UploadIntentDependencies;
  created: UploadedMediaAssetData[];
  failed: Array<{ id: string; processingError: string }>;
  signed: Array<Parameters<UploadSigner["sign"]>[0]>;
  logs: string[];
  quotaQueries: Array<{ uploadedById: string; since: Date }>;
}

function harness(options: { signer?: UploadSigner | null; recentIntents?: number; signError?: Error; prepareError?: Error; createError?: Error } = {}): Harness {
  const h: Harness = { created: [], failed: [], signed: [], logs: [], quotaQueries: [], deps: undefined as never };
  const ids = [MEDIA_ID, UPLOAD_ID];
  const fakeSigner: UploadSigner = {
    async prepare() {
      if (options.prepareError) throw options.prepareError;
    },
    async sign(request) {
      h.signed.push(request);
      if (options.signError) throw options.signError;
      return { method: "PUT", url: "https://signed.invalid/upload", headers: { "Content-Type": request.contentType, "x-amz-checksum-sha256": request.sha256 } };
    },
  };
  h.deps = {
    store: {
      findUser: async (id) => USERS[id] ?? null,
      findProperty: async (id) => PROPERTIES[id] ?? null,
      countRecentUploadedIntents: async (uploadedById, since) => {
        h.quotaQueries.push({ uploadedById, since });
        return options.recentIntents ?? 0;
      },
      createUploadedMediaAsset: async (data) => {
        if (options.createError) throw options.createError;
        h.created.push(data);
      },
      markUploadIntentFailed: async (id, processingError) => {
        h.failed.push({ id, processingError });
      },
    },
    getSigner: () => (options.signer === undefined ? fakeSigner : options.signer),
    findProject: (slug) => PROJECTS[slug] ?? null,
    now: () => NOW,
    randomId: () => ids.shift() ?? "ffffffffffffffffffffffffffffffff",
    log: (message, context) => h.logs.push(`${message} ${JSON.stringify(context)}`),
  };
  return h;
}

const propertyBody = (overrides: Record<string, unknown> = {}) => ({
  subjectType: "PROPERTY",
  propertyId: "prop-1",
  kind: "MODEL",
  expectedFormat: "GLB",
  filename: "tower.glb",
  sourceSizeBytes: 1840,
  sourceMimeType: "",
  sha256: SHA256,
  ...overrides,
});
const projectBody = (overrides: Record<string, unknown> = {}) => ({
  subjectType: "PROJECT",
  projectSlug: "reef-996-dubai-production-city",
  kind: "PANORAMA",
  expectedFormat: "EQUIRECT_JPEG",
  filename: "Terrace View.JPEG",
  sourceSizeBytes: 9_000_000,
  sourceMimeType: "image/jpeg",
  sha256: SHA256,
  ...overrides,
});

async function send(h: Harness, body: unknown, caller: string | null = "owner", contentType: string | null = "application/json", contentLength: number | null = null) {
  return handleUploadIntent({ caller: caller === null ? null : { id: caller }, contentType, contentLength, readBody: async () => body }, h.deps);
}

// ── Shared contract ─────────────────────────────────────────────────────────

describe("upload contract (shared/media-asset.ts)", () => {
  it("maps every format to exactly one kind, a key extension and the published content type", () => {
    for (const format of MEDIA_ASSET_FORMATS) {
      const spec = MEDIA_FORMAT_SPECS[format];
      assert.ok(FORMATS_BY_KIND[spec.kind].includes(format), format);
      assert.equal(spec.contentType, PUBLISHED_CONTENT_TYPES[spec.keyExtension], format);
      assert.ok(spec.filenameExtensions.includes(spec.keyExtension), format);
    }
  });

  it("has one budget definition: the pipeline's source ceilings are the application's", () => {
    assert.equal(BYTE_BUDGETS.MODEL.sourceMax, SOURCE_MAX_BYTES.MODEL);
    assert.equal(BYTE_BUDGETS.PANORAMA.sourceMax, SOURCE_MAX_BYTES.PANORAMA);
    assert.equal(BYTE_BUDGETS.SPLAT.sourceMax, SOURCE_MAX_BYTES.SPLAT);
    assert.deepEqual(SOURCE_MAX_BYTES, { MODEL: 250_000_000, PANORAMA: 50_000_000, SPLAT: 80_000_000 });
  });

  it("keeps the single-PUT ceiling well below S3's 5 GiB limit and at or above the smaller kind limits", () => {
    assert.equal(SINGLE_PUT_UPLOAD_MAX_BYTES, 100_000_000);
    assert.ok(SINGLE_PUT_UPLOAD_MAX_BYTES < 5 * 1024 ** 3 / 10);
    assert.ok(SINGLE_PUT_UPLOAD_MAX_BYTES >= SOURCE_MAX_BYTES.PANORAMA && SINGLE_PUT_UPLOAD_MAX_BYTES >= SOURCE_MAX_BYTES.SPLAT);
    assert.ok(SINGLE_PUT_UPLOAD_MAX_BYTES < SOURCE_MAX_BYTES.MODEL, "large models need the multipart follow-up");
  });

  it("builds only uploads/{mediaId}/{uploadId}/source.{ext} keys from server-generated ids", () => {
    assert.equal(buildIngestSourceKey(MEDIA_ID, UPLOAD_ID, "EQUIRECT_JPEG"), `uploads/${MEDIA_ID}/${UPLOAD_ID}/source.jpg`);
    assert.match(buildIngestSourceKey(MEDIA_ID, UPLOAD_ID, "SOG"), INGEST_SOURCE_KEY_PATTERN);
    for (const [mediaId, uploadId] of [["../x", UPLOAD_ID], [MEDIA_ID, "a/b"], ["UPPER1234", UPLOAD_ID], [MEDIA_ID, "short"]]) {
      assert.throws(() => buildIngestSourceKey(mediaId, uploadId, "GLB"));
    }
    const id = randomUploadIdentifier();
    assert.match(id, /^[a-f0-9]{32}$/);
    assert.notEqual(id, randomUploadIdentifier());
  });

  it("rejects kind/format, extension, MIME and size mismatches with the right status", () => {
    const base = { kind: "MODEL", expectedFormat: "GLB", filename: "a.glb", sourceSizeBytes: 10 } as const;
    assert.deepEqual(checkUploadSource(base), { ok: true, contentType: "model/gltf-binary" });
    const cases: Array<[Partial<Parameters<typeof checkUploadSource>[0]>, number]> = [
      [{ expectedFormat: "SOG" }, 400],
      [{ kind: "PANORAMA" }, 400],
      [{ filename: "a.gltf" }, 400],
      [{ filename: "glb" }, 400],
      [{ filename: ".glb" }, 400],
      [{ sourceMimeType: "text/html" }, 400],
      [{ sourceSizeBytes: 0 }, 400],
      [{ sourceSizeBytes: 1.5 }, 400],
      [{ sourceSizeBytes: SOURCE_MAX_BYTES.MODEL + 1 }, 413],
      [{ sourceSizeBytes: SINGLE_PUT_UPLOAD_MAX_BYTES + 1 }, 413],
    ];
    for (const [override, status] of cases) {
      const result = checkUploadSource({ ...base, ...override });
      assert.equal(result.ok ? 200 : result.status, status, JSON.stringify(override));
    }
    assert.equal(checkUploadSource({ ...base, kind: "PANORAMA", expectedFormat: "EQUIRECT_WEBP", filename: "a.webp", sourceMimeType: "" }).ok, false, "empty MIME only tolerated for GLB/SOG");
    assert.equal(checkUploadSource({ ...base, sourceMimeType: "application/octet-stream" }).ok, true);
    assert.equal(checkUploadSource({ ...base, kind: "SPLAT", expectedFormat: "SOG", filename: "a.SOG", sourceMimeType: "application/zip" }).ok, true);
  });
});

// ── Authentication and authorization ────────────────────────────────────────

describe("upload intent: authentication", () => {
  it("unauthenticated → 401, before reading the body or touching the store", async () => {
    const h = harness();
    let read = false;
    const result = await handleUploadIntent({ caller: null, contentType: "application/json", contentLength: null, readBody: async () => ((read = true), propertyBody()) }, h.deps);
    assert.equal(result.status, 401);
    assert.equal(read, false);
    assert.equal(h.created.length, 0);
  });

  it("authenticated but deleted user → 401", async () => {
    const h = harness();
    assert.equal((await send(h, propertyBody(), "deleted-user")).status, 401);
    assert.equal(h.created.length, 0);
  });

  it("uses the database role, not the token: the caller object carries only an id", async () => {
    const h = harness();
    // "other" might hold an ADMIN claim in a stale token; the store says USER.
    const result = await handleUploadIntent(
      { caller: { id: "other", role: "ADMIN" } as { id: string }, contentType: "application/json", contentLength: null, readBody: async () => projectBody() },
      h.deps,
    );
    assert.equal(result.status, 403);
  });
});

describe("upload intent: PROPERTY authorization", () => {
  it("owner → 201", async () => assert.equal((await send(harness(), propertyBody(), "owner")).status, 201));
  it("ADMIN → 201", async () => assert.equal((await send(harness(), propertyBody(), "admin")).status, 201));
  it("another user → 403", async () => {
    const h = harness();
    assert.equal((await send(h, propertyBody(), "other")).status, 403);
    assert.equal(h.created.length + h.signed.length, 0);
  });
  it("AGENT/BUILDER who do not own it → 403", async () => {
    assert.equal((await send(harness(), propertyBody(), "agent")).status, 403);
    assert.equal((await send(harness(), propertyBody(), "builder")).status, 403);
  });
  it("missing property → 404", async () => {
    const h = harness();
    assert.equal((await send(h, propertyBody({ propertyId: "does-not-exist" }), "admin")).status, 404);
    assert.equal(h.created.length, 0);
  });
  it("matches the rule in canCreateMediaFor", () => {
    assert.equal(canCreateMediaFor(USERS.owner, { type: "PROPERTY", ownerId: "owner" }), true);
    assert.equal(canCreateMediaFor(USERS.other, { type: "PROPERTY", ownerId: "owner" }), false);
    assert.equal(canCreateMediaFor(USERS.admin, { type: "PROPERTY", ownerId: "owner" }), true);
  });
});

describe("upload intent: PROJECT authorization", () => {
  it("ADMIN → 201", async () => assert.equal((await send(harness(), projectBody(), "admin")).status, 201));
  for (const role of ["owner", "agent", "builder"]) {
    it(`${USERS[role].role} → 403`, async () => {
      const h = harness();
      assert.equal((await send(h, projectBody(), role)).status, 403);
      assert.equal(h.created.length + h.signed.length, 0);
    });
  }
  it("BUILDER who owns the same-slug Property row still cannot upload to the PROJECT", async () => {
    assert.equal((await send(harness(), propertyBody({ propertyId: "reef-996-dubai-production-city" }), "builder")).status, 201);
    assert.equal((await send(harness(), projectBody(), "builder")).status, 403);
  });
  it("missing project → 404", async () => assert.equal((await send(harness(), projectBody({ projectSlug: "reef-999" }), "admin")).status, 404));
  it("unpublished existing project + ADMIN → 201", async () => {
    const h = harness();
    assert.equal((await send(h, projectBody({ projectSlug: "reef-997-dubai-islands" }), "admin")).status, 201);
    assert.equal(h.created[0]?.projectSlug, "reef-997-dubai-islands");
  });
});

// ── Input validation ────────────────────────────────────────────────────────

describe("upload intent: input validation", () => {
  const expect400 = async (body: unknown, label: string) => {
    const h = harness();
    const result = await send(h, body, "admin");
    assert.equal(result.status, 400, label);
    assert.equal(h.created.length + h.signed.length, 0, label);
  };

  it("requires Content-Type: application/json", async () => {
    assert.equal((await send(harness(), propertyBody(), "owner", "text/plain")).status, 415);
    assert.equal((await send(harness(), propertyBody(), "owner", null)).status, 415);
    assert.equal((await send(harness(), propertyBody(), "owner", "multipart/form-data; boundary=x")).status, 415);
    assert.equal((await send(harness(), propertyBody(), "owner", "application/json; charset=utf-8")).status, 201);
  });

  it("rejects oversized request bodies and invalid JSON", async () => {
    assert.equal((await send(harness(), propertyBody(), "owner", "application/json", 16_001)).status, 413);
    const h = harness();
    const result = await handleUploadIntent({ caller: { id: "owner" }, contentType: "application/json", contentLength: 10, readBody: async () => { throw new SyntaxError("bad json"); } }, h.deps);
    assert.equal(result.status, 400);
  });

  it("unknown field → 400", () => expect400(propertyBody({ sortOrder: 1 }), "sortOrder"));
  it("wrong subject identifier → 400", async () => {
    await expect400({ ...propertyBody(), propertyId: undefined, projectSlug: "reef-996-dubai-production-city" }, "PROPERTY with projectSlug");
    await expect400({ ...projectBody(), projectSlug: undefined, propertyId: "prop-1" }, "PROJECT with propertyId");
  });
  it("both identifiers → 400", async () => {
    await expect400(propertyBody({ projectSlug: "reef-996-dubai-production-city" }), "PROPERTY");
    await expect400(projectBody({ propertyId: "prop-1" }), "PROJECT");
  });
  it("neither identifier → 400", async () => {
    await expect400({ ...propertyBody(), propertyId: undefined }, "PROPERTY");
    await expect400({ ...projectBody(), projectSlug: undefined }, "PROJECT");
    await expect400(propertyBody({ subjectType: "LISTING" }), "unknown subject type");
  });
  it("invalid kind/format → 400", async () => {
    await expect400(propertyBody({ kind: "TEXTURE" }), "unknown kind");
    await expect400(propertyBody({ expectedFormat: "KTX2" }), "unknown format");
    await expect400(propertyBody({ expectedFormat: "SOG", filename: "a.sog" }), "MODEL + SOG");
  });
  it("wrong filename extension → 400", async () => {
    await expect400(propertyBody({ filename: "tower.gltf" }), ".gltf");
    await expect400(propertyBody({ filename: "tower.glb.exe" }), ".exe");
    await expect400(propertyBody({ filename: "../../published/m/x.glb" }), "path separators");
    await expect400(propertyBody({ filename: "a\u0000.glb" }), "control character");
    await expect400(propertyBody({ filename: `${"a".repeat(252)}.glb` }), "too long");
  });
  it("oversized source → 413", async () => {
    assert.equal((await send(harness(), propertyBody({ sourceSizeBytes: SOURCE_MAX_BYTES.MODEL + 1 }))).status, 413);
    const tooBigForPut = await send(harness(), propertyBody({ sourceSizeBytes: SINGLE_PUT_UPLOAD_MAX_BYTES + 1 }));
    assert.equal(tooBigForPut.status, 413);
    assert.match(String(tooBigForPut.body.error), /not supported yet/);
    await expect400(propertyBody({ sourceSizeBytes: 0 }), "zero");
    await expect400(propertyBody({ sourceSizeBytes: -5 }), "negative");
    await expect400(propertyBody({ sourceSizeBytes: "1840" }), "string");
  });
  it("invalid MIME combination → 400", async () => {
    await expect400(propertyBody({ sourceMimeType: "image/jpeg" }), "GLB as jpeg");
    await expect400(projectBody({ sourceMimeType: "application/octet-stream" }), "JPEG as octet-stream");
  });
  it("missing sha256 → 400", async () => {
    await expect400({ ...propertyBody(), sha256: undefined }, "PROPERTY without sha256");
    await expect400({ ...projectBody(), sha256: undefined }, "PROJECT without sha256");
    await expect400(propertyBody({ sha256: "" }), "empty sha256");
    await expect400(propertyBody({ sha256: null }), "null sha256");
  });
  it("malformed sha256 → 400", async () => {
    await expect400(propertyBody({ sha256: "not-a-hash" }), "garbage");
    await expect400(propertyBody({ sha256: createHash("sha256").update("x").digest("hex") }), "hex instead of base64");
    await expect400(propertyBody({ sha256: createHash("sha1").update("x").digest("base64") }), "wrong digest length");
    await expect400(propertyBody({ sha256: createHash("sha512").update("x").digest("base64") }), "sha512");
    await expect400(propertyBody({ sha256: SHA256.replace(/=$/, "") }), "unpadded");
  });
  it("bounds title and altText", async () => {
    await expect400(propertyBody({ title: "x".repeat(151) }), "title");
    await expect400(propertyBody({ altText: "x".repeat(501) }), "altText");
    await expect400(propertyBody({ title: "   " }), "blank title");
  });
});

describe("upload intent: client cannot choose security-sensitive values", () => {
  const forbidden: Record<string, unknown> = {
    uploadedById: "admin",
    userId: "admin",
    ownerId: "owner",
    reviewedById: "admin",
    id: MEDIA_ID,
    mediaAssetId: MEDIA_ID,
    uploadId: UPLOAD_ID,
    key: "published/m/x/scene.glb",
    objectKey: "uploads/x/y/source.glb",
    sourceKey: "uploads/x/y/source.glb",
    storageKey: "m/x/y",
    bucket: "aarvasa-media-dev-published-149465616428-ap-south-1",
    prefix: "m/",
    path: "originals/",
    cdnUrl: "https://d1l4p1pty829ds.cloudfront.net/m/x/scene.glb",
    status: "PUBLISHED",
    contentType: "text/html",
  };
  for (const [field, value] of Object.entries(forbidden)) {
    it(`rejects ${field}`, async () => {
      const h = harness();
      assert.equal((await send(h, propertyBody({ [field]: value }), "admin")).status, 400);
      assert.equal(h.created.length + h.signed.length, 0);
    });
  }
});

// ── Row creation, signing and failure handling ──────────────────────────────

describe("upload intent: MediaAsset row and response", () => {
  it("creates one UPLOADED row with server-derived identity, key, MIME and uploader, and nothing processed", async () => {
    const h = harness();
    const result = await send(h, propertyBody({ filename: "published m originals uploads x.GLB", title: " Tower ", altText: "Massing model" }), "owner");
    assert.equal(result.status, 201);
    assert.deepEqual(h.created, [
      {
        id: MEDIA_ID,
        subjectType: "PROPERTY",
        propertyId: "prop-1",
        projectSlug: null,
        kind: "MODEL",
        status: "UPLOADED",
        sourceKey: `uploads/${MEDIA_ID}/${UPLOAD_ID}/source.glb`,
        sourceSizeBytes: 1840,
        sourceMimeType: "model/gltf-binary",
        uploadedById: "owner",
        title: "Tower",
        altText: "Massing model",
      },
    ]);
    const row = h.created[0] as unknown as Record<string, unknown>;
    for (const field of ["format", "storageKey", "entryFile", "contentHash", "mimeType", "sizeBytes", "fileCount", "posterKey", "dimensions", "metrics", "viewDefaults", "reviewedById", "reviewedAt", "publishedAt", "rejectionReason", "processingError", "processorVersion", "sortOrder"]) {
      assert.ok(!(field in row), `${field} is never written at intent time`);
    }
  });

  it("uses the server MIME type, not the client's, and never puts the filename in the key", async () => {
    const h = harness();
    await send(h, projectBody({ filename: "uploads-admin-override.jpeg", sourceMimeType: "image/jpeg" }), "admin");
    assert.equal(h.created[0]?.sourceMimeType, "image/jpeg");
    assert.equal(h.created[0]?.sourceKey, `uploads/${MEDIA_ID}/${UPLOAD_ID}/source.jpg`);
    const glb = harness();
    await send(glb, propertyBody({ sourceMimeType: "application/octet-stream" }), "owner");
    assert.equal(glb.created[0]?.sourceMimeType, "model/gltf-binary");
  });

  it("signs exactly the generated key, canonical type, exact length, required checksum and short expiry", async () => {
    const h = harness();
    await send(h, propertyBody({ sourceMimeType: "application/octet-stream" }), "owner");
    assert.deepEqual(h.signed, [
      { key: `uploads/${MEDIA_ID}/${UPLOAD_ID}/source.glb`, contentType: "model/gltf-binary", contentLength: 1840, sha256: SHA256, expiresInSeconds: UPLOAD_INTENT_TTL_SECONDS },
    ]);
    assert.ok(UPLOAD_INTENT_TTL_SECONDS <= 15 * 60);
  });

  it("returns only what the browser needs", async () => {
    const result = await send(harness(), propertyBody(), "owner");
    const data = (result.body as { data: Record<string, unknown> }).data;
    assert.deepEqual(Object.keys(data).sort(), ["mediaAssetId", "objectKey", "status", "upload", "uploadId"]);
    assert.deepEqual(Object.keys(data.upload as object).sort(), ["contentLength", "expiresAt", "headers", "method", "url"]);
    assert.equal((data.upload as { expiresAt: string }).expiresAt, new Date(NOW.getTime() + UPLOAD_INTENT_TTL_SECONDS * 1000).toISOString());
    assert.doesNotMatch(JSON.stringify(result.body), /cloudfront|aarvasa-media-dev|secret|credential/i);
  });

  it("applies the outstanding-intent guard per uploader", async () => {
    const h = harness({ recentIntents: UPLOAD_INTENT_QUOTA.maxRecent });
    assert.equal((await send(h, propertyBody(), "owner")).status, 429);
    assert.equal(h.created.length, 0);
    assert.deepEqual(h.quotaQueries, [{ uploadedById: "owner", since: new Date(NOW.getTime() - UPLOAD_INTENT_QUOTA.windowSeconds * 1000) }]);
    assert.equal((await send(harness({ recentIntents: UPLOAD_INTENT_QUOTA.maxRecent - 1 }), propertyBody(), "owner")).status, 201);
  });

  it("missing AWS configuration fails closed with 503 and no row", async () => {
    const h = harness({ signer: null });
    const result = await send(h, propertyBody(), "owner");
    assert.equal(result.status, 503);
    assert.equal(h.created.length, 0);
  });

  it("unavailable credentials fail closed with 503 and no row", async () => {
    const h = harness({ prepareError: Object.assign(new Error("Could not load credentials from any providers"), { name: "CredentialsProviderError" }) });
    const result = await send(h, propertyBody(), "owner");
    assert.equal(result.status, 503);
    assert.equal(h.created.length, 0);
    assert.doesNotMatch(JSON.stringify(result.body), /credentials|provider/i);
  });

  it("signing failure after the row exists marks it FAILED and hides the AWS error", async () => {
    const awsError = Object.assign(new Error("AccessDenied: arn:aws:iam::123456789012:user/x is not authorized"), { name: "AccessDenied" });
    const h = harness({ signError: awsError });
    const result = await send(h, propertyBody(), "owner");
    assert.equal(result.status, 502);
    assert.deepEqual(result.body, { success: false, error: UPLOAD_INTENT_FAILURE_MESSAGE });
    assert.deepEqual(h.failed, [{ id: MEDIA_ID, processingError: "Upload authorization could not be created" }]);
    assert.ok(h.logs.some((line) => line.includes("AccessDenied") && line.includes(MEDIA_ID)));
    assert.ok(h.logs.every((line) => !line.includes("arn:aws") && !line.includes("https://")), "logs carry the error name only");
  });

  it("database failure creating the row → 500, nothing signed", async () => {
    const h = harness({ createError: new Error("P2003 foreign key") });
    const result = await send(h, propertyBody(), "owner");
    assert.equal(result.status, 500);
    assert.equal(h.signed.length, 0);
    assert.doesNotMatch(JSON.stringify(result.body), /P2003/);
  });
});

// ── Real SDK signing, offline, with obviously fake credentials ──────────────

describe("ingest upload signer (AWS SDK presigned PUT, offline)", () => {
  const config = { region: "ap-south-1", bucket: "example-ingest-bucket" };
  const credentials = { accessKeyId: "TESTONLYACCESSKEYID", secretAccessKey: "test-only-secret-not-a-real-key" };
  const key = `uploads/${MEDIA_ID}/${UPLOAD_ID}/source.glb`;

  it("binds bucket, region, exact key, content type, content length and checksum (as a header), with a short expiry", async () => {
    const signer = createIngestUploadSigner(config, { credentials });
    await signer.prepare();
    const signed = await signer.sign({ key, contentType: "model/gltf-binary", contentLength: 1840, sha256: SHA256, expiresInSeconds: UPLOAD_INTENT_TTL_SECONDS });
    const url = new URL(signed.url);
    assert.equal(signed.method, "PUT");
    assert.equal(url.protocol, "https:");
    assert.equal(url.host, "example-ingest-bucket.s3.ap-south-1.amazonaws.com");
    assert.equal(decodeURIComponent(url.pathname), `/${key}`);
    assert.equal(url.searchParams.get("X-Amz-Expires"), String(UPLOAD_INTENT_TTL_SECONDS));
    assert.match(url.searchParams.get("X-Amz-Credential") ?? "", /\/ap-south-1\/s3\/aws4_request$/);
    assert.deepEqual((url.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";").sort(), ["content-length", "content-type", "host", "x-amz-checksum-sha256"]);
    assert.ok(![...url.searchParams.keys()].some((name) => /checksum/i.test(name)), "no hoisted or SDK-default checksum parameters");
    assert.deepEqual(signed.headers, { "Content-Type": "model/gltf-binary", "x-amz-checksum-sha256": SHA256 });
  });

  it("refuses to sign without a checksum", async () => {
    const signer = createIngestUploadSigner(config, { credentials });
    const withoutChecksum = { key, contentType: "model/gltf-binary", contentLength: 7, expiresInSeconds: 60 } as unknown as Parameters<UploadSigner["sign"]>[0];
    await assert.rejects(signer.sign(withoutChecksum), /SHA-256/);
    await assert.rejects(signer.sign({ ...withoutChecksum, sha256: "" }), /SHA-256/);
  });

  it("refuses keys outside the ingest source layout, bad lengths and long expiries", async () => {
    const signer = createIngestUploadSigner(config, { credentials });
    const ok = { key, contentType: "model/gltf-binary", contentLength: 1, sha256: SHA256, expiresInSeconds: 60 };
    for (const bad of [
      { key: "published/m/x/scene.glb" },
      { key: "m/abcdefgh/0123456789abcdef/scene.glb" },
      { key: `uploads/${MEDIA_ID}/${UPLOAD_ID}/../../x.glb` },
      { key: `uploads/${MEDIA_ID}/${UPLOAD_ID}/source.html` },
      { contentLength: 0 },
      { expiresInSeconds: UPLOAD_INTENT_TTL_SECONDS + 1 },
      { sha256: "abc" },
    ]) {
      await assert.rejects(signer.sign({ ...ok, ...bad }), JSON.stringify(bad));
    }
  });

  it("reads bucket and region only from configuration and fails closed when missing or malformed", () => {
    assert.deepEqual(readIngestStorageConfig({ MEDIA_REGION: "ap-south-1", MEDIA_INGEST_BUCKET: "example-ingest-bucket" }), config);
    for (const env of [{}, { MEDIA_REGION: "ap-south-1" }, { MEDIA_INGEST_BUCKET: "example-ingest-bucket" }, { MEDIA_REGION: " ", MEDIA_INGEST_BUCKET: "b" }, { MEDIA_REGION: "ap-south-1", MEDIA_INGEST_BUCKET: "Bad_Bucket" }, { MEDIA_REGION: "https://evil", MEDIA_INGEST_BUCKET: "example-ingest-bucket" }]) {
      assert.equal(readIngestStorageConfig(env), null, JSON.stringify(env));
      assert.equal(getIngestUploadSigner(env), null);
    }
    assert.ok(getIngestUploadSigner({ MEDIA_REGION: "ap-south-1", MEDIA_INGEST_BUCKET: "example-ingest-bucket" }));
  });

  it("only asks the browser for headers the deployed ingest CORS rule allows", async () => {
    const { templates } = synthMediaApp();
    const buckets = templates.storage.findResources("AWS::S3::Bucket");
    const ingest = Object.values(buckets).find((b) => JSON.stringify(b).includes("browser-direct-uploads")) as { Properties: { CorsConfiguration: { CorsRules: Array<{ AllowedHeaders: string[]; AllowedMethods: string[] }> } } };
    const rule = ingest.Properties.CorsConfiguration.CorsRules[0];
    assert.ok(rule.AllowedMethods.includes("PUT"));
    const signed = await createIngestUploadSigner(config, { credentials }).sign({ key, contentType: "model/gltf-binary", contentLength: 1, sha256: SHA256, expiresInSeconds: 60 });
    for (const header of Object.keys(signed.headers)) assert.ok(rule.AllowedHeaders.map((h) => h.toLowerCase()).includes(header.toLowerCase()), header);
  });
});
