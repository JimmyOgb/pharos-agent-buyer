import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createPublicClient, http, getAddress, Hex } from "viem";
import { CONFIG } from "./config.js";
import { DiscoveredEndpoint, PurchaseState } from "./types.js";

export interface SettlementReceipt {
  success: boolean;
  state: PurchaseState;
  txHash: string;
  explorerUrl: string;
  settledAmountAtomic: string;
  payer: string;
  data: any;
  error?: string;
  uncertainSettlement?: boolean;
  verifiedOnChain?: boolean;
}

export class PaymentClient {
  /**
   * Independently inspects a transaction receipt on Pharos Atlantic Testnet
   */
  public static async verifyOnChainSettlement(
    txHash: string,
    expectedPayTo?: string,
    expectedAmountAtomic?: bigint
  ): Promise<{ verified: boolean; blockNumber?: string; reason?: string }> {
    if (!txHash || typeof txHash !== "string" || !txHash.startsWith("0x") || txHash.length !== 66) {
      return { verified: false, reason: "invalid_hash_format" };
    }

    try {
      const client = createPublicClient({
        transport: http(CONFIG.RPC_URL),
      });

      const receipt = await client.getTransactionReceipt({ hash: txHash as Hex });
      if (!receipt) {
        return { verified: false, reason: "receipt_not_found" };
      }
      if (receipt.status !== "success") {
        return { verified: false, reason: "transaction_reverted" };
      }

      // Check for USDC Transfer event
      const usdcTransfer = receipt.logs.find((log) => {
        return (
          log.address.toLowerCase() === CONFIG.USDC_ADDRESS.toLowerCase() &&
          log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
        );
      });

      if (!usdcTransfer) {
        return { verified: false, reason: "no_usdc_transfer_event_in_receipt" };
      }

      const toTopic = usdcTransfer.topics[2];
      const actualTo = toTopic ? `0x${toTopic.slice(26)}`.toLowerCase() : "";
      const actualAmount = usdcTransfer.data ? BigInt(usdcTransfer.data) : 0n;

      if (expectedPayTo && actualTo !== expectedPayTo.toLowerCase()) {
        return { verified: false, reason: `wrong_recipient: expected ${expectedPayTo}, got ${actualTo}` };
      }
      if (expectedAmountAtomic && actualAmount < expectedAmountAtomic) {
        return { verified: false, reason: `underpaid: expected ${expectedAmountAtomic}, got ${actualAmount}` };
      }

      return {
        verified: true,
        blockNumber: receipt.blockNumber.toString(),
      };
    } catch (err: any) {
      if (err.name === "TransactionReceiptNotFoundError" || err.message?.includes("could not be found")) {
        return { verified: false, reason: "receipt_not_found" };
      }
      return { verified: false, reason: err.message || "rpc_lookup_failed" };
    }
  }

  public static async executePurchase(
    endpoint: DiscoveredEndpoint,
    signingKey?: string
  ): Promise<SettlementReceipt> {
    if (!endpoint.requirements) {
      return {
        success: false,
        state: "REJECTED_BY_POLICY",
        txHash: "",
        explorerUrl: "",
        settledAmountAtomic: "0",
        payer: "",
        data: null,
        error: `Endpoint ${endpoint.url} has no parsed payment requirements.`,
      };
    }

    const reqs = endpoint.requirements;
    const account = signingKey
      ? privateKeyToAccount(signingKey.startsWith("0x") ? (signingKey as Hex) : (`0x${signingKey}` as Hex))
      : privateKeyToAccount(generatePrivateKey());

    const now = Math.floor(Date.now() / 1000);
    const nonce = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const validBefore = BigInt(now + (reqs.maxTimeoutSeconds || 300));

    const domain = {
      name: CONFIG.USDC_NAME,
      version: CONFIG.USDC_VERSION,
      chainId: CONFIG.CHAIN_ID,
      verifyingContract: getAddress(reqs.asset),
    };

    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    const message = {
      from: account.address,
      to: getAddress(reqs.payTo),
      value: BigInt(reqs.amount),
      validAfter: 0n,
      validBefore,
      nonce: nonce as Hex,
    };

    // Sign EIP-712 / EIP-3009 typed data
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message,
    });

    const paymentPayload = {
      x402Version: 2,
      accepted: reqs,
      payload: {
        authorization: {
          from: account.address,
          to: reqs.payTo,
          value: reqs.amount,
          validAfter: "0",
          validBefore: validBefore.toString(),
          nonce,
        },
        signature,
      },
    };

    const encodedHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

    try {
      const response = await fetch(endpoint.url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-PAYMENT": encodedHeader,
          "PAYMENT-SIGNATURE": encodedHeader,
        },
      });

      const paymentRespHeader =
        response.headers.get("payment-response") ||
        response.headers.get("PAYMENT-RESPONSE") ||
        response.headers.get("x-payment-response");

      let settlementInfo: any = null;
      if (paymentRespHeader) {
        try {
          settlementInfo = JSON.parse(Buffer.from(paymentRespHeader, "base64").toString("utf-8"));
        } catch {
          try {
            settlementInfo = JSON.parse(paymentRespHeader);
          } catch {
            // Unparseable header
          }
        }
      }

      const body = await response.json().catch(() => ({}));

      if (response.status === 200) {
        const candidateHash = settlementInfo?.txHash || (body as any)?.settlement?.txHash;

        // A signature reference must NEVER be treated as a transaction hash
        const isSigRef =
          !candidateHash ||
          candidateHash === signature.slice(0, 66) ||
          candidateHash === `0x${signature.slice(2, 66)}`;

        if (isSigRef) {
          return {
            success: false,
            state: "SIGNATURE_REFERENCE_ONLY",
            txHash: candidateHash || "",
            explorerUrl: "",
            settledAmountAtomic: "0",
            payer: account.address,
            data: body,
            error: "Supplier returned signature reference without confirmed on-chain settlement.",
          };
        }

        // Independently verify on-chain settlement on Atlantic Testnet
        const onChain = await PaymentClient.verifyOnChainSettlement(
          candidateHash,
          reqs.payTo,
          BigInt(reqs.amount)
        );

        if (!onChain.verified) {
          return {
            success: false,
            state: "SETTLEMENT_UNVERIFIED",
            txHash: candidateHash,
            explorerUrl: `${CONFIG.EXPLORER_URL}/tx/${candidateHash}`,
            settledAmountAtomic: "0",
            payer: account.address,
            data: body,
            error: `On-chain settlement unverified: ${onChain.reason}`,
          };
        }

        return {
          success: true,
          state: "SETTLED",
          txHash: candidateHash,
          explorerUrl: `${CONFIG.EXPLORER_URL}/tx/${candidateHash}`,
          settledAmountAtomic: reqs.amount,
          payer: account.address,
          data: body,
          verifiedOnChain: true,
        };
      }

      // If 402 or 400 returned, payment was rejected or unverified
      const errState: PurchaseState = (body as any)?.state || "SETTLEMENT_FAILED";
      return {
        success: false,
        state: errState,
        txHash: (body as any)?.txHash || "",
        explorerUrl: "",
        settledAmountAtomic: "0",
        payer: account.address,
        data: body,
        error: `Supplier returned HTTP ${response.status}: ${(body as any)?.message || (body as any)?.error || "Payment refused or unverified"}`,
      };
    } catch (err: any) {
      // Possible network drop after payment was sent
      return {
        success: false,
        state: "SETTLEMENT_UNKNOWN",
        txHash: "",
        explorerUrl: "",
        settledAmountAtomic: "0",
        payer: account.address,
        data: null,
        error: `Connection failure during settlement request: ${err.message}`,
        uncertainSettlement: true,
      };
    }
  }
}
