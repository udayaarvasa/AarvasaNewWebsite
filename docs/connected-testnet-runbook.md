# Wallet-connected testnet workspace

Public route: `/blockchain/demo/connected`. Linked from the simulator's entry,
workspace sidebar, and heading. This is a separate real-transaction mode; the
simulator remains a labelled browser exercise.

## Authorization and custody

Authorization is the wallet signature and the deployed contract's role checks.
The shared demo password grants no authority. No account is created, no role is
granted, and no existing development signer is enabled on the hosted server.
No private key or seed phrase is requested, loaded, transmitted or stored by this
integration. The user connects an existing browser wallet and approves each action.
Only Base Sepolia (84532) is exposed in the UI. The gateway also permits isolated
local chain 31337 solely for tests; it rejects mainnet chains.

- Issuer: issue whole test units, within the existing 10,000-unit cap.
- Controller: allowlist/remove a wallet; pause/resume the class.
- Investor: transfer its own units to an allowlisted wallet while active.
- Anchorer: anchor generated synthetic document fingerprints.
- Administrator role changes are deliberately not exposed.

Current issuer and controller addresses are read from `roleHolder` and shown under
Roles & setup. The selected account's role grants are read from the two contracts.
Use the existing authorized wallet for the action. An unrelated wallet can read
state but cannot issue, control the class or anchor without the appropriate role.
Test ETH is required for gas; the action's native value is always zero.

## Transaction lifecycle

1. Read balances, supply, permissions and class state from one RPC block.
2. Prepare: validate input, verify RPC network and contract code, check the role,
   simulate the exact call with `eth_call`, and estimate gas.
3. Review: show sender, contract, chain, calldata, unit amount/recipient and gas units.
4. Persist the intent in browser storage before opening the wallet prompt.
5. Recheck account, network and simulation, then request `eth_sendTransaction` with
   chain ID 84532 and value 0. The wallet signs and submits; the server never signs.
6. Persist the returned hash. Await three confirmations, checking the exact sender,
   destination, calldata, zero value and chain against the actual transaction.
7. Mark confirmed/reverted from the receipt; reread contract balances. No optimistic
   balance or synthetic fallback is used.

A rejected wallet prompt is separate from an uncertain network error. A timeout
remains pending, and a missing submission hash becomes unknown. New writes are
locked while a request is unsettled. No action is automatically resent. Browser
reload restores pending/unknown records; the user can check a known receipt, or
supply a hash found in wallet activity. A wrong hash cannot confirm an action.
Repriced matching transactions track the new hash. A different wallet replacement
is marked cancelled. Dismissing an uncertain local record does not cancel a chain
transaction; the UI requires the user to check wallet activity first.

Tracking is browser-local, limited to the latest 30 requests. It is not an
organization-wide audit database. Recent decoded logs cover 420 blocks in RPC-safe
windows, explicitly labelled as a partial history. The explorer provides older
receipts. Watchlist labels are local; balances and allowlisting are always on-chain.

Generated synthetic text and its fingerprint persist locally for verification after
reload. Only a SHA-256 digest and opaque record reference are anchored. This flow
does not accept uploads of real developer/property records. Anchors are permanent;
a content match is not a legal title or authenticity determination.

## Validation

- Full website suite: 253 passing tests.
- TypeScript and scoped ESLint pass.
- Gateway unit cases: network/account/role refusals, exact receipt matching,
  replacement/cancellation, timeout without resend, restore of unknown state, and
  read failure without fabricated balances.
- Actual local chain integration: 8 confirmed transactions through the same gateway;
  final A/B/C balances 700/300/0; supply 1,000; registry entry confirmed. Role, cap,
  allowlist, pause, duplicate issuance/anchor and wrong identity refusals exercised.
- Browser: live Base Sepolia reads, no-wallet guidance, disabled unauthorized controls,
  watchlist, synthetic generation/lookup and persistence, desktop/mobile layout.

Reproduce local integration with a NEW Hardhat node on 127.0.0.1:8556, using the
prototype contracts checkout:

```sh
# In contracts/: npm ci && npm run compile, then
npx hardhat node --hostname 127.0.0.1 --port 8556
# In the website checkout (no keys or production DB):
AARVASA_CONTRACT_TEST_ROOT=/absolute/path/to/contracts node --experimental-strip-types test/e2e/connected-testnet.e2e.mts
```

The real browser-wallet signature flow still requires a human holding an authorized
wallet. No new Base Sepolia transaction is sent by automated browser QA, and no
existing test key is exported into a browser wallet by the agent.

## Deployment and operating acceptance

Use the existing ARM64 CodeBuild → ECR → ECS release process. No environment flag,
secret, database migration, IAM grant or contract deployment is needed. Invalidate
CloudFront after the new task is healthy. Preserve the preceding ECS task revision
as the rollback target. Verify the public connected route, simulator link, live reads
and locked controls without a wallet.

For a team acceptance demonstration, the authorized wallet holder should:

1. Connect the controller, watch a fresh test wallet, and approve its allowlisting.
2. Connect the issuer and approve a small issuance to that wallet.
3. Connect that investor and approve a transfer to another allowlisted investor.
4. Use the controller to pause/resume and observe blocked actions.
5. Use the registry anchorer to approve a generated synthetic fingerprint, then verify it.
6. Inspect confirmed receipts and refreshed balances on the explorer.

A mainnet investment/ownership product, KYC, payments, legal title, server-held
investor keys and automatic transactions are outside this integration.
