/* =========================================================
   /api/yahoo — serverless proxy for Yahoo Finance chart data
   Deploy target: Vercel (Node runtime). No API key required.

   Why a proxy: query1.finance.yahoo.com sends no CORS headers, so a
   browser cannot read it directly. Server-side we can, and we cache the
   response at the edge for a minute.

   GET /api/yahoo?symbol=ES%3DF&interval=5m&range=1mo
   ========================================================= */
/* Yahoo runs several identical front-ends; rotate when one is rate limited. */
const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

const ALLOWED_INTERVALS = new Set(["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo"]);
const ALLOWED_RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"]);

function clamp(s, allowed, fallback) {
  return allowed.has(s) ? s : fallback;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

  const symbol = String(req.query.symbol || "").trim();
  if (!symbol || symbol.length > 32) {
    return res.status(400).json({ error: "symbol is required" });
  }

  const interval = clamp(String(req.query.interval || "5m"), ALLOWED_INTERVALS, "5m");
  const range = clamp(String(req.query.range || "1mo"), ALLOWED_RANGES, "1mo");

  const path =
    "/v8/finance/chart/" +
    encodeURIComponent(symbol) +
    `?interval=${interval}&range=${range}&includePrePost=false&events=div%2Csplit&corsDomain=finance.yahoo.com`;

  let upstream = null;
  let text = "";
  let lastStatus = 0;
  for (const host of HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      upstream = await fetch(host + path, {
        signal: controller.signal,
        headers: {
          // Yahoo rejects some default runtimes; a normal UA is enough
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://finance.yahoo.com/",
        },
      });
      clearTimeout(timer);
      text = await upstream.text();
      lastStatus = upstream.status;
      /* 429/5xx: try the next mirror; 404 means the ticker itself is unknown */
      if (upstream.ok || upstream.status === 404) break;
    } catch (e) {
      clearTimeout(timer);
      upstream = null;
      lastStatus = 0;
    }
  }

  try {
    if (!upstream || !upstream.ok) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(lastStatus === 404 ? 404 : 502).json({
        error: "upstream " + (lastStatus || "unreachable"),
        symbol,
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: "upstream returned non-JSON", symbol });
    }

    const result = data && data.chart && data.chart.result;
    if (!result || !result.length) {
      // Yahoo answers 200 with an empty result set for unknown tickers
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).json({ error: "no data", symbol, chart: data && data.chart });
    }

    // Short cache: 1m candles refresh fast, daily candles can sit longer.
    const maxAge = interval === "1m" ? 30 : interval === "1d" ? 300 : 60;
    res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(text);
  } catch (err) {
    clearTimeout(timer);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      error: err && err.name === "AbortError" ? "upstream timeout" : "upstream failed",
      symbol,
    });
  }
}
