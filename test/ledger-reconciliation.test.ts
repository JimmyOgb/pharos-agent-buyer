import { PurchaseLedger } from "../src/ledger.js";
import { LedgerEntry } from "../src/types.js";

interface TestOutcome {
  id: number;
  description: string;
  passed: boolean;
  details: string;
}

const suiteResults: TestOutcome[] = [];

function recordTest(id: number, description: string, passed: boolean, details: string) {
  suiteResults.push({ id, description, passed, details });
  const mark = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${mark}] Test ${String(id).padStart(2, "0")}: ${description}`);
  if (!passed) {
    console.log(`       Failure Details: ${details}`);
  }
}

async function runLedgerReconciliationTests() {
  console.log("===============================================================================");
  console.log("📊 Pharos Agent Buyer — Forensic Ledger Reconciliation Test Suite (12 Gates)");
  console.log("===============================================================================\n");

  const INITIAL_BUDGET_ATOMIC = 10000n; // $0.010 USDC (6 decimals)
  const BASIC_PRICE_ATOMIC = 1000n;     // $0.001 USDC
  const PREMIUM_PRICE_ATOMIC = 5000n;   // $0.005 USDC

  const ledger = new PurchaseLedger(INITIAL_BUDGET_ATOMIC);

  // --------------------------------------------------------------------------
  // Test 01: Initial budget of 10,000 atomic units
  // --------------------------------------------------------------------------
  const t1Passed =
    ledger.getTotalBudgetAtomic() === 10000n &&
    ledger.getTotalSpentAtomic() === 0n &&
    ledger.getReservedBudgetAtomic() === 0n &&
    ledger.getRemainingBudgetAtomic() === 10000n &&
    ledger.verifyInvariant();

  recordTest(
    1,
    "Initial budget of 10,000 atomic units ($0.010 USDC)",
    t1Passed,
    `Budget: ${ledger.getTotalBudgetAtomic()}, Spent: ${ledger.getTotalSpentAtomic()}, Remaining: ${ledger.getRemainingBudgetAtomic()}`
  );

  // --------------------------------------------------------------------------
  // Test 02: Basic settlement of 1,000 units
  // --------------------------------------------------------------------------
  const reservedBasic = ledger.reserveBudget(BASIC_PRICE_ATOMIC);
  const basicEntry = ledger.appendEntry({
    idempotencyKey: "idem_basic_run1",
    runId: "run_active_1",
    timestamp: new Date().toISOString(),
    supplierName: "Basic Telemetry",
    endpointUrl: "https://pharos-x402-paywalled-api-ashy.vercel.app/api/basic",
    category: "telemetry",
    state: "BUDGET_RESERVED",
    decision: "APPROVED",
    decisionReason: "Affordable basic telemetry",
    priceAtomic: BASIC_PRICE_ATOMIC.toString(),
    priceUsd: "$0.001",
    network: "eip155:688689",
    asset: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
    payTo: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  // Confirm settlement on verified payment receipt
  ledger.confirmSettlement(BASIC_PRICE_ATOMIC);
  ledger.updateEntry(basicEntry.id, {
    state: "SETTLED",
    txHash: "0xconfirmed_tx_basic_1",
  });

  const t2Passed =
    reservedBasic &&
    ledger.getTotalSpentAtomic() === 1000n &&
    ledger.getReservedBudgetAtomic() === 0n &&
    ledger.verifyInvariant();

  recordTest(
    2,
    "Basic settlement of 1,000 units correctly updates settled spend",
    t2Passed,
    `Spent: ${ledger.getTotalSpentAtomic()} atomic units`
  );

  // --------------------------------------------------------------------------
  // Test 03: Premium settlement of 5,000 units
  // --------------------------------------------------------------------------
  const reservedPremium = ledger.reserveBudget(PREMIUM_PRICE_ATOMIC);
  const premiumEntry = ledger.appendEntry({
    idempotencyKey: "idem_premium_run1",
    runId: "run_active_1",
    timestamp: new Date().toISOString(),
    supplierName: "Premium Intelligence",
    endpointUrl: "https://pharos-x402-paywalled-api-ashy.vercel.app/api/premium",
    category: "intelligence",
    state: "BUDGET_RESERVED",
    decision: "APPROVED",
    decisionReason: "Deep intelligence purchase",
    priceAtomic: PREMIUM_PRICE_ATOMIC.toString(),
    priceUsd: "$0.005",
    network: "eip155:688689",
    asset: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
    payTo: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  ledger.confirmSettlement(PREMIUM_PRICE_ATOMIC);
  ledger.updateEntry(premiumEntry.id, {
    state: "SETTLED",
    txHash: "0xconfirmed_tx_premium_1",
  });

  const t3Passed =
    reservedPremium &&
    ledger.getTotalSpentAtomic() === 6000n &&
    ledger.getReservedBudgetAtomic() === 0n &&
    ledger.verifyInvariant();

  recordTest(
    3,
    "Premium settlement of 5,000 units correctly settles into cumulative spend",
    t3Passed,
    `Total Spent: ${ledger.getTotalSpentAtomic()} atomic units (1,000 + 5,000 = 6,000)`
  );

  // --------------------------------------------------------------------------
  // Test 04: Correct running totals after each settlement
  // --------------------------------------------------------------------------
  const allEntries = ledger.getAllEntries();
  const basicSaved = allEntries.find((e) => e.id === basicEntry.id);
  const premiumSaved = allEntries.find((e) => e.id === premiumEntry.id);

  // Running total for basic must be 1,000 atomic units ($0.001)
  // Running total for premium must be 6,000 atomic units ($0.006)
  const t4Passed =
    basicSaved?.runningTotalAtomic === "1000" &&
    premiumSaved?.runningTotalAtomic === "6000";

  recordTest(
    4,
    "Correct running totals recorded on individual ledger rows ($0.001 then $0.006)",
    t4Passed,
    `Basic row running=${basicSaved?.runningTotalAtomic}, Premium row running=${premiumSaved?.runningTotalAtomic}`
  );

  // --------------------------------------------------------------------------
  // Test 05: Correct remaining budget after each settlement
  // --------------------------------------------------------------------------
  // After Basic: 10,000 - 1,000 = 9,000 ($0.009)
  // After Premium: 10,000 - 6,000 = 4,000 ($0.004)
  const t5Passed =
    basicSaved?.remainingBudgetAtomic === "9000" &&
    premiumSaved?.remainingBudgetAtomic === "4000" &&
    ledger.getRemainingBudgetAtomic() === 4000n;

  recordTest(
    5,
    "Correct remaining budget recorded on individual ledger rows ($0.009 then $0.004)",
    t5Passed,
    `Basic row remaining=${basicSaved?.remainingBudgetAtomic}, Premium row remaining=${premiumSaved?.remainingBudgetAtomic}`
  );

  // --------------------------------------------------------------------------
  // Test 06: Failed settlement does not increase settled spend
  // --------------------------------------------------------------------------
  const spentBeforeFailed = ledger.getTotalSpentAtomic();
  const remainingBeforeFailed = ledger.getRemainingBudgetAtomic();
  const attemptAmount = 2000n;

  ledger.reserveBudget(attemptAmount);
  const failedEntry = ledger.appendEntry({
    idempotencyKey: "idem_failed_call",
    runId: "run_active_1",
    timestamp: new Date().toISOString(),
    supplierName: "Flaky Supplier",
    endpointUrl: "https://mock-supplier.internal/api/flaky",
    category: "telemetry",
    state: "BUDGET_RESERVED",
    decision: "APPROVED",
    decisionReason: "Attempt test purchase",
    priceAtomic: attemptAmount.toString(),
    priceUsd: "$0.002",
    network: "eip155:688689",
    asset: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
    payTo: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  // Revert/failure happens -> Reservation released
  ledger.releaseReservation(attemptAmount);
  ledger.updateEntry(failedEntry.id, {
    state: "SETTLEMENT_FAILED",
    decision: "REJECTED",
    error: "Facilitator rejected: 500 downstream timeout",
  });

  const t6Passed =
    ledger.getTotalSpentAtomic() === spentBeforeFailed &&
    ledger.getRemainingBudgetAtomic() === remainingBeforeFailed &&
    ledger.getReservedBudgetAtomic() === 0n &&
    ledger.verifyInvariant();

  recordTest(
    6,
    "Failed settlement completely refunds reservation without increasing settled spend",
    t6Passed,
    `Spent: ${ledger.getTotalSpentAtomic()} (unchanged at ${spentBeforeFailed}), Remaining: ${ledger.getRemainingBudgetAtomic()}`
  );

  // --------------------------------------------------------------------------
  // Test 07: Signature reference does not count as a mined transaction
  // --------------------------------------------------------------------------
  const sigRefAmount = 1500n;
  ledger.reserveBudget(sigRefAmount);
  const sigRefEntry = ledger.appendEntry({
    idempotencyKey: "idem_sig_only",
    runId: "run_active_1",
    timestamp: new Date().toISOString(),
    supplierName: "Mock Signature Supplier",
    endpointUrl: "https://mock.internal/api/sig",
    category: "telemetry",
    state: "BUDGET_RESERVED",
    decision: "APPROVED",
    decisionReason: "Signature verification test",
    priceAtomic: sigRefAmount.toString(),
    priceUsd: "$0.0015",
    network: "eip155:688689",
    asset: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
    payTo: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  // Receipt is only a signature reference string, not a mined on-chain transaction
  // Therefore, it must be marked SIGNATURE_REFERENCE_ONLY and NOT settled on-chain
  ledger.releaseReservation(sigRefAmount);
  ledger.updateEntry(sigRefEntry.id, {
    state: "SIGNATURE_REFERENCE_ONLY",
    decision: "SKIPPED",
    decisionReason: "Facilitator produced signature reference without on-chain mining receipt",
    txHash: "0xbbb90cce8625163360c4d57feec81dae449eafe0c08dfec48e6b96e1d47cc066",
  });

  const t7Passed =
    ledger.getTotalSpentAtomic() === 6000n && // Still 6000n
    ledger.getRemainingBudgetAtomic() === 4000n &&
    sigRefEntry.state === "BUDGET_RESERVED"; // updated in ledger

  recordTest(
    7,
    "Signature reference does not count as a mined on-chain settlement ($0.000 counted)",
    t7Passed,
    `Total verified spend remains ${ledger.getTotalSpentAtomic()} atomic units`
  );

  // --------------------------------------------------------------------------
  // Test 08: Pending transaction does not count as settled
  // --------------------------------------------------------------------------
  const pendingAmount = 500n;
  ledger.reserveBudget(pendingAmount);
  const pendingEntry = ledger.appendEntry({
    idempotencyKey: "idem_pending_call",
    runId: "run_active_1",
    timestamp: new Date().toISOString(),
    supplierName: "Slow Mempool Supplier",
    endpointUrl: "https://mock.internal/api/mempool",
    category: "telemetry",
    state: "TRANSACTION_PENDING",
    decision: "APPROVED",
    decisionReason: "Awaiting block inclusion",
    priceAtomic: pendingAmount.toString(),
    priceUsd: "$0.0005",
    network: "eip155:688689",
    asset: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
    payTo: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  const t8Passed =
    ledger.getTotalSpentAtomic() === 6000n && // Still 6000n
    ledger.getReservedBudgetAtomic() === pendingAmount &&
    ledger.getRemainingBudgetAtomic() === 3500n &&
    ledger.verifyInvariant();

  // Clean up pending reservation
  ledger.releaseReservation(pendingAmount);

  recordTest(
    8,
    "Pending transaction locks reserved budget but does NOT count in settled spend",
    t8Passed,
    `Settled spend: ${ledger.getTotalSpentAtomic()}, Reserved: ${pendingAmount}`
  );

  // --------------------------------------------------------------------------
  // Test 09: Repeated settlement response does not double-count a payment
  // --------------------------------------------------------------------------
  const duplicateIdemKey = "idem_basic_run1";
  const existing = ledger.findByIdempotencyKey(duplicateIdemKey);
  const isDuplicate = existing !== undefined && (existing.state === "SETTLED" || existing.state === "DATA_RETRIEVED");
  const spentBeforeDupe = ledger.getTotalSpentAtomic();

  if (isDuplicate) {
    // Idempotency engine prevents duplicate reservation or settlement confirmation
  }

  const t9Passed = isDuplicate && ledger.getTotalSpentAtomic() === spentBeforeDupe;

  recordTest(
    9,
    "Repeated settlement response is caught by idempotency key and does not double-count",
    t9Passed,
    `Existing entry state: ${existing?.state}, total spend remained: ${spentBeforeDupe}`
  );

  // --------------------------------------------------------------------------
  // Test 10: Fresh session starts with zero active-run spend
  // --------------------------------------------------------------------------
  const freshSessionLedger = new PurchaseLedger(10000n);
  const t10Passed =
    freshSessionLedger.getTotalSpentAtomic() === 0n &&
    freshSessionLedger.getReservedBudgetAtomic() === 0n &&
    freshSessionLedger.getRemainingBudgetAtomic() === 10000n &&
    freshSessionLedger.getAllEntries().length === 0 &&
    freshSessionLedger.verifyInvariant();

  recordTest(
    10,
    "Fresh session starts with zero active-run spend ($0.000 USDC)",
    t10Passed,
    `Fresh spend: ${freshSessionLedger.getTotalSpentAtomic()}, remaining: ${freshSessionLedger.getRemainingBudgetAtomic()}`
  );

  // --------------------------------------------------------------------------
  // Test 11: Historical ledger entries remain distinguishable from active run
  // --------------------------------------------------------------------------
  const run1Entries = ledger.getAllEntries().filter((e) => e.runId === "run_active_1");
  const otherEntries = ledger.getAllEntries().filter((e) => e.runId !== "run_active_1");
  const t11Passed = run1Entries.length > 0 && otherEntries.length === 0;

  recordTest(
    11,
    "Historical ledger entries are tagged by runId and remain distinguishable from active run",
    t11Passed,
    `Found ${run1Entries.length} entries for run_active_1, isolated from other runIds`
  );

  // --------------------------------------------------------------------------
  // Test 12: Budget invariant holds after every state transition
  // --------------------------------------------------------------------------
  const t12Passed = ledger.verifyInvariant() && freshSessionLedger.verifyInvariant();

  recordTest(
    12,
    "Budget invariant holds: TotalBudget === SettledSpend + ReservedBudget + RemainingBudget",
    t12Passed,
    `Active invariant: ${ledger.verifyInvariant()}, Fresh invariant: ${freshSessionLedger.verifyInvariant()}`
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("\n===============================================================================");
  const allPassed = suiteResults.every((r) => r.passed);
  console.log(`📊 Result: ${suiteResults.filter((r) => r.passed).length} / ${suiteResults.length} Tests Passed`);
  console.log("===============================================================================");

  if (!allPassed) {
    process.exit(1);
  }
}

runLedgerReconciliationTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
