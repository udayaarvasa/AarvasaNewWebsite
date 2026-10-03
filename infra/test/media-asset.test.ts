import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  FORMATS_BY_KIND,
  MEDIA_ASSET_FORMATS,
  MEDIA_ASSET_KINDS,
  MEDIA_ASSET_STATUSES,
  MEDIA_FAILURE_CODES,
  MEDIA_SUBJECT_TYPES,
  SHA256_BASE64_PATTERN,
  type MediaAssetRecord,
  validateMediaAssetRecord,
} from "../../shared/media-asset";

/** infra/dist/infra/test → repository root. */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const SCHEMA = readFileSync(join(REPO_ROOT, "prisma", "schema.prisma"), "utf8");
const MIGRATIONS = join(REPO_ROOT, "prisma", "migrations");

const block = (keyword: "enum" | "model", name: string): string => {
  const match = SCHEMA.match(new RegExp(`^${keyword} ${name} \\{\\n([\\s\\S]*?)^\\}`, "m"));
  assert.ok(match, `${keyword} ${name} exists in schema.prisma`);
  return match[1];
};
const enumValues = (name: string) =>
  block("enum", name)
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
/** field name → the rest of its declaration, for the MediaAsset model. */
const mediaFields = new Map(
  block("model", "MediaAsset")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => line && !line.startsWith("@@"))
    .map((line) => {
      const [name, ...rest] = line.split(/\s+/);
      return [name, rest.join(" ")] as const;
    }),
);
const mediaIndexes = block("model", "MediaAsset")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("@@"));

const MEDIA_ID = "cm1abcd2ef3gh4ij5kl6mn7op";
const VERSION = "de1d54d4e9da0d02";
const SHA = "370418ddb037b189a64f4c1f761398b8fcf9974ca9028b9ab188bb3a37ba7ef2";
/** The same digest as S3 carries it: canonical base64. */
const SHA_BASE64 = Buffer.from(SHA, "hex").toString("base64");

const publishedModel: MediaAssetRecord = {
  id: MEDIA_ID,
  subjectType: "PROPERTY",
  propertyId: "cproperty0000000000000001",
  projectSlug: null,
  kind: "MODEL",
  format: "GLB",
  status: "PUBLISHED",
  storageKey: `m/${MEDIA_ID}/${VERSION}`,
  entryFile: "scene.glb",
  contentHash: SHA,
  mimeType: "model/gltf-binary",
  sizeBytes: 1840,
  fileCount: 2,
  posterKey: `m/${MEDIA_ID}/${VERSION}/poster.webp`,
  altText: "Tower on a podium slab",
  sourceKey: `originals/${MEDIA_ID}/${VERSION}/tower.glb`,
  sourceSizeBytes: 1840,
  sourceMimeType: "model/gltf-binary",
  sourceChecksumSha256: null,
  reviewedAt: new Date("2026-09-14T10:00:00Z"),
  publishedAt: new Date("2026-09-14T10:05:00Z"),
  rejectionReason: null,
  processingError: null,
};

const uploadedProjectPanorama: MediaAssetRecord = {
  ...publishedModel,
  subjectType: "PROJECT",
  propertyId: null,
  projectSlug: "reef-996-dubai-production-city",
  kind: "PANORAMA",
  format: null,
  status: "UPLOADED",
  storageKey: null,
  entryFile: null,
  contentHash: null,
  mimeType: null,
  sizeBytes: null,
  fileCount: null,
  posterKey: null,
  altText: null,
  sourceKey: `uploads/${MEDIA_ID}/upl01/terrace.jpg`,
  sourceSizeBytes: 9_000_000,
  sourceMimeType: "image/jpeg",
  sourceChecksumSha256: SHA_BASE64,
  reviewedAt: null,
  publishedAt: null,
};

describe("MediaAsset Prisma schema", () => {
  it("defines exactly the enum values the shared contract uses", () => {
    assert.deepEqual(enumValues("MediaSubjectType"), [...MEDIA_SUBJECT_TYPES]);
    assert.deepEqual(enumValues("MediaAssetKind"), [...MEDIA_ASSET_KINDS]);
    assert.deepEqual(enumValues("MediaAssetFormat"), [...MEDIA_ASSET_FORMATS]);
    assert.deepEqual(enumValues("MediaAssetStatus"), [...MEDIA_ASSET_STATUSES]);
    assert.deepEqual(Object.values(FORMATS_BY_KIND).flat().sort(), [...MEDIA_ASSET_FORMATS].sort(), "every format belongs to one kind");
  });

  it("has a lifecycle covering processing, review, publication, failure and retirement", () => {
    for (const status of ["UPLOADED", "PROCESSING", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "FAILED", "ARCHIVED"]) {
      assert.ok(MEDIA_ASSET_STATUSES.includes(status as never), status);
    }
    assert.equal(mediaFields.get("status"), "MediaAssetStatus @default(UPLOADED)");
  });

  it("links properties by foreign key without cascading deletes, and projects by slug only", () => {
    assert.equal(mediaFields.get("propertyId"), "String?");
    assert.match(mediaFields.get("property") ?? "", /^Property\? @relation\(fields: \[propertyId\], references: \[id\], onDelete: Restrict\)$/);
    assert.equal(mediaFields.get("projectSlug"), "String?");
    assert.ok(![...mediaFields.keys()].some((f) => /^project(Id)?$/.test(f)), "no fabricated project relation");
    assert.doesNotMatch(SCHEMA, /^model Project\b/m, "no Project table");
    assert.match(block("model", "Property"), /^\s+mediaAssets MediaAsset\[\]$/m);
    assert.match(mediaFields.get("uploadedBy") ?? "", /onDelete: SetNull\)$/);
    assert.match(mediaFields.get("reviewedBy") ?? "", /onDelete: SetNull\)$/);
  });

  it("stores object keys as plain strings and never a URL or CDN origin", () => {
    for (const field of ["storageKey", "entryFile", "posterKey"]) assert.equal(mediaFields.get(field), "String?", field);
    assert.equal(mediaFields.get("sourceKey"), "String");
    assert.equal(mediaFields.get("sourceChecksumSha256"), "String?", "declared source SHA-256, separate from contentHash");
    assert.ok(![...mediaFields.keys()].some((f) => /url|origin|cdn/i.test(f)), "no URL-shaped columns");
    assert.doesNotMatch(block("model", "MediaAsset"), /https?:|cloudfront|media\.aarvasa/i);
  });

  it("keeps core fields typed and renderer metadata in JSON", () => {
    assert.equal(mediaFields.get("kind"), "MediaAssetKind");
    assert.equal(mediaFields.get("subjectType"), "MediaSubjectType");
    assert.equal(mediaFields.get("sizeBytes"), "Int?");
    assert.equal(mediaFields.get("sourceSizeBytes"), "Int");
    assert.equal(mediaFields.get("sortOrder"), "Int @default(0)");
    for (const field of ["dimensions", "metrics", "viewDefaults"]) assert.equal(mediaFields.get(field), "Json?", field);
  });

  it("indexes the access patterns without making keys or hashes unique", () => {
    assert.deepEqual(mediaIndexes, [
      "@@index([propertyId, status, sortOrder])", // a property's (published) media, in order
      "@@index([projectSlug, status, sortOrder])", // a project's (published) media, in order
      // Public project lookups filter on provenance too, so engineering assets
      // are excluded in the query rather than after it.
      "@@index([projectSlug, status, provenance, sortOrder])",
      "@@index([status, createdAt])", // processing and review queues, oldest first
      "@@index([contentHash])", // duplicate detection
      "@@index([uploadedById])",
    ]);
    assert.doesNotMatch(block("model", "MediaAsset"), /@unique|@@unique/, "same binary may belong to several subjects or versions");
  });
});

describe("MediaAsset migrations", () => {
  const dirs = readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const sql = (dir: string) => readFileSync(join(MIGRATIONS, dir, "migration.sql"), "utf8");

  it("baselines the pre-existing schema, then adds MediaAsset", () => {
    assert.ok(existsSync(join(MIGRATIONS, "migration_lock.toml")));
    assert.deepEqual(dirs, [
      "0_init",
      "20260914120000_add_media_asset",
      "20260914140000_add_media_source_checksum",
      "20260919120000_add_media_processing_state",
      // Entitlements: the commercial boundary for premium creation. Listed here
      // so an unreviewed migration appearing in this directory still fails.
      "20260927102729_add_entitlements",
      // Provenance: what an asset actually is, and therefore whether it may be
      // shown publicly at all. Defaults to INTERNAL_TEST, so nothing becomes
      // public by migration.
      "20261003073926_media_provenance",
    ]);
    const init = sql("0_init");
    assert.match(init, /NEVER execute this against an existing database/);
    assert.deepEqual([...init.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]), ["User", "Account", "Session", "VerificationToken", "Property", "Favorite", "Inquiry"]);
    assert.doesNotMatch(init, /MediaAsset|MediaSubjectType/);
  });

  it("adds entitlements without touching anything that already existed", () => {
    const add = sql("20260927102729_add_entitlements");
    assert.doesNotMatch(add, /\bDROP\b|\bTRUNCATE\b|^\s*DELETE\s+FROM\b/m);
    // Only the two new tables are created; nothing pre-existing is redefined.
    assert.deepEqual([...add.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]), ["Entitlement", "Payment"]);
    // An entitlement row must not be permission by existing: the column defaults
    // to the denying state.
    assert.match(add, /"status" "EntitlementStatus" NOT NULL DEFAULT 'INACTIVE'/);
  });

  it("is purely additive: it never alters or drops existing tables or types", () => {
    const add = sql("20260914120000_add_media_asset");
    assert.doesNotMatch(add, /\bDROP\b|\bTRUNCATE\b|^\s*DELETE\s+FROM\b|^\s*UPDATE\s+"/m);
    for (const m of add.matchAll(/ALTER TABLE "(\w+)"/g)) assert.equal(m[1], "MediaAsset");
    assert.deepEqual([...add.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]), ["MediaAsset"]);
    assert.doesNotMatch(add, /https?:\/\/|cloudfront/i);
  });

  it("enforces the invariants Prisma cannot express as CHECK constraints", () => {
    const add = sql("20260914120000_add_media_asset");
    for (const name of ["subject", "lifecycle", "object_keys", "sizes"]) {
      assert.match(add, new RegExp(`ADD CONSTRAINT "MediaAsset_${name}_check" CHECK`), name);
    }
    assert.match(add, /"subjectType" = 'PROPERTY' AND "propertyId" IS NOT NULL AND "projectSlug" IS NULL/);
    assert.match(add, /"subjectType" = 'PROJECT' AND "projectSlug" IS NOT NULL AND "propertyId" IS NULL/);
    assert.match(add, /FOREIGN KEY \("propertyId"\) REFERENCES "Property"\("id"\) ON DELETE RESTRICT/);
    assert.doesNotMatch(add, /projectSlug"\) REFERENCES/, "no project foreign key");
  });
});

describe("MediaAsset source checksum migration", () => {
  const add = readFileSync(join(MIGRATIONS, "20260914140000_add_media_source_checksum", "migration.sql"), "utf8");
  const pattern = add.match(/"sourceChecksumSha256" ~ '([^']+)'/)?.[1];

  it("only adds one nullable column and one CHECK constraint to MediaAsset", () => {
    const statements = add.split(";").map((st) => st.replace(/--.*$/gm, "").trim()).filter(Boolean);
    assert.equal(statements.length, 2);
    assert.match(statements[0], /^ALTER TABLE "MediaAsset" ADD COLUMN "sourceChecksumSha256" TEXT$/);
    assert.match(statements[1], /^ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_source_checksum_check" CHECK \(/);
    assert.doesNotMatch(add, /\bDROP\b|\bTRUNCATE\b|\bDELETE\b|\bUPDATE\b|NOT NULL|DEFAULT|https?:\/\//i);
  });

  it("enforces the same canonical base64 SHA-256 shape as the application", () => {
    assert.equal(pattern, SHA256_BASE64_PATTERN.source);
  });
});

describe("MediaAsset processing-state migration", () => {
  const add = readFileSync(join(MIGRATIONS, "20260919120000_add_media_processing_state", "migration.sql"), "utf8");

  it("adds the processing columns additively and one CHECK constraint", () => {
    assert.doesNotMatch(add, /\bDROP\b|\bTRUNCATE\b|^\s*DELETE\b|^\s*UPDATE\s+"/im);
    for (const column of ['"failureCode" TEXT', '"processingAttempts" INTEGER NOT NULL DEFAULT 0', '"processingLeaseExpiresAt" TIMESTAMP(3)', '"processingStartedAt" TIMESTAMP(3)']) {
      assert.ok(add.includes(`ADD COLUMN     ${column}`), column);
    }
    assert.match(add, /ADD CONSTRAINT "MediaAsset_processing_check" CHECK/);
  });

  it("lists exactly the shared failure codes", () => {
    const listed = [...add.slice(add.indexOf('"failureCode" IN (')).matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    assert.deepEqual(listed, [...MEDIA_FAILURE_CODES]);
  });

  it("matches the schema", () => {
    assert.equal(mediaFields.get("processingStartedAt"), "DateTime?");
    assert.equal(mediaFields.get("processingAttempts"), "Int @default(0)");
    assert.equal(mediaFields.get("processingLeaseExpiresAt"), "DateTime?");
    assert.equal(mediaFields.get("failureCode"), "String?");
  });
});

describe("validateMediaAssetRecord", () => {
  it("accepts a published PROPERTY model and an uploaded PROJECT panorama", () => {
    assert.deepEqual(validateMediaAssetRecord(publishedModel), []);
    assert.deepEqual(validateMediaAssetRecord(uploadedProjectPanorama), []);
  });

  it("requires exactly one subject that matches subjectType", () => {
    const cases: Array<Partial<MediaAssetRecord>> = [
      { subjectType: "PROPERTY", propertyId: null, projectSlug: "reef-996-dubai-production-city" },
      { subjectType: "PROJECT", propertyId: "cproperty0000000000000001", projectSlug: null },
      { subjectType: "PROPERTY", propertyId: "cproperty0000000000000001", projectSlug: "reef-996-dubai-production-city" },
      { subjectType: "PROJECT", propertyId: null, projectSlug: null },
      { subjectType: "PROJECT", propertyId: null, projectSlug: "REEF 996" },
    ];
    for (const c of cases) assert.ok(validateMediaAssetRecord({ ...publishedModel, ...c }).length > 0, JSON.stringify(c));
  });

  it("rejects URLs, CDN origins and foreign keys where object keys belong", () => {
    const cdn = "https://d1l4p1pty829ds.cloudfront.net";
    const cases: Array<Partial<MediaAssetRecord>> = [
      { storageKey: `${cdn}/m/${MEDIA_ID}/${VERSION}` },
      { storageKey: `/m/${MEDIA_ID}/${VERSION}` },
      { storageKey: `m/othermedia0001/${VERSION}` },
      { storageKey: `m/${MEDIA_ID}/${VERSION}/scene.glb` },
      { posterKey: `${cdn}/m/${MEDIA_ID}/${VERSION}/poster.webp` },
      { posterKey: `m/${MEDIA_ID}/ffffffffffffffff/poster.webp` },
      { entryFile: "../../originals/x.glb" },
      { entryFile: "scene.html" },
      { sourceKey: "https://example.com/tower.glb" },
      { sourceKey: `uploads/othermedia0001/upl01/tower.glb` },
      { sourceKey: `uploads/${MEDIA_ID}/../../m/x.glb` },
    ];
    for (const c of cases) assert.ok(validateMediaAssetRecord({ ...publishedModel, ...c }).length > 0, JSON.stringify(c));
  });

  it("enforces lifecycle requirements", () => {
    assert.ok(validateMediaAssetRecord({ ...publishedModel, storageKey: null, posterKey: null }).length > 0, "published without processed fields");
    assert.ok(validateMediaAssetRecord({ ...publishedModel, status: "PENDING_REVIEW", contentHash: null }).length > 0, "review without hash");
    assert.ok(validateMediaAssetRecord({ ...publishedModel, publishedAt: null }).length > 0, "published without publishedAt");
    assert.ok(validateMediaAssetRecord({ ...publishedModel, altText: " " }).length > 0, "published without alt text");
    assert.ok(validateMediaAssetRecord({ ...uploadedProjectPanorama, status: "REJECTED" }).length > 0, "rejected without reason");
    assert.ok(validateMediaAssetRecord({ ...uploadedProjectPanorama, status: "FAILED" }).length > 0, "failed without error");
    assert.deepEqual(validateMediaAssetRecord({ ...uploadedProjectPanorama, status: "FAILED", processingError: "GPS EXIF", failureCode: "VALIDATION_FAILED" }), []);
    assert.deepEqual(validateMediaAssetRecord({ ...uploadedProjectPanorama, status: "PROCESSING", processingStartedAt: new Date("2026-09-19T10:00:00Z") }), []);
    assert.deepEqual(validateMediaAssetRecord({ ...publishedModel, status: "ARCHIVED" }), []);
  });

  it("checks typed core fields against the storage contract", () => {
    assert.ok(validateMediaAssetRecord({ ...publishedModel, format: "SOG" }).length > 0, "kind/format mismatch");
    assert.ok(validateMediaAssetRecord({ ...publishedModel, mimeType: "application/octet-stream" }).length > 0, "MIME type mismatch");
    assert.ok(validateMediaAssetRecord({ ...publishedModel, contentHash: VERSION }).length > 0, "content hash is a full SHA-256");
    assert.ok(validateMediaAssetRecord({ ...publishedModel, sizeBytes: -1 }).length > 0);
    assert.ok(validateMediaAssetRecord({ ...publishedModel, fileCount: 0 }).length > 0);
  });

  it("requires a known failureCode exactly when FAILED, a start time while PROCESSING, and leases only while PROCESSING", () => {
    const failed = { ...uploadedProjectPanorama, status: "FAILED" as const, processingError: "x" };
    assert.ok(validateMediaAssetRecord(failed).some((p) => /failureCode/.test(p)), "FAILED without a code");
    assert.deepEqual(validateMediaAssetRecord({ ...failed, failureCode: "VALIDATION_FAILED" }), []);
    assert.ok(validateMediaAssetRecord({ ...failed, failureCode: "WHATEVER" }).length > 0);
    assert.ok(validateMediaAssetRecord({ ...uploadedProjectPanorama, failureCode: "VALIDATION_FAILED" }).length > 0, "code on a non-FAILED asset");
    const processing = { ...uploadedProjectPanorama, status: "PROCESSING" as const };
    assert.ok(validateMediaAssetRecord({ ...processing, processingStartedAt: null }).length > 0);
    assert.deepEqual(validateMediaAssetRecord({ ...processing, processingStartedAt: new Date(), processingLeaseExpiresAt: new Date(), processingAttempts: 1 }), []);
    assert.ok(validateMediaAssetRecord({ ...uploadedProjectPanorama, processingLeaseExpiresAt: new Date() }).length > 0, "lease outside PROCESSING");
    assert.ok(validateMediaAssetRecord({ ...uploadedProjectPanorama, processingAttempts: -1 }).length > 0);
  });

  it("accepts only a canonical base64 SHA-256 as the source checksum, never contentHash's hex", () => {
    assert.deepEqual(validateMediaAssetRecord({ ...uploadedProjectPanorama, sourceChecksumSha256: null }), []);
    for (const bad of [SHA, SHA_BASE64.replace(/=$/, ""), `${SHA_BASE64.slice(0, 42)}B=`, "https://example.com/x", ""]) {
      assert.ok(validateMediaAssetRecord({ ...uploadedProjectPanorama, sourceChecksumSha256: bad }).length > 0, bad);
    }
  });
});
