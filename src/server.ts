import { createApp } from "./app.js";
import { CONFIG } from "./config.js";

const app = createApp();

app.listen(CONFIG.PORT, () => {
  console.log(`====================================================`);
  console.log(`🤖 Pharos Agent Buyer Server running`);
  console.log(`📡 URL: http://localhost:${CONFIG.PORT}`);
  console.log(`⛓️  Network: ${CONFIG.NETWORK_ID} (Atlantic Testnet)`);
  console.log(`💵 Payment Asset: ${CONFIG.USDC_ADDRESS}`);
  console.log(`🔍 Block Explorer: ${CONFIG.EXPLORER_URL}`);
  console.log(`====================================================`);
  console.log(`Endpoints:`);
  console.log(`  - Free Health:    GET  /health`);
  console.log(`  - Config:         GET  /api/config`);
  console.log(`  - Discovery:      GET  /api/discovery`);
  console.log(`  - Run Agent Task: POST /api/run`);
  console.log(`====================================================`);
});
