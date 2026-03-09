// api/spikes.js
// GET /api/spikes
// Returns latest volume spike events detected by the cron job.

import { cors, getCache } from './_utils.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const spikes = getCache('cron:spikes') || [];
  return res.status(200).json({
    success: true,
    count: spikes.length,
    spikes,
  });
}
