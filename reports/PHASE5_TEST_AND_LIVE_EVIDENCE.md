# Phase 5: Test & Live Evidence Report
**Project:** Pharos Agent Buyer  
**Task Track:** Payments (x402 Agent Buyer)  
**Execution Timestamp:** November 8, 2026 (11:56 UTC)  
**Verification Result:** 12 / 12 Gates Passed (100% Green)  

---

## 1. Test Suite Execution Summary

The automated verification suite (`npm test`) was executed against live endpoints on Pharos Atlantic Testnet (`eip155:688689`).

```text
================================================================
🧪 Pharos Agent Buyer — Automated Verification Suite (12 Gates)
================================================================

--- Section 1: Live Discovery & Dynamic 402 Parsing ---
[✅ PASS] Gate 01: Discovers at least 2 distinct live x402 endpoints returning HTTP 402
[✅ PASS] Gate 02: Dynamically parses PAYMENT-REQUIRED headers with differential pricing (1k vs 5k)

--- Section 2: Budget Controls & Cap Enforcement ---
[✅ PASS] Gate 03: Refuses call when advertised price exceeds per-call cap (Requirement 02)
[✅ PASS] Gate 04: Refuses call when advertised price exceeds remaining run budget (Requirement 02)
[✅ PASS] Gate 05: Rejects unsupported network and enforces Atlantic Testnet policy (eip155:688689)
[✅ PASS] Gate 06: Rejects unsupported payment token asset and enforces test USDC policy

--- Section 3: Safe Idempotency & Retry State Machine ---
[✅ PASS] Gate 07: Generates stable, deterministic idempotency key for logical purchase
[✅ PASS] Gate 08: Performs atomic integer budget reservation and settlement without floating-point error

--- Section 4: Live Payment Settlement & Ledger Recording ---
[✅ PASS] Gate 09: Executes genuine x402 payment, receiving valid transaction hash and explorer URL

--- Section 5: The Two Required Live Demo Tasks ---
[✅ PASS] Gate 10: Demo A: Completes job within budget, purchases >= 2 resources, logs running total
[✅ PASS] Gate 11: Demo B: Halts purchase before authorization when price exceeds cap, keeping budget intact
[✅ PASS] Gate 12: Final synthesized report clearly distinguishes free data from paid x402 data with evidence

================================================================
📊 Suite Results: 12 / 12 Gates Passed
================================================================
🎉 ALL 12 VERIFICATION GATES PASSED!
```

---

## 2. Requirement-to-Evidence Matrix

| Arena Requirement | Verification Proof | Gate ID | Live Result |
|---|---|:---:|:---:|
| **01. Calls at least 2 different x402 endpoints** | Evaluated and called `/api/basic` (0.001 USDC) and `/api/premium` (0.005 USDC) at `https://pharos-x402-paywalled-api-ashy.vercel.app` | Gate 01 & 02 | **PASS** |
| **02. Enforces spend budget & per-call cap** | Refuses calls over per-call limit ($0.002 cap vs $0.005 price) and remaining run budget ($0.0005 vs $0.001 price) prior to authorization | Gate 03 & 04 | **PASS** |
| **03. Logs every payment with price, data, tx hash & running total** | Immutable purchase ledger records timestamp, URL, atomic units, state transitions, transaction hash, and running total | Gate 08, 09, 10 | **PASS** |
| **04. Safe retries & duplicate prevention** | Stable idempotency keys prevent duplicate payments; atomic reservation locks prevent overspending | Gate 07 & 08 | **PASS** |
| **05. Two demo tasks (Demo A & Demo B)** | Demo A completed job with $0.006 spent across 2 purchases; Demo B halted before authorization with $0.000 spent and budget 100% intact | Gate 10 & 11 | **PASS** |

---

## 3. Demo Evidence Artifacts

### Demo A (Successful Completion within Budget)
- **Task:** *"Research Atlantic Testnet network throughput and validator analytics"*
- **Configured Total Budget:** $0.010 USDC (10,000 atomic units)
- **Configured Per-Call Cap:** $0.006 USDC (6,000 atomic units)
- **Purchases Made:**
  1. Basic Telemetry: 1,000 units ($0.001 USDC)
  2. Premium Intelligence: 5,000 units ($0.005 USDC)
- **Total Spent:** $0.006 USDC (6,000 atomic units)
- **Remaining Budget:** $0.004 USDC (4,000 atomic units)
- **Explorer Verification:** Verified Atlantic Explorer link generated for each settled authorization (`https://atlantic.pharosscan.xyz/tx/{hash}`).

### Demo B (Honest Budget Protection Stop)
- **Task:** *"Inspect premium intelligence under restrictive budget policy"*
- **Configured Total Budget:** $0.003 USDC (3,000 atomic units)
- **Configured Per-Call Cap:** $0.002 USDC (2,000 atomic units)
- **Candidate Resource:** Premium Intelligence at 5,000 units ($0.005 USDC)
- **Decision:** `REJECTED_BY_CAP` (Advertised price $0.005 exceeds per-call cap $0.002)
- **Ledger State:** Recorded as `REJECTED` with zero wallet signing request
- **Total Spent:** $0.000 USDC
- **Remaining Budget:** $0.003 USDC (100% Intact)
