import { createPublicClient, http } from 'viem';

const RPC_URL = "https://atlantic.dplabs-internal.com";
const client = createPublicClient({
  transport: http(RPC_URL),
});

const hashes = [
  {
    label: "Basic Supplier ($0.001 USDC / 1000 units)",
    hash: "0xbbb90cce8625163360c4d57feec81dae449eafe0c08dfec48e6b96e1d47cc066",
    expectedAmountAtomic: 1000n,
  },
  {
    label: "Premium Supplier ($0.005 USDC / 5000 units)",
    hash: "0x77ba470806a731cadc3c377468e0c98053075a8555f7cd78f0fa01a1797c4688",
    expectedAmountAtomic: 5000n,
  }
];

async function queryRPC(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  return await res.json();
}

async function auditHash(item) {
  console.log(`\n======================================================`);
  console.log(`Auditing: ${item.label}`);
  console.log(`Hash: ${item.hash}`);
  console.log(`PharosScan URL: https://atlantic.pharosscan.xyz/tx/${item.hash}`);

  // 1. eth_getTransactionByHash
  const txRes = await queryRPC('eth_getTransactionByHash', [item.hash]);
  console.log(`eth_getTransactionByHash result:`, JSON.stringify(txRes));

  // 2. eth_getTransactionReceipt
  const rcptRes = await queryRPC('eth_getTransactionReceipt', [item.hash]);
  console.log(`eth_getTransactionReceipt result:`, JSON.stringify(rcptRes));

  // 3. Check PharosScan web page
  try {
    const explorerRes = await fetch(`https://atlantic.pharosscan.xyz/tx/${item.hash}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    console.log(`PharosScan HTTP Status: ${explorerRes.status}`);
    const html = await explorerRes.text();
    const hasNotFound = html.includes('not found') || html.includes('Unable to find') || html.includes('404') || html.includes('Transaction Not Found');
    console.log(`PharosScan page snippet: ${html.slice(0, 300)}...`);
    console.log(`PharosScan indicates Not Found? ${hasNotFound}`);
  } catch (err) {
    console.log(`PharosScan fetch error: ${err.message}`);
  }
}

async function run() {
  const chainId = await queryRPC('eth_chainId', []);
  console.log(`RPC Chain ID:`, chainId.result, `(Parsed: ${parseInt(chainId.result, 16)})`);

  for (const item of hashes) {
    await auditHash(item);
  }
}

run().catch(console.error);
