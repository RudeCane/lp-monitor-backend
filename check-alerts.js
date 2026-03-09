// api/cron/check-alerts.js
// Vercel Cron: runs every 5 minutes
// Checks global alert snapshots and logs spikes.
// In production you'd extend this to send emails/webhooks/push notifications.

import { DEX_CONFIGS, fetchGeckoDex, getCache, setCache } from '../_utils.js';

// Persistent snapshot (module-level, survives warm instance reuse)
const volSnapshots = {}; // poolId -> { vol24, ts, name }

export default async function handler(req, res) {
  // Vercel cron sends Authorization header — verify it
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = Date.now();
  const spikes = [];

  try {
    // Fetch all pools
    const results = await Promise.allSettled(DEX_CONFIGS.map(fetchGeckoDex));
    const pools = [];
    for (const r of results) {
      if (r.status === 'fulfilled') pools.push(...r.value);
    }

    // Detect volume spikes (>50% increase since last check)
    const SPIKE_THRESHOLD = 50; // %
    for (const pool of pools) {
      const snap = volSnapshots[pool.id];
      if (snap && snap.vol24 > 10_000) { // only check pools with meaningful volume
        const pct = ((pool.vol24 - snap.vol24) / snap.vol24) * 100;
        if (pct >= SPIKE_THRESHOLD) {
          spikes.push({
            pool: pool.name,
            dex:  pool.dexId,
            chain: pool.chain,
            prevVol: snap.vol24,
            currVol: pool.vol24,
            pctChange: pct.toFixed(1),
          });
        }
      }
      // Update snapshot
      volSnapshots[pool.id] = { vol24: pool.vol24, ts: now, name: pool.name };
    }

    // Store latest spike report in cache so frontend can poll it
    if (spikes.length > 0) {
      const existing = getCache('cron:spikes') || [];
      const updated = [...spikes, ...existing].slice(0, 50); // keep last 50
      setCache('cron:spikes', updated, 30 * 60_000); // 30 min
    }

    console.log(`[cron] Checked ${pools.length} pools. Spikes: ${spikes.length}`);
    return res.status(200).json({ ok: true, poolsChecked: pools.length, spikes });

  } catch (err) {
    console.error('[cron] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
