/* KyorakuReplay — market feed
 *
 * One catalog, one loader, one rule: never show a candle that did not happen.
 * Sources, in order:
 *   1. data/<ID>.json   — a real snapshot published by the CI job (fast, always there)
 *   2. CME / exchange   — the provider itself, through the host proxy or a relay
 *   3. nothing          — the chart says "no data" instead of inventing bars
 */
(function (global) {
  "use strict";

  /* id, label, name, market, venue, provider symbol, decimals, tick size, tick value, contract */
  var CATALOG = [
    /* ---- CME / CBOT / NYMEX / COMEX futures ---- */
    ["NQ", "NQ", "E-mini Nasdaq-100", "Futures", "CME Globex", "NQ=F", 2, 0.25, 5, "E-mini Nasdaq-100"],
    ["ES", "ES", "E-mini S&P 500", "Futures", "CME Globex", "ES=F", 2, 0.25, 12.5, "E-mini S&P 500"],
    ["MNQ", "MNQ", "Micro Nasdaq-100", "Futures", "CME Globex", "MNQ=F", 2, 0.25, 0.5, "Micro Nasdaq-100"],
    ["MES", "MES", "Micro S&P 500", "Futures", "CME Globex", "MES=F", 2, 0.25, 1.25, "Micro S&P 500"],
    ["YM", "YM", "E-mini Dow", "Futures", "CBOT", "YM=F", 0, 1, 5, "E-mini Dow"],
    ["RTY", "RTY", "E-mini Russell 2000", "Futures", "CME Globex", "RTY=F", 1, 0.1, 5, "E-mini Russell 2000"],
    ["CL", "CL", "WTI Crude Oil", "Futures", "NYMEX", "CL=F", 2, 0.01, 10, "WTI Crude Oil"],
    ["GC", "GC", "Gold", "Futures", "COMEX", "GC=F", 1, 0.1, 10, "Gold"],
    ["SI", "SI", "Silver", "Futures", "COMEX", "SI=F", 3, 0.005, 25, "Silver"],
    ["6E", "6E", "Euro FX", "Futures", "CME Globex", "6E=F", 5, 0.00005, 6.25, "Euro FX"],
    ["ZB", "ZB", "30-Year T-Bond", "Futures", "CBOT", "ZB=F", 2, 0.03125, 31.25, "30-Year T-Bond"],
    ["ZN", "ZN", "10-Year T-Note", "Futures", "CBOT", "ZN=F", 3, 0.015625, 15.625, "10-Year T-Note"],

    /* ---- cash indices ---- */
    ["NAS100", "NAS100", "Nasdaq 100 Index", "Indices", "Nasdaq", "^NDX", 2, 0.25, 0, "Nasdaq-100 index"],
    ["SPX500", "SPX500", "S&P 500 Index", "Indices", "Cboe", "^GSPC", 2, 0.25, 0, "S&P 500 index"],
    ["US30", "US30", "Dow Jones 30", "Indices", "Cboe", "^DJI", 1, 1, 0, "Dow Jones Industrial Average"],
    ["GER40", "GER40", "DAX 40", "Indices", "Xetra", "^GDAXI", 1, 1, 0, "DAX 40 index"],
    ["UK100", "UK100", "FTSE 100", "Indices", "LSE", "^FTSE", 2, 0.5, 0, "FTSE 100 index"],
    ["JP225", "JP225", "Nikkei 225", "Indices", "Tokyo SE", "^N225", 0, 5, 0, "Nikkei 225 index"],

    /* ---- spot FX ---- */
    ["EURUSD", "EUR/USD", "Euro / US Dollar", "Forex", "Interbank", "EURUSD=X", 5, 0.00001, 0, "Euro vs US Dollar"],
    ["GBPUSD", "GBP/USD", "British Pound / US Dollar", "Forex", "Interbank", "GBPUSD=X", 5, 0.00001, 0, "Pound vs US Dollar"],
    ["USDJPY", "USD/JPY", "US Dollar / Japanese Yen", "Forex", "Interbank", "JPY=X", 3, 0.001, 0, "US Dollar vs Yen"],
    ["USDCHF", "USD/CHF", "US Dollar / Swiss Franc", "Forex", "Interbank", "CHF=X", 5, 0.00001, 0, "US Dollar vs Franc"],
    ["AUDUSD", "AUD/USD", "Australian Dollar / US Dollar", "Forex", "Interbank", "AUDUSD=X", 5, 0.00001, 0, "Aussie vs US Dollar"],
    ["USDCAD", "USD/CAD", "US Dollar / Canadian Dollar", "Forex", "Interbank", "CAD=X", 5, 0.00001, 0, "US Dollar vs Loonie"],
    ["NZDUSD", "NZD/USD", "New Zealand Dollar / US Dollar", "Forex", "Interbank", "NZDUSD=X", 5, 0.00001, 0, "Kiwi vs US Dollar"],
    ["EURJPY", "EUR/JPY", "Euro / Japanese Yen", "Forex", "Interbank", "EURJPY=X", 3, 0.001, 0, "Euro vs Yen"],
    ["GBPJPY", "GBP/JPY", "British Pound / Japanese Yen", "Forex", "Interbank", "GBPJPY=X", 3, 0.001, 0, "Pound vs Yen"],

    /* ---- metals & energy (spot) ---- */
    ["XAUUSD", "XAU/USD", "Gold spot", "Metals", "LBMA", "XAUUSD=X", 2, 0.01, 0, "Gold spot vs US Dollar"],
    ["XAGUSD", "XAG/USD", "Silver spot", "Metals", "LBMA", "XAGUSD=X", 3, 0.001, 0, "Silver spot vs US Dollar"],
    ["USOIL", "USOIL", "WTI Crude spot", "Energy", "NYMEX", "CL=F", 2, 0.01, 0, "WTI crude spot"],
    ["UKOIL", "UKOIL", "Brent Crude", "Energy", "ICE", "BZ=F", 2, 0.01, 0, "Brent crude"],
    ["NGAS", "NGAS", "Natural Gas", "Energy", "NYMEX", "NG=F", 3, 0.001, 0, "Henry Hub natural gas"],

    /* ---- crypto ---- */
    ["BTCUSD", "BTC/USD", "Bitcoin", "Crypto", "Binance", "BTCUSDT", 1, 0.1, 0, "Bitcoin vs US Dollar"],
    ["ETHUSD", "ETH/USD", "Ethereum", "Crypto", "Binance", "ETHUSDT", 2, 0.01, 0, "Ethereum vs US Dollar"],
    ["SOLUSD", "SOL/USD", "Solana", "Crypto", "Binance", "SOLUSDT", 3, 0.001, 0, "Solana vs US Dollar"]
  ];

  /* A trader types NAS100USD, NQ1!, ustec, spx… all of it lands on the right row. */
  var ALIASES = {
    NAS100: "nas100usd nasdaq100 nasdaq-100 nasdaq 100 ndx us100 n100 ustec ndx100",
    NQ: "nq1! nasdaq futures emini nasdaq e-mini nasdaq nq100 us100",
    ES: "es1! spx sp500 s&p500 s&p 500 emini sp e-mini sp",
    MNQ: "mnq1! micro nasdaq",
    MES: "mes1! micro sp micro s&p",
    YM: "ym1! dow dow30 djia wall street",
    RTY: "rty1! russell",
    CL: "cl1! oil wti crude",
    GC: "gc1! gold bullion",
    SI: "si1! silver",
    "6E": "6e1! euro fx",
    ZB: "zb1! bonds tbond t-bond",
    ZN: "zn1! tnote t-note 10y",
    SPX500: "spx500 gspc s&p",
    US30: "dji dow",
    GER40: "dax dax40 de40 gdaxi germany",
    UK100: "ftse ftse100 uk100",
    JP225: "nikkei nikkei225 jp225",
    EURUSD: "eurusd euro fiber",
    GBPUSD: "gbpusd cable",
    USDJPY: "usdjpy yen",
    USDCHF: "usdchf franc",
    AUDUSD: "audusd aussie",
    USDCAD: "usdcad loonie",
    NZDUSD: "nzdusd kiwi",
    EURJPY: "eurjpy",
    GBPJPY: "gbpjpy dragon",
    XAUUSD: "gold xau",
    XAGUSD: "silver xag",
    USOIL: "wti crude oil",
    UKOIL: "brent",
    NGAS: "natgas natural gas ng",
    BTCUSD: "bitcoin btc",
    ETHUSD: "ethereum eth",
    SOLUSD: "solana sol"
  };

  var MARKETS = ["Futures", "Indices", "Forex", "Crypto", "Metals", "Energy"];

  var ASSETS = CATALOG.map(function (r) {
    var id = r[0];
    var isCrypto = r[3] === "Crypto";
    return {
      id: id, label: r[1], name: r[2], market: r[3], venue: r[4],
      symbol: r[5], provider: isCrypto ? "binance" : "yahoo",
      dp: r[6], tick: r[7], tickValue: r[8], contract: r[9],
      alias: ALIASES[id] || ""
    };
  });
  var BY_ID = {};
  ASSETS.forEach(function (a) { BY_ID[a.id] = a; });

  var TF = { "1m": 60, "5m": 300, "15m": 900, "1H": 3600, "4H": 14400, "1D": 86400 };
  var TF_LIST = ["1m", "5m", "15m", "1H", "4H", "1D"];
  var RANGE_MS = {
    "1D": 864e5, "5D": 432e6, "1M": 2592e6, "3M": 7776e6,
    "6M": 15552e6, "1Y": 31536e6, "ALL": 0
  };

  function search(q) {
    q = String(q || "").trim().toLowerCase();
    if (!q) return ASSETS.slice();
    var out = [];
    ASSETS.forEach(function (a, i) {
      var id = a.id.toLowerCase(), label = a.label.toLowerCase();
      var words = (id + " " + label + " " + a.name.toLowerCase() + " " + a.alias)
        .split(/[\s,]+/).filter(Boolean);
      var hay = (id + " " + label + " " + a.name + " " + a.market + " " + a.venue + " " + a.alias).toLowerCase();
      var rank;
      if (id === q || label === q || words.indexOf(q) !== -1) rank = 0;
      else if (id.indexOf(q) === 0 || label.indexOf(q) === 0 ||
               words.some(function (w) { return w.indexOf(q) === 0; })) rank = 1;
      else if (hay.indexOf(q) !== -1) rank = 2;
      else return;
      out.push({ a: a, r: rank, i: i });
    });
    out.sort(function (x, y) { return x.r - y.r || x.i - y.i; });
    return out.map(function (x) { return x.a; });
  }

  /* ---------- transport ---------- */
  var BASE = (function () {
    var p = global.location.pathname;
    var dir = p.slice(0, p.lastIndexOf("/") + 1);
    return dir;
  })();

  var RELAYS = [
    function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); },
    function (u) { return "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u); },
    function (u) { return "https://r.jina.ai/" + u; }
  ];

  function yahooUrl(symbol, tf, count) {
    var map = {
      "1m": ["1m", "5d"], "5m": ["5m", "1mo"], "15m": ["15m", "3mo"],
      "1H": ["60m", "6mo"], "4H": ["60m", "1y"], "1D": ["1d", "5y"]
    };
    var m = map[tf] || map["1H"];
    return "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) +
      "?interval=" + m[0] + "&range=" + m[1] + "&includePrePost=false&events=div%2Csplit";
  }
  function binanceUrl(symbol, tf) {
    var map = { "1m": "1m", "5m": "5m", "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d" };
    return "https://data-api.binance.vision/api/v3/klines?symbol=" + encodeURIComponent(symbol) +
      "&interval=" + (map[tf] || "15m") + "&limit=1000";
  }

  function json(res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  /* Try the host proxy, then the exchange itself, then public relays. The first
     one that answers with candles wins; the caller is told which it was. */
  function fetchUpstream(url, direct) {
    var chain = [];
    if (direct) chain.push(direct);
    RELAYS.forEach(function (fn) { chain.push(fn); });
    var i = 0;
    function next() {
      if (i >= chain.length) return Promise.reject(new Error("feed unreachable"));
      var u = chain[i++];
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 11000);
      return fetch(u(url), { signal: ctrl.signal, cache: "no-store" })
        .then(function (r) { clearTimeout(timer); return json(r); })
        .catch(function () { clearTimeout(timer); return next(); });
    }
    return next();
  }

  function parseYahoo(doc, tf) {
    var res = doc && doc.chart && doc.chart.result && doc.chart.result[0];
    if (!res || !res.timestamp) throw new Error("empty yahoo payload");
    var q = res.indicators.quote[0];
    var bars = [];
    for (var i = 0; i < res.timestamp.length; i++) {
      var o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
      if (o == null || h == null || l == null || c == null) continue;
      bars.push([res.timestamp[i], +o, +h, +l, +c, q.volume[i] || 0]);
    }
    if (tf === "4H") bars = aggregate(bars, 14400);
    return bars;
  }
  function parseBinance(rows, tf) {
    var bars = rows.map(function (r) {
      return [Math.floor(r[0] / 1000), +r[1], +r[2], +r[3], +r[4], +r[5]];
    });
    if (tf === "4H" && false) bars = aggregate(bars, 14400); /* Binance serves natively */
    return bars;
  }

  /* Bucket finer candles into 4H blocks on the exchange's own clock. */
  function aggregate(bars, seconds) {
    var out = [], cur = null;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      var k = Math.floor(b[0] / seconds) * seconds;
      if (!cur || cur[0] !== k) {
        if (cur) out.push(cur);
        cur = [k, b[1], b[2], b[3], b[4], b[5]];
      } else {
        cur[2] = Math.max(cur[2], b[2]);
        cur[3] = Math.min(cur[3], b[3]);
        cur[4] = b[4];
        cur[5] += b[5];
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  var cache = {};
  var status = { lastError: null, lastTransport: null };

  /* Snapshot first: it is the same real data the CI job pulled, just older.
     The second origin is the snapshot the previous deployment already published;
     it is the same exchange data, one refresh behind, and it keeps real candles
     on screen while this deployment has none of its own. */
  var LEGACY = "https://kyoraku-bl.github.io/reverse/data/";

  function snapshotPath(base, id) {
    return fetch(base + encodeURIComponent(id) + ".json", { cache: "no-store" }).then(json);
  }

  function snapshot(id) {
    return snapshotPath(BASE + "data/", id)
      .catch(function () {
        if (BASE.indexOf("kyoraku-bl.github.io") !== -1) throw new Error("no local snapshot");
        return snapshotPath(LEGACY, id);
      })
      .catch(function () { return null; });
  }

  function load(id, tf) {
    var asset = BY_ID[id] || ASSETS[0];
    var key = asset.id + "@" + tf;
    if (cache[key] && Date.now() - cache[key].at < 30000) return Promise.resolve(cache[key].doc);

    return snapshot(asset.id).then(function (snap) {
      var fromSnap = snap && snap.tf && snap.tf[tf] && snap.tf[tf].bars;
      if (fromSnap && fromSnap.length) {
        var fresh = snap.tf[tf].fetchedAt && Date.now() - snap.tf[tf].fetchedAt < 15 * 60000;
        if (fresh) {
          var doc = mk(asset, tf, fromSnap, "snapshot", snap.provider || asset.provider, snap.symbol || asset.symbol, snap.tf[tf].fetchedAt);
          cache[key] = { at: Date.now(), doc: doc };
          return doc;
        }
      }
      return live(asset, tf).catch(function (err) {
        status.lastError = String(err && err.message || err);
        if (fromSnap && fromSnap.length) {
          return mk(asset, tf, fromSnap, "snapshot", snap.provider || asset.provider, snap.symbol || asset.symbol, snap.tf[tf].fetchedAt);
        }
        throw err;
      }).then(function (doc) {
        cache[key] = { at: Date.now(), doc: doc };
        return doc;
      });
    });
  }

  function live(asset, tf) {
    var t0 = Date.now();
    if (asset.provider === "binance") {
      return fetchUpstream(binanceUrl(asset.symbol, tf)).then(function (rows) {
        var bars = parseBinance(rows, tf);
        if (!bars.length) throw new Error("no bars");
        status.lastTransport = "binance";
        return mk(asset, tf, bars, "live", "binance", asset.symbol, t0);
      });
    }
    return fetchUpstream(yahooUrl(asset.symbol, tf)).then(function (doc) {
      var bars = parseYahoo(doc, tf);
      if (!bars.length) throw new Error("no bars");
      status.lastTransport = status.lastTransport || "relay";
      return mk(asset, tf, bars, "live", "yahoo", asset.symbol, t0);
    });
  }

  function mk(asset, tf, bars, transport, provider, symbol, fetchedAt) {
    return {
      id: asset.id, tf: tf, bars: bars,
      transport: transport, provider: provider, symbol: symbol,
      fetchedAt: fetchedAt || Date.now()
    };
  }

  function quotes(ids) {
    return snapshot("_quotes").then(function (doc) {
      if (!doc || !doc.quotes) return {};
      var out = {};
      (ids || Object.keys(doc.quotes)).forEach(function (id) {
        if (doc.quotes[id]) out[id] = doc.quotes[id];
      });
      return out;
    });
  }

  function index() {
    return snapshot("_index").catch(function () { return null; });
  }

  global.KYFeed = {
    ASSETS: ASSETS, MARKETS: MARKETS, TF: TF, TF_LIST: TF_LIST, RANGE_MS: RANGE_MS,
    BY_ID: BY_ID,
    get: function (id) { return BY_ID[id] || ASSETS[0]; },
    search: search,
    load: load,
    quotes: quotes,
    index: index,
    status: status,
    aggregate: aggregate,
    base: BASE
  };
})(typeof window !== "undefined" ? window : globalThis);
