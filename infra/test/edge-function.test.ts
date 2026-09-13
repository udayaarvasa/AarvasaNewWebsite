import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { MAX_FUNCTION_BYTES, renderViewerRequestFunction } from "../src/edge-function";

type Headers = Record<string, { value: string }>;
type Request = {
  method: string;
  uri: string;
  headers: Headers;
  querystring: Record<string, unknown>;
  cookies: Record<string, unknown>;
};
type Response = { statusCode: number; headers: Headers };

const ORIGINS = ["http://localhost:3000", "https://dev.example.test"];
const code = renderViewerRequestFunction(ORIGINS);
const handler = runInNewContext(`${code}\nhandler;`, {}) as (event: { request: Request }) => Request | Response;

const MEDIA = "/m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60";

function request(method: string, uri: string, headers: Record<string, string> = {}): Request {
  return {
    method,
    uri,
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, { value: v }])),
    querystring: { v: { value: "2" } },
    cookies: { "authjs.session-token": { value: "secret" } },
  };
}

const isResponse = (r: Request | Response): r is Response => "statusCode" in r;

describe("viewer-request CloudFront Function", () => {
  it("forwards valid media GETs with query strings and cookies stripped", () => {
    const result = handler({ request: request("GET", `${MEDIA}/scene.glb`, { origin: ORIGINS[0] }) });
    assert.ok(!isResponse(result));
    // Objects created inside the vm context have a different prototype, so compare keys.
    assert.deepEqual(Object.keys(result.querystring), []);
    assert.deepEqual(Object.keys(result.cookies), [], "session cookies must never reach the cache key or S3");
    assert.equal(result.uri, `${MEDIA}/scene.glb`);
  });

  it("forwards HEAD and range-style GETs for decoders and splat chunks", () => {
    assert.ok(!isResponse(handler({ request: request("HEAD", `${MEDIA}/lod-meta.json`) })));
    assert.ok(!isResponse(handler({ request: request("GET", "/lib/draco/1.5.7/draco_decoder.wasm", { range: "bytes=0-99" }) })));
  });

  it("returns 404 for originals, unknown types, traversal and non-layout paths", () => {
    for (const uri of [
      "/originals/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/capture.ply",
      `${MEDIA}/index.html`,
      `${MEDIA}/image.svg`,
      `${MEDIA}/loader.js`,
      `${MEDIA}/../../../originals/x.ply`,
      "/uploads/cm1abcd2ef3gh4/u1/scene.glb",
      "/",
      "/m/",
      "/robots.txt",
    ]) {
      const result = handler({ request: request("GET", uri) });
      assert.ok(isResponse(result), `expected a generated response for ${uri}`);
      assert.equal(result.statusCode, 404, uri);
      assert.equal(result.headers["x-content-type-options"]?.value, "nosniff");
    }
  });

  it("returns 405 for write methods", () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const result = handler({ request: request(method, `${MEDIA}/scene.glb`) });
      assert.ok(isResponse(result));
      assert.equal(result.statusCode, 405);
    }
  });

  it("answers preflight for allowed origins with an exact origin echo and no credentials", () => {
    for (const origin of ORIGINS) {
      const result = handler({
        request: request("OPTIONS", `${MEDIA}/scene.glb`, {
          origin,
          "access-control-request-method": "GET",
          "access-control-request-headers": "range",
        }),
      });
      assert.ok(isResponse(result));
      assert.equal(result.statusCode, 204);
      assert.equal(result.headers["access-control-allow-origin"]?.value, origin);
      assert.equal(result.headers["access-control-allow-methods"]?.value, "GET, HEAD");
      assert.equal(result.headers["access-control-allow-headers"]?.value, "Range");
      assert.equal(result.headers.vary?.value, "Origin");
      assert.equal(result.headers["access-control-allow-credentials"], undefined);
    }
  });

  it("refuses preflight from other origins or for write methods", () => {
    const cases: Array<Record<string, string>> = [
      { origin: "https://evil.example", "access-control-request-method": "GET" },
      { origin: "http://localhost:3001", "access-control-request-method": "GET" },
      { origin: "null", "access-control-request-method": "GET" },
      { "access-control-request-method": "GET" },
      { origin: ORIGINS[0], "access-control-request-method": "PUT" },
    ];
    for (const headers of cases) {
      const result = handler({ request: request("OPTIONS", `${MEDIA}/scene.glb`, headers) });
      assert.ok(isResponse(result));
      assert.equal(result.statusCode, 403, JSON.stringify(headers));
      assert.equal(result.headers["access-control-allow-origin"], undefined);
    }
  });

  it("fits CloudFront Functions limits and runtime 2.0 syntax", () => {
    assert.ok(Buffer.byteLength(code) < MAX_FUNCTION_BYTES, "rendered function must be under 10 KB");
    assert.ok(!/__[A-Z_]+_JSON__/.test(code), "no unreplaced placeholders");
    const template = readFileSync(join(__dirname, "..", "..", "..", "functions", "viewer-request.js"), "utf8");
    // Syntax outside the documented runtime 2.0 feature list.
    for (const pattern of [/\?\./, /\?\?/, /\.\.\.[A-Za-z]/, /\bclass\s/, /\bfor\s*\([^)]*\bof\b/, /\bimport\b/, /\brequire\(/]) {
      assert.ok(!pattern.test(template), `template uses unsupported syntax: ${pattern}`);
    }
  });
});
