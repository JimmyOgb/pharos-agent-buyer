# Production Smoke Test Report

**Environment:** Production (Vercel Serverless + Edge Network)  
**Date:** November 8, 2026  
**Auditor:** Antigravity Production Verification  

---

## 1. Upstream Supplier Service

* **Production URL:** [https://pharos-x402-paywalled-api-ashy.vercel.app](https://pharos-x402-paywalled-api-ashy.vercel.app)
* **Deployment ID:** `dpl_4fjV9r3qyEH1QrE6HvhwTtXXQbtG`
* **Target Network:** Pharos Atlantic Testnet (`eip155:688689`)

| Endpoint | Method | Expected Status | Actual Status | Response Verification |
|---|:---:|:---:|:---:|---|
| `/health` | `GET` | 200 | **200 OK** | Returns `status: "healthy"`, `network: "eip155:688689"`, `freeRoute: true`. |
| `/supported` | `GET` | 200 | **200 OK** | Returns `kinds` with `scheme: "exact"` and `network: "eip155:688689"`. |
| `/api/basic` | `GET` | 402 | **402 Payment Required** | Returns base64 `PAYMENT-REQUIRED` header advertising $0.001 test USDC. |
| `/api/premium`| `GET` | 402 | **402 Payment Required** | Returns base64 `PAYMENT-REQUIRED` header advertising $0.005 test USDC. |
| `/verify-receipt` | `GET` | 200 | **200 OK** | Querying unmined signature hash (`0xbbb90cce...`) returns `{ verified: false, state: "NOT_FOUND" }`. |

**Honest Settlement Verification:**
* Probed `/api/basic` with valid cryptographic signature without funded on-chain gas.
* Result: Returned **HTTP 402 Settlement Unverified** (`state: "SETTLEMENT_FAILED"`).
* Paid telemetry withheld; zero manufactured transaction hashes or fake explorer links.

---

## 2. Pharos Agent Buyer Service

* **Production URL:** [https://pharos-agent-buyer.vercel.app](https://pharos-agent-buyer.vercel.app)
* **Deployment ID:** `dpl_EiR3S6AtuGBC9K2WGxXaY4XezQ8L`
* **Target Network:** Pharos Atlantic Testnet (`eip155:688689`)

| Endpoint | Method | Expected Status | Actual Status | Response Verification |
|---|:---:|:---:|:---:|---|
| `/` | `GET` | 200 | **200 OK** | Serves complete dashboard HTML in-memory with wallet bar, Demo A/B presets, approval modal, and clean ledger. |
| `/health` | `GET` | 200 | **200 OK** | Returns `status: "healthy"`, `service: "pharos-agent-buyer"`, `chainId: 688689`. |
| `/style.css` | `GET` | 200 | **200 OK** | Serves full responsive dark-mode stylesheet (15,613 bytes). |
| `/app.js` | `GET` | 200 | **200 OK** | Serves updated JavaScript bundle with reconciled `AuthoritativeLedger` and on-chain verification engine (43,336 bytes). |
| `/api/discovery` | `GET` | 200 | **200 OK** | Dynamically probes and discovers 2 live x402 endpoints returning HTTP 402 on Atlantic Testnet. |

---

## 3. Production UI State Review

1. **Wallet Connection State:**
   * Starts in honest `Disconnected` state.
   * No wallet is silently connected or prompted without user action.
   * Prominent `Connect Wallet` button visible.
2. **Fresh Session Integrity:**
   * Top stats bar: Initial Run Budget `$0.010 USDC`, Total Spent `$0.000 USDC`, Remaining Budget `$0.010 USDC`.
   * Verifiable Purchase Ledger: Displays `0 Transactions` with clean placeholder.
3. **Demo Controls:**
   * **Demo A Preset:** Sets Budget `$0.010 USDC`, Cap `$0.006 USDC`. Evaluates Basic ($0.001) and Premium ($0.005). Prompts explicit approval modal before payment.
   * **Demo B Preset:** Sets Budget `$0.003 USDC`, Cap `$0.002 USDC`. Probing premium ($0.005) triggers honest refusal *before* requesting wallet authorization, keeping budget intact ($0.000 spent).
4. **Signature References Not Converted to Hashes:**
   * Signature reference strings are tagged `SIGNATURE_REFERENCE_ONLY` or `SETTLEMENT_UNVERIFIED`.
   * Unmined receipts are excluded from verified spend.
