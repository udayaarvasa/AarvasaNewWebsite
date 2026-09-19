import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import {
  COMPLETED_UPLOAD_STATUSES,
  INGEST_SERVER_SIDE_ENCRYPTION,
  NOT_COMPLETABLE_STATUSES,
  UPLOAD_COMPLETION_GRACE_SECONDS,
  UPLOAD_INTENT_QUOTA,
  UPLOAD_INTENT_TTL_SECONDS,
  checkCompletableSource,
  uploadCompletionDeadline,
  verifyIngestObject,
  type CompletableSource,
  type IngestObjectHead,
  type MediaAssetStatus,
} from "../../shared/media-asset";
import {
  createIngestObjectInspector,
  getIngestObjectInspector,
  getIngestUploadSigner,
  type IngestObjectInspection,
  type IngestObjectInspector,
} from "../../src/lib/media/ingest-storage";
import {
  COMPLETION_PROCESSING_ERRORS,
  UPLOAD_COMPLETION_MAX_BODY_BYTES,
  canCompleteUpload,
  handleUploadCompletion,
  type CompletionAuthorization,
  type CompletionMediaAsset,
  type UploadCompletionDependencies,
  type UploadCompletionResult,
  type VerifiedSource,
} from "../../src/lib/services/media-completion.service";
import { handleUploadIntent, type UploadIntentDependencies } from "../../src/lib/services/media-upload.service";

// ── Test doubles (no database, no AWS, no real credentials) ─────────────────

const USERS: Record<string, { id: string; role: string }> = {
  owner: { id: "owner", role: "USER" },
  other: { id: "other", role: "USER" },
  admin: { id: "admin", role: "ADMIN" },
  agent: { id: "agent", role: "AGENT" },
  builder: { id: "builder", role: "BUILDER" },
};

const MEDIA_ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const OTHER_MEDIA_ID = "ffeeddccbbaa99887766554433221100";
const UPLOAD_ID = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const KEY = `uploads/${MEDIA_ID}/${UPLOAD_ID}/source.glb`;
const SHA256 = createHash("sha256").update("pilot bytes").digest("base64");
const OTHER_SHA256 = createHash("sha256").update("other bytes").digest("base64");
const CREATED = new Date("2026-09-14T12:00:00.000Z");
const WITHIN_GRACE = new Date(CREATED.getTime() + 5 * 60 * 1000);
const AFTER_GRACE = new Date(uploadCompletionDeadline(CREATED).getTime() + 1);

const uploadedAsset = (overrides: Partial<CompletionMediaAsset> = {}): CompletionMediaAsset => ({
  id: MEDIA_ID,
  subjectType: "PROPERTY",
  propertyId: "prop-1",
  projectSlug: null,
  kind: "MODEL",
  status: "UPLOADED",
  sourceKey: KEY,
  sourceSizeBytes: 1840,
  sourceMimeType: "model/gltf-binary",
  sourceChecksumSha256: SHA256,
  uploadedById: "owner",
  createdAt: CREATED,
  ...overrides,
});

const projectAsset = (overrides: Partial<CompletionMediaAsset> = {}) =>
  uploadedAsset({
    subjectType: "PROJECT",
    propertyId: null,
    projectSlug: "reef-996-dubai-production-city",
    kind: "PANORAMA",
    sourceKey: `uploads/${MEDIA_ID}/${UPLOAD_ID}/source.jpg`,
    sourceMimeType: "image/jpeg",
    uploadedById: "admin",
    ...overrides,
  });

const goodHead = (overrides: Partial<IngestObjectHead> = {}): IngestObjectHead => ({
  contentLength: 1840,
  contentType: "model/gltf-binary",
  checksumSha256: SHA256,
  checksumType: "FULL_OBJECT",
  serverSideEncryption: "AES256",
  ...overrides,
});

interface HarnessOptions {
  asset?: CompletionMediaAsset | null;
  properties?: Record<string, { ownerId: string }>;
  inspection?: IngestObjectInspection | (() => IngestObjectInspection);
  inspector?: null;
  inspectError?: Error;
  now?: Date;
  transitionError?: Error;
  /** Runs once, right before the conditional update is evaluated (simulates a concurrent change). */
  beforeUpdate?: (h: Harness) => void;
}

interface Harness {
  deps: UploadCompletionDependencies;
  rows: Map<string, CompletionMediaAsset & { processingError?: string | null }>;
  properties: Record<string, { ownerId: string }>;
  users: Record<string, { id: string; role: string }>;
  inspected: string[];
  updates: Array<{ kind: "processing" | "failed"; id: string; verified?: VerifiedSource; processingError?: string; authorization: CompletionAuthorization }>;
  logs: string[];
  storeCalls: string[];
}

function harness(options: HarnessOptions = {}): Harness {
  const h: Harness = {
    rows: new Map(),
    properties: options.properties ?? { "prop-1": { ownerId: "owner" } },
    users: { ...USERS },
    inspected: [],
    updates: [],
    logs: [],
    storeCalls: [],
    deps: undefined as never,
  };
  const asset = options.asset === undefined ? uploadedAsset() : options.asset;
  if (asset) h.rows.set(asset.id, { ...asset });
  let beforeUpdate = options.beforeUpdate;

  // Mirrors the Prisma store's predicates exactly (media-completion.store.ts).
  const authorized = (row: CompletionMediaAsset, authorization: CompletionAuthorization) =>
    authorization.admin ||
    (row.subjectType === "PROPERTY" && row.uploadedById === authorization.userId && h.properties[row.propertyId ?? ""]?.ownerId === authorization.userId);

  const inspector: IngestObjectInspector = {
    async inspect(key) {
      h.inspected.push(key);
      if (options.inspectError) throw options.inspectError;
      const i = options.inspection ?? { status: "FOUND", head: goodHead() };
      return typeof i === "function" ? i() : i;
    },
  };

  h.deps = {
    store: {
      findUser: async (id) => {
        h.storeCalls.push("findUser");
        return h.users[id] ?? null;
      },
      findMediaAsset: async (id) => {
        h.storeCalls.push("findMediaAsset");
        const row = h.rows.get(id);
        return row ? { ...row } : null;
      },
      findPropertyOwner: async (id) => {
        h.storeCalls.push("findPropertyOwner");
        return h.properties[id] ?? null;
      },
      transitionToProcessing: async (id, verified, authorization) => {
        h.updates.push({ kind: "processing", id, verified, authorization });
        beforeUpdate?.(h);
        beforeUpdate = undefined;
        if (options.transitionError) throw options.transitionError;
        const row = h.rows.get(id);
        if (
          !row ||
          row.status !== "UPLOADED" ||
          row.sourceKey !== verified.sourceKey ||
          row.sourceSizeBytes !== verified.sourceSizeBytes ||
          row.sourceMimeType !== verified.sourceMimeType ||
          row.sourceChecksumSha256 !== verified.sourceChecksumSha256 ||
          !authorized(row, authorization)
        ) {
          return 0;
        }
        h.rows.set(id, { ...row, status: "PROCESSING", processingError: null });
        return 1;
      },
      markFailed: async (id, sourceKey, processingError, authorization) => {
        h.updates.push({ kind: "failed", id, processingError, authorization });
        beforeUpdate?.(h);
        beforeUpdate = undefined;
        const row = h.rows.get(id);
        if (!row || row.status !== "UPLOADED" || row.sourceKey !== sourceKey || !authorized(row, authorization)) return 0;
        h.rows.set(id, { ...row, status: "FAILED", processingError });
        return 1;
      },
    },
    getInspector: () => (options.inspector === null ? null : inspector),
    projectExists: (slug) => ["reef-996-dubai-production-city", "reef-997-dubai-islands"].includes(slug),
    now: () => options.now ?? WITHIN_GRACE,
    log: (message, context) => h.logs.push(`${message} ${JSON.stringify(context)}`),
  };
  return h;
}

async function complete(
  h: Harness,
  caller: string | null = "owner",
  { mediaAssetId = MEDIA_ID, body = {}, contentType = "application/json" as string | null, contentLength = 2 as number | null, bodyError = undefined as Error | undefined } = {},
): Promise<UploadCompletionResult> {
  return handleUploadCompletion(
    {
      caller: caller === null ? null : { id: caller },
      mediaAssetId,
      contentType,
      contentLength,
      readBody: async () => {
        if (bodyError) throw bodyError;
        return body;
      },
    },
    h.deps,
  );
}

const codeOf = (r: UploadCompletionResult) => (r.body as { code?: string }).code;
const dataOf = (r: UploadCompletionResult) => (r.body as { data: { mediaAssetId: string; status: string; transitioned: boolean } }).data;
const statusOf = (h: Harness) => h.rows.get(MEDIA_ID)?.status;

// ── Authentication and request shape ───────────────────────────────────────

describe("upload completion: authentication", () => {
  it("unauthenticated → 401 before reading the body or touching the store or S3", async () => {
    const h = harness();
    let read = false;
    const result = await handleUploadCompletion({ caller: null, mediaAssetId: MEDIA_ID, contentType: "application/json", contentLength: 2, readBody: async () => ((read = true), {}) }, h.deps);
    assert.equal(result.status, 401);
    assert.equal(codeOf(result), "UNAUTHORIZED");
    assert.equal(read, false);
    assert.deepEqual(h.storeCalls, []);
    assert.deepEqual(h.inspected, []);
  });

  it("deleted user → 401", async () => {
    const h = harness();
    assert.equal((await complete(h, "deleted-user")).status, 401);
    assert.deepEqual(h.inspected, []);
    assert.equal(statusOf(h), "UPLOADED");
  });

  it("ignores the token's role: an ADMIN claim on a USER account is not an admin", async () => {
    const h = harness({ asset: projectAsset() });
    const result = await handleUploadCompletion(
      { caller: { id: "other", role: "ADMIN" } as { id: string }, mediaAssetId: MEDIA_ID, contentType: "application/json", contentLength: 2, readBody: async () => ({}) },
      h.deps,
    );
    assert.equal(result.status, 404);
    assert.deepEqual(h.inspected, []);
  });
});

describe("upload completion: request", () => {
  const rejected = async (label: string, status: number, code: string, args: Parameters<typeof complete>[2]) => {
    const h = harness();
    const result = await complete(h, "owner", args);
    assert.equal(result.status, status, label);
    assert.equal(codeOf(result), code, label);
    assert.deepEqual(h.inspected, [], label);
    assert.equal(h.updates.length, 0, label);
  };

  it("requires Content-Type: application/json", async () => {
    await rejected("text/plain", 415, "UNSUPPORTED_MEDIA_TYPE", { contentType: "text/plain" });
    await rejected("missing", 415, "UNSUPPORTED_MEDIA_TYPE", { contentType: null });
    await rejected("form", 415, "UNSUPPORTED_MEDIA_TYPE", { contentType: "application/x-www-form-urlencoded" });
    assert.equal((await complete(harness(), "owner", { contentType: "application/json; charset=utf-8" })).status, 200);
  });

  it("rejects oversized bodies", async () => {
    await rejected("oversized", 413, "BODY_TOO_LARGE", { contentLength: UPLOAD_COMPLETION_MAX_BODY_BYTES + 1 });
  });

  it("rejects invalid JSON and anything but {}", async () => {
    await rejected("invalid JSON", 400, "INVALID_BODY", { bodyError: new SyntaxError("Unexpected end of JSON input") });
    for (const body of [null, [], "", 0, "{}", { a: 1 }]) await rejected(JSON.stringify(body), 400, "INVALID_BODY", { body: body as never });
  });

  it("rejects every client-supplied value the server owns", async () => {
    const forbidden: Record<string, unknown> = {
      uploadId: UPLOAD_ID,
      sourceKey: `uploads/${OTHER_MEDIA_ID}/${UPLOAD_ID}/source.glb`,
      key: "published/m/x/scene.glb",
      checksum: SHA256,
      sha256: SHA256,
      sourceChecksumSha256: OTHER_SHA256,
      size: 1,
      sourceSizeBytes: 1,
      mimeType: "text/html",
      sourceMimeType: "text/html",
      status: "PROCESSING",
      format: "GLB",
      subjectType: "PROJECT",
      propertyId: "prop-1",
      projectSlug: "reef-996-dubai-production-city",
      mediaAssetId: OTHER_MEDIA_ID,
    };
    for (const [field, value] of Object.entries(forbidden)) await rejected(field, 400, "INVALID_BODY", { body: { [field]: value } as never });
  });

  it("malformed mediaAssetId → 404 without an asset lookup", async () => {
    for (const mediaAssetId of ["", "upload-intent", "../x", "UPPERCASE1234", "a".repeat(41), "abc", `${MEDIA_ID}/../${OTHER_MEDIA_ID}`]) {
      const h = harness();
      const result = await complete(h, "owner", { mediaAssetId });
      assert.equal(result.status, 404, mediaAssetId);
      assert.ok(!h.storeCalls.includes("findMediaAsset"), mediaAssetId);
    }
  });

  it("unknown mediaAssetId → 404, indistinguishable from a forbidden one", async () => {
    const unknown = await complete(harness(), "owner", { mediaAssetId: OTHER_MEDIA_ID });
    const forbidden = await complete(harness(), "other");
    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown, forbidden);
  });
});

// ── Authorization ───────────────────────────────────────────────────────────

describe("upload completion: PROPERTY authorization", () => {
  it("current owner who is also the uploader → 200", async () => {
    const h = harness();
    const result = await complete(h, "owner");
    assert.equal(result.status, 200);
    assert.deepEqual(h.updates[0]?.authorization, { admin: false, userId: "owner" });
  });

  it("ADMIN → 200, for an asset someone else uploaded", async () => {
    const h = harness();
    assert.equal((await complete(h, "admin")).status, 200);
    assert.deepEqual(h.updates[0]?.authorization, { admin: true });
  });

  it("current owner who did not upload it → 404", async () => {
    const h = harness({ asset: uploadedAsset({ uploadedById: "admin" }) });
    assert.equal((await complete(h, "owner")).status, 404);
    assert.deepEqual(h.inspected, []);
  });

  it("uploader who no longer owns the property → 404", async () => {
    const h = harness({ properties: { "prop-1": { ownerId: "other" } } });
    assert.equal((await complete(h, "owner")).status, 404);
    assert.deepEqual(h.inspected, []);
    assert.equal(statusOf(h), "UPLOADED");
  });

  it("uploader whose account was deleted (uploadedById null): owner 404, ADMIN 200", async () => {
    assert.equal((await complete(harness({ asset: uploadedAsset({ uploadedById: null }) }), "owner")).status, 404);
    assert.equal((await complete(harness({ asset: uploadedAsset({ uploadedById: null }) }), "admin")).status, 200);
  });

  it("USER/AGENT/BUILDER who are neither owner nor uploader → 404", async () => {
    for (const caller of ["other", "agent", "builder"]) {
      const h = harness();
      assert.equal((await complete(h, caller)).status, 404, caller);
      assert.deepEqual(h.inspected, []);
    }
  });

  it("an uploader role never substitutes for ownership (AGENT uploader, other owner)", async () => {
    const h = harness({ asset: uploadedAsset({ uploadedById: "agent" }) });
    assert.equal((await complete(h, "agent")).status, 404);
  });

  it("missing property → 404, even for ADMIN", async () => {
    const h = harness({ properties: {} });
    assert.equal((await complete(h, "admin")).status, 404);
    assert.deepEqual(h.inspected, []);
  });

  it("cross-property: authorization is checked against the asset's own property only", async () => {
    // "other" owns prop-2; the asset belongs to prop-1. Nothing in the request can point elsewhere.
    const h = harness({ asset: uploadedAsset({ uploadedById: "other" }), properties: { "prop-1": { ownerId: "owner" }, "prop-2": { ownerId: "other" } } });
    assert.equal((await complete(h, "other")).status, 404);
  });

  it("matches the rule in canCompleteUpload", () => {
    const a = uploadedAsset();
    assert.equal(canCompleteUpload(USERS.owner, a, "owner"), true);
    assert.equal(canCompleteUpload(USERS.owner, { ...a, uploadedById: "other" }, "owner"), false);
    assert.equal(canCompleteUpload(USERS.owner, a, "other"), false);
    assert.equal(canCompleteUpload(USERS.admin, { ...a, uploadedById: null }, "other"), true);
    assert.equal(canCompleteUpload(USERS.builder, { ...a, subjectType: "PROJECT", uploadedById: "builder" }, null), false);
  });
});

describe("upload completion: PROJECT authorization", () => {
  it("ADMIN → 200", async () => {
    const h = harness({ asset: projectAsset(), inspection: { status: "FOUND", head: goodHead({ contentType: "image/jpeg" }) } });
    const result = await complete(h, "admin");
    assert.equal(result.status, 200);
    assert.equal(statusOf(h), "PROCESSING");
  });

  it("USER/AGENT/BUILDER → 404, even as the recorded uploader", async () => {
    for (const caller of ["owner", "agent", "builder"]) {
      const h = harness({ asset: projectAsset({ uploadedById: caller }) });
      assert.equal((await complete(h, caller)).status, 404, caller);
      assert.deepEqual(h.inspected, []);
      assert.equal(h.updates.length, 0);
    }
  });

  it("project no longer defined → 404, even for ADMIN", async () => {
    const h = harness({ asset: projectAsset({ projectSlug: "reef-999-removed" }) });
    assert.equal((await complete(h, "admin")).status, 404);
    assert.deepEqual(h.inspected, []);
  });
});

// ── Lifecycle ───────────────────────────────────────────────────────────────

describe("upload completion: lifecycle", () => {
  it("UPLOADED + verified object → PROCESSING, transitioned=true", async () => {
    const h = harness();
    const result = await complete(h);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { success: true, data: { mediaAssetId: MEDIA_ID, status: "PROCESSING", transitioned: true } });
    assert.equal(statusOf(h), "PROCESSING");
    assert.equal(h.rows.get(MEDIA_ID)?.processingError, null);
    assert.deepEqual(h.inspected, [KEY]);
  });

  for (const status of COMPLETED_UPLOAD_STATUSES) {
    it(`${status} → 200 transitioned=false, no S3 call, no write`, async () => {
      const h = harness({ asset: uploadedAsset({ status }) });
      const result = await complete(h);
      assert.equal(result.status, 200);
      assert.deepEqual(dataOf(result), { mediaAssetId: MEDIA_ID, status, transitioned: false });
      assert.deepEqual(h.inspected, []);
      assert.equal(h.updates.length, 0);
    });
  }

  for (const status of NOT_COMPLETABLE_STATUSES) {
    it(`${status} → 409 NOT_COMPLETABLE, no S3 call, no write`, async () => {
      const h = harness({ asset: uploadedAsset({ status }) });
      const result = await complete(h);
      assert.equal(result.status, 409);
      assert.equal(codeOf(result), "NOT_COMPLETABLE");
      assert.equal((result.body as { retryable: boolean }).retryable, false);
      assert.deepEqual(h.inspected, []);
      assert.equal(h.updates.length, 0);
    });
  }

  it("covers every status exactly once", () => {
    const all: MediaAssetStatus[] = ["UPLOADED", "PROCESSING", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "FAILED", "ARCHIVED"];
    assert.deepEqual([...COMPLETED_UPLOAD_STATUSES, ...NOT_COMPLETABLE_STATUSES, "UPLOADED"].sort(), [...all].sort());
  });
});

// ── Object verification ─────────────────────────────────────────────────────

describe("upload completion: object state", () => {
  it("missing object within grace → 409 UPLOAD_NOT_FOUND, retryable, row unchanged", async () => {
    for (const now of [WITHIN_GRACE, uploadCompletionDeadline(CREATED)]) {
      const h = harness({ inspection: { status: "NOT_FOUND" }, now });
      const result = await complete(h);
      assert.equal(result.status, 409);
      assert.deepEqual(result.body, { success: false, error: "The upload has not been received yet.", code: "UPLOAD_NOT_FOUND", retryable: true });
      assert.equal(statusOf(h), "UPLOADED");
      assert.equal(h.updates.length, 0);
    }
  });

  it("missing object after createdAt + TTL + grace → 409 UPLOAD_EXPIRED and FAILED", async () => {
    const h = harness({ inspection: { status: "NOT_FOUND" }, now: AFTER_GRACE });
    const result = await complete(h);
    assert.equal(result.status, 409);
    assert.equal(codeOf(result), "UPLOAD_EXPIRED");
    assert.equal(statusOf(h), "FAILED");
    assert.equal(h.rows.get(MEDIA_ID)?.processingError, COMPLETION_PROCESSING_ERRORS.expired);
  });

  const mismatches: Array<[string, Partial<IngestObjectHead>, string]> = [
    ["wrong size", { contentLength: 1841 }, "content-length"],
    ["missing size", { contentLength: undefined }, "content-length"],
    ["wrong Content-Type", { contentType: "application/octet-stream" }, "content-type"],
    ["Content-Type with parameters", { contentType: "model/gltf-binary; charset=binary" }, "content-type"],
    ["wrong checksum", { checksumSha256: OTHER_SHA256 }, "checksum"],
    ["missing checksum", { checksumSha256: undefined }, "checksum-missing"],
    ["hex checksum", { checksumSha256: Buffer.from(SHA256, "base64").toString("hex") }, "checksum"],
    ["composite checksum", { checksumSha256: `${SHA256}-2`, checksumType: "COMPOSITE" }, "checksum"],
    ["composite checksum type", { checksumType: "COMPOSITE" }, "checksum-type"],
    ["unexpected Content-Encoding", { contentEncoding: "gzip" }, "content-encoding"],
    ["unexpected Content-Disposition", { contentDisposition: "attachment; filename=x.html" }, "content-disposition"],
    ["unexpected Cache-Control", { cacheControl: "public, max-age=31536000" }, "cache-control"],
    ["unexpected metadata", { metadata: { filename: "x" } }, "metadata"],
  ];
  for (const [label, override, mismatch] of mismatches) {
    it(`${label} → 422 UPLOAD_VERIFICATION_FAILED and FAILED`, async () => {
      const h = harness({ inspection: { status: "FOUND", head: goodHead(override) } });
      const result = await complete(h);
      assert.equal(result.status, 422);
      assert.equal(codeOf(result), "UPLOAD_VERIFICATION_FAILED");
      assert.equal(statusOf(h), "FAILED");
      assert.equal(h.rows.get(MEDIA_ID)?.processingError, COMPLETION_PROCESSING_ERRORS.mismatch(mismatch));
      assert.doesNotMatch(JSON.stringify(result.body), /checksum|content-|metadata|gzip|uploads\//i, "no verification detail reaches the client");
    });
  }

  it("absent optional headers and empty metadata are fine", async () => {
    const h = harness({ inspection: { status: "FOUND", head: goodHead({ checksumType: undefined, contentEncoding: "", cacheControl: "", contentDisposition: undefined, metadata: {} }) } });
    assert.equal((await complete(h)).status, 200);
  });

  it("wrong server-side encryption → 503, row unchanged (bucket drift is not the uploader's fault)", async () => {
    for (const serverSideEncryption of ["aws:kms", undefined]) {
      const h = harness({ inspection: { status: "FOUND", head: goodHead({ serverSideEncryption }) } });
      const result = await complete(h);
      assert.equal(result.status, 503);
      assert.equal(codeOf(result), "VERIFICATION_UNAVAILABLE");
      assert.equal(statusOf(h), "UPLOADED");
      assert.equal(h.updates.length, 0);
      assert.ok(h.logs.some((l) => l.includes("configuration drift")));
    }
  });

  it("S3 403, 5xx, throttling, network or credential failure → 503, retryable, row unchanged, AWS detail kept out", async () => {
    for (const reason of ["Forbidden (HTTP 403)", "InternalError (HTTP 500)", "SlowDown (HTTP 503)", "ThrottlingException (HTTP 429)", "TimeoutError", "CredentialsProviderError"]) {
      const h = harness({ inspection: { status: "UNAVAILABLE", reason } });
      const result = await complete(h);
      assert.equal(result.status, 503, reason);
      assert.deepEqual(result.body, { success: false, error: "Upload verification is temporarily unavailable. Please try again.", code: "VERIFICATION_UNAVAILABLE", retryable: true });
      assert.equal(statusOf(h), "UPLOADED");
      assert.equal(h.updates.length, 0);
      assert.ok(h.logs.some((l) => l.includes(reason)));
    }
  });

  it("an inspector that throws → 503, row unchanged", async () => {
    const h = harness({ inspectError: Object.assign(new Error("arn:aws:iam::123456789012:role/x is not authorized"), { name: "AccessDenied" }) });
    const result = await complete(h);
    assert.equal(result.status, 503);
    assert.equal(statusOf(h), "UPLOADED");
    assert.ok(h.logs.every((l) => !l.includes("arn:aws")));
  });

  it("verification not configured → 503 without writing", async () => {
    const h = harness({ inspector: null });
    assert.equal((await complete(h)).status, 503);
    assert.equal(statusOf(h), "UPLOADED");
  });
});

// ── Source key integrity ────────────────────────────────────────────────────

describe("upload completion: source key integrity", () => {
  const refused = async (label: string, asset: CompletionMediaAsset) => {
    const h = harness({ asset });
    const result = await complete(h, "admin");
    assert.equal(result.status, 409, label);
    assert.equal(codeOf(result), "NOT_COMPLETABLE", label);
    assert.deepEqual(h.inspected, [], `${label}: no S3 call`);
    assert.equal(h.updates.length, 0, `${label}: row unchanged`);
    assert.ok(h.logs.some((l) => l.includes("inconsistent row") && l.includes(MEDIA_ID)), label);
    assert.ok(h.logs.every((l) => !l.includes("https://")), label);
  };

  it("malformed or non-ingest keys are refused, never repaired", async () => {
    await refused("originals/", uploadedAsset({ sourceKey: `originals/${MEDIA_ID}/de1d54d4e9da0d02/tower.glb` }));
    await refused("published m/", uploadedAsset({ sourceKey: `m/${MEDIA_ID}/de1d54d4e9da0d02/scene.glb` }));
    await refused("traversal", uploadedAsset({ sourceKey: `uploads/${MEDIA_ID}/${UPLOAD_ID}/../source.glb` }));
    await refused("wrong file name", uploadedAsset({ sourceKey: `uploads/${MEDIA_ID}/${UPLOAD_ID}/tower.glb` }));
    await refused("extra segment", uploadedAsset({ sourceKey: `uploads/${MEDIA_ID}/${UPLOAD_ID}/x/source.glb` }));
    await refused("URL", uploadedAsset({ sourceKey: `https://example.com/uploads/${MEDIA_ID}/${UPLOAD_ID}/source.glb` }));
  });

  it("another media asset's key is refused", async () => {
    await refused("other media id", uploadedAsset({ sourceKey: `uploads/${OTHER_MEDIA_ID}/${UPLOAD_ID}/source.glb` }));
  });

  it("a key whose format disagrees with the row is refused", async () => {
    await refused("kind", uploadedAsset({ sourceKey: `uploads/${MEDIA_ID}/${UPLOAD_ID}/source.jpg` }));
    await refused("MIME", uploadedAsset({ sourceMimeType: "application/octet-stream" }));
  });

  it("a row without a stored or canonical checksum is refused", async () => {
    await refused("null checksum", uploadedAsset({ sourceChecksumSha256: null }));
    await refused("hex checksum", uploadedAsset({ sourceChecksumSha256: createHash("sha256").update("x").digest("hex") }));
  });

  it("the client cannot influence the key: the inspected key is always the stored one", async () => {
    const h = harness();
    await complete(h, "owner", { body: { sourceKey: `uploads/${OTHER_MEDIA_ID}/${UPLOAD_ID}/source.glb` } as never });
    await complete(h, "owner");
    assert.deepEqual(h.inspected, [KEY]);
    assert.equal(h.updates[0]?.verified?.sourceKey, KEY);
  });

  it("checkCompletableSource accepts exactly the Phase 5A layout", () => {
    const row: CompletableSource = { id: MEDIA_ID, kind: "MODEL", sourceKey: KEY, sourceSizeBytes: 1840, sourceMimeType: "model/gltf-binary", sourceChecksumSha256: SHA256 };
    assert.equal(checkCompletableSource(row), null);
    assert.equal(checkCompletableSource({ ...row, kind: "SPLAT", sourceKey: KEY.replace(".glb", ".sog"), sourceMimeType: "application/zip" }), null);
    assert.notEqual(checkCompletableSource({ ...row, sourceSizeBytes: 0 }), null);
    assert.notEqual(checkCompletableSource({ ...row, sourceSizeBytes: 100_000_001 }), null);
  });
});

// ── Concurrency and idempotency ─────────────────────────────────────────────

describe("upload completion: concurrency and idempotency", () => {
  it("two simultaneous completions: exactly one transitions, both succeed", async () => {
    const h = harness();
    const results = await Promise.all([complete(h), complete(h)]);
    assert.deepEqual(results.map((r) => r.status), [200, 200]);
    assert.deepEqual(results.map((r) => dataOf(r).transitioned).sort(), [false, true]);
    assert.equal(statusOf(h), "PROCESSING");
    assert.equal(h.updates.filter((u) => u.kind === "processing").length, 2, "both attempted the guarded update; the row only moved once");
  });

  it("a request that loses the race after verifying answers from the current row", async () => {
    const h = harness({
      beforeUpdate: (x) => x.rows.set(MEDIA_ID, { ...x.rows.get(MEDIA_ID)!, status: "PROCESSING" }),
    });
    const result = await complete(h);
    assert.deepEqual(dataOf(result), { mediaAssetId: MEDIA_ID, status: "PROCESSING", transitioned: false });
  });

  it("retry after success → transitioned=false with no S3 call and no write", async () => {
    const h = harness();
    assert.equal(dataOf(await complete(h)).transitioned, true);
    const before = { inspected: h.inspected.length, updates: h.updates.length };
    const retry = await complete(h);
    assert.deepEqual(dataOf(retry), { mediaAssetId: MEDIA_ID, status: "PROCESSING", transitioned: false });
    assert.equal(h.inspected.length, before.inspected);
    assert.equal(h.updates.length, before.updates);
  });

  it("retry after a failed verification → stable 409 NOT_COMPLETABLE", async () => {
    const h = harness({ inspection: { status: "FOUND", head: goodHead({ contentLength: 1 }) } });
    assert.equal((await complete(h)).status, 422);
    for (let i = 0; i < 3; i++) {
      const retry = await complete(h);
      assert.equal(retry.status, 409);
      assert.equal(codeOf(retry), "NOT_COMPLETABLE");
    }
    assert.equal(h.inspected.length, 1);
  });

  it("simultaneous mismatching completions → one 422, then the loser reports the FAILED row", async () => {
    const h = harness({ inspection: { status: "FOUND", head: goodHead({ checksumSha256: OTHER_SHA256 }) } });
    const results = await Promise.all([complete(h), complete(h)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [409, 422]);
    assert.equal(statusOf(h), "FAILED");
  });

  it("retry after UPLOAD_NOT_FOUND succeeds once the object is there", async () => {
    let arrived = false;
    const h = harness({ inspection: () => (arrived ? { status: "FOUND", head: goodHead() } : { status: "NOT_FOUND" }) });
    assert.equal(codeOf(await complete(h)), "UPLOAD_NOT_FOUND");
    arrived = true;
    assert.equal(dataOf(await complete(h)).transitioned, true);
  });

  it("database failure on the transition (unknown commit outcome) → 500 retryable, and a retry converges", async () => {
    const committed = harness({ transitionError: new Error("Connection terminated unexpectedly") });
    const result = await complete(committed);
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { success: false, error: "Server error", code: "SERVER_ERROR", retryable: true });
    assert.ok(committed.logs.every((l) => !l.includes("Connection terminated")), "only the error name is logged");

    // Outcome A: the update did commit before the connection dropped.
    committed.rows.set(MEDIA_ID, { ...committed.rows.get(MEDIA_ID)!, status: "PROCESSING" });
    const inspectedBefore = committed.inspected.length;
    const retryA = await handleUploadCompletion({ caller: { id: "owner" }, mediaAssetId: MEDIA_ID, contentType: "application/json", contentLength: 2, readBody: async () => ({}) }, committed.deps);
    assert.deepEqual(dataOf(retryA), { mediaAssetId: MEDIA_ID, status: "PROCESSING", transitioned: false });
    assert.equal(committed.inspected.length, inspectedBefore, "no S3 call after the committed transition");

    // Outcome B: it did not commit; the retry verifies again and transitions.
    const uncommitted = harness();
    assert.equal(dataOf(await complete(uncommitted)).transitioned, true);
  });

  it("ownership change between the check and the guarded update → no transition, 404", async () => {
    const h = harness({ beforeUpdate: (x) => (x.properties["prop-1"] = { ownerId: "other" }) });
    const result = await complete(h);
    assert.equal(result.status, 404);
    assert.equal(statusOf(h), "UPLOADED");
  });

  it("row changed underneath a verified request (still UPLOADED) → 503 retryable, no transition", async () => {
    const h = harness({ beforeUpdate: (x) => x.rows.set(MEDIA_ID, { ...x.rows.get(MEDIA_ID)!, sourceSizeBytes: 999 }) });
    const result = await complete(h);
    assert.equal(result.status, 503);
    assert.equal(statusOf(h), "UPLOADED");
  });

  it("the transition is guarded by every verified value and the authorization", async () => {
    const h = harness();
    await complete(h, "owner");
    assert.deepEqual(h.updates, [
      {
        kind: "processing",
        id: MEDIA_ID,
        verified: { sourceKey: KEY, sourceSizeBytes: 1840, sourceMimeType: "model/gltf-binary", sourceChecksumSha256: SHA256 },
        authorization: { admin: false, userId: "owner" },
      },
    ]);
  });
});

// ── Pure verdict ────────────────────────────────────────────────────────────

describe("verifyIngestObject (pure)", () => {
  const expected: CompletableSource = { id: MEDIA_ID, kind: "MODEL", sourceKey: KEY, sourceSizeBytes: 1840, sourceMimeType: "model/gltf-binary", sourceChecksumSha256: SHA256 };

  it("accepts the exact object and compares the SHA-256 as canonical base64 without conversion", () => {
    assert.deepEqual(verifyIngestObject(expected, goodHead()), { ok: true });
    assert.equal(INGEST_SERVER_SIDE_ENCRYPTION, "AES256");
  });

  it("never consults ETag", () => {
    const head = { ...goodHead(), etag: '"not-an-md5"' } as IngestObjectHead;
    assert.deepEqual(verifyIngestObject(expected, head), { ok: true });
    const md5Only = { ...goodHead({ checksumSha256: undefined }), etag: `"${createHash("md5").update("pilot bytes").digest("hex")}"` } as IngestObjectHead;
    assert.deepEqual(verifyIngestObject(expected, md5Only), { ok: false, outcome: "MISMATCH", mismatch: "checksum-missing" });
  });

  it("reports a mismatch before configuration drift", () => {
    assert.deepEqual(verifyIngestObject(expected, goodHead({ contentLength: 1, serverSideEncryption: "aws:kms" })), { ok: false, outcome: "MISMATCH", mismatch: "content-length" });
    assert.deepEqual(verifyIngestObject(expected, goodHead({ serverSideEncryption: "aws:kms" })), { ok: false, outcome: "MISCONFIGURED", problem: "server-side-encryption" });
  });

  it("derives the completion deadline from createdAt + TTL + one hour of grace", () => {
    assert.equal(UPLOAD_COMPLETION_GRACE_SECONDS, 3600);
    assert.equal(uploadCompletionDeadline(CREATED).getTime() - CREATED.getTime(), (UPLOAD_INTENT_TTL_SECONDS + 3600) * 1000);
  });
});

// ── Quota ───────────────────────────────────────────────────────────────────

describe("upload intent quota after completion", () => {
  it("counts every intent in the window, so completed assets do not free a slot", async () => {
    // A store that counts rows by uploader and createdAt only, like the Prisma store.
    const rows: Array<{ uploadedById: string; createdAt: Date; status: MediaAssetStatus }> = [];
    const now = new Date("2026-09-14T12:00:00Z");
    const statuses: MediaAssetStatus[] = ["UPLOADED", "PROCESSING", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "FAILED", "ARCHIVED"];
    for (let i = 0; i < UPLOAD_INTENT_QUOTA.maxRecent; i++) rows.push({ uploadedById: "owner", createdAt: new Date(now.getTime() - i * 1000), status: statuses[i % statuses.length] });
    rows.push({ uploadedById: "owner", createdAt: new Date(now.getTime() - UPLOAD_INTENT_QUOTA.windowSeconds * 1000 - 1), status: "UPLOADED" });
    rows.push({ uploadedById: "other", createdAt: now, status: "UPLOADED" });
    let created = 0;
    const deps: UploadIntentDependencies = {
      store: {
        findUser: async (id) => USERS[id] ?? null,
        findProperty: async () => ({ id: "prop-1", ownerId: "owner" }),
        countRecentUploadIntents: async (uploadedById, since) => rows.filter((r) => r.uploadedById === uploadedById && r.createdAt >= since).length,
        createUploadedMediaAsset: async () => void created++,
        markUploadIntentFailed: async () => undefined,
      },
      getSigner: () => ({ prepare: async () => undefined, sign: async () => ({ method: "PUT", url: "https://signed.invalid/x", headers: {} }) }),
      findProject: () => null,
      now: () => now,
      randomId: () => MEDIA_ID,
      log: () => undefined,
    };
    const body = { subjectType: "PROPERTY", propertyId: "prop-1", kind: "MODEL", expectedFormat: "GLB", filename: "a.glb", sourceSizeBytes: 10, sha256: SHA256 };
    const request = { caller: { id: "owner" }, contentType: "application/json", contentLength: null, readBody: async () => body };
    assert.equal((await handleUploadIntent(request, deps)).status, 429, "20 intents in the window, most no longer UPLOADED");
    rows.splice(0, 1);
    assert.equal((await handleUploadIntent(request, deps)).status, 201, "one slot below the limit; the out-of-window and other-user rows never counted");
    assert.equal(created, 1);
  });
});

// ── Real SDK HeadObject, offline, with a stub transport and fake credentials ─

describe("ingest object inspector (AWS SDK HeadObject, offline)", () => {
  const config = { region: "ap-south-1", bucket: "example-ingest-bucket" };
  const credentials = { accessKeyId: "TESTONLYACCESSKEYID", secretAccessKey: "test-only-secret-not-a-real-key" };

  function stub(statusCode: number, headers: Record<string, string> = {}) {
    const requests: Array<{ method: string; hostname: string; path: string; headers: Record<string, string>; query: Record<string, unknown> }> = [];
    const requestHandler = {
      handle: async (request: { method: string; hostname: string; path: string; headers: Record<string, string>; query: Record<string, unknown> }) => {
        requests.push({ method: request.method, hostname: request.hostname, path: request.path, headers: request.headers, query: request.query });
        return { response: { statusCode, headers, body: Readable.from([]) } };
      },
    };
    const inspector = createIngestObjectInspector(config, { credentials, requestHandler: requestHandler as never, maxAttempts: 1 });
    return { inspector, requests };
  }

  it("sends HEAD with ChecksumMode ENABLED to exactly the bucket and key, and maps the headers", async () => {
    const { inspector, requests } = stub(200, {
      "content-length": "1840",
      "content-type": "model/gltf-binary",
      "x-amz-checksum-sha256": SHA256,
      "x-amz-checksum-type": "FULL_OBJECT",
      "x-amz-server-side-encryption": "AES256",
      etag: '"0123456789abcdef0123456789abcdef"',
    });
    const result = await inspector.inspect(KEY);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "HEAD");
    assert.equal(requests[0].hostname, "example-ingest-bucket.s3.ap-south-1.amazonaws.com");
    assert.equal(decodeURIComponent(requests[0].path), `/${KEY}`);
    assert.equal(requests[0].headers["x-amz-checksum-mode"], "ENABLED");
    assert.deepEqual(requests[0].query, {});
    assert.equal(result.status, "FOUND");
    assert.deepEqual(result.status === "FOUND" && result.head, {
      contentLength: 1840,
      contentType: "model/gltf-binary",
      checksumSha256: SHA256,
      checksumType: "FULL_OBJECT",
      serverSideEncryption: "AES256",
      contentEncoding: undefined,
      contentDisposition: undefined,
      cacheControl: undefined,
      metadata: {},
    });
    assert.ok(result.status === "FOUND" && !("etag" in result.head), "ETag is not surfaced");
    assert.deepEqual(result.status === "FOUND" && verifyIngestObject({ id: MEDIA_ID, kind: "MODEL", sourceKey: KEY, sourceSizeBytes: 1840, sourceMimeType: "model/gltf-binary", sourceChecksumSha256: SHA256 }, result.head), { ok: true });
  });

  it("surfaces user metadata so verification can reject it", async () => {
    const { inspector } = stub(200, { "content-length": "1", "x-amz-meta-origin": "browser" });
    const result = await inspector.inspect(KEY);
    assert.deepEqual(result.status === "FOUND" && result.head.metadata, { origin: "browser" });
  });

  it("maps failures by HTTP status: 404 → NOT_FOUND; 403, 5xx and throttling → UNAVAILABLE", async () => {
    assert.deepEqual(await stub(404).inspector.inspect(KEY), { status: "NOT_FOUND" });
    for (const status of [403, 500, 503, 429]) {
      const result = await stub(status).inspector.inspect(KEY);
      assert.equal(result.status, "UNAVAILABLE", String(status));
      assert.match(result.status === "UNAVAILABLE" ? result.reason : "", new RegExp(`HTTP ${status}`));
    }
  });

  it("maps a transport failure with no HTTP status to UNAVAILABLE", async () => {
    const requestHandler = { handle: async () => { throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { name: "NetworkingError" }); } };
    const inspector = createIngestObjectInspector(config, { credentials, requestHandler: requestHandler as never, maxAttempts: 1 });
    assert.deepEqual(await inspector.inspect(KEY), { status: "UNAVAILABLE", reason: "NetworkingError" });
  });

  it("refuses to inspect keys outside the ingest source layout, before any request", async () => {
    const { inspector, requests } = stub(200);
    for (const key of [`originals/${MEDIA_ID}/de1d54d4e9da0d02/x.glb`, "m/abcdefgh/0123456789abcdef/scene.glb", `uploads/${MEDIA_ID}/${UPLOAD_ID}/../../x.glb`]) {
      await assert.rejects(inspector.inspect(key), /Refusing/);
    }
    assert.equal(requests.length, 0);
  });

  it("is configured like the signer and fails closed without configuration", () => {
    assert.equal(getIngestObjectInspector({}), null);
    assert.equal(getIngestObjectInspector({ MEDIA_REGION: "ap-south-1" }), null);
    const env = { MEDIA_REGION: "ap-south-1", MEDIA_INGEST_BUCKET: "example-ingest-bucket" };
    assert.ok(getIngestObjectInspector(env));
    assert.ok(getIngestUploadSigner(env));
    assert.equal(getIngestObjectInspector(env), getIngestObjectInspector(env), "cached per configuration");
  });
});
