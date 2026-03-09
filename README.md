# LP Volume Monitor — Full Stack
https://lp-monitor-backend.vercel.app/api/health
Real-time LP pool volume scanner for Uniswap V2/V3/V4, PancakeSwap V2/V3/V4, Meteora, Orca, and Jito.

## Architecture

```
GitHub Pages (index.html)  ──calls──▶  Vercel API (api/)
     ↓                                      ↓
 Frontend UI                    Proxy + Cache + Alerts
                                       ↓
                             GeckoTerminal + DeFiLlama
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Status + endpoint list |
| GET | `/api/pools?dex=all` | All pools (cached 60s) |
| GET | `/api/pools?dex=uni-v3` | Single DEX pools |
| GET | `/api/defillama` | DeFiLlama APY data (cached 5min) |
| GET | `/api/spikes` | Latest volume spike events |
| POST | `/api/alerts/check` | Evaluate alert rules |

## Deploy Backend to Vercel

### Step 1 — Push this folder to GitHub
Create a new repo (e.g. `lp-monitor-backend`) and push all files.

### Step 2 — Import to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Framework: **Other**
4. Click **Deploy**

### Step 3 — Set environment variable (optional)
In Vercel project settings → Environment Variables:
```
CRON_SECRET = any_random_string_you_choose
```

### Step 4 — Copy your Vercel URL
It will look like: `https://lp-monitor-backend.vercel.app`

### Step 5 — Connect frontend
On your GitHub Pages site (`https://rudecane.github.io/lp-volume-monitor`):
- The setup banner will appear on first load
- Paste your Vercel URL and click **SAVE**
- The frontend now routes all API calls through your backend

## Deploy Frontend to GitHub Pages
Upload `index.html` to your `lp-volume-monitor` repo as described.

## Alert Types

| Type | Description | Threshold unit |
|------|-------------|----------------|
| `vol_threshold` | Fires when pool 24H vol exceeds X | USD ($) |
| `vol_spike` | Fires when vol increases X% vs last check | Percent (%) |
| `apr_threshold` | Fires when fee APR exceeds X% | Percent (%) |
| `new_top_pool` | Lists top N pools by volume | Count (N) |
