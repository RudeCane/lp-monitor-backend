// ─── Shared in-memory cache ──────────────────────────────────────────────────
// Vercel reuses function instances, so module-level cache works for short TTLs.
const cache = {};

export function getCache(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    delete cache[key];
    return null;
  }
  return entry.data;
}

export function setCache(key, data, ttlMs = 60_000) {
  cache[key] = { data, expires: Date.now() + ttlMs };
}

// ─── CORS helper ─────────────────────────────────────────────────────────────
export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── DEX definitions ─────────────────────────────────────────────────────────
export const DEX_CONFIGS = [
  { id: 'uni-v2',  short: 'UNI V2',  network: 'eth',    dex: 'uniswap_v2',     chain: 'ETH', feeDefault: 0.003  },
  { id: 'uni-v3',  short: 'UNI V3',  network: 'eth',    dex: 'uniswap_v3',     chain: 'ETH', feeDefault: 0.003  },
  { id: 'uni-v4',  short: 'UNI V4',  network: 'eth',    dex: 'uniswap_v4',     chain: 'ETH', feeDefault: 0.003  },
  { id: 'cake-v2', short: 'CAKE V2', network: 'bsc',    dex: 'pancakeswap_v2', chain: 'BNB', feeDefault: 0.0025 },
  { id: 'cake-v3', short: 'CAKE V3', network: 'bsc',    dex: 'pancakeswap_v3', chain: 'BNB', feeDefault: 0.003  },
  { id: 'cake-v4', short: 'CAKE V4', network: 'bsc',    dex: 'pancakeswap-v4', chain: 'BNB', feeDefault: 0.003  },
  { id: 'meteora', short: 'METEOR',  network: 'solana', dex: 'meteora',        chain: 'SOL', feeDefault: 0.002  },
  { id: 'orca',    short: 'ORCA',    network: 'solana', dex: 'orca',           chain: 'SOL', feeDefault: 0.003  },
  { id: 'jito',    short: 'JITO',    network: 'solana', dex: 'jito',           chain: 'SOL', feeDefault: 0.003  },
];

// ─── Fetch a single DEX page from GeckoTerminal ───────────────────────────────
export async function fetchGeckoDex(cfg) {
  const url = `https://api.geckoterminal.com/api/v2/networks/${cfg.network}/dexes/${cfg.dex}/pools?sort=h24_volume_usd_liquidity_desc&page=1`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GeckoTerminal ${cfg.id}: HTTP ${res.status}`);
  const json = await res.json();
  return (json.data || []).map(p => normalizePool(p, cfg));
}

function normalizePool(p, cfg) {
  const a  = p.attributes || {};
  const vu = a.volume_usd || {};
  const tx = a.transactions || {};
  const pc = a.price_change_percentage || {};
  const liq = parseFloat(a.reserve_in_usd) || 0;
  const v24 = parseFloat(vu.h24) || 0;
  const v6  = parseFloat(vu.h6)  || 0;
  const v1  = parseFloat(vu.h1)  || 0;

  // Detect fee tier from pool name
  let fee = cfg.feeDefault;
  const nm = (a.name || '').toUpperCase();
  if (nm.includes('0.01%') || nm.includes(' 100 '))   fee = 0.0001;
  else if (nm.includes('0.05%') || nm.includes(' 500 '))  fee = 0.0005;
  else if (nm.includes('0.3%')  || nm.includes(' 3000 ')) fee = 0.003;
  else if (nm.includes('1%')    || nm.includes(' 10000 '))fee = 0.01;
  if (a.pool_fee) fee = parseFloat(a.pool_fee) / 100;

  const apr   = liq > 0 ? (v24 * fee * 365 / liq * 100) : 0;
  const ratio = liq > 0 ? v24 / liq : 0;
  const t24   = tx.h24 || {};
  const addr  = (p.id || '').split('_').pop();

  return {
    id:      p.id,
    addr,
    name:    a.name  || 'Unknown',
    dexId:   cfg.id,
    dexName: cfg.short,
    chain:   cfg.chain,
    network: cfg.network,
    liq,
    vol24: v24,
    vol6h: v6,
    vol1h: v1,
    buys:    t24.buys  || 0,
    sells:   t24.sells || 0,
    txns24:  (t24.buys || 0) + (t24.sells || 0),
    pchg24:  parseFloat(pc.h24) || 0,
    pchg1h:  parseFloat(pc.h1)  || 0,
    fee,
    apr,
    ratio,
    basePrice: a.base_token_price_usd || null,
    fetchedAt: Date.now(),
  };
}
