// api/alerts/check.js - CommonJS
const { cors, DEX_CONFIGS, fetchGeckoDex, getCache, setCache } = require('../_utils');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { alerts = [] } = body || {};
  if (!alerts.length) return res.status(400).json({ error: 'alerts array required' });

  const cached = getCache('alert:all_pools');
  let pools = cached;
  if (!pools) {
    const results = await Promise.allSettled(DEX_CONFIGS.map(fetchGeckoDex));
    pools = [];
    for (const r of results) { if (r.status === 'fulfilled') pools.push(...r.value); }
    setCache('alert:all_pools', pools, 60000);
  }

  const triggered = [];
  for (const rule of alerts) {
    let scope = rule.dexId && rule.dexId !== 'all' ? pools.filter(p => p.dexId === rule.dexId) : pools;
    if (rule.poolName) { const q = rule.poolName.toLowerCase(); scope = scope.filter(p => p.name.toLowerCase().includes(q)); }

    if (rule.type === 'vol_threshold') {
      scope.filter(p => (p.vol24 || 0) >= rule.threshold).forEach(p =>
        triggered.push({ ruleId: rule.id, label: rule.label, pool: p.name, dexId: p.dexId, value: p.vol24, message: `${p.name} vol exceeded threshold` })
      );
    } else if (rule.type === 'apr_threshold') {
      scope.filter(p => (p.apr || 0) >= rule.threshold).forEach(p =>
        triggered.push({ ruleId: rule.id, label: rule.label, pool: p.name, dexId: p.dexId, value: p.apr, message: `${p.name} APR ${p.apr.toFixed(1)}% exceeded ${rule.threshold}%` })
      );
    } else if (rule.type === 'new_top_pool') {
      scope.sort((a, b) => (b.vol24||0) - (a.vol24||0)).slice(0, rule.threshold).forEach((p, i) =>
        triggered.push({ ruleId: rule.id, label: rule.label, pool: p.name, rank: i+1, message: `#${i+1} ${p.name}` })
      );
    }
  }

  return res.status(200).json({ success: true, checkedAt: Date.now(), poolsScanned: pools.length, triggered, count: triggered.length });
};
