// api/cron/check-alerts.js - CommonJS
const { DEX_CONFIGS, fetchGeckoDex, getCache, setCache } = require('../_utils');

const volSnapshots = {};

module.exports = async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = Date.now();
  const spikes = [];

  try {
    const results = await Promise.allSettled(DEX_CONFIGS.map(fetchGeckoDex));
    const pools = [];
    for (const r of results) { if (r.status === 'fulfilled') pools.push(...r.value); }

    for (const pool of pools) {
      const snap = volSnapshots[pool.id];
      if (snap && snap.vol24 > 10000) {
        const pct = ((pool.vol24 - snap.vol24) / snap.vol24) * 100;
        if (pct >= 50) spikes.push({ pool: pool.name, dex: pool.dexId, chain: pool.chain, prevVol: snap.vol24, currVol: pool.vol24, pctChange: pct.toFixed(1) });
      }
      volSnapshots[pool.id] = { vol24: pool.vol24, ts: now };
    }

    if (spikes.length > 0) {
      const existing = getCache('cron:spikes') || [];
      setCache('cron:spikes', [...spikes, ...existing].slice(0, 50), 1800000);
    }

    return res.status(200).json({ ok: true, poolsChecked: pools.length, spikes });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
