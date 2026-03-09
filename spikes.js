// api/spikes.js - CommonJS
const { cors, getCache } = require('./_utils');

module.exports = function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const spikes = getCache('cron:spikes') || [];
  return res.status(200).json({ success: true, count: spikes.length, spikes });
};
