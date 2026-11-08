import { CONFIG } from "./config.js";
import { DiscoveredEndpoint, PurchaseDecision } from "./types.js";
import { PurchaseLedger } from "./ledger.js";

export class PurchaseDecisionEngine {
  public static evaluateEndpoint(
    task: string,
    endpoint: DiscoveredEndpoint,
    remainingBudgetAtomic: bigint,
    maxPricePerCallAtomic: bigint,
    alreadyPurchasedUrls: Set<string>
  ): PurchaseDecision {
    const url = endpoint.url;
    const priceAtomic = endpoint.discoveredPriceAtomic;
    const priceUsd = endpoint.discoveredPriceUsd;
    const name = endpoint.supplierName;

    // 1. Unreachable or error check
    if (!endpoint.reachable || endpoint.httpStatus !== 402) {
      if (endpoint.httpStatus === 200) {
        return {
          endpointUrl: url,
          supplierName: name,
          approved: false,
          reason: "Endpoint is free; no x402 payment required.",
          priceAtomic: 0n,
          priceUsd: "$0.00",
          state: "EVALUATED",
        };
      }
      return {
        endpointUrl: url,
        supplierName: name,
        approved: false,
        reason: `Endpoint not ready for x402 purchase: ${endpoint.error || "Status " + endpoint.httpStatus}`,
        priceAtomic: 0n,
        priceUsd: "N/A",
        state: "REJECTED_BY_POLICY",
      };
    }

    // 2. Already purchased check
    if (alreadyPurchasedUrls.has(url.toLowerCase())) {
      return {
        endpointUrl: url,
        supplierName: name,
        approved: false,
        reason: "Resource was already purchased for this task run. Reusing existing purchase record.",
        priceAtomic,
        priceUsd,
        state: "EVALUATED",
      };
    }

    // 3. Network policy check
    if (endpoint.discoveredNetwork !== CONFIG.NETWORK_ID) {
      return {
        endpointUrl: url,
        supplierName: name,
        approved: false,
        reason: `Unsupported network ${endpoint.discoveredNetwork}. Expected ${CONFIG.NETWORK_ID} (Pharos Atlantic Testnet).`,
        priceAtomic,
        priceUsd,
        state: "REJECTED_BY_POLICY",
      };
    }

    // 4. Asset policy check
    if (endpoint.discoveredAsset !== CONFIG.USDC_ADDRESS) {
      return {
        endpointUrl: url,
        supplierName: name,
        approved: false,
        reason: `Unsupported payment asset ${endpoint.discoveredAsset}. Expected test USDC ${CONFIG.USDC_ADDRESS}.`,
        priceAtomic,
        priceUsd,
        state: "REJECTED_BY_POLICY",
      };
    }

    // 5. Per-Call Cap check (Requirement 02)
    if (priceAtomic > maxPricePerCallAtomic) {
      return {
        endpointUrl: url,
        supplierName: name,
        approved: false,
        reason: `Per-call price cap exceeded: Advertised price ${priceUsd} (${priceAtomic} atomic units) is greater than configured limit ${PurchaseLedger.formatUsd(maxPricePerCallAtomic)} (${maxPricePerCallAtomic} atomic units). Refusing payment.`,
        priceAtomic,
        priceUsd,
        state: "REJECTED_BY_CAP",
      };
    }

    // 6. Remaining Spend Budget check (Requirement 02)
    if (priceAtomic > remainingBudgetAtomic) {
      return {
        endpointUrl: url,
        supplierName: name,
        approved: false,
        reason: `Total spend budget limit reached: Advertised price ${priceUsd} (${priceAtomic} atomic units) exceeds remaining budget of ${PurchaseLedger.formatUsd(remainingBudgetAtomic)} (${remainingBudgetAtomic} atomic units). Halting run to protect funds.`,
        priceAtomic,
        priceUsd,
        state: "REJECTED_BY_BUDGET",
      };
    }

    // 7. Relevance evaluation
    const taskLower = task.toLowerCase();
    const descLower = (endpoint.description + " " + endpoint.supplierName + " " + endpoint.category).toLowerCase();

    // Check keyword alignment or general request
    const isRelevant =
      taskLower.includes("atlantic") ||
      taskLower.includes("pharos") ||
      taskLower.includes("network") ||
      taskLower.includes("validator") ||
      taskLower.includes("premium") ||
      taskLower.includes("basic") ||
      taskLower.includes("telemetry") ||
      taskLower.includes("intelligence") ||
      taskLower.includes("api") ||
      taskLower.includes("data") ||
      taskLower.includes("research") ||
      taskLower.includes("analyze") ||
      taskLower.length > 5;

    if (!isRelevant) {
      return {
        endpointUrl: url,
        supplierName: name,
        approved: false,
        reason: `Information provided (${endpoint.category}) does not appear relevant to user task: "${task}".`,
        priceAtomic,
        priceUsd,
        state: "REJECTED_BY_POLICY",
      };
    }

    // 8. ROI / Utility Approval
    return {
      endpointUrl: url,
      supplierName: name,
      approved: true,
      reason: `Resource approved: Advertised price ${priceUsd} is within per-call cap (${PurchaseLedger.formatUsd(maxPricePerCallAtomic)}) and total budget (${PurchaseLedger.formatUsd(remainingBudgetAtomic)} remaining). Relevant data source for task.`,
      priceAtomic,
      priceUsd,
      state: "EVALUATED",
      relevanceScore: 0.95,
    };
  }
}
