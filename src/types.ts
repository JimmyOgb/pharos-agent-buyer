export type PurchaseState =
  | "DISCOVERED"
  | "EVALUATED"
  | "BUDGET_RESERVED"
  | "PAYMENT_AUTHORIZED"
  | "SETTLEMENT_PENDING"
  | "SETTLED"
  | "DATA_RETRIEVED"
  | "SIGNATURE_REFERENCE_ONLY"
  | "TRANSACTION_PENDING"
  | "SETTLEMENT_UNVERIFIED"
  | "REJECTED_BY_BUDGET"
  | "REJECTED_BY_CAP"
  | "REJECTED_BY_POLICY"
  | "AUTHORIZATION_FAILED"
  | "SETTLEMENT_FAILED"
  | "SETTLEMENT_UNKNOWN"
  | "DATA_RETRIEVAL_FAILED";

export interface x402AcceptsRequirement {
  scheme: string;
  network: string;
  asset: string;
  amount: string; // Atomic integer string
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: {
    token?: string;
    name?: string;
    version?: string;
    priceUsd?: string;
    [key: string]: any;
  };
}

export interface x402PaymentRequiredHeader {
  x402Version: number;
  accepts: x402AcceptsRequirement[];
}

export interface DiscoveredEndpoint {
  url: string;
  supplierName: string;
  description: string;
  category: string;
  reachable: boolean;
  httpStatus: number;
  paymentRequiredHeaderPresent: boolean;
  requirements?: x402AcceptsRequirement;
  discoveredPriceAtomic: bigint;
  discoveredPriceUsd: string;
  discoveredNetwork: string;
  discoveredAsset: string;
  discoveredPayTo: string;
  discoveryTimestamp: string;
  error?: string;
}

export interface PurchaseDecision {
  endpointUrl: string;
  supplierName: string;
  approved: boolean;
  reason: string;
  priceAtomic: bigint;
  priceUsd: string;
  state: PurchaseState;
  relevanceScore?: number;
}

export interface LedgerEntry {
  id: string;
  idempotencyKey: string;
  runId: string;
  timestamp: string;
  supplierName: string;
  endpointUrl: string;
  category: string;
  state: PurchaseState;
  decision: "APPROVED" | "REJECTED" | "SKIPPED";
  decisionReason: string;
  priceAtomic: string; // Serialized string of bigint
  priceUsd: string;
  network: string;
  asset: string;
  payTo: string;
  payerAddress?: string;
  txHash?: string;
  explorerUrl?: string;
  runningTotalAtomic: string;
  remainingBudgetAtomic: string;
  retrievedDataSummary?: string;
  retrievedData?: any;
  error?: string;
}

export interface AgentRunConfig {
  task: string;
  totalBudgetAtomic: bigint; // micro-USDC
  maxPricePerCallAtomic: bigint; // micro-USDC
  maxPurchases?: number;
  candidateUrls?: string[];
  privateKey?: string; // Optional non-custodial test key
}

export interface AgentRunResult {
  runId: string;
  task: string;
  status: "COMPLETED" | "BUDGET_STOP" | "FAILED";
  summary: string;
  totalBudgetAtomic: string;
  totalBudgetUsd: string;
  totalSpentAtomic: string;
  totalSpentUsd: string;
  remainingBudgetAtomic: string;
  remainingBudgetUsd: string;
  purchasesAttempted: number;
  purchasesSettled: number;
  purchasesRejected: number;
  ledgerEntries: LedgerEntry[];
  purchasedSources: Array<{
    supplierName: string;
    url: string;
    priceUsd: string;
    txHash: string;
    explorerUrl: string;
  }>;
  finalReport: {
    title: string;
    freeDataInsights: string[];
    purchasedInsights: string[];
    synthesis: string;
    verifiableEvidence: Array<{
      resource: string;
      txHash: string;
      explorerUrl: string;
    }>;
  };
}
