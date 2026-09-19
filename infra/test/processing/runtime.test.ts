import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readProcessingRuntimeConfig } from "../../src/runtime/config";
import { getDatabaseUrl, parseDatabaseUrl, type SecretReader } from "../../src/runtime/database";

const ENV = {
  MEDIA_REGION: "ap-south-1",
  MEDIA_INGEST_BUCKET: "aarvasa-media-dev-ingest-123456789012-ap-south-1",
  MEDIA_PUBLISHED_BUCKET: "aarvasa-media-dev-published-123456789012-ap-south-1",
  MEDIA_PROCESSING_QUEUE_URL: "https://sqs.ap-south-1.amazonaws.com/123456789012/aarvasa-media-dev-processing",
  MEDIA_DATABASE_SECRET_ARN: "arn:aws:secretsmanager:ap-south-1:123456789012:secret:aarvasa-media-dev/database-AbCdEf",
};

describe("processing runtime configuration", () => {
  it("reads every value from the environment", () => {
    assert.deepEqual(readProcessingRuntimeConfig(ENV), {
      region: "ap-south-1",
      ingestBucket: ENV.MEDIA_INGEST_BUCKET,
      publishedBucket: ENV.MEDIA_PUBLISHED_BUCKET,
      queueUrl: ENV.MEDIA_PROCESSING_QUEUE_URL,
      databaseSecretArn: ENV.MEDIA_DATABASE_SECRET_ARN,
    });
  });

  it("fails closed on anything missing or malformed, naming only the variable", () => {
    const cases: Array<Record<string, string>> = [
      { MEDIA_REGION: "" },
      { MEDIA_INGEST_BUCKET: "Bad_Bucket" },
      { MEDIA_PUBLISHED_BUCKET: ENV.MEDIA_INGEST_BUCKET },
      { MEDIA_PROCESSING_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/123456789012/q" },
      { MEDIA_DATABASE_SECRET_ARN: "postgresql://user:pw@host/db" },
    ];
    for (const override of cases) {
      assert.throws(() => readProcessingRuntimeConfig({ ...ENV, ...override }), (e: Error) => /misconfigured: MEDIA_/.test(e.message) && !e.message.includes("pw@"));
    }
  });
});

describe("database secret", () => {
  it("accepts a raw URL or JSON with DATABASE_URL, and nothing else", () => {
    assert.equal(parseDatabaseUrl("postgresql://u:p@db.example:5432/app"), "postgresql://u:p@db.example:5432/app");
    assert.equal(parseDatabaseUrl(JSON.stringify({ DATABASE_URL: "postgres://u:p@db/app", other: 1 })), "postgres://u:p@db/app");
    for (const bad of ["", "mysql://x", "{not json", JSON.stringify({ url: "postgresql://x" }), "postgresql://has space/x"]) {
      assert.throws(() => parseDatabaseUrl(bad), (e: Error) => !e.message.includes("postgresql://"));
    }
  });

  it("reads the secret once per container, and retries after a failed read", async () => {
    let calls = 0;
    let fail = true;
    const reader: SecretReader = {
      async readSecretString() {
        calls++;
        if (fail) throw new Error("AccessDenied");
        return "postgresql://u:p@db/app";
      },
    };
    await assert.rejects(getDatabaseUrl(reader, ENV.MEDIA_DATABASE_SECRET_ARN));
    fail = false;
    assert.equal(await getDatabaseUrl(reader, ENV.MEDIA_DATABASE_SECRET_ARN), "postgresql://u:p@db/app");
    assert.equal(await getDatabaseUrl(reader, ENV.MEDIA_DATABASE_SECRET_ARN), "postgresql://u:p@db/app");
    assert.equal(calls, 2);
  });
});
