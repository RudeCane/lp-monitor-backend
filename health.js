// api/health.js - CommonJS
const { cors, DEX_CONFIGS } = require('./_utils');

module.exports = function handler(req, res) {
  cors(res);
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    ts: Date.now(),
    dexCount: DEX_CONFIGS.length,
    dexes: DEX_CONFIGS.map(d => d.id),
    endpoints: [
      'GET  /api/health',
      'GET  /api/pools?dex=all',
      'GET  /api/defillama',
      'GET  /api/spikes',
      'POST /api/alerts/check',
    ],
  });
};
