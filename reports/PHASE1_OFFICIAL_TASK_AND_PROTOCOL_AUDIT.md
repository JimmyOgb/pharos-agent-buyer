# Phase 1: Official Task & Protocol Audit Report
**Project:** Pharos Agent Buyer  
**Task Track:** Payments (Hard — 200 points + 50 video bonus = 250 points)  
**Official Arena Task URL:** https://pharos-agent-arena.vercel.app/tasks/x402-agent-buyer  
**Audit Date:** November 8, 2026  
**Auditor:** Pharos Autonomous Agent Builder  

---

## 1. Official Task Overview & Requirements

The official Pharos Agent Arena defines **x402 Agent Buyer** as:
> *"An agent that pays for what it uses: it calls x402-paywalled APIs on Pharos, pays within a budget, and finishes the job. Given a task, it calls x402-paywalled APIs on Pharos, reads each price, decides whether the data is worth buying, pays within a budget, and finishes the job. This is the agent-to-API payment loop that the Agent Payment Plane is built for."*

### Official Scoring Criteria & Requirements Breakdown

| Requirement ID | Specification Statement | Score Weight | Acceptance Verification Method |
|---|---|:---:|---|
| **REQ-01** | **Calls at least 2 different x402 endpoints.** They can be your own or another dev's. | 40 pts | Dynamic discovery and execution against two distinct live paid endpoints (`/api/basic` at 0.001 USDC and `/api/premium` at 0.005 USDC) returning HTTP 402 with genuine payment requirements. |
| **REQ-02** | **Enforces a spend budget and a per-call price cap, and refuses calls over either one.** | 40 pts | Pre-execution decision engine checks each dynamic price in atomic units before authorization. Rejects if price > per-call cap or price > remaining budget without signing or spending. |
| **REQ-03** | **Logs every payment with the price, what it bought and the tx hash, plus a running total.** | 40 pts | Immutable local purchase ledger recording endpoint URL, purpose, price in USD & atomic units, transaction hash, explorer link, timestamp, idempotency key, and running balance. |
| **REQ-04** | **Handles payment failures with retries that are safe: the same payment never counts twice.** | 40 pts | Finite State Machine (`DISCOVERED` -> `EVALUATED` -> `BUDGET_RESERVED` -> `PAYMENT_AUTHORIZED` -> `SETTLEMENT_PENDING` -> `SETTLED` -> `DATA_RETRIEVED`) with idempotency keys, budget reservation locks, and reconciliation. |
| **REQ-05** | **Includes a demo task where the agent completes the job, and one where it stops because it hit the budget.** | 40 pts | Demo A: Complete task execution with multiple purchases within budget. Demo B: Restrictive budget stops purchase before authorization with verifiable unchanged ledger. |
| **BONUS** | **Walkthrough video demonstrating the build.** | +50 pts | Continuous 1080p demo video showing both live demos, MetaMask/wallet interactions, dynamic 402 discovery, and explorer validation. |

---

## 2. Protocol & Network Audit

### Official Pharos Atlantic Testnet Specifications
- **Chain ID:** `688689` (`0xa8231`)
- **Network Identifier (CAIP-2):** `eip155:688689`
- **RPC URL:** `https://atlantic.dplabs-internal.com`
- **Block Explorer:** `https://atlantic.pharosscan.xyz`
- **Settlement Asset:** Test USDC (`0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B`, 6 decimals)
- **Smallest Atomic Unit:** 1 micro-USDC ($0.000001 = 1 unit)
  - Basic route: 1,000 units = 0.001 USDC
  - Premium route: 5,000 units = 0.005 USDC

### x402 Protocol Specification (Version 2)
1. **Initial Request:** Client performs `GET` or `POST` to paywalled resource.
2. **Payment Challenge (HTTP 402):**
   - Header: `PAYMENT-REQUIRED: <base64-json>`
   - JSON Schema:
     ```json
     {
       "x402Version": 2,
       "accepts": [
         {
           "scheme": "exact",
           "network": "eip155:688689",
           "asset": "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
           "amount": "1000",
           "payTo": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
           "maxTimeoutSeconds": 300,
           "extra": { "token": "USDC", "name": "USDC", "version": "2" }
         }
       ]
     }
     ```
3. **Authorization Header:**
   - Client signs EIP-712 / EIP-3009 typed data (`TransferWithAuthorization`) via connected wallet or ephemeral account.
   - Client sends request with header `X-PAYMENT: <base64-json>` or `PAYMENT-SIGNATURE: <base64-json>`.
4. **Verification & Settlement:**
   - Facilitator verifies signature, nonce, recipient, and amount.
   - Facilitator settles on Atlantic Testnet, broadcasting `transferWithAuthorization`.
5. **Settlement Response (HTTP 200):**
   - Header: `PAYMENT-RESPONSE: <base64-json>` containing `txHash`, `settledAmount`, `payer`, and `explorerUrl`.
   - Response body: The purchased payload data.

---

## 3. Official x402-pharos Skill Alignment

The official `x402-pharos` skill is located at `https://github.com/PharosNetwork/examples/tree/main/skills/x402-pharos`.
Key findings from skill review:
1. Supported EVM Scheme: `ExactEvmScheme` using EIP-3009 TransferWithAuthorization.
2. Token configuration: Name `"USDC"`, Version `"2"`, verifying contract matching the active network.
3. Safe accounting: All amounts must be calculated in integer atomic units (strings / BigInt). Floating point arithmetic is prohibited.
4. Non-custodial requirement: No private keys or seed phrases stored in browser storage, code, or logs. MetaMask / EIP-1193 explicit authorization must remain the ultimate signing authority.

---

## 4. Phase 1 Acceptance Checklist

| Item | Requirement | Verification Method | Status |
|:---:|---|---|:---:|
| 1 | Arena Task & Criteria Audited | Scraped and verified against `https://pharos-agent-arena.vercel.app/tasks/x402-agent-buyer` | **CONFIRMED** |
| 2 | Protocol Specs Verified | Atlantic Testnet parameters (`688689`, USDC `0xcfC8...Fc8B`) validated from docs and live API | **CONFIRMED** |
| 3 | Package Inventory Defined | `@x402/core`, `@x402/evm`, `@x402/fetch`, `viem`, `express`, `cors` | **CONFIRMED** |
| 4 | Architecture Boundaries Defined | $0-first, zero secrets in git, strict EIP-1193 user consent | **CONFIRMED** |
