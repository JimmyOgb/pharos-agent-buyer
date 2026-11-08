# Phase 3: Architecture & Product Design Specification
**Project:** Pharos Agent Buyer  
**Target Repository:** `JimmyOgb/pharos-agent-buyer`  
**Workspace:** `C:\Users\NO GO NO\pharosbuild\skills\pharos-agent-buyer`  
**Status:** Approved & Implemented  

---

## 1. System Architecture Overview

Pharos Agent Buyer is an autonomous purchasing agent built for the Pharos Agent Payment Plane. It enables AI agents to evaluate task requirements, dynamically discover x402-protected APIs, read payment terms directly from HTTP 402 headers, evaluate ROI, enforce strict user-defined budget and per-call caps, safely execute non-custodial EIP-3009/x402 payments, and record verified on-chain evidence in an immutable purchase ledger.

```
+---------------------------------------------------------------------------------------+
|                                    USER INTERFACE                                     |
|  - Agent Task Composer    - Budget & Cap Controls       - Wallet Connection (EIP-1193)|
|  - Live Supplier Feed     - Purchase Decision Console   - Verified Ledger & Explorer  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                               AGENT PURCHASING ENGINE                                 |
|                                                                                       |
|  1. Task Decomposition & Query Planning                                               |
|     * Identifies knowledge gaps & maps needed resources                               |
|                                                                                       |
|  2. Dynamic Discovery & 402 Parsing                                                   |
|     * Issues HTTP GET to candidates -> Parses base64 PAYMENT-REQUIRED header          |
|     * Extracts: network, asset, atomic amount, payTo, timeout, metadata               |
|                                                                                       |
|  3. Decision & Governance Engine                                                      |
|     * Policy Check: Supported Network (eip155:688689) & Token (USDC 0xcfC8...)        |
|     * Per-Call Price Cap: atomicAmount <= maxPricePerCall                             |
|     * Total Budget Cap: atomicAmount <= remainingBudget                               |
|     * Utility vs Price Evaluation: Is information worth the advertised cost?          |
|                                                                                       |
|  4. Idempotent Budget & State Manager                                                 |
|     * Generates stable Idempotency Key                                                |
|     * Atomic Budget Reservation (prevents concurrent overspending)                    |
|                                                                                       |
|  5. Non-Custodial Wallet Payment Gateway                                              |
|     * Requests user EIP-712 TransferWithAuthorization signature                       |
|     * Transmits base64 X-PAYMENT header to Resource Server                            |
|                                                                                       |
|  6. Settlement Verification & Ledgering                                               |
|     * Receives PAYMENT-RESPONSE header containing txHash & explorer link              |
|     * Appends to Immutable Purchase Ledger                                            |
|     * Synthesizes purchased facts into structured final report                        |
+---------------------------------------------------------------------------------------+
                                           |
              +----------------------------+----------------------------+
              |                                                         |
              v                                                         v
+-------------------------------------+   +---------------------------------------------+
|    LIVE x402 RESOURCE SERVERS       |   |       PHAROS ATLANTIC TESTNET               |
|  - Supplier A: /api/basic (0.001)   |   |  - Chain ID: 688689                         |
|  - Supplier B: /api/premium (0.005) |   |  - Token: 0xcfC8330f4BCAB529c625D12781b1C194|
|  - Facilitator: /verify, /settle    |   |  - Explorer: atlantic.pharosscan.xyz        |
+-------------------------------------+   +---------------------------------------------+
```

---

## 2. Core Functional Modules

### A. Agent Task Composer & Orchestrator
- Accepts user query or mission objective (e.g., *"Analyze Pharos Atlantic Testnet validator distribution and network throughput"*).
- Pre-sets customizable budget parameters:
  - Total Spend Budget (e.g., 0.010 USDC = 10,000 atomic units)
  - Max Price Per Call (e.g., 0.004 USDC = 4,000 atomic units)
  - Max Calls per Run (e.g., 5 calls)

### B. Live Dynamic Supplier Discovery
- The agent does **not** rely on hardcoded price tables as the authority.
- The agent connects to candidates, issues requests, and intercepts HTTP 402 responses.
- Decodes base64 `PAYMENT-REQUIRED` headers conforming to the x402 specification.
- Dynamically extracts and validates:
  - `scheme`: Must be `"exact"`
  - `network`: Must match active network (`"eip155:688689"`)
  - `asset`: Must match verified test USDC (`0xcfc8330f4bcab529c625d12781b1c19466a9fc8b`)
  - `amount`: Atomic micro-units as integer string
  - `payTo`: Valid 42-character checksummed EVM address

### C. Purchase Decision Engine
Before any payment authorization is requested, the engine evaluates 6 gates:
1. **Relevance Gate:** Does the endpoint provide data relevant to the task?
2. **Network Gate:** Is the network supported? (Blocks unsupported chains)
3. **Asset Gate:** Is the token asset authorized? (Blocks unknown tokens)
4. **Per-Call Cap Gate:** Is `atomicAmount <= maxPricePerCallAtomic`? If not, **REJECT** (`REJECTED_BY_BUDGET`).
5. **Remaining Budget Gate:** Is `atomicAmount <= remainingBudgetAtomic`? If not, **REJECT** (`REJECTED_BY_BUDGET`).
6. **Deduplication Gate:** Has this resource already been purchased in this run? If so, reuse cached data without re-paying.

### D. Zero-Loss Atomic Accounting
- **No Floating Point Arithmetic:** All financial comparisons, balances, and budgets use `BigInt` atomic units (where 1 unit = $0.000001 USDC).
- Conversion to human-readable USD strings occurs purely at display time.
- Atomic reservation lock guarantees that concurrent or queued purchases cannot exceed remaining budget.

### E. Non-Custodial Wallet Payment Execution
- Works with standard EIP-1193 providers (MetaMask, Rabby) or verified test accounts.
- Private keys are never collected, stored in cookies, localStorage, indexedDB, or server logs.
- The user retains sole custody and must explicitly approve the payment run and signature.
- Signs EIP-3009 `TransferWithAuthorization` typed data:
  ```typescript
  {
    from: payerAddress,
    to: payToAddress,
    value: atomicAmount,
    validAfter: 0,
    validBefore: now + 300,
    nonce: randomHex32
  }
  ```

### F. Verifiable Purchase Ledger
Every purchase attempt creates an immutable ledger entry with:
- `timestamp`: ISO-8601 string
- `idempotencyKey`: Unique SHA-256 hash
- `supplierName`: Supplier label
- `endpointUrl`: Verified URL
- `priceUsd`: Advertised USD price string
- `atomicUnits`: Stringified integer atomic amount
- `network`: eip155:688689
- `decision`: `APPROVED` | `REJECTED`
- `decisionReason`: Rationale explanation
- `status`: `SETTLED` | `REJECTED` | `FAILED`
- `txHash`: Genuine settlement transaction hash
- `explorerUrl`: Link to block explorer
- `runningTotalSpentAtomic`: Cumulative spend
- `remainingBudgetAtomic`: Remaining authorized budget

### G. Result Synthesis
Distinguishes between:
1. **Free Data:** Baseline information retrieved without cost.
2. **Paid Data:** Verified insights unlocked through x402 settlement.
3. **Agent Synthesis:** Logical conclusion and recommendations derived from paid facts.
