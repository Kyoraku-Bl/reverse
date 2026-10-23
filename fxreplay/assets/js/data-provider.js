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
  var LIVE = (global.KRSymbols || {}).LIVE || {};

  /* ---------------------------------------------------------
     Timeframe translation
  --------------------------------------------------------- */
  /* Yahoo: interval + how far back to ask. We only ever keep the last
     3000 bars, but the range has to be wide enough to fill them. */
  /* Yahoo caps intraday history per interval (1m ≈ 7d, 5m/15m 60d,
     60m 730d) and errors out above it, so these stay inside the cap. */
  var YAHOO = {
    "1m": { interval: "1m", range: "5d" },
    "5m": { interval: "5m", range: "1mo" },
    "15m": { interval: "15m", range: "2mo" },
    "1H": { interval: "60m", range: "2y" },
    "4H": { interval: "60m", range: "2y", aggregate: 4 },
    "1D": { interval: "1d", range: "10y" }
  };
  var BINANCE = {
    "1m": "1m", "5m": "5m", "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d"
  };

  var BAR_LIMIT = 3200;   /* one instrument can carry 2 years of hourly candles */
  var TTL = { "1m": 45000, "5m": 120000, "15m": 240000, "1H": 420000, "4H": 600000, "1D": 900000 };

  var mem = new Map();          /* id:tf -> { series, at } */
  var status = { mode: "auto", checked: false, yahoo: null, binance: null, direct: null, transport: null, lastError: null, lastSource: null };

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

  function json(url, ms) {
    return withTimeout(
      fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }), ms || 12000);
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
     Direct + relay transports.
     When the site is served by a plain static host (GitHub Pages,
     jsDelivr, Netlify drop…) there is no /api proxy. Binance allows
     cross-origin reads, so crypto still loads straight from the
     exchange; Yahoo has no CORS, so its candles go through a public
     passthrough relay. Same bytes, same numbers, no key.
  --------------------------------------------------------- */
  var DIRECT = global.KRDirect || {
    yahoo: "https://query1.finance.yahoo.com/v8/finance/chart/",
    binance: [
      "https://data-api.binance.vision/api/v3/klines",
      "https://api.binance.com/api/v3/klines"
    ],
    relays: [
      /* r.jina.ai answers fast and is rarely blocked; it wraps the JSON in a
         short text preamble, which jparse() strips. */
      function (u) { return "https://r.jina.ai/" + u; },
      function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); },
      function (u) { return "https://corsproxy.io/?url=" + encodeURIComponent(u); },
      function (u) { return "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u); },
      function (u) { return "https://cors.eu.org/" + u; }
    ]
  };

  function yahooDirect(symbol, tf) {
    var cfg = YAHOO[tf] || YAHOO["1m"];
    return DIRECT.yahoo + encodeURIComponent(symbol) +
      "?interval=" + cfg.interval + "&range=" + cfg.range +
      "&includePrePost=false&events=div%2Csplit";
  }
  function binanceDirect(symbol, tf, host) {
    var interval = BINANCE[tf] || "1m";
    var limit = tf === "1D" ? 1500 : 1000;
    return (host || DIRECT.binance[0]) + "?symbol=" + encodeURIComponent(symbol) +
      "&interval=" + encodeURIComponent(interval) + "&limit=" + limit;
  }

  function jsonAbs(url, ms) {
    return withTimeout(
      fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }), ms || 9000);
  }

  /* Some relays wrap the payload in a text preamble or HTML shell.
     Pull out the first complete JSON object instead of trusting the body. */
  function jparse(text) {
    if (typeof text !== "string") return text;
    var from = text.indexOf("{");
    var to = text.lastIndexOf("}");
    if (from === -1 || to <= from) throw new Error("relay returned no JSON");
    return JSON.parse(text.slice(from, to + 1));
  }

  /* Resolves with the first relay that returns a real chart payload.
     Two relays are raced at a time so a slow or blocked one cannot stall
     the chart; the winner is remembered for the rest of the session. */
  function anyOf(promises) {
    return new Promise(function (resolve, reject) {
      var left = promises.length;
      if (!left) return reject(new Error("no relay"));
      promises.forEach(function (p) {
        p.then(resolve, function () {
          if (--left === 0) reject(new Error("no relay answered"));
        });
      });
    });
  }

  var relayPref = parseInt(readPref("fxr-relay", "-1"), 10);
  function raceRelays(target) {
    var n = DIRECT.relays.length;
    var start = relayPref >= 0 && relayPref < n ? relayPref : 0;
    var order = [];
    for (var i = 0; i < n; i++) order.push((start + i) % n);

    function wave(indexes, ms) {
      return anyOf(indexes.map(function (i) {
        var url = DIRECT.relays[i](target);
        return withTimeout(fetch(url, { cache: "no-store" }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        }), ms).then(function (body) {
          var p = jparse(body);
          if (!p || !p.chart || !p.chart.result || !p.chart.result.length) {
            throw new Error("relay payload");
          }
          relayPref = i;
          writePref("fxr-relay", String(i));
          return p;
        });
      }));
    }
    return wave(order.slice(0, 2), 9000).catch(function () {
      if (order.length <= 2) throw new Error("no relay answered");
      return wave(order.slice(2), 9000);
    });
  }

  /* last-resort transport chain for one candidate symbol */
  function offlineFetch(c, tf) {
    if (c.provider === "binance") {
      var hosts = DIRECT.binance;
      return jsonAbs(binanceDirect(c.symbol, tf, hosts[0]))
        .then(function (p) { return { payload: p, transport: "direct" }; })
        .catch(function () {
          return jsonAbs(binanceDirect(c.symbol, tf, hosts[1]))
            .then(function (p) { return { payload: p, transport: "direct" }; });
        });
    }
    return raceRelays(yahooDirect(c.symbol, tf))
      .then(function (p) { return { payload: p, transport: "relay" }; });
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

  /* ---------------------------------------------------------
     Snapshots
     `data/<ID>.json` ships with the site: real candles fetched from
     the provider by the GitHub Actions job (scripts/fetch-market-data).
     Same origin, so it always loads — even when every relay is down.
  --------------------------------------------------------- */
  var SNAP_BASE = "data/";
  var SNAP_FRESH = 40 * 60 * 1000;   /* a snapshot younger than this is used first */

  function snapKey(id) { return "snap:" + id; }
  function loadSnapshot(id) {
    var hit = mem.get(snapKey(id));
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return Promise.resolve(hit.snap);
    return withTimeout(
      fetch(SNAP_BASE + id + ".json", { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }), 6000
    ).then(function (snap) {
      if (!snap || !snap.tf) throw new Error("empty snapshot");
      mem.set(snapKey(id), { snap: snap, at: Date.now() });
      return snap;
    }).catch(function () { return null; });
  }

  function seriesFromSnapshot(asset, id, tf, snap, stale) {
    var cfg = snap.tf[tf];
    if (!cfg) return null;
    var rows = cfg.bars || cfg;
    var bars = rows.map(function (r) {
      return { t: r[0] < 1e12 ? r[0] * 1000 : r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] || 0 };
    });
    bars = trim(bars, BAR_LIMIT);
    if (bars.length < 30) return null;
    var series = K.decorate(asset, tf, bars, {
      synthetic: false,
      source: {
        provider: cfg.provider || snap.provider || "yahoo",
        symbol: cfg.symbol || snap.symbol || id,
        label: (cfg.provider || snap.provider) === "binance" ? "Binance" : "Yahoo Finance",
        fetchedAt: (cfg.fetchedAt || snap.fetchedAt || Date.now()),
        transport: "snapshot",
        derivedFrom: cfg.derivedFrom || null,
        currency: null
      }
    });
    series.synthetic = false;
    series.snapshot = true;
    series.stale = !!stale;
    return series;
  }

  /* Some snapshots miss a coarser interval (Yahoo refuses 15m or 4H for a
     future). Rather than showing a simulated chart, build that interval from
     a finer one that did arrive — same real candles, grouped. */
  var TF_MIN = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1H": 60, "4H": 240, "1D": 1440 };

  function deriveBars(snap, tf) {
    var want = TF_MIN[tf];
    if (!want || !snap.tf) return null;
    var base = null, size = 0;
    Object.keys(snap.tf).forEach(function (b) {
      var m = TF_MIN[b];
      if (!m || m >= want || want % m || want / m > 12) return;
      var cfg = snap.tf[b];
      if (!cfg || !cfg.bars || cfg.bars.length < 30) return;
      if (m > size) { size = m; base = b; }
    });
    if (!base) return null;
    var bucket = want * 60;
    var out = [], cur = null;
    snap.tf[base].bars.forEach(function (r) {
      var t = r[0] < 1e12 ? r[0] : Math.floor(r[0] / 1000);
      var k = Math.floor(t / bucket) * bucket;
      if (!cur || cur[0] !== k) {
        if (cur) out.push(cur);
        cur = [k, r[1], r[2], r[3], r[4], r[5] || 0];
      } else {
        if (r[2] > cur[2]) cur[2] = r[2];
        if (r[3] < cur[3]) cur[3] = r[3];
        cur[4] = r[4];
        cur[5] += r[5] || 0;
      }
    });
    if (cur) out.push(cur);
    if (out.length < 30) return null;
    var src = snap.tf[base];
    var shim = { id: snap.id, symbol: snap.symbol, provider: snap.provider, fetchedAt: snap.fetchedAt, tf: {} };
    shim.tf[tf] = {
      interval: tf,
      provider: src.provider || snap.provider,
      symbol: src.symbol || snap.symbol,
      fetchedAt: src.fetchedAt || snap.fetchedAt,
      currency: src.currency || null,
      bars: out,
      derivedFrom: base
    };
    return shim;
  }

  function shapedSnap(snap, tf) {
    if (!snap || !snap.tf) return null;
    if (snap.tf[tf]) return snap;
    var key = "drv:" + (snap.fetchedAt || 0) + ":" + tf;
    var hit = mem.get(key);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.snap;
    var shim = deriveBars(snap, tf);
    if (!shim) return null;
    mem.set(key, { snap: shim, at: Date.now() });
    return shim;
  }

  function snapshotAge(snap) {
    return Date.now() - (snap.fetchedAt || 0);
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
        .then(function (d) { status.transport = "proxy"; return !!(d && d.chart && d.chart.result); })
        .catch(function () {
          return raceRelays(yahooDirect("ES=F", "5m"))
            .then(function () { status.transport = "relay"; return true; })
            .catch(function () { return false; });
        }),
      json(API + "/binance?symbol=BTCUSDT&interval=5m&limit=5&probe=1")
        .then(function (d) { return Array.isArray(d) && d.length > 0; })
        .catch(function () {
          return jsonAbs(binanceDirect("BTCUSDT", "5m"), 9000)
            .then(function (d) { return Array.isArray(d) && d.length > 0; })
            .catch(function () { return false; });
        })
    ];
    return Promise.all(checks).then(function (r) {
      status.yahoo = r[0];
      status.binance = r[1];
      status.direct = true;      /* Binance answers cross-origin on its own */
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
  function remember(id, tf, series) {
    mem.set(id + ":" + tf, { series: series, at: Date.now() });
    try {
      toCacheStorage(id, tf, series.data, series.source);
    } catch (e) {}
    status.lastSource = series.source;
    status.lastError = null;
  }

  function liveFromCandidates(id, tf, list, tried, i, asset) {
    if (i >= list.length) return Promise.reject(new Error(tried.join(", ") || "source unavailable"));
    var c = list[i];
    /* the probe already told us this endpoint is missing in this build:
       skip the round-trip instead of waiting on a doomed request */
    if (status.checked && status[c.provider] === false && !global.KRDirect) {
      tried.push(c.symbol + " (endpoint unavailable)");
      return liveFromCandidates(id, tf, list, tried, i + 1, asset);
    }
    var url = c.provider === "binance" ? binanceUrl(c.symbol, tf) : yahooUrl(c.symbol, tf);
    return json(url, 4000)
      .then(function (payload) { return { payload: payload, transport: "proxy" }; })
      .catch(function () { return offlineFetch(c, tf); })
      .then(function (res) {
        var parsed = c.provider === "binance" ? parseBinance(res.payload) : parseYahoo(res.payload);
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
            transport: res.transport,
            currency: parsed.meta && parsed.meta.currency
          }
        });
        series.synthetic = false;
        mem.set(id + ":" + tf, { series: series, at: Date.now() });
        try { toCacheStorage(id, tf, bars, series.source); } catch (e) {}
        status.lastSource = series.source;
        status.lastError = null;
        return series;
      })
      .catch(function (err) {
        tried.push(c.symbol + " (" + (err && err.message ? err.message : "error") + ")");
        return liveFromCandidates(id, tf, list, tried, i + 1, asset);
      });
  }

  /* Order of preference:
       1. a fresh snapshot that shipped with the site (same origin, instant)
       2. the live provider through /api, a relay, or the exchange directly
       3. an older snapshot — still real prices, just older
       4. the last real prices this browser saved
       5. the labelled synthetic engine                                        */
  function load(id, tf) {
    tf = tf || "1m";
    var asset = K.get(id);
    var m = mode();
    if (!status.checked && m !== "synthetic") probe();
    var hit = cached(id, tf);
    if (hit) return Promise.resolve(hit);
    if (m === "synthetic" || !LIVE[id]) {
      return Promise.resolve(fallback(id, tf, m === "synthetic" ? "Synthetic mode" : "No public source"));
    }

    var list = candidates(id);
    var tried = [];

    return loadSnapshot(id).then(function (snap) {
      var shaped = shapedSnap(snap, tf);
      if (shaped && snapshotAge(shaped) < SNAP_FRESH) {
        var fresh = seriesFromSnapshot(asset, id, tf, shaped, false);
        if (fresh) { remember(id, tf, fresh); return fresh; }
      }
      var liveTry = liveFromCandidates(id, tf, list, tried, 0, asset);
      if (shaped) {
        var saved = seriesFromSnapshot(asset, id, tf, shaped, true);
        if (saved) {
          /* An older snapshot only costs a short wait: five seconds of live
             attempt, then the real prices we already have. The live call keeps
             running and lands in the cache if it ever answers. */
          var liveOrSaved = liveTry.catch(function () { return saved; });
          return Promise.race([
            liveOrSaved,
            new Promise(function (resolve) {
              setTimeout(function () { resolve(saved); }, 5000);
            })
          ]).then(function (res) {
            if (res === saved) remember(id, tf, saved);
            return res;
          });
        }
      }
      return liveTry.catch(function (err) {
        if (shaped) {
          var older = seriesFromSnapshot(asset, id, tf, shaped, true);
          if (older) { remember(id, tf, older); return older; }
        }
        status.lastError = err && err.message;
        return fallback(id, tf, (err && err.message) || "Source unavailable");
      });
    });
  }

  function cfgFor(snap, tf) {
    return snap && snap.tf && snap.tf[tf];
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

  /* Boot helper: start the reachability probe in the background (it only
     feeds the status panel) and resolve as soon as the first series is
     ready. Never makes the chart wait for a probe round-trip. */
  function ready(id, tf) {
    if (mode() !== "synthetic" && !status.checked) probe();
    return load(id, tf);
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
