// api/pools.js - CommonJS
const { cors, getCache, setCache, DEX_CONFIGS, fetchGeckoDex } = require('./_utils');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const dexFilter = req.query.dex || 'all';
  const targets = dexFilter === 'all'
    ? DEX_CONFIGS
    : DEX_CONFIGS.filter(d => d.id === dexFilter);

  if (!targets.length) {
    return res.status(400).json({ error: 'Unknown dex id' });
  }

  const results = await Promise.allSettled(
    targets.map(async cfg => {
      const cacheKey = `gecko:${cfg.id}`;
      const cached = getCache(cacheKey);
      if (cached) return { dexId: cfg.id, pools: cached, cached: true };
      const pools = await fetchGeckoDex(cfg);
      setCache(cacheKey, pools, 60000);
      return { dexId: cfg.id, pools, cached: false };
    })
  );

  const data = [], errors = [], meta = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { dexId, pools, cached } = r.value;
      data.push(...pools);
      meta[dexId] = { count: pools.length, cached, vol24: pools.reduce((a, b) => a + (b.vol24 || 0), 0) };
    } else {
      errors.push({ message: r.reason?.message });
    }
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  return res.status(200).json({ success: true, count: data.length, fetchedAt: Date.now(), meta, data });
};
