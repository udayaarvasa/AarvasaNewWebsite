/**
 * Retired. This endpoint used to simulate a ledger: it minted a random "hash",
 * reported it "verified" a few seconds later and claimed an escrow lock and a
 * 4/5 MPC quorum — none of which existed. Aarvasa has no blockchain
 * integration, so the endpoint now says so and returns nothing that could be
 * mistaken for a transaction. 410 Gone, because the resource was removed on
 * purpose and will not come back in this form.
 *
 * No imports, so the test can load this module directly.
 */
const body = {
  error: "Gone",
  message: "Aarvasa has no blockchain or escrow integration. This endpoint has been retired.",
};

const gone = () =>
  Response.json(body, { status: 410, headers: { "Cache-Control": "no-store" } });

export const GET = gone;
export const POST = gone;
