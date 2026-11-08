# Pharos Agent Buyer · x402 Autonomous Purchasing Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Pharos Network](https://img.shields.io/badge/Network-Pharos%20Atlantic%20Testnet%20(688689)-06b6d4)](https://atlantic.pharosscan.xyz)
[![Payment Standard](https://img.shields.io/badge/Standard-x402%20Protocol%20v2-8b5cf6)](https://docs.pharos.xyz/developer-guide/x402)
[![Arena Track](https://img.shields.io/badge/Arena%20Track-Payments%20(Hard%20200%2B50)-10b981)](https://pharos-agent-arena.vercel.app/tasks/x402-agent-buyer)

**Pharos Agent Buyer** is an autonomous purchasing agent for the **Pharos Agent Arena** task [x402 Agent Buyer](https://pharos-agent-arena.vercel.app/tasks/x402-agent-buyer) (200 base points + 50 video bonus).

Given an objective, the agent discovers live x402-paywalled APIs, parses their actual payment requirements directly from HTTP 402 headers, evaluates information utility vs advertised price, enforces strict user-defined budget and per-call caps, executes non-custodial EIP-3009 payments on **Pharos Atlantic Testnet**, and maintains an immutable purchase ledger with verifiable transaction hashes on the Atlantic block explorer.

---

## ⚡ Quick Start: Judge Testing Guide (Under 2 Minutes)

### 1. Interactive Web Dashboard
Open the production deployment:  
👉 **[https://pharos-agent-buyer.vercel.app](https://pharos-agent-buyer.vercel.app)** *(Or run locally via `npm run dev` on `http://localhost:4022`)*

### 2. Reproduce Demo A: Successful Task Completion Within Budget
1. Click **"Demo A: Successful Task"** preset button.
   - Task: *"Research Pharos Atlantic Testnet throughput, validator distribution, and systemic stability using live paid resources."*
   - Total Run Budget: `$0.010 USDC` (10,000 atomic units)
   - Per-Call Cap: `$0.006 USDC` (6,000 atomic units)
2. Click **"1. Discover Live Suppliers (402)"**:
   - The agent probes `/api/basic` ($0.001) and `/api/premium` ($0.005), decoding live base64 `PAYMENT-REQUIRED` headers.
3. Click **"2. Execute Autonomous Purchase Run"**:
   - The agent evaluates both resources, reserves budget, authorizes payments via EIP-3009, settles on Atlantic Testnet, and streams verified transaction hashes into the Purchase Ledger.
   - Total spent: `$0.006 USDC`. Remaining: `$0.004 USDC`.

### 3. Reproduce Demo B: Honest Budget Protection
1. Click **"Demo B: Budget Protection"** preset button.
   - Total Run Budget: `$0.003 USDC`
   - Per-Call Cap: `$0.002 USDC` (Deliberately set below the $0.005 premium price)
2. Click **"2. Execute Autonomous Purchase Run"**:
   - The agent inspects the live advertised price ($0.005) and **refuses authorization** (`REJECTED_BY_CAP`).
   - The purchase ledger records the rejection. Total spent remains `$0.000 USDC` and budget remains 100% intact.

### 4. Run Automated CLI Verification Suite (12 / 12 Gates)
```bash
git clone https://github.com/JimmyOgb/pharos-agent-buyer.git
cd pharos-agent-buyer
npm install
npm test
```

---

## 🔍 Live Verified Supplier Endpoints

The buyer connects to real, running x402 resource servers on Pharos Atlantic Testnet:

| Endpoint URL | HTTP Status | Advertised Price | Atomic Units | Description |
|---|:---:|---|---|---|
| `https://pharos-x402-paywalled-api-ashy.vercel.app/health` | **200 OK** | Free ($0.00) | 0 | Atlantic Testnet health & telemetry baseline |
| `https://pharos-x402-paywalled-api-ashy.vercel.app/api/basic` | **402 Payment Required** | $0.001 USDC | 1,000 | Atlantic TPS, validator count, block times |
| `https://pharos-x402-paywalled-api-ashy.vercel.app/api/premium` | **402 Payment Required** | $0.005 USDC | 5,000 | Deep analytics, staking distributions, systemic risk |

---

## 🏗️ Architecture & Core Components

```
+---------------------------------------------------------------------------------------+
|                                    USER INTERFACE                                     |
|  - Agent Task Composer    - Budget & Cap Controls       - Live Discovered Suppliers   |
|  - Decision Console       - Verifiable Purchase Ledger  - Synthesized Task Results    |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                               AGENT PURCHASING ENGINE                                 |
|  1. Task Decomposition & Query Planning                                               |
|  2. Dynamic Discovery & 402 Parsing (Reads PAYMENT-REQUIRED Header)                   |
|  3. Decision Engine (Enforces: Network, Token Asset, Per-Call Cap, Spend Budget)      |
|  4. Idempotent Budget Lock (SHA-256 Keys & Atomic Micro-USDC Accounting)              |
|  5. Non-Custodial Payment Gateway (EIP-3009 TransferWithAuthorization Typed Data)     |
|  6. Settlement Verification & Ledgering (PAYMENT-RESPONSE Header -> Tx Hash)          |
+---------------------------------------------------------------------------------------+
```

### 1. Zero Floating-Point Accounting
All prices, remaining balances, and caps are processed strictly in integer `BigInt` atomic units ($0.000001 USDC = 1 unit). Floating-point arithmetic is prohibited to prevent rounding drift or budget leakage.

### 2. Idempotency State Machine
```
DISCOVERED -> EVALUATED -> BUDGET_RESERVED -> PAYMENT_AUTHORIZED -> SETTLEMENT_PENDING -> SETTLED -> DATA_RETRIEVED
```
- Stable idempotency key: `SHA256(runId:endpointUrl:atomicAmount:payTo)`.
- Budget is reserved prior to signing; released if payment fails; committed on receipt of `PAYMENT-RESPONSE`.
- Deduplication prevents the same resource from being purchased twice within a single task run.

---

## 🛡️ Security & Protocol Compliance

- **Zero Key Custody:** Private keys and seed phrases are never stored in browser storage (`localStorage`, `indexedDB`), cookies, logs, or GitHub.
- **SSRF Prevention:** Restricts candidate URLs to valid `http:` / `https:` schemes and blocks loopback, private RFC 1918 ranges, and cloud metadata IPs.
- **Prompt Injection Defense:** External API payloads are treated as untrusted data and cannot modify agent budget, caps, or policy.

---

## 📜 Official Arena Requirement Verification

| Requirement ID | Specification Statement | Verification Proof | Status |
|---|---|---|:---:|
| **REQ-01** | Calls at least 2 different x402 endpoints | Discovers and pays `/api/basic` ($0.001) and `/api/premium` ($0.005) | **PASS** |
| **REQ-02** | Enforces spend budget and per-call cap | Automatically refuses calls exceeding per-call cap or total budget | **PASS** |
| **REQ-03** | Logs payment with price, data, tx hash & running total | Immutable purchase ledger records txHash and running balance | **PASS** |
| **REQ-04** | Handles payment failures with safe retries | Stable SHA-256 idempotency keys and state machine eliminate double counts | **PASS** |
| **REQ-05** | Includes Demo A (completion) and Demo B (budget stop) | Reproducible Demo A ($0.006 spent) and Demo B ($0.000 spent, budget saved) | **PASS** |

---

## 📄 License
MIT License. Created for the Pharos Agent Arena (Season of AI).
