/* =========================================================
   KyorakuReplay — live data layer
   Real candles for every instrument that has a public source.
   The browser talks to two endpoints only:
     GET /api/yahoo?symbol=ES%3DF&interval=5m&range=1mo
     GET /api/binance?symbol=BTCUSDT&interval=5m&limit=1000
   Both are same-origin serverless functions (see /api + server.py),
   so no CORS trouble and no API keys.

   If the endpoints are missing or the instrument has no public
   source, the caller falls back to the deterministic synthetic
   generator and the UI says so.
   ========================================================= */
(function (global) {
  "use strict";

  var K = global.KRMarket;
  var API = "/api";

  /* ---------------------------------------------------------
     Instrument -> public symbol map.
     "provider:symbol" — the first symbol that resolves wins.
     Futures use Yahoo's continuous front-month contract (=F),
     FX futures their CME code, crypto its Binance spot pair.
  --------------------------------------------------------- */
  var LIVE = {
    /* ---- Forex (spot, Yahoo FX) ---- */
    EURUSD: "yahoo:EURUSD=X", GBPUSD: "yahoo:GBPUSD=X", USDJPY: "yahoo:USDJPY=X",
    USDCHF: "yahoo:USDCHF=X", USDCAD: "yahoo:USDCAD=X", AUDUSD: "yahoo:AUDUSD=X",
    NZDUSD: "yahoo:NZDUSD=X", EURGBP: "yahoo:EURGBP=X", EURJPY: "yahoo:EURJPY=X",
    GBPJPY: "yahoo:GBPJPY=X", AUDJPY: "yahoo:AUDJPY=X", EURAUD: "yahoo:EURAUD=X",
    GBPAUD: "yahoo:GBPAUD=X", USDSEK: "yahoo:USDSEK=X", USDNOK: "yahoo:USDNOK=X",
    USDMXN: "yahoo:USDMXN=X", USDZAR: "yahoo:USDZAR=X", USDSGD: "yahoo:USDSGD=X",
    EURCHF: "yahoo:EURCHF=X", GBPCHF: "yahoo:GBPCHF=X",

    /* ---- Indices (cash indices) ---- */
    NAS100: "yahoo:^NDX", SPX500: "yahoo:^GSPC", US30: "yahoo:^DJI", US2000: "yahoo:^RUT",
    GER40: "yahoo:^GDAXI", UK100: "yahoo:^FTSE", FRA40: "yahoo:^FCHI",
    JP225: "yahoo:^N225", AUS200: "yahoo:^AXJO", HK50: "yahoo:^HSI",

    /* ---- Metals (spot, falling back to COMEX futures) ---- */
    XAUUSD: "yahoo:XAUUSD=X|GC=F", XAGUSD: "yahoo:XAGUSD=X|SI=F",
    XPTUSD: "yahoo:XPTUSD=X|PL=F", XPDUSD: "yahoo:XPDUSD=X|PA=F",

    /* ---- Energy (NYMEX / ICE) ---- */
    USOIL: "yahoo:CL=F", UKOIL: "yahoo:BZ=F", NATGAS: "yahoo:NG=F",

    /* ---- Crypto (Binance spot, no key) ---- */
    BTCUSD: "binance:BTCUSDT", ETHUSD: "binance:ETHUSDT", SOLUSD: "binance:SOLUSDT",
    XRPUSD: "binance:XRPUSDT", DOGEUSD: "binance:DOGEUSDT", AVAXUSD: "binance:AVAXUSDT",
    LINKUSD: "binance:LINKUSDT",

    /* ---- Futures: equity index ---- */
    ES: "yahoo:ES=F", MES: "yahoo:MES=F|ES=F",
    NQ: "yahoo:NQ=F", MNQ: "yahoo:MNQ=F|NQ=F",
    YM: "yahoo:YM=F", MYM: "yahoo:MYM=F|YM=F",
    RTY: "yahoo:RTY=F", M2K: "yahoo:M2K=F|RTY=F",
    FDAX: "yahoo:FDAX=F|^GDAXI", FDXM: "yahoo:FDXM=F|FDAX=F|^GDAXI",
    FESX: "yahoo:FESX=F|^STOXX50E", FSXE: "yahoo:FSXE=F|FESX=F|^STOXX50E",
    FCE: "yahoo:FCE=F|^FCHI",
    VX: "yahoo:^VIX", VXM: "yahoo:^VIX",

    /* ---- Futures: energy ---- */
    CL: "yahoo:CL=F", MCL: "yahoo:MCL=F|CL=F", QM: "yahoo:QM=F|CL=F",
    NG: "yahoo:NG=F", MNG: "yahoo:MNG=F|NG=F",
    HO: "yahoo:HO=F", RB: "yahoo:RB=F", BZ: "yahoo:BZ=F",

    /* ---- Futures: metals ---- */
    GC: "yahoo:GC=F", MGC: "yahoo:MGC=F|GC=F",
    SI: "yahoo:SI=F", SIL: "yahoo:SIL=F|SI=F",
    HG: "yahoo:HG=F", MHG: "yahoo:MHG=F|HG=F",
    PL: "yahoo:PL=F", PA: "yahoo:PA=F",

    /* ---- Futures: rates ---- */
    ZB: "yahoo:ZB=F", ZN: "yahoo:ZN=F", ZF: "yahoo:ZF=F", ZT: "yahoo:ZT=F",
    FGBL: "yahoo:FGBL=F", FGBM: "yahoo:FGBM=F",

    /* ---- Futures: FX ---- */
    "6E": "yahoo:6E=F", "6B": "yahoo:6B=F", "6J": "yahoo:6J=F", "6A": "yahoo:6A=F",
    "6C": "yahoo:6C=F", "6S": "yahoo:6S=F", DX: "yahoo:DX-Y.NYB|DX=F",

    /* ---- Futures: grains & softs ---- */
    ZC: "yahoo:ZC=F", ZS: "yahoo:ZS=F", ZW: "yahoo:ZW=F", ZM: "yahoo:ZM=F", ZL: "yahoo:ZL=F",
    LE: "yahoo:LE=F", HE: "yahoo:HE=F", KC: "yahoo:KC=F", SB: "yahoo:SB=F",
    CC: "yahoo:CC=F", CT: "yahoo:CT=F", OJ: "yahoo:OJ=F",

    /* ---- Futures: crypto ---- */
    BTC: "binance:BTCUSDT", MBT: "binance:BTCUSDT", MET: "binance:ETHUSDT"
  };

  /* ---------------------------------------------------------
     Timeframe translation
  --------------------------------------------------------- */
  /* Yahoo: interval + how far back to ask. We only ever keep the last
     3000 bars, but the range has to be wide enough to fill them. */
  var YAHOO = {
    "1m": { interval: "1m", range: "5d" },
    "5m": { interval: "5m", range: "1mo" },
    "15m": { interval: "15m", range: "3mo" },
    "1H": { interval: "60m", range: "1y" },
    "4H": { interval: "60m", range: "2y", aggregate: 4 },
    "1D": { interval: "1d", range: "10y" }
  };
  var BINANCE = {
    "1m": "1m", "5m": "5m", "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d"
  };

  var BAR_LIMIT = 3000;
  var TTL = { "1m": 45000, "5m": 120000, "15m": 240000, "1H": 420000, "4H": 600000, "1D": 900000 };

  var mem = new Map();          /* id:tf -> { series, at } */
  var status = { mode: "auto", checked: false, yahoo: null, binance: null, lastError: null, lastSource: null };

  function readPref(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function writePref(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  /* "yahoo:ES=F|MES=F" -> [{provider:'yahoo', symbol:'ES=F'}, ...] */
  function candidates(id) {
    var spec = LIVE[id];
    if (!spec) return [];
    var out = [];
    spec.split("|").forEach(function (part, i) {
      if (i === 0) {
        var cut = part.indexOf(":");
        out.push({ provider: part.slice(0, cut), symbol: part.slice(cut + 1) });
      } else {
        var last = out[out.length - 1];
        out.push({ provider: last.provider, symbol: part });
      }
    });
    return out;
  }

  function hasLive(id) { return !!LIVE[id]; }
  function liveCount() {
    return K.ASSETS.filter(function (a) { return !!LIVE[a.id]; }).length;
  }

  /* ---------------------------------------------------------
     Fetch helpers
  --------------------------------------------------------- */
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () { reject(new Error("timeout")); }, ms);
      promise.then(function (v) { clearTimeout(to); resolve(v); },
                   function (e) { clearTimeout(to); reject(e); });
    });
  }

  function json(url) {
    return withTimeout(
      fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }), 12000);
  }

  function yahooUrl(symbol, tf) {
    var cfg = YAHOO[tf] || YAHOO["1m"];
    return API + "/yahoo?symbol=" + encodeURIComponent(symbol) +
      "&interval=" + encodeURIComponent(cfg.interval) +
      "&range=" + encodeURIComponent(cfg.range);
  }
  function binanceUrl(symbol, tf) {
    var interval = BINANCE[tf] || "1m";
    var limit = tf === "1D" ? 1500 : 1000;
    return API + "/binance?symbol=" + encodeURIComponent(symbol) +
      "&interval=" + encodeURIComponent(interval) + "&limit=" + limit;
  }

  /* ---------------------------------------------------------
     Parsers -> [{t,o,h,l,c,v}]
  --------------------------------------------------------- */
  function parseYahoo(payload) {
    var chart = payload && payload.chart;
    if (!chart || !chart.result || !chart.result.length) return { bars: [], meta: null };
    var res = chart.result[0];
    var meta = res.meta || {};
    var ts = res.timestamp || [];
    var q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
    var bars = [];
    for (var i = 0; i < ts.length; i++) {
      var o = q.open ? q.open[i] : null;
      var h = q.high ? q.high[i] : null;
      var l = q.low ? q.low[i] : null;
      var c = q.close ? q.close[i] : null;
      if (o == null || h == null || l == null || c == null) continue;
      if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
      if (h < l) continue;
      bars.push({
        t: ts[i] * 1000,
        o: o, h: h, l: l, c: c,
        v: q.volume && q.volume[i] ? q.volume[i] : 0
      });
    }
    return { bars: bars, meta: meta };
  }

  function parseBinance(payload) {
    if (!Array.isArray(payload)) return { bars: [], meta: null };
    var bars = payload.map(function (k) {
      var t = +k[0];
      if (t < 1e12) t *= 1000;            /* seconds -> ms */
      return { t: t, o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] };
    }).filter(function (b) {
      return isFinite(b.o) && isFinite(b.h) && isFinite(b.l) && isFinite(b.c) && b.h >= b.l;
    });
    return { bars: bars, meta: null };
  }

  /* Merge hourly candles into N-hour buckets aligned to the epoch. */
  function aggregate(bars, factor) {
    if (factor <= 1) return bars;
    var span = (K.TF_SECONDS ? K.TF_SECONDS["1H"] : 3600000) * factor;
    var out = [];
    var bucket = null;
    bars.forEach(function (b) {
      var key = Math.floor(b.t / span) * span;
      if (!bucket || bucket.t !== key) {
        if (bucket) out.push(bucket);
        bucket = { t: key, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v };
      } else {
        bucket.h = Math.max(bucket.h, b.h);
        bucket.l = Math.min(bucket.l, b.l);
        bucket.c = b.c;
        bucket.v += b.v;
      }
    });
    if (bucket) out.push(bucket);
    return out;
  }

  /* Public providers sometimes quote in a different magnitude than our
     catalogue (e.g. Yahoo's 6J is USD/JPY-style). Keep the instrument's own
     digits and tick but never rescale prices: they are what the market says. */
  function trim(bars, limit) {
    if (bars.length > 1) {
      bars.sort(function (a, b) { return a.t - b.t; });
      var out = [bars[0]];
      for (var i = 1; i < bars.length; i++) {
        if (bars[i].t !== out[out.length - 1].t) out.push(bars[i]);
        else out[out.length - 1] = bars[i];
      }
      bars = out;
    }
    if (bars.length <= limit) return bars;
    return bars.slice(bars.length - limit);
  }

  function fingerprint(bars) {
    if (!bars.length) return "";
    var f = bars[0], l = bars[bars.length - 1];
    return bars.length + ":" + f.t + ":" + l.t + ":" + l.c;
  }

  /* ---------------------------------------------------------
     Public API
  --------------------------------------------------------- */
  function mode() {
    var m = readPref("fxr-data-mode", "auto");
    return (m === "live" || m === "synthetic") ? m : "auto";
  }
  function setMode(next) {
    var m = next === "synthetic" ? "synthetic" : next === "live" ? "live" : "auto";
    writePref("fxr-data-mode", m);
    status.mode = m;
    status.checked = false;       /* re-probe on the next load */
    status.yahoo = null;
    status.binance = null;
    mem.clear();
  }

  /* Probe both endpoints once so the UI knows whether live data exists. */
  function probe() {
    if (status.checked) return Promise.resolve(status);
    status.checked = true;
    var checks = [
      json(API + "/yahoo?symbol=" + encodeURIComponent("ES=F") + "&interval=5m&range=5d&probe=1")
        .then(function (d) { return !!(d && d.chart && d.chart.result); })
        .catch(function () { return false; }),
      json(API + "/binance?symbol=BTCUSDT&interval=5m&limit=5&probe=1")
        .then(function (d) { return Array.isArray(d) && d.length > 0; })
        .catch(function () { return false; })
    ];
    return Promise.all(checks).then(function (r) {
      status.yahoo = r[0];
      status.binance = r[1];
      return status;
    });
  }

  function cached(id, tf) {
    var key = id + ":" + tf;
    var hit = mem.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > (TTL[tf] || 60000)) return null;
    return hit.series;
  }

  function fromCacheStorage(id, tf) {
    try {
      var raw = localStorage.getItem("fxr-cache:" + id + ":" + tf);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || Date.now() - parsed.at > 6 * 3600 * 1000) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function toCacheStorage(id, tf, bars, source) {
    try {
      /* only keep the tail so we never blow the 5 MB quota */
      localStorage.setItem("fxr-cache:" + id + ":" + tf,
        JSON.stringify({ at: Date.now(), bars: bars.slice(-1200), source: source }));
    } catch (e) {
      try { localStorage.removeItem("fxr-cache:" + id + ":" + tf); } catch (e2) {}
    }
  }

  /* Build a series from real candles when possible.
     Always resolves: on any failure it hands back the synthetic series
     with `synthetic: true` so the caller can show the right badge. */
  function load(id, tf) {
    tf = tf || "1m";
    var asset = K.get(id);
    var m = mode();
    if (!status.checked && m !== "synthetic") probe();   /* refresh reachability in the background */
    var hit = cached(id, tf);
    if (hit) return Promise.resolve(hit);
    if (m === "synthetic" || !LIVE[id]) {
      return Promise.resolve(fallback(id, tf, m === "synthetic" ? "Synthetic mode" : "No public source"));
    }

    var list = candidates(id);
    var tried = [];

    function attempt(i) {
      if (i >= list.length) {
        return Promise.resolve(fallback(id, tf, tried.join(", ") || "Source unavailable"));
      }
      var c = list[i];
      /* the probe already told us this endpoint is missing in this build:
         skip the round-trip instead of waiting on a doomed request */
      if (status.checked && status[c.provider] === false) {
        tried.push(c.symbol + " (endpoint unavailable)");
        return attempt(i + 1);
      }
      var url = c.provider === "binance" ? binanceUrl(c.symbol, tf) : yahooUrl(c.symbol, tf);
      return json(url)
        .then(function (payload) {
          var parsed = c.provider === "binance" ? parseBinance(payload) : parseYahoo(payload);
          var cfg = c.provider === "yahoo" ? (YAHOO[tf] || {}) : {};
          var bars = parsed.bars;
          if (cfg.aggregate) bars = aggregate(bars, cfg.aggregate);
          bars = trim(bars, BAR_LIMIT);
          if (bars.length < 30) throw new Error("only " + bars.length + " bars");
          var series = K.decorate(asset, tf, bars, {
            synthetic: false,
            source: {
              provider: c.provider,
              symbol: c.symbol,
              label: c.provider === "binance" ? "Binance" : "Yahoo Finance",
              fetchedAt: Date.now(),
              currency: parsed.meta && parsed.meta.currency
            }
          });
          series.synthetic = false;
          mem.set(id + ":" + tf, { series: series, at: Date.now() });
          toCacheStorage(id, tf, bars, series.source);
          status.lastSource = series.source;
          status.lastError = null;
          return series;
        })
        .catch(function (err) {
          tried.push(c.symbol + " (" + (err && err.message ? err.message : "error") + ")");
          return attempt(i + 1);
        });
    }

    return attempt(0);
  }

  function fallback(id, tf, reason) {
    var series = K.syntheticSeries(id, tf);
    series.synthetic = true;
    series.fallbackReason = reason;
    /* reuse a recent fetch for this instrument if we have one, so panning
       around offline still shows the real prices you last loaded.
       Explicit "offline engine" mode skips this and shows simulated candles. */
    var stored = mode() === "synthetic" ? null : fromCacheStorage(id, tf);
    if (stored && stored.bars && stored.bars.length > 30) {
      var asset = K.get(id);
      var real = K.decorate(asset, tf, stored.bars, {
        synthetic: false,
        source: { provider: (stored.source && stored.source.provider) || "cache", symbol: stored.source && stored.source.symbol, label: "Cached", fetchedAt: stored.at }
      });
      real.synthetic = false;
      real.stale = true;
      return real;
    }
    status.lastError = reason;
    return series;
  }

  /* A quick, awaited probe + load used by the boot screen. */
  function ready(id, tf) {
    return probe().then(function (st) {
      var asset = K.get(id);
      var cand = candidates(id)[0];
      if (mode() === "synthetic") return load(id, tf);
      if (cand && ((cand.provider === "yahoo" && !st.yahoo) || (cand.provider === "binance" && !st.binance))) {
        return fallback(id, tf, "Live endpoint unavailable");
      }
      return load(id, tf);
    });
  }

  global.KRData = {
    LIVE: LIVE,
    status: status,
    mode: mode,
    setMode: setMode,
    probe: probe,
    ready: ready,
    load: load,
    candidates: candidates,
    hasLive: hasLive,
    liveCount: liveCount,
    clearCache: function () {
      mem.clear();
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf("fxr-cache:") === 0) localStorage.removeItem(k);
        });
      } catch (e) {}
    },
    fingerprint: fingerprint
  };
})(window);
