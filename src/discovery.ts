import { CONFIG } from "./config.js";
import { DiscoveredEndpoint, x402PaymentRequiredHeader } from "./types.js";
import { PurchaseLedger } from "./ledger.js";

export class SupplierDiscovery {
  public static async probeEndpoint(
    url: string,
    supplierName?: string,
    description?: string,
    category?: string
  ): Promise<DiscoveredEndpoint> {
    const timestamp = new Date().toISOString();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const status = response.status;
      const paymentReqHeader =
        response.headers.get("payment-required") ||
        response.headers.get("PAYMENT-REQUIRED") ||
        response.headers.get("x-payment-required");

      if (status === 200) {
        return {
          url,
          supplierName: supplierName || "Free Endpoint",
          description: description || "Public resource with zero payment requirement",
          category: category || "free",
          reachable: true,
          httpStatus: 200,
          paymentRequiredHeaderPresent: false,
          discoveredPriceAtomic: 0n,
          discoveredPriceUsd: "$0.00",
          discoveredNetwork: CONFIG.NETWORK_ID,
          discoveredAsset: CONFIG.USDC_ADDRESS,
          discoveredPayTo: "",
          discoveryTimestamp: timestamp,
        };
      }

      if (status === 402) {
        if (!paymentReqHeader) {
          return {
            url,
            supplierName: supplierName || "Unknown Paid Supplier",
            description: description || "Returned 402 without PAYMENT-REQUIRED header",
            category: category || "unknown",
            reachable: true,
            httpStatus: 402,
            paymentRequiredHeaderPresent: false,
            discoveredPriceAtomic: 0n,
            discoveredPriceUsd: "Unknown",
            discoveredNetwork: "Unknown",
            discoveredAsset: "Unknown",
            discoveredPayTo: "Unknown",
            discoveryTimestamp: timestamp,
            error: "HTTP 402 returned but missing PAYMENT-REQUIRED header",
          };
        }

        // Decode base64 payment requirement
        let decodedReq: x402PaymentRequiredHeader;
        try {
          const jsonStr = Buffer.from(paymentReqHeader, "base64").toString("utf-8");
          decodedReq = JSON.parse(jsonStr);
        } catch {
          try {
            decodedReq = JSON.parse(paymentReqHeader);
          } catch (e: any) {
            return {
              url,
              supplierName: supplierName || "Invalid Supplier",
              description: description || "",
              category: category || "invalid",
              reachable: true,
              httpStatus: 402,
              paymentRequiredHeaderPresent: true,
              discoveredPriceAtomic: 0n,
              discoveredPriceUsd: "Malformed",
              discoveredNetwork: "Unknown",
              discoveredAsset: "Unknown",
              discoveredPayTo: "Unknown",
              discoveryTimestamp: timestamp,
              error: `Malformed PAYMENT-REQUIRED header: ${e.message}`,
            };
          }
        }

        const exactReq = decodedReq.accepts?.find((a) => a.scheme === "exact");
        if (!exactReq) {
          return {
            url,
            supplierName: supplierName || "Unsupported Scheme Supplier",
            description: description || "",
            category: category || "unsupported",
            reachable: true,
            httpStatus: 402,
            paymentRequiredHeaderPresent: true,
            discoveredPriceAtomic: 0n,
            discoveredPriceUsd: "Unsupported",
            discoveredNetwork: "Unknown",
            discoveredAsset: "Unknown",
            discoveredPayTo: "Unknown",
            discoveryTimestamp: timestamp,
            error: "No accepts clause with scheme 'exact' found in header",
          };
        }

        const priceAtomic = BigInt(exactReq.amount);
        const priceUsd = exactReq.extra?.priceUsd || PurchaseLedger.formatUsd(priceAtomic);

        return {
          url,
          supplierName: supplierName || "x402 Resource Supplier",
          description: description || exactReq.extra?.description || "x402 paywalled resource",
          category: category || "paid",
          reachable: true,
          httpStatus: 402,
          paymentRequiredHeaderPresent: true,
          requirements: exactReq,
          discoveredPriceAtomic: priceAtomic,
          discoveredPriceUsd: priceUsd,
          discoveredNetwork: exactReq.network,
          discoveredAsset: exactReq.asset.toLowerCase(),
          discoveredPayTo: exactReq.payTo,
          discoveryTimestamp: timestamp,
        };
      }

      return {
        url,
        supplierName: supplierName || "Unexpected Status Endpoint",
        description: description || "",
        category: category || "unknown",
        reachable: true,
        httpStatus: status,
        paymentRequiredHeaderPresent: false,
        discoveredPriceAtomic: 0n,
        discoveredPriceUsd: "N/A",
        discoveredNetwork: "N/A",
        discoveredAsset: "N/A",
        discoveredPayTo: "N/A",
        discoveryTimestamp: timestamp,
        error: `Unexpected HTTP status: ${status}`,
      };
    } catch (err: any) {
      return {
        url,
        supplierName: supplierName || "Unreachable Endpoint",
        description: description || "",
        category: category || "unreachable",
        reachable: false,
        httpStatus: 0,
        paymentRequiredHeaderPresent: false,
        discoveredPriceAtomic: 0n,
        discoveredPriceUsd: "N/A",
        discoveredNetwork: "N/A",
        discoveredAsset: "N/A",
        discoveredPayTo: "N/A",
        discoveryTimestamp: timestamp,
        error: `Network failure: ${err.message}`,
      };
    }
  }

  public static async discoverAll(candidates: Array<{ url: string; name?: string; description?: string; category?: string }>): Promise<DiscoveredEndpoint[]> {
    const results: DiscoveredEndpoint[] = [];
    for (const c of candidates) {
      const res = await this.probeEndpoint(c.url, c.name, c.description, c.category);
      results.push(res);
    }
    return results;
  }
}
