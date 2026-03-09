// api/defillama.js - CommonJS
const { cors, getCache, setCache } = require('./_utils');

const TARGET_PROJECTS = new Set([
  'uniswap-v2','uniswap-v3','uniswap-v4',
  'pancakeswap','pancakeswap-v3',
  'meteora','orca','jito',
]);
const TARGET_CHAINS = new Set(['Ethereum','BSC','Base','Avalanche','Solana']);

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cached = getCache('defillama:pools');
  if (cached) { res.setHeader('X-Cache','HIT'); return res.status(200).json(cached); }

  try {
    const response = await fetch('https://yields.llama.fi/pools', { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`DeFiLlama HTTP ${response.status}`);
    const json = await response.json();
    const filtered = (json.data || [])
      .filter(p => TARGET_CHAINS.has(p.chain) && TARGET_PROJECTS.has(p.project) && p.tvlUsd > 0 && p.apy !== null)
      .map(p => ({ pool: p.pool, symbol: p.symbol, project: p.project, chain: p.chain, tvlUsd: p.tvlUsd, apy: p.apy, apyMean30d: p.apyMean30d, apyPct1D: p.apyPct1D, apyPct7D: p.apyPct7D, volumeUsd1d: p.volumeUsd1d }))
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, 500);
    const payload = { success: true, count: filtered.length, fetchedAt: Date.now(), data: filtered };
    setCache('defillama:pools', payload, 300000);
    res.setHeader('Cache-Control','s-maxage=300,stale-while-revalidate=60');
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
