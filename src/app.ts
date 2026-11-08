import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "./config.js";
import { SupplierDiscovery } from "./discovery.js";
import { AgentBuyer } from "./agentBuyer.js";
import { PurchaseLedger } from "./ledger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-PAYMENT", "PAYMENT-SIGNATURE"],
      exposedHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"],
    })
  );

  app.use(express.json());

  // Static Assets
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  // Health Endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      service: "pharos-agent-buyer",
      network: CONFIG.NETWORK_ID,
      chainId: CONFIG.CHAIN_ID,
      timestamp: new Date().toISOString(),
    });
  });

  // Config Endpoint
  app.get("/api/config", (req: Request, res: Response) => {
    res.status(200).json({
      network: {
        id: CONFIG.NETWORK_ID,
        chainId: CONFIG.CHAIN_ID,
        rpcUrl: CONFIG.RPC_URL,
        explorerUrl: CONFIG.EXPLORER_URL,
        usdcAddress: CONFIG.USDC_ADDRESS,
      },
      defaultSuppliers: CONFIG.DEFAULT_SUPPLIERS,
    });
  });

  // Dynamic Live Discovery Endpoint
  app.get("/api/discovery", async (req: Request, res: Response) => {
    try {
      const candidates = CONFIG.DEFAULT_SUPPLIERS.map((s) => ({
        url: s.url,
        name: s.name,
        description: s.description,
        category: s.category,
      }));
      const results = await SupplierDiscovery.discoverAll(candidates);
      // Map BigInt to serialized strings for JSON response
      const safeResults = results.map((r) => ({
        ...r,
        discoveredPriceAtomic: r.discoveredPriceAtomic.toString(),
      }));
      res.status(200).json({
        success: true,
        count: safeResults.length,
        endpoints: safeResults,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  // Agent Task Execution Endpoint
  app.post("/api/run", async (req: Request, res: Response) => {
    try {
      const {
        task = "Research Atlantic Testnet performance and validator analytics",
        totalBudgetUsd = "0.010",
        maxPricePerCallUsd = "0.006",
        candidateUrls,
        privateKey,
      } = req.body;

      // Convert USD decimal strings to safe atomic micro-USDC (6 decimals)
      const parseAtomic = (usdStr: string): bigint => {
        const cleaned = usdStr.replace("$", "").trim();
        const parts = cleaned.split(".");
        const intPart = BigInt(parts[0] || "0");
        const decPart = (parts[1] || "").padEnd(6, "0").slice(0, 6);
        return intPart * 1000000n + BigInt(decPart);
      };

      const totalBudgetAtomic = parseAtomic(totalBudgetUsd);
      const maxPricePerCallAtomic = parseAtomic(maxPricePerCallUsd);

      const runResult = await AgentBuyer.executeTask({
        task,
        totalBudgetAtomic,
        maxPricePerCallAtomic,
        candidateUrls,
        privateKey,
      });

      res.status(200).json({
        success: true,
        result: runResult,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  return app;
}
