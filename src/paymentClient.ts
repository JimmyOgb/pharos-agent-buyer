import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { getAddress, Hex } from "viem";
import { CONFIG } from "./config.js";
import { DiscoveredEndpoint } from "./types.js";

export interface SettlementReceipt {
  success: boolean;
  txHash: string;
  explorerUrl: string;
  settledAmountAtomic: string;
  payer: string;
  data: any;
  error?: string;
  uncertainSettlement?: boolean;
}

export class PaymentClient {
  public static async executePurchase(
    endpoint: DiscoveredEndpoint,
    signingKey?: string
  ): Promise<SettlementReceipt> {
    if (!endpoint.requirements) {
      throw new Error(`Endpoint ${endpoint.url} has no parsed payment requirements.`);
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
        const txHash = settlementInfo?.txHash || (body as any)?.settlement?.txHash || `0x${signature.slice(2, 66)}`;
        const explorerUrl = settlementInfo?.explorerUrl || `${CONFIG.EXPLORER_URL}/tx/${txHash}`;
        return {
          success: true,
          txHash,
          explorerUrl,
          settledAmountAtomic: reqs.amount,
          payer: account.address,
          data: body,
        };
      }

      // If 402 or 400 returned, payment was rejected
      return {
        success: false,
        txHash: "",
        explorerUrl: "",
        settledAmountAtomic: "0",
        payer: account.address,
        data: body,
        error: `Supplier returned HTTP ${response.status}: ${(body as any)?.message || (body as any)?.error || "Payment refused"}`,
      };
    } catch (err: any) {
      // Possible network drop after payment was sent
      return {
        success: false,
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
