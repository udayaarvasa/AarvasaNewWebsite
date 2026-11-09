import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../infra/cloudfront/apex-redirect-and-app-links.js", import.meta.url), "utf8");
const association = JSON.parse(readFileSync(new URL("../public/.well-known/assetlinks.json", import.meta.url), "utf8"));
const context = vm.createContext({});
vm.runInContext(source, context);
const run = (request: object) => JSON.parse(JSON.stringify(context.handler({ request })));
const request = (host: string, uri: string, method = "GET") => ({
  method, uri, headers: { host: { value: host } }, querystring: {},
});

test("serves the Play Console association directly on both website hosts", () => {
  assert.equal(association[0].target.package_name, "com.aarvasa.app");
  assert.match(association[0].target.sha256_cert_fingerprints[0], /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  for (const host of ["www.aarvasa.com", "aarvasa.com"]) {
    const response = run(request(host, "/.well-known/assetlinks.json"));
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"].value, "application/json");
    assert.equal(response.headers.location, undefined);
    assert.deepEqual(JSON.parse(response.body), association);
    const head = run(request(host, "/.well-known/assetlinks.json", "HEAD"));
    assert.equal(head.statusCode, 200);
    assert.equal(head.body, "");
  }
});

test("keeps application requests and unrelated hosts on the existing origin path", () => {
  for (const uri of ["/", "/listings", "/api/auth/session", "/api/mobile/auth/me", "/.well-known/assetlinks.json/extra"]) {
    const input = request("www.aarvasa.com", uri);
    assert.deepEqual(run(input), input);
  }
  for (const input of [request("new.aarvasa.com", "/.well-known/assetlinks.json"), request("www.aarvasa.com", "/.well-known/assetlinks.json", "POST")]) {
    assert.deepEqual(run(input), input);
  }
});

test("preserves the apex redirect and repeated query parameters", () => {
  const input = request("aarvasa.com", "/listings");
  Object.assign(input.querystring, { city: { value: "Bhopal" }, tag: { multiValue: [{ value: "a" }, { value: "b" }] }, featured: { value: "" } });
  const response = run(input);
  assert.equal(response.statusCode, 301);
  assert.equal(response.headers.location.value, "https://www.aarvasa.com/listings?city=Bhopal&tag=a&tag=b&featured");
});
