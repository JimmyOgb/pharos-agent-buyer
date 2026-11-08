# Phase 4: Idempotency, Safe Retries & State Machine Design
**Project:** Pharos Agent Buyer  
**Task Track:** Payments (x402 Agent Buyer — REQ-04)  
**Date:** November 8, 2026  

---

## 1. Idempotent Purchasing State Machine

To satisfy **REQ-04** (*"Handles payment failures with retries that are safe: the same payment never counts twice"*), the buyer implements a strict Finite State Machine (FSM):

```
                       [ DISCOVERED ]
                             |
                             v
                       [ EVALUATED ]
                        /         \
   (Budget/Policy Exceeded)       (Approved)
                      /             \
                     v               v
           [ REJECTED_* ]     [ BUDGET_RESERVED ]
                                     |
                                     v
                           [ PAYMENT_AUTHORIZED ]
                                     |
                                     v
                          [ SETTLEMENT_PENDING ]
                             /        |        \
                   (Network/          |         (Settlement Confirmed)
                    Timeout)          |                   \
                     /                |                    v
                    v                 |               [ SETTLED ]
          [ SETTLEMENT_UNKNOWN ]      |                    |
                    |                 |                    v
             (Reconciliation)         |            [ DATA_RETRIEVED ]
             /             \          |
     (Tx Confirmed)   (No Tx/Refund)  |
            |                |        |
            v                v        v
       [ SETTLED ]   [ SETTLEMENT_FAILED ]
```

### State Definitions
1. **`DISCOVERED`**: Candidate endpoint inspected; HTTP 402 intercepted; `PAYMENT-REQUIRED` header decoded.
2. **`EVALUATED`**: Decision engine evaluated ROI, task relevance, network/asset compatibility, per-call cap, and total budget.
3. **`REJECTED_BY_BUDGET`** / **`REJECTED_BY_POLICY`**: Purchase safely aborted prior to any budget commitment or signature request.
4. **`BUDGET_RESERVED`**: Required atomic units locked in memory/storage. Prevents concurrent operations from double-allocating budget.
5. **`PAYMENT_AUTHORIZED`**: EIP-712 typed signature produced by user wallet for specific nonce, recipient, and amount.
6. **`SETTLEMENT_PENDING`**: Payment authorization transmitted to supplier via `X-PAYMENT` header.
7. **`SETTLED`**: Supplier/Facilitator verified and broadcasted settlement; verifiable transaction hash and `PAYMENT-RESPONSE` received.
8. **`DATA_RETRIEVED`**: Protected payload successfully extracted and validated.
9. **`SETTLEMENT_UNKNOWN`**: Network drop, timeout, or 5xx received after authorization was dispatched. Requires reconciliation before any retry.
10. **`SETTLEMENT_FAILED`**: Authoritative rejection by facilitator (e.g. invalid signature, expired, bad nonce). Reserved budget released.

---

## 2. Idempotency Key Specification

Each purchase attempt generates a deterministic idempotency key:

$$\text{idempotencyKey} = \text{SHA256}(\text{runId} + ":" + \text{endpointUrl} + ":" + \text{atomicAmount} + ":" + \text{payTo})$$

- **Uniqueness:** Guarantees that within a single task run, the agent cannot initiate duplicate payments for the same resource.
- **Cache Lookup:** Before creating a signature or contacting the facilitator, the agent queries the ledger by `idempotencyKey`. If an entry exists with state `SETTLED` or `DATA_RETRIEVED`, the cached result is returned immediately without spending additional tokens.

---

## 3. Atomic Budget Reservation & Release Protocol

1. **Pre-Allocation:**
   ```typescript
   if (atomicAmount > remainingBudgetAtomic) {
     return { approved: false, reason: "Exceeds remaining budget" };
   }
   // Atomically reserve budget
   remainingBudgetAtomic -= atomicAmount;
   reservedBudgetAtomic += atomicAmount;
   ```
2. **Post-Settlement Confirmation:**
   Upon receiving valid `PAYMENT-RESPONSE`:
   ```typescript
   reservedBudgetAtomic -= atomicAmount;
   totalSpentAtomic += atomicAmount;
   ```
3. **Rollback on Authoritative Failure:**
   Only when settlement is proven *not* to have occurred (e.g. user rejected wallet signature, or facilitator explicitly returned `invalid_signature`):
   ```typescript
   reservedBudgetAtomic -= atomicAmount;
   remainingBudgetAtomic += atomicAmount;
   ```

---

## 4. Separation of Settlement from Data Retrieval

A critical pitfall in agent payment architectures is assuming that an HTTP error after sending payment means the payment did not settle. In x402:
1. The facilitator may settle the transaction on Atlantic Testnet before the supplier's web server encounters an internal error or gateway timeout.
2. Pharos Agent Buyer treats **Settlement** and **Data Retrieval** as distinct decoupled stages.
3. If an HTTP 500 occurs after dispatching `X-PAYMENT`, the agent does **not** assume non-payment.
4. The agent queries the facilitator or Atlantic Testnet explorer for the nonce/authorization.
5. If the transaction was mined, the settlement receipt and txHash are permanently retained in the ledger, and the state advances to `SETTLED (DATA_RETRIEVAL_FAILED)`. The agent never pays twice for the same resource.

---

## 5. Summary of Guarantees
- **No Double Spending:** Stable keys and pre-allocated locks eliminate duplicate signing requests.
- **No Floating-Point Rounding Leakage:** 100% integer atomic calculations.
- **Fail-Safe Recovery:** Unknown states trigger on-chain reconciliation before any retry attempt.
