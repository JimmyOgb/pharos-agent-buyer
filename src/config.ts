import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "4022", 10),
  NETWORK_ID: "eip155:688689",
  CHAIN_ID: 688689,
  RPC_URL: process.env.RPC_URL || "https://atlantic.dplabs-internal.com",
  EXPLORER_URL: "https://atlantic.pharosscan.xyz",
  USDC_ADDRESS: (process.env.USDC_ADDRESS || "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b").toLowerCase(),
  USDC_NAME: "USDC",
  USDC_VERSION: "2",
  USDC_DECIMALS: 6,
  DEFAULT_SUPPLIERS: [
    {
      id: "supplier-basic",
      name: "Pharos Atlantic Basic Network Telemetry",
      url: process.env.SUPPLIER_BASIC_URL || "https://pharos-x402-paywalled-api-ashy.vercel.app/api/basic",
      description: "Live Atlantic Testnet TPS, validator counts, block time, and health metrics.",
      category: "telemetry",
    },
    {
      id: "supplier-premium",
      name: "Pharos Atlantic Deep Intelligence & Validator Analytics",
      url: process.env.SUPPLIER_PREMIUM_URL || "https://pharos-x402-paywalled-api-ashy.vercel.app/api/premium",
      description: "Deep analytics, staking distributions, security risk assessment, and sentiment analysis.",
      category: "intelligence",
    },
  ],
};
