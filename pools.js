// api/pools.js
// GET /api/pools?dex=all|uni-v2|...
// Returns cached pool data from GeckoTerminal for all configured DEXs.
// Cache TTL: 60 seconds per DEX.

import { cors, getCache, setCache, DEX_CONFIGS, fetchGeckoDex } from './_utils.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const dexFilter = req.query.dex || 'all';
  const targets = dexFilter === 'all'
    ? DEX_CONFIGS
    : DEX_CONFIGS.filter(d => d.id === dexFilter);

  if (!targets.length) {
    return res.status(400).json({ error: 'Unknown dex id', validIds: DEX_CONFIGS.map(d => d.id) });
  }

  const results = await Promise.allSettled(
    targets.map(async cfg => {
      const cacheKey = `gecko:${cfg.id}`;
      const cached = getCache(cacheKey);
      if (cached) return { dexId: cfg.id, pools: cached, cached: true };

      const pools = await fetchGeckoDex(cfg);
      setCache(cacheKey, pools, 60_000); // 60s TTL
      return { dexId: cfg.id, pools, cached: false };
    })
  );

  const data   = [];
  const errors = [];
  const meta   = {};

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { dexId, pools, cached } = r.value;
      data.push(...pools);
      meta[dexId] = { count: pools.length, cached, vol24: pools.reduce((a, b) => a + (b.vol24 || 0), 0) };
    } else {
      const cfg = targets[results.indexOf(r)];
      errors.push({ dexId: cfg?.id, message: r.reason?.message });
      meta[cfg?.id] = { count: 0, error: r.reason?.message };
    }
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  return res.status(200).json({
    success: true,
    count:   data.length,
    fetchedAt: Date.now(),
    meta,
    errors: errors.length ? errors : undefined,
    data,
  });
}
