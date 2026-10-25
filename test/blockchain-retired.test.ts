/**
 * The simulated ledger is gone: no endpoint returns a transaction-shaped
 * answer, and no copy says an enquiry is routed somewhere it is not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

import * as transaction from "../src/app/api/blockchain/transaction/route.ts";
import * as status from "../src/app/api/blockchain/status/route.ts";

const fabricated = /0x[0-9a-f]{8,}|escrowLocked|mpcQuorum|"verified"|smartContract|hash/i;

test("both blockchain endpoints answer 410 with nothing that looks like a transaction", async () => {
  for (const handler of [transaction.GET, transaction.POST, status.GET, status.POST]) {
    const res = handler();
    assert.equal(res.status, 410);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const text = await res.text();
    assert.doesNotMatch(text, fabricated);
    assert.match(JSON.parse(text).message, /no blockchain or escrow integration/);
  }
});

test("the simulation and its Mongo store are removed", async () => {
  for (const f of ["../src/lib/blockchain.ts", "../src/lib/db.ts", "../src/models/Transaction.ts"]) {
    await assert.rejects(access(new URL(f, import.meta.url)), f);
  }
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies.mongoose, undefined);
});

test("enquiry copy describes the email hand-off, not a routed lead", async () => {
  const files = [
    "../src/components/lux/ledger-chain.tsx",
    "../src/app/contact/page.tsx",
    "../src/app/services/page.tsx",
    "../src/components/lux/home.tsx",
  ];
  for (const f of files) {
    // Comments may record what the copy used to say; only shipped strings count.
    const src = (await readFile(new URL(f, import.meta.url), "utf8")).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(src, /developer's desk|Routed to the developer|reaches the developer or their appointed channel partner directly|one enquiry, to the developer/i, f);
  }
  const ledger = await readFile(new URL("../src/components/lux/ledger-chain.tsx", import.meta.url), "utf8");
  assert.match(ledger, /title: "Enquiry by email"/);
  assert.match(ledger, /title: "Title on-chain", body: "[^"]+", live: false/);
  assert.match(ledger, /title: "Escrow", body: "[^"]+", live: false/);
});

test("the unverified exclusivity claim is gone", async () => {
  const home = await readFile(new URL("../src/components/lux/home.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(home, /eyebrow="[^"]*Exclusive to Aarvasa/);
});
