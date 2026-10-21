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
const UPSTREAM = "https://api.binance.com/api/v3/klines";
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

  try {
    let all = [];
    let endTime = null;
    // Binance caps a single response at 1000 candles: page backwards until we
    // have `limit` bars or the history runs out.
    while (all.length < limit) {
      const want = Math.min(1000, limit - all.length);
      let url = `${UPSTREAM}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${want}`;
      if (endTime) url += `&endTime=${endTime}`;

      const r = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "KyorakuReplay/1.0" },
      });
      if (!r.ok) {
        clearTimeout(timer);
        res.setHeader("Cache-Control", "no-store");
        return res.status(r.status === 429 ? 429 : 502).json({ error: "upstream " + r.status, symbol });
      }
      const page = await r.json();
      if (!Array.isArray(page) || !page.length) break;

      all = page.concat(all);
      endTime = page[0][0] - 1;
      if (page.length < want) break;
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
