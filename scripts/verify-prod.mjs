async function verify() {
  const base = 'https://pharos-agent-buyer.vercel.app';
  const urls = [
    { name: 'Root /', url: base + '/' },
    { name: 'Health /health', url: base + '/health' },
    { name: 'CSS /style.css', url: base + '/style.css' },
    { name: 'JS /app.js', url: base + '/app.js' },
    { name: 'Discovery /api/discovery', url: base + '/api/discovery' }
  ];

  for (const item of urls) {
    try {
      const res = await fetch(item.url, { headers: { 'User-Agent': 'Antigravity-Verifier' } });
      const text = await res.text();
      console.log(`[${res.status}] ${item.name} - Length: ${text.length} bytes`);
      if (item.name === 'Root /') {
        const hasWallet = text.includes('wallet-section');
        const hasDemoA = text.includes('card-demo-a');
        const hasModal = text.includes('payment-modal');
        console.log(`  > UI Elements: walletSection=${hasWallet}, demoA=${hasDemoA}, modal=${hasModal}`);
      }
      if (item.name === 'Health /health') {
        console.log(`  > Health: ${text.slice(0, 150)}`);
      }
    } catch (err) {
      console.error(`[ERR] ${item.name}: ${err.message}`);
    }
  }
}
verify();
