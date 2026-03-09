// api/health.js
import { cors, DEX_CONFIGS } from './_utils.js';

export default function handler(req, res) {
  cors(res);
  res.status(200).json({
    status:    'ok',
    version:   '1.0.0',
    ts:        Date.now(),
    dexCount:  DEX_CONFIGS.length,
    dexes:     DEX_CONFIGS.map(d => d.id),
    endpoints: [
      'GET  /api/health',
      'GET  /api/pools?dex=all|<dexId>',
      'GET  /api/defillama',
      'GET  /api/spikes',
      'POST /api/alerts/check',
    ],
  });
}
