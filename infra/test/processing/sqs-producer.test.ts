import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import { buildProcessingJob, parseProcessingJob, type ProcessingJob } from "../../../shared/media-processing";
import { createSqsProcessingJobQueue, getProcessingJobQueue, readProcessingQueueConfig } from "../../../src/lib/media/processing-queue";

/** Real AWS SDK SQS client, stub transport, fake credentials: nothing reaches AWS. */
const credentials = { accessKeyId: "TESTONLYACCESSKEYID", secretAccessKey: "test-only-secret-not-a-real-key" };
const QUEUE_URL = "https://sqs.ap-south-1.amazonaws.com/123456789012/aarvasa-media-dev-processing";
const MEDIA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const KEY = `uploads/${MEDIA}/0f1e2d3c4b5a69788796a5b4c3d2e1f0/source.glb`;

function stub(statusCode = 200, options: { wrongMd5?: boolean } = {}) {
  const requests: Array<{ method: string; hostname: string; target: string; body: { QueueUrl: string; MessageBody: string } }> = [];
  const requestHandler = {
    handle: async (req: { method: string; hostname: string; headers: Record<string, string>; body: Uint8Array }) => {
      const body = JSON.parse(Buffer.from(req.body).toString("utf8"));
      requests.push({ method: req.method, hostname: req.hostname, target: req.headers["x-amz-target"], body });
      const md5 = createHash("md5").update(options.wrongMd5 ? "tampered" : body.MessageBody).digest("hex");
      const payload = statusCode === 200 ? { MessageId: "m-1", MD5OfMessageBody: md5 } : { __type: "com.amazonaws.sqs#InternalError", message: "boom" };
      return { response: { statusCode, headers: { "content-type": "application/x-amz-json-1.0" }, body: Readable.from([Buffer.from(JSON.stringify(payload))]) } };
    },
  };
  const queue = createSqsProcessingJobQueue({ region: "ap-south-1", queueUrl: QUEUE_URL }, { credentials, requestHandler: requestHandler as never, maxAttempts: 1 });
  return { queue, requests };
}

const job = () => buildProcessingJob({ id: MEDIA, sourceKey: KEY }, randomUUID(), new Date("2026-09-19T10:00:00.000Z"));

describe("SQS processing-job producer (AWS SDK, offline)", () => {
  it("sends exactly the serialized job to the configured queue with SendMessage", async () => {
    const s = stub();
    const j = job();
    await s.queue.send(j);
    assert.equal(s.requests.length, 1);
    const [r] = s.requests;
    assert.equal(r.method, "POST");
    assert.equal(r.hostname, "sqs.ap-south-1.amazonaws.com");
    assert.equal(r.target, "AmazonSQS.SendMessage");
    assert.equal(r.body.QueueUrl, QUEUE_URL);
    assert.deepEqual(Object.keys(r.body).sort(), ["MessageBody", "QueueUrl"], "no attributes, delays or group ids");
    const parsed = parseProcessingJob(r.body.MessageBody);
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.ok && parsed.job, j);
    assert.ok(Buffer.byteLength(r.body.MessageBody) <= 1024);
    assert.doesNotMatch(r.body.MessageBody, /https?:\/\/|X-Amz-|secret|password/i, "identifiers only");
  });

  it("refuses to send an invalid or tampered job", async () => {
    const s = stub();
    const tampered = { ...job(), sourceKey: `uploads/ffffffffffffffffffffffffffffffff/0f1e2d3c4b5a69788796a5b4c3d2e1f0/source.glb` } as ProcessingJob;
    await assert.rejects(s.queue.send(tampered), /invalid processing job/);
    const extra = { ...job(), status: "PUBLISHED" } as unknown as ProcessingJob;
    await s.queue.send(extra); // extra properties are dropped by the fixed-field serializer
    assert.deepEqual(Object.keys(JSON.parse(s.requests[0].body.MessageBody)).includes("status"), false);
  });

  it("surfaces SQS failures and MD5 mismatches to the caller (who leaves the row for the sweeper)", async () => {
    await assert.rejects(stub(500).queue.send(job()));
    await assert.rejects(stub(200, { wrongMd5: true }).queue.send(job()));
  });

  it("reads the queue only from server configuration and fails closed", () => {
    assert.deepEqual(readProcessingQueueConfig({ MEDIA_REGION: "ap-south-1", MEDIA_PROCESSING_QUEUE_URL: QUEUE_URL }), { region: "ap-south-1", queueUrl: QUEUE_URL });
    for (const env of [
      {},
      { MEDIA_REGION: "ap-south-1" },
      { MEDIA_PROCESSING_QUEUE_URL: QUEUE_URL },
      { MEDIA_REGION: "us-east-1", MEDIA_PROCESSING_QUEUE_URL: QUEUE_URL },
      { MEDIA_REGION: "ap-south-1", MEDIA_PROCESSING_QUEUE_URL: "http://sqs.ap-south-1.amazonaws.com/123456789012/q" },
      { MEDIA_REGION: "ap-south-1", MEDIA_PROCESSING_QUEUE_URL: "https://evil.example/123456789012/q" },
      { MEDIA_REGION: "ap-south-1", MEDIA_PROCESSING_QUEUE_URL: `${QUEUE_URL}/../other` },
    ]) {
      assert.equal(readProcessingQueueConfig(env), null, JSON.stringify(env));
      assert.equal(getProcessingJobQueue(env), null);
    }
    assert.ok(getProcessingJobQueue({ MEDIA_REGION: "ap-south-1", MEDIA_PROCESSING_QUEUE_URL: QUEUE_URL }));
  });
});
