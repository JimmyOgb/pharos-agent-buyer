import { SupplierDiscovery } from "../src/discovery.js";
import { PurchaseDecisionEngine } from "../src/decisionEngine.js";
import { PurchaseLedger } from "../src/ledger.js";
import { PaymentClient } from "../src/paymentClient.js";
import { AgentBuyer } from "../src/agentBuyer.js";
import { CONFIG } from "../src/config.js";

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(id: number, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${icon}] Gate ${String(id).padStart(2, "0")}: ${name}`);
  if (!passed || process.env.VERBOSE) {
    console.log(`       Details: ${details}`);
  }
}

async function runTestSuite() {
  console.log(`================================================================`);
  console.log(`🧪 Pharos Agent Buyer — Automated Verification Suite (12 Gates)`);
  console.log(`================================================================\n`);

  try {
    // -------------------------------------------------------------
    // Gate 01: Live discovery against 2 distinct paid x402 endpoints
    // -------------------------------------------------------------
    console.log(`--- Section 1: Live Discovery & Dynamic 402 Parsing ---`);
    const basicProbe = await SupplierDiscovery.probeEndpoint(
      CONFIG.DEFAULT_SUPPLIERS[0].url,
      CONFIG.DEFAULT_SUPPLIERS[0].name,
      CONFIG.DEFAULT_SUPPLIERS[0].description,
      "telemetry"
    );
    const premiumProbe = await SupplierDiscovery.probeEndpoint(
      CONFIG.DEFAULT_SUPPLIERS[1].url,
      CONFIG.DEFAULT_SUPPLIERS[1].name,
      CONFIG.DEFAULT_SUPPLIERS[1].description,
      "intelligence"
    );

    record(
      1,
      "Discovers at least 2 distinct live x402 endpoints returning HTTP 402",
      basicProbe.httpStatus === 402 && premiumProbe.httpStatus === 402 && basicProbe.url !== premiumProbe.url,
      `Basic status=${basicProbe.httpStatus}, Premium status=${premiumProbe.httpStatus}`
    );

    // -------------------------------------------------------------
    // Gate 02: Dynamic Price & Requirement Extraction
    // -------------------------------------------------------------
    const hasRequirements =
      basicProbe.paymentRequiredHeaderPresent &&
      premiumProbe.paymentRequiredHeaderPresent &&
      basicProbe.discoveredPriceAtomic === 1000n &&
      premiumProbe.discoveredPriceAtomic === 5000n;

    record(
      2,
      "Dynamically parses PAYMENT-REQUIRED headers with differential pricing (1k vs 5k)",
      hasRequirements,
      `Basic price=${basicProbe.discoveredPriceAtomic} ($${basicProbe.discoveredPriceUsd}), Premium price=${premiumProbe.discoveredPriceAtomic} ($${premiumProbe.discoveredPriceUsd})`
    );

    // -------------------------------------------------------------
    // Gate 03: Decision Engine rejects calls over per-call price cap
    // -------------------------------------------------------------
    console.log(`\n--- Section 2: Budget Controls & Cap Enforcement ---`);
    const capDecision = PurchaseDecisionEngine.evaluateEndpoint(
      "Analyze Atlantic network metrics",
      premiumProbe,
      10000n, // $0.010 remaining budget (ample)
      2000n,  // $0.002 per-call cap (below $0.005 premium price)
      new Set()
    );

    record(
      3,
      "Refuses call when advertised price exceeds per-call cap (Requirement 02)",
      !capDecision.approved && capDecision.state === "REJECTED_BY_CAP",
      `Decision state=${capDecision.state}, Reason=${capDecision.reason}`
    );

    // -------------------------------------------------------------
    // Gate 04: Decision Engine rejects calls over remaining budget
    // -------------------------------------------------------------
    const budgetDecision = PurchaseDecisionEngine.evaluateEndpoint(
      "Analyze Atlantic network metrics",
      basicProbe,
      500n,  // $0.0005 remaining budget (below $0.001 basic price)
      5000n, // $0.005 per-call cap (ample)
      new Set()
    );

    record(
      4,
      "Refuses call when advertised price exceeds remaining run budget (Requirement 02)",
      !budgetDecision.approved && budgetDecision.state === "REJECTED_BY_BUDGET",
      `Decision state=${budgetDecision.state}, Reason=${budgetDecision.reason}`
    );

    // -------------------------------------------------------------
    // Gate 05: Decision Engine rejects unsupported network
    // -------------------------------------------------------------
    const mockWrongNetwork = {
      ...basicProbe,
      discoveredNetwork: "eip155:1", // Ethereum Mainnet
    };
    const networkDecision = PurchaseDecisionEngine.evaluateEndpoint(
      "Analyze network metrics",
      mockWrongNetwork,
      10000n,
      10000n,
      new Set()
    );

    record(
      5,
      "Rejects unsupported network and enforces Atlantic Testnet policy (eip155:688689)",
      !networkDecision.approved && networkDecision.state === "REJECTED_BY_POLICY",
      `Decision state=${networkDecision.state}, Reason=${networkDecision.reason}`
    );

    // -------------------------------------------------------------
    // Gate 06: Decision Engine rejects unsupported token asset
    // -------------------------------------------------------------
    const mockWrongAsset = {
      ...basicProbe,
      discoveredAsset: "0x1111111111111111111111111111111111111111",
    };
    const assetDecision = PurchaseDecisionEngine.evaluateEndpoint(
      "Analyze network metrics",
      mockWrongAsset,
      10000n,
      10000n,
      new Set()
    );

    record(
      6,
      "Rejects unsupported payment token asset and enforces test USDC policy",
      !assetDecision.approved && assetDecision.state === "REJECTED_BY_POLICY",
      `Decision state=${assetDecision.state}, Reason=${assetDecision.reason}`
    );

    // -------------------------------------------------------------
    // Gate 07: Safe Idempotency & Duplicate Prevention
    // -------------------------------------------------------------
    console.log(`\n--- Section 3: Safe Idempotency & Retry State Machine ---`);
    const ledger = new PurchaseLedger(10000n);
    const key1 = PurchaseLedger.generateIdempotencyKey("run_test", basicProbe.url, basicProbe.discoveredPriceAtomic, basicProbe.discoveredPayTo);
    const key2 = PurchaseLedger.generateIdempotencyKey("run_test", basicProbe.url, basicProbe.discoveredPriceAtomic, basicProbe.discoveredPayTo);

    record(
      7,
      "Generates stable, deterministic idempotency key for logical purchase",
      key1 === key2 && key1.length === 64,
      `IdempotencyKey=${key1}`
    );

    // -------------------------------------------------------------
    // Gate 08: Atomic Budget Reservation & Zero Float Error
    // -------------------------------------------------------------
    const reserveOk = ledger.reserveBudget(1000n);
    const remainingAfterReserve = ledger.getRemainingBudgetAtomic();
    ledger.confirmSettlement(1000n);
    const spentAfterConfirm = ledger.getTotalSpentAtomic();

    record(
      8,
      "Performs atomic integer budget reservation and settlement without floating-point error",
      reserveOk && remainingAfterReserve === 9000n && spentAfterConfirm === 1000n,
      `Remaining=${remainingAfterReserve}, Spent=${spentAfterConfirm}`
    );

    // -------------------------------------------------------------
    // Gate 09: Genuine live settlement and explorer receipt
    // -------------------------------------------------------------
    console.log(`\n--- Section 4: Live Payment Settlement & Ledger Recording ---`);
    const liveSettlement = await PaymentClient.executePurchase(basicProbe);

    record(
      9,
      "Executes genuine x402 payment, receiving valid transaction hash and explorer URL",
      liveSettlement.success && liveSettlement.txHash.startsWith("0x") && liveSettlement.explorerUrl.includes("atlantic.pharosscan.xyz"),
      `TxHash=${liveSettlement.txHash}, Explorer=${liveSettlement.explorerUrl}`
    );

    // -------------------------------------------------------------
    // Gate 10: Full Demo A — Successful completion within budget
    // -------------------------------------------------------------
    console.log(`\n--- Section 5: The Two Required Live Demo Tasks ---`);
    const demoAResult = await AgentBuyer.executeTask({
      task: "Research Atlantic Testnet network throughput and validator analytics (Demo A)",
      totalBudgetAtomic: 10000n, // $0.010
      maxPricePerCallAtomic: 6000n, // $0.006 (Permits both basic $0.001 and premium $0.005)
    });

    record(
      10,
      "Demo A: Completes job within budget, purchases >= 2 resources, logs running total",
      demoAResult.status === "COMPLETED" &&
        demoAResult.purchasesSettled >= 2 &&
        demoAResult.ledgerEntries.length >= 2 &&
        BigInt(demoAResult.totalSpentAtomic) === 6000n,
      `Status=${demoAResult.status}, Settled=${demoAResult.purchasesSettled}, TotalSpent=${demoAResult.totalSpentUsd}`
    );

    // -------------------------------------------------------------
    // Gate 11: Full Demo B — Honest Budget Protection Stop
    // -------------------------------------------------------------
    const demoBResult = await AgentBuyer.executeTask({
      task: "Inspect premium intelligence under restrictive budget policy (Demo B)",
      totalBudgetAtomic: 3000n, // $0.003
      maxPricePerCallAtomic: 2000n, // $0.002 cap (Refuses $0.005 premium resource)
      candidateUrls: [CONFIG.DEFAULT_SUPPLIERS[1].url], // Probes premium endpoint
    });

    record(
      11,
      "Demo B: Halts purchase before authorization when price exceeds cap, keeping budget intact",
      demoBResult.status === "BUDGET_STOP" &&
        demoBResult.purchasesSettled === 0 &&
        demoBResult.purchasesRejected > 0 &&
        demoBResult.totalSpentAtomic === "0" &&
        demoBResult.remainingBudgetAtomic === "3000",
      `Status=${demoBResult.status}, Spent=${demoBResult.totalSpentUsd}, Remaining=${demoBResult.remainingBudgetUsd}`
    );

    // -------------------------------------------------------------
    // Gate 12: Distinguishes paid data from free data in final report
    // -------------------------------------------------------------
    const reportDistinction =
      demoAResult.finalReport.freeDataInsights.length > 0 &&
      demoAResult.finalReport.purchasedInsights.length > 0 &&
      demoAResult.finalReport.verifiableEvidence.length >= 2;

    record(
      12,
      "Final synthesized report clearly distinguishes free data from paid x402 data with evidence",
      reportDistinction,
      `FreeInsights=${demoAResult.finalReport.freeDataInsights.length}, PaidInsights=${demoAResult.finalReport.purchasedInsights.length}, EvidenceItems=${demoAResult.finalReport.verifiableEvidence.length}`
    );

    console.log(`\n================================================================`);
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`📊 Suite Results: ${passedCount} / ${results.length} Gates Passed`);
    console.log(`================================================================\n`);

    if (passedCount === results.length) {
      console.log(`🎉 ALL 12 VERIFICATION GATES PASSED! Ready for publication and deployment.`);
      process.exit(0);
    } else {
      console.error(`⚠️ Some verification gates failed.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`💥 Unhandled test suite error:`, err);
    process.exit(1);
  }
}

runTestSuite();
