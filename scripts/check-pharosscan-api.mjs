async function checkExplorerAPI(hash) {
  const urls = [
    `https://atlantic.pharosscan.xyz/api/v1/tx/${hash}`,
    `https://atlantic.pharosscan.xyz/api/tx/${hash}`,
    `https://atlantic.pharosscan.xyz/api?module=transaction&action=gettxinfo&txhash=${hash}`,
    `https://atlantic.pharosscan.xyz/api?module=proxy&action=eth_getTransactionByHash&txhash=${hash}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      console.log(`URL: ${url} -> Status: ${res.status}`);
      if (res.status === 200) {
        const text = await res.text();
        console.log(`Response: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`URL ${url} err: ${e.message}`);
    }
  }
}

async function run() {
  await checkExplorerAPI('0xbbb90cce8625163360c4d57feec81dae449eafe0c08dfec48e6b96e1d47cc066');
}
run();
