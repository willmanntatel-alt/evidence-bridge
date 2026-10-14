# Evidence Bridge

A read-only deployment evidence tool for human review. It joins a public Sourcify source record to its Ethereum Sepolia deployment transaction, checks the receipt against a separately fetched block header and finalized head, and exports an explicit record of matching, conflicting, missing, and pending evidence.

The source-provider label is not an audit verdict. A receipt is not proof of current proxy implementation or legal enforceability. License labels are declarations in compiler metadata, not a license-compliance decision.

## Run the working browser diagnostic

Node.js 24 or later. The local dashboard and tests require no installed packages, API keys, wallet connection, or payment.

```sh
node server.mjs
```

Open http://127.0.0.1:5033. The default is a public third-party Sepolia contract; no ownership or affiliation is claimed. Requests go only to the fixed Sourcify and PublicNode endpoints. The app verifies the RPC chain ID, uses a fixed supported chain, binds to loopback, and checks Host and Origin. It never signs or broadcasts a transaction.

The **Download evidence JSON** button exports the observed references, source-provider metadata, six checks when receipt data is available, and limitations. **Compute local pack fingerprint** produces SHA-256 over the exact exported bytes. This fingerprint is local and has not been anchored on-chain.

## Evidence interpretation

- `CONSISTENT_DEPLOYMENT_EVIDENCE`: all of the implemented receipt-reference checks match. This is narrowly about those checks.
- `CONFLICT`: at least one reference, execution status, or canonical-block check disagrees.
- `PENDING_FINALITY`: a deployment height exceeds the provider's finalized head. Other unknowns remain visible.
- `INCOMPLETE`: a required reference or observation is absent; factory deployments need separate trace or log review.
- `UNAVAILABLE`: the source or RPC call failed. Failure does not become a positive result.

Sourcify metadata may be historical. This app does not recompile source or compare present runtime bytecode. Proxies, factory deployment traces, full licence analysis, Ethereum consensus proofs, and durable historical monitoring are outside this pilot's scope.

## Chainlink CRE extension — compilation only so far

`workflow/main.ts` implements the same reconciliation with the official CRE HTTP and EVM capabilities. It has been compiled with CRE CLI 1.38.0, SDK 1.23.0, TypeScript 5.9.3 and Bun 1.4.3. **A successful authenticated CRE CLI simulation has not yet run.** The browser diagnostic is a real public RPC/HTTP run, and is labelled separately. This project is not claiming qualification for the Chainlink bounty at this stage.

With your own CRE account, CLI, Bun and pnpm installed:

```sh
pnpm install --frozen-lockfile
cre login
cre workflow build ./workflow --target local-simulation
cre workflow simulate ./workflow --target local-simulation --non-interactive --trigger-index 0
```

No broadcast flag or on-chain writes are needed. Review account terms and authenticate yourself. Keep all credentials out of public source and screenshots.

## Validation

```sh
node --test test/*.test.mjs
```

Eleven fixture tests cover successful direct-creation reference reconciliation, returned-transaction mismatch, failed execution, canonical-block mismatch, factory creation, pending finality, missing deployment/finality data, provider identity mismatch, input validation, and unknown licence labels. Fixture tests are not live-chain demonstrations.

On 2026-10-14 a genuine public RPC/HTTP run on a recently verified third-party Sepolia proxy showed matching transaction, execution, block-height and canonical-block checks, while the creation address was unavailable and the height had not reached finality. These limitations were returned explicitly. Provider availability and future data can differ; the app makes no guarantee for any address.

## Intended submission

BLI Legal Tech Hackathon 2, general LegalTech / RegTech project submission on DoraHacks. The CRE-specific sponsor bounty is excluded until its separate successful-simulation requirement is actually met. No prize, acceptance, or sponsor endorsement is claimed.

Original implementation and visual identity created with substantial AI assistance for one human participant. Public contract metadata is used as input evidence; its code is not presented as this project's code. MIT licence.

## Primary references

- [BLI Legal Tech Hackathon 2](https://dorahacks.io/hackathon/legal-hack-2026/detail)
- [Sourcify API documentation](https://docs.sourcify.dev/docs/api/)
- [Solidity compiler metadata](https://docs.sourcify.dev/docs/metadata/)
- [CRE simulation guide](https://docs.chain.link/cre/guides/operations/simulating-workflows)
- [CRE SDK](https://www.npmjs.com/package/@chainlink/cre-sdk)
