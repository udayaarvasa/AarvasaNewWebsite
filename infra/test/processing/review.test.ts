import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type MediaAssetStatus } from "../../../shared/media-asset";
import { ACTOR_TRANSITIONS } from "../../../shared/media-processing";
import {
  approveReviewAsset,
  createReviewPreview,
  getReviewAsset,
  listReviewAssets,
  rejectReviewAsset,
  type MediaReviewDependencies,
  type ReviewAssetRow,
  type ReviewResult,
} from "../../../src/lib/services/media-review.service";
import { ImmutableObjectConflictError, RetryableProcessingError, ReviewCopyMissingError, type ReviewAccess } from "../../../src/lib/media/published-storage";

const MEDIA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const HASH16 = "de1d54d4e9da0d02";
const CONTENT_HASH = "370418ddb037b189a64f4c1f761398b8fcf9974ca9028b9ab188bb3a37ba7ef2";
const NOW = new Date("2026-09-19T12:00:00.000Z");
const USERS: Record<string, { id: string; role: string }> = {
  admin: { id: "admin", role: "ADMIN" },
  owner: { id: "owner", role: "USER" },
  agent: { id: "agent", role: "AGENT" },
  builder: { id: "builder", role: "BUILDER" },
};

const pendingRow = (overrides: Partial<ReviewAssetRow> = {}): ReviewAssetRow => ({
  id: MEDIA,
  subjectType: "PROPERTY",
  propertyId: "prop-1",
  projectSlug: null,
  propertyTitle: "Sea View Villa",
  kind: "PANORAMA",
  format: "EQUIRECT_JPEG",
  status: "PENDING_REVIEW",
  storageKey: `m/${MEDIA}/${HASH16}`,
  entryFile: "panorama.jpg",
  contentHash: CONTENT_HASH,
  mimeType: "image/jpeg",
  sizeBytes: 1_200_000,
  fileCount: 2,
  posterKey: `m/${MEDIA}/${HASH16}/poster.webp`,
  dimensions: { entry: { width: 4096, height: 2048 }, poster: { width: 1280, height: 640 } },
  metrics: { "validation.warnings": "panorama.progressive" },
  title: "Terrace",
  altText: null,
  sourceKey: `uploads/${MEDIA}/0f1e2d3c4b5a69788796a5b4c3d2e1f0/source.jpg`,
  sourceSizeBytes: 1_200_000,
  sourceMimeType: "image/jpeg",
  sourceChecksumSha256: Buffer.from(CONTENT_HASH, "hex").toString("base64"),
  processorVersion: "1.0.0/passthrough-v1",
  processingAttempts: 1,
  processingStartedAt: new Date("2026-09-19T11:00:00.000Z"),
  failureCode: null,
  processingError: null,
  rejectionReason: null,
  uploadedBy: { id: "owner", name: "Owner", email: "owner@example.test" },
  reviewedAt: null,
  publishedAt: null,
  createdAt: new Date("2026-09-19T10:55:00.000Z"),
  updatedAt: new Date("2026-09-19T11:01:00.000Z"),
  ...overrides,
});

class FakeReviewAccess implements ReviewAccess {
  readonly reviewCopies = new Set<string>([`review/${MEDIA}/${HASH16}/panorama.jpg`, `review/${MEDIA}/${HASH16}/poster.webp`]);
  readonly published = new Map<string, number>();
  readonly presigned: Array<{ key: string; ttl: number }> = [];
  failPublish: Error | null = null;
  async exists(key: string) {
    return this.reviewCopies.has(key);
  }
  async presignGet(key: string, ttl: number) {
    if (!key.startsWith("review/")) throw new Error("Refusing");
    this.presigned.push({ key, ttl });
    return `https://example-published-bucket.s3.ap-south-1.amazonaws.com/${key}?X-Amz-Expires=${ttl}&X-Amz-Signature=test`;
  }
  async publish(reviewKey: string, expected: string | null) {
    if (this.failPublish) {
      const e = this.failPublish;
      this.failPublish = null;
      throw e;
    }
    if (!this.reviewCopies.has(reviewKey)) throw new ReviewCopyMissingError("gone");
    if (reviewKey.endsWith("panorama.jpg")) assert.equal(expected, CONTENT_HASH, "entry published with its contentHash");
    const target = reviewKey.replace(/^review\//, "m/");
    this.published.set(target, (this.published.get(target) ?? 0) + 1);
    return this.published.get(target) === 1 ? ("created" as const) : ("exists" as const);
  }
}

function harness(row: ReviewAssetRow | null = pendingRow(), options: { access?: null } = {}) {
  const rows = new Map<string, ReviewAssetRow>(row ? [[row.id, row]] : []);
  const access = new FakeReviewAccess();
  const decisions: string[] = [];
  const logs: string[] = [];
  const deps: MediaReviewDependencies = {
    store: {
      findUser: async (id) => USERS[id] ?? null,
      listAssets: async ({ status, limit }) => [...rows.values()].filter((r) => !status || r.status === status).slice(0, limit),
      findAsset: async (id) => rows.get(id) ?? null,
      approve: async (id, reviewerId, now, altText) => {
        const r = rows.get(id);
        if (!r || r.status !== "PENDING_REVIEW") return 0;
        rows.set(id, { ...r, status: "PUBLISHED", reviewedAt: now, publishedAt: now, altText, updatedAt: now });
        decisions.push(`approve:${reviewerId}`);
        return 1;
      },
      reject: async (id, reviewerId, now, reason) => {
        const r = rows.get(id);
        if (!r || r.status !== "PENDING_REVIEW") return 0;
        rows.set(id, { ...r, status: "REJECTED", reviewedAt: now, rejectionReason: reason, updatedAt: now });
        decisions.push(`reject:${reviewerId}`);
        return 1;
      },
    },
    getReviewAccess: () => (options.access === null ? null : access),
    now: () => NOW,
    log: (message, context) => logs.push(`${message} ${JSON.stringify(context)}`),
  };
  const body = (b: unknown, caller = "admin", contentType: string | null = "application/json") => ({ caller: caller ? { id: caller } : null, mediaAssetId: MEDIA, contentType, readBody: async () => b });
  return { rows, access, decisions, logs, deps, body, row: () => rows.get(MEDIA)! };
}

const code = (r: ReviewResult) => (r.body as { code?: string }).code;
const data = (r: ReviewResult) => (r.body as { data: Record<string, unknown> }).data;

describe("review API: authorization (fresh database role, ADMIN only)", () => {
  it("unauthenticated → 401, deleted user → 401, USER/AGENT/BUILDER → 403 on every endpoint", async () => {
    for (const [caller, status] of [[null, 401], ["ghost", 401], ["owner", 403], ["agent", 403], ["builder", 403]] as const) {
      const h = harness();
      const results = [
        await listReviewAssets({ caller: caller ? { id: caller } : null, status: null, limit: null }, h.deps),
        await getReviewAsset({ caller: caller ? { id: caller } : null, mediaAssetId: MEDIA }, h.deps),
        await createReviewPreview(h.body({}, caller as string), h.deps),
        await approveReviewAsset(h.body({ altText: "x" }, caller as string), h.deps),
        await rejectReviewAsset(h.body({ reason: "not ok" }, caller as string), h.deps),
      ];
      assert.deepEqual(results.map((r) => r.status), [status, status, status, status, status], String(caller));
      assert.equal(h.row().status, "PENDING_REVIEW");
      assert.equal(h.access.presigned.length + h.access.published.size, 0);
    }
  });

  it("the uploader cannot approve their own asset", async () => {
    const h = harness();
    assert.equal((await approveReviewAsset(h.body({ altText: "Mine" }, "owner"), h.deps)).status, 403);
    assert.equal(h.row().status, "PENDING_REVIEW");
  });

  it("the token's role is ignored: only the store's role counts", async () => {
    const h = harness();
    const r = await approveReviewAsset({ ...h.body({ altText: "x" }, "owner"), caller: { id: "owner", role: "ADMIN" } as { id: string } }, h.deps);
    assert.equal(r.status, 403);
  });
});

describe("review API: list and detail", () => {
  it("lists by status with admin-only diagnostics, and validates filters", async () => {
    const h = harness(pendingRow({ status: "FAILED", failureCode: "UNSUPPORTED_CONTENT", processingError: "UNSUPPORTED_CONTENT: gltf.meshopt: ...", storageKey: null, entryFile: null, contentHash: null, posterKey: null }));
    const r = await listReviewAssets({ caller: { id: "admin" }, status: "FAILED", limit: "10" }, h.deps);
    const [item] = data(r) as unknown as Array<Record<string, { code: string; message: string; diagnostic: string }>>;
    assert.equal(item.failure.code, "UNSUPPORTED_CONTENT");
    assert.match(item.failure.message, /not supported/);
    assert.match(item.failure.diagnostic, /gltf\.meshopt/);
    assert.ok(!JSON.stringify(r.body).includes("uploads/"), "no storage keys leave the server");
    assert.ok(!JSON.stringify(r.body).includes(`m/${MEDIA}`), "no storage keys leave the server");
    for (const [status, limit] of [["NOPE", null], ["PENDING_REVIEW", "0"], ["PENDING_REVIEW", "101"], ["PENDING_REVIEW", "x"]] as const) {
      assert.equal((await listReviewAssets({ caller: { id: "admin" }, status, limit }, h.deps)).status, 400);
    }
  });

  it("detail: 404 for unknown and malformed ids", async () => {
    const h = harness();
    assert.equal((await getReviewAsset({ caller: { id: "admin" }, mediaAssetId: "ffffffffffffffffffffffffffffffff" }, h.deps)).status, 404);
    assert.equal((await getReviewAsset({ caller: { id: "admin" }, mediaAssetId: "../x" }, h.deps)).status, 404);
    const ok = await getReviewAsset({ caller: { id: "admin" }, mediaAssetId: MEDIA }, h.deps);
    assert.equal((data(ok) as { status: string }).status, "PENDING_REVIEW");
  });
});

describe("review API: secure preview", () => {
  it("presigns 5-minute GETs for the private review copies only (never the source upload)", async () => {
    const h = harness();
    const r = await createReviewPreview(h.body({}), h.deps);
    assert.equal(r.status, 200);
    assert.deepEqual(h.access.presigned, [
      { key: `review/${MEDIA}/${HASH16}/panorama.jpg`, ttl: 300 },
      { key: `review/${MEDIA}/${HASH16}/poster.webp`, ttl: 300 },
    ]);
    assert.equal((data(r) as { expiresAt: string }).expiresAt, new Date(NOW.getTime() + 300_000).toISOString());
    assert.ok(!JSON.stringify(r.body).includes("uploads/"));
  });

  it("only for PENDING_REVIEW, only with a JSON {} body, and 503 without storage", async () => {
    assert.equal(code(await createReviewPreview(harness(pendingRow({ status: "PUBLISHED" })).body({}), harness(pendingRow({ status: "PUBLISHED" })).deps)), "NOT_REVIEWABLE");
    const h = harness();
    assert.equal((await createReviewPreview(h.body({ key: "originals/x" }), h.deps)).status, 400);
    assert.equal((await createReviewPreview(h.body({}, "admin", "text/plain"), h.deps)).status, 415);
    const n = harness(pendingRow(), { access: null });
    assert.equal((await createReviewPreview(n.body({}), n.deps)).status, 503);
  });
});

describe("review API: approve and publish", () => {
  it("PENDING_REVIEW → PUBLISHED with reviewer, timestamps and alt text; publishes entry and poster to m/", async () => {
    const h = harness();
    const r = await approveReviewAsset(h.body({ altText: "Terrace at sunset" }), h.deps);
    assert.equal(r.status, 200);
    assert.deepEqual(data(r), { mediaAssetId: MEDIA, status: "PUBLISHED", transitioned: true });
    const row = h.row();
    assert.equal(row.status, "PUBLISHED");
    assert.equal(row.altText, "Terrace at sunset");
    assert.deepEqual(row.reviewedAt, NOW);
    assert.deepEqual(row.publishedAt, NOW);
    assert.deepEqual(h.decisions, ["approve:admin"]);
    assert.deepEqual([...h.access.published.keys()].sort(), [`m/${MEDIA}/${HASH16}/panorama.jpg`, `m/${MEDIA}/${HASH16}/poster.webp`]);
  });

  it("requires alt text (from the asset or the request), and rejects any other field", async () => {
    const h = harness();
    assert.equal(code(await approveReviewAsset(h.body({}), h.deps)), "ALT_TEXT_REQUIRED");
    for (const extra of [{ status: "PUBLISHED" }, { storageKey: "m/x" }, { altText: "x", ownerId: "admin" }, { altText: "   " }]) {
      assert.equal((await approveReviewAsset(h.body(extra), h.deps)).status, 400, JSON.stringify(extra));
    }
    assert.equal(h.row().status, "PENDING_REVIEW");
    const withAlt = harness(pendingRow({ altText: "From upload" }));
    assert.equal((await approveReviewAsset(withAlt.body({}), withAlt.deps)).status, 200);
    assert.equal(withAlt.row().altText, "From upload");
  });

  it("duplicate approval is idempotent: 200 transitioned=false, nothing re-decided, publication re-checked", async () => {
    const h = harness();
    await approveReviewAsset(h.body({ altText: "A" }), h.deps);
    const again = await approveReviewAsset(h.body({ altText: "B" }), h.deps);
    assert.deepEqual(data(again), { mediaAssetId: MEDIA, status: "PUBLISHED", transitioned: false });
    assert.equal(h.row().altText, "A", "a repeat approval changes nothing");
    assert.deepEqual(h.decisions, ["approve:admin"]);
  });

  it("approval after rejection → 409, nothing published", async () => {
    const h = harness();
    await rejectReviewAsset(h.body({ reason: "Blurry capture" }), h.deps);
    const r = await approveReviewAsset(h.body({ altText: "x" }), h.deps);
    assert.equal(code(r), "NOT_REVIEWABLE");
    assert.equal(h.access.published.size, 0);
  });

  it("stale or unfinished assets cannot be approved", async () => {
    for (const status of ["UPLOADED", "PROCESSING", "FAILED", "ARCHIVED"] as MediaAssetStatus[]) {
      const h = harness(pendingRow({ status, failureCode: status === "FAILED" ? "VALIDATION_FAILED" : null }));
      assert.equal(code(await approveReviewAsset(h.body({ altText: "x" }), h.deps)), "NOT_REVIEWABLE", status);
      assert.equal(h.access.published.size, 0);
    }
  });

  it("an inconsistent asset (missing processed fields) is refused before any decision", async () => {
    const h = harness(pendingRow({ storageKey: null }));
    assert.equal(code(await approveReviewAsset(h.body({ altText: "x" }), h.deps)), "INCONSISTENT_ASSET");
    assert.equal(h.row().status, "PENDING_REVIEW");
  });

  it("a missing review copy is caught before the decision; storage outage → 503 with no decision", async () => {
    const h = harness();
    h.access.reviewCopies.delete(`review/${MEDIA}/${HASH16}/poster.webp`);
    assert.equal(code(await approveReviewAsset(h.body({ altText: "x" }), h.deps)), "REVIEW_COPY_MISSING");
    assert.equal(h.row().status, "PENDING_REVIEW");
    const n = harness(pendingRow(), { access: null });
    assert.equal((await approveReviewAsset(n.body({ altText: "x" }), n.deps)).status, 503);
    assert.equal(n.row().status, "PENDING_REVIEW");
  });

  it("a publication failure after the decision → 502 retryable; approving again completes it", async () => {
    const h = harness();
    h.access.failPublish = new RetryableProcessingError("SlowDown (HTTP 503)");
    const first = await approveReviewAsset(h.body({ altText: "x" }), h.deps);
    assert.equal(first.status, 502);
    assert.equal((first.body as { retryable: boolean }).retryable, true);
    assert.equal(h.row().status, "PUBLISHED", "the decision stands; files follow on retry");
    const retry = await approveReviewAsset(h.body({}), h.deps);
    assert.equal(retry.status, 200);
    assert.deepEqual([...h.access.published.keys()].sort(), [`m/${MEDIA}/${HASH16}/panorama.jpg`, `m/${MEDIA}/${HASH16}/poster.webp`]);
  });

  it("an immutable-object conflict is a server error, never an overwrite", async () => {
    const h = harness();
    h.access.failPublish = new ImmutableObjectConflictError("different bytes");
    assert.equal((await approveReviewAsset(h.body({ altText: "x" }), h.deps)).status, 500);
  });
});

describe("review API: reject", () => {
  it("PENDING_REVIEW → REJECTED with a reason; nothing is published", async () => {
    const h = harness();
    const r = await rejectReviewAsset(h.body({ reason: "Contains people's faces" }), h.deps);
    assert.deepEqual(data(r), { mediaAssetId: MEDIA, status: "REJECTED", transitioned: true });
    assert.equal(h.row().rejectionReason, "Contains people's faces");
    assert.equal(h.access.published.size, 0);
  });

  it("needs a real reason; duplicate rejection is idempotent; rejection after publication → 409", async () => {
    const h = harness();
    assert.equal((await rejectReviewAsset(h.body({ reason: "no" }), h.deps)).status, 400);
    assert.equal((await rejectReviewAsset(h.body({ reason: "Bad", status: "REJECTED" }), h.deps)).status, 400);
    await rejectReviewAsset(h.body({ reason: "Blurry capture" }), h.deps);
    assert.deepEqual(data(await rejectReviewAsset(h.body({ reason: "Again" }), h.deps)), { mediaAssetId: MEDIA, status: "REJECTED", transitioned: false });
    assert.equal(h.row().rejectionReason, "Blurry capture");
    const p = harness();
    await approveReviewAsset(p.body({ altText: "x" }), p.deps);
    assert.equal(code(await rejectReviewAsset(p.body({ reason: "Too late" }), p.deps)), "NOT_REVIEWABLE");
    assert.equal(p.row().status, "PUBLISHED");
  });
});

describe("review API: concurrency", () => {
  it("simultaneous approve and reject: exactly one decision, and a rejected asset never has published files", async () => {
    for (let i = 0; i < 20; i++) {
      const h = harness();
      const [approve, reject] = await Promise.all([approveReviewAsset(h.body({ altText: "x" }), h.deps), rejectReviewAsset(h.body({ reason: "Race" }), h.deps)]);
      assert.equal(h.decisions.length, 1);
      if (h.row().status === "REJECTED") {
        assert.equal(approve.status, 409);
        assert.equal(h.access.published.size, 0);
      } else {
        assert.equal(h.row().status, "PUBLISHED");
        assert.equal(reject.status, 409);
      }
    }
  });

  it("two simultaneous approvals: one decision, both succeed, files published once", async () => {
    const h = harness();
    const results = await Promise.all([approveReviewAsset(h.body({ altText: "x" }), h.deps), approveReviewAsset(h.body({ altText: "x" }), h.deps)]);
    assert.deepEqual(results.map((r) => r.status), [200, 200]);
    assert.deepEqual(h.decisions, ["approve:admin"]);
    assert.deepEqual(results.map((r) => (data(r) as { transitioned: boolean }).transitioned).sort(), [false, true]);
  });

  it("only the REVIEW actor may publish or reject; the worker and sweeper never can", () => {
    const pairs = (actor: keyof typeof ACTOR_TRANSITIONS) => ACTOR_TRANSITIONS[actor].map(([f, t]) => `${f}→${t}`);
    assert.deepEqual(pairs("REVIEW"), ["PENDING_REVIEW→PUBLISHED", "PENDING_REVIEW→REJECTED"]);
    for (const actor of ["PROCESSING_WORKER", "SWEEPER", "UPLOAD_COMPLETION", "UPLOAD_INTENT"] as const) {
      assert.ok(!pairs(actor).some((p) => p.endsWith("→PUBLISHED") || p.endsWith("→REJECTED")), actor);
    }
  });
});
