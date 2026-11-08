# Aarvasa digital property dashboard

Run the existing website with `npm run dev`, then open
`http://127.0.0.1:3000/labs/ownership-dashboard`.
The local lab alias returns 404 outside development mode. The public demo route is
`/blockchain/demo`, linked from the blockchain roadmap and footer.

Demo credentials: workspace `demo`, password `aarvasa`.
These unlock a local presentation only, not account authentication. No credentials
are stored, and signing out or reloading discards the simulation.

The design follows the supplied Aussie Estates reference: photo-backed sign-in,
floating sidebar and toolbar, translucent panels, activity chart, allocation donut,
summary cards, review queue and activity table. It uses Aarvasa's wine, ivory and
gold palette. The sign-in background uses the existing REEF 999 developer render;
all dashboard assets, wallets, balances and documents are explicitly fictional.

The guided sequence anchors a SHA-256 fingerprint, allowlists Investor C, issues
250 units, transfers 50 units, pauses the class, demonstrates a blocked transfer,
and resumes. Manual issuance, transfers, allowlisting, review, anchoring, filtering,
search and reset work in browser state. Cmd/Ctrl+K focuses activity search.

SHA-256 is calculated with Web Crypto. Registry entries and SIM references are
simulated. The simulator sends no RPC, wallet, payment, database mutation or blockchain
transaction. The separate Testnet proof view reads fixed public Base Sepolia
contracts through GET `/api/blockchain/testnet-proof`. It checks chain ID, deployed
code, historical receipt status and contract events against current contract state.
Reads use one block at three-block depth, with a 30-second cache. RPC failures return
503 and show no live balances; there is no synthetic fallback. No signing or write
capability is included. A synthetic sample PDF can be hashed locally and compared
with the registry fingerprint; no file leaves the browser.

Validation: typecheck, scoped ESLint, six tests covering issuance/cap,
transfer conservation and permissions, pause/invalid amounts, document
review/anchoring/idempotence, and receipt/event validation. Browser QA covers desktop, mobile, demo sign-in,
guided sequence, manual transfer, document review/hash, blocked-event filter, live RPC contract reads, and local PDF fingerprint match.
