// api/defillama.js
// GET /api/defillama
// Returns top LP pools from DeFiLlama yields API, filtered to our target chains.
// Enriches with APY, TVL, reward tokens.
// Cache TTL: 5 minutes.

import { cors, getCache, setCache } from './_utils.js';

const TARGET_PROJECTS = new Set([
  'uniswap-v2', 'uniswap-v3', 'uniswap-v4',
  'pancakeswap', 'pancakeswap-v3',
  'meteora', 'orca', 'jito',
]);

const TARGET_CHAINS = new Set(['Ethereum', 'BSC', 'Base', 'Avalanche', 'Solana']);

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const CACHE_KEY = 'defillama:pools';
  const cached = getCache(CACHE_KEY);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    const response = await fetch('https://yields.llama.fi/pools', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`DeFiLlama HTTP ${response.status}`);

    const json = await response.json();
    const filtered = (json.data || [])
      .filter(p =>
        TARGET_CHAINS.has(p.chain) &&
        TARGET_PROJECTS.has(p.project) &&
        p.tvlUsd > 0 &&
        p.apy !== null
      )
      .map(p => ({
        pool:        p.pool,
        symbol:      p.symbol,
        project:     p.project,
        chain:       p.chain,
        tvlUsd:      p.tvlUsd,
        apy:         p.apy,
        apyBase:     p.apyBase,
        apyReward:   p.apyReward,
        apyMean30d:  p.apyMean30d,
        apyPct1D:    p.apyPct1D,
        apyPct7D:    p.apyPct7D,
        apyPct30D:   p.apyPct30D,
        rewardTokens: p.rewardTokens || [],
        il7d:        p.il7d,
        volumeUsd1d: p.volumeUsd1d,
        stablecoin:  p.stablecoin,
      }))
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, 500);

    const payload = {
      success:   true,
      count:     filtered.length,
      fetchedAt: Date.now(),
      data:      filtered,
    };

    setCache(CACHE_KEY, payload, 5 * 60_000); // 5 min TTL
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
