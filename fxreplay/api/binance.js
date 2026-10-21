/* =========================================================
   /api/binance — serverless proxy for Binance spot klines
   Deploy target: Vercel (Node runtime). No API key required.

   Binance does send CORS headers, so the browser could call it
   directly. We still route through the proxy so that:
     - regions where api.binance.com is blocked keep working,
     - one origin/one cache story for every provider,
     - we can merge several 1000-bar pages into a single answer.

   GET /api/binance?symbol=BTCUSDT&interval=5m&limit=3000
   ========================================================= */
/* Public market-data mirror first: api.binance.com refuses some regions
   (notably US datacentres, where Vercel runs). Both serve identical klines. */
const HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
];
const PATH = "/api/v3/klines";
const ALLOWED = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w"]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

  const symbol = String(req.query.symbol || "").toUpperCase().trim();
  if (!/^[A-Z0-9]{4,20}$/.test(symbol)) {
    return res.status(400).json({ error: "invalid symbol" });
  }
  const interval = ALLOWED.has(String(req.query.interval)) ? String(req.query.interval) : "5m";
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 1), 3000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  let host = 0;

  /* one request, with a host fallback when a mirror is unavailable */
  async function page(query) {
    let lastError = null;
    for (let i = 0; i < HOSTS.length; i++) {
      const idx = (host + i) % HOSTS.length;
      try {
        const r = await fetch(HOSTS[idx] + PATH + "?" + query, {
          signal: controller.signal,
          headers: { Accept: "application/json", "User-Agent": "KyorakuReplay/1.0" },
        });
        if (r.status === 429) { lastError = { status: 429 }; continue; }
        if (!r.ok) { lastError = { status: r.status }; continue; }
        host = idx;                       /* stick to the host that worked */
        return { ok: true, page: await r.json() };
      } catch (e) {
        lastError = { status: 0, aborted: e && e.name === "AbortError" };
      }
    }
    return { ok: false, error: lastError || { status: 0 } };
  }

  try {
    let all = [];
    let endTime = null;
    // Binance caps a single response at 1000 candles: page backwards until we
    // have `limit` bars or the history runs out.
    while (all.length < limit) {
      const want = Math.min(1000, limit - all.length);
      let query = `symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${want}`;
      if (endTime) query += `&endTime=${endTime}`;

      const got = await page(query);
      if (!got.ok) {
        clearTimeout(timer);
        res.setHeader("Cache-Control", "no-store");
        const st = got.error && got.error.status;
        return res.status(st === 429 ? 429 : st === 400 ? 400 : 502)
          .json({ error: "upstream " + (st || (got.error && got.error.aborted ? "timeout" : "failed")), symbol });
      }
      const pageData = got.page;
      if (!Array.isArray(pageData) || !pageData.length) break;

      all = pageData.concat(all);
      endTime = pageData[0][0] - 1;
      if (pageData.length < want) break;
    }
    clearTimeout(timer);

    const maxAge = interval === "1m" ? 20 : 120;
    res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json(all.slice(-limit));
  } catch (err) {
    clearTimeout(timer);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      error: err && err.name === "AbortError" ? "upstream timeout" : "upstream failed",
      symbol,
    });
  }
}
