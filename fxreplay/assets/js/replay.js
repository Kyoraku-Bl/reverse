/* =========================================================
   KyorakuReplay — replay terminal
   Canvas chart with drawings + undo/redo, bar-by-bar replay,
   paper trading and session persistence. Everything is local:
   no network, no backend, no API keys.
   ========================================================= */
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var K = window.KRMarket;
  var DP = window.KRData;
  var root = document.documentElement;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var pad2 = function (n) { return n < 10 ? "0" + n : "" + n; };
  var isoLocal = function (d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
  var signed = function (n, d) {
    var v = Number(n) || 0;
    var s = v.toFixed(d === undefined ? 1 : d);
    return (v > 0 ? "+" : "") + (s === "-0.0" ? "0.0" : s);
  };
  var money = function (n, d) {
    var v = Number(n) || 0;
    return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US", {
      minimumFractionDigits: d === undefined ? 2 : d,
      maximumFractionDigits: d === undefined ? 2 : d
    });
  };

  var store = {
    get: function (key, fallback) {
      try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
      catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }
  };

  var params = new URLSearchParams(location.search);

  /* ---------------- state ---------------- */
  var S = {
    symbolId: "",
    tf: "1m",
    series: null,
    data: [],
    n: 0,
    cursor: 0,
    bars: 150,
    right: 0,
    follow: true,
    tool: "cursor",
    drawings: [],
    undo: [],
    redo: [],
    selected: null,
    draft: null,
    hidden: false,
    locked: false,
    hover: null,
    drag: null,
    playing: false,
    speed: 1,
    timer: null,
    pos: null,
    trades: [],
    risk: 100,
    start: Date.now(),
    W: 1,
    H: 1,
    dpr: 1,
    dirty: false
  };

  var canvas = $("#chart");
  var wrap = $("#chartWrap");
  var ctx = canvas.getContext("2d");
  var PAD = { l: 14, t: 16, r: 74, b: 30 };
  var AXIS_FONT = "11px 'JetBrains Mono', ui-monospace, monospace";

  /* ---------------- theme ---------------- */
  function isLight() { return root.dataset.theme === "light"; }
  function palette() {
    return isLight() ? {
      grid: "rgba(16,24,40,.07)",
      axis: "rgba(104,113,138,.92)",
      axisLine: "rgba(16,24,40,.12)",
      cross: "rgba(16,24,40,.32)",
      up: "#0f9d6b", down: "#d93b57",
      upFill: "rgba(15,157,107,.16)", downFill: "rgba(217,59,87,.14)",
      ema1: "#6d54e6", ema2: "#2f6be0", vwap: "#b07a12",
      watermark: "rgba(16,24,40,.05)",
      tagText: "#ffffff",
      panel: "rgba(255,255,255,.9)"
    } : {
      grid: "rgba(255,255,255,.055)",
      axis: "rgba(139,147,171,.92)",
      axisLine: "rgba(255,255,255,.09)",
      cross: "rgba(255,255,255,.28)",
      up: "#38e2a0", down: "#ff5d7d",
      upFill: "rgba(56,226,160,.15)", downFill: "rgba(255,93,125,.15)",
      ema1: "#a78bfa", ema2: "#5d8bff", vwap: "#ffc861",
      watermark: "rgba(255,255,255,.035)",
      tagText: "#04070f",
      panel: "rgba(9,12,22,.9)"
    };
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem("fxr-theme", theme); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f5f7fc" : "#06080f");
    var btn = $("#themeToggle");
    if (btn) {
      btn.innerHTML = '<svg class="ic"><use href="#' + (theme === "light" ? "i-moon" : "i-sun") + '"/></svg>';
      btn.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
    }
    scheduleDraw();
  }

  /* ---------------- toasts ---------------- */
  var toastStack = $("#toastStack");
  function toast(message, bad) {
    if (!toastStack) return;
    var el = document.createElement("div");
    el.className = "toast" + (bad ? " bad" : "");
    el.innerHTML = '<svg class="ic"><use href="#' + (bad ? "i-info" : "i-check") + '"/></svg><span></span>';
    el.querySelector("span").textContent = message;
    toastStack.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 2600);
  }

  /* ---------------- formatting ---------------- */
  var asset = function () { return S.series.asset; };
  var fmtP = function (v) { return K.fmt(v, asset().digits); };
  /* ---------------- time zone ---------------- */

  /* The list mirrors what a trader expects from a charting terminal: UTC,
     the instrument's own exchange, then the cities people actually use.
     Offsets are computed with Intl, so daylight saving is always right. */
  var TZ_LIST = [
    { zone: "UTC", label: "UTC", group: "Universal" },
    { zone: "exchange", label: "Exchange", group: "Universal" },
    { zone: "Atlantic/Azores", label: "Azores", group: "Atlantic" },
    { zone: "Atlantic/Reykjavik", label: "Reykjavik", group: "Atlantic" },
    { zone: "America/Sao_Paulo", label: "Sao Paulo", group: "Americas" },
    { zone: "America/Argentina/Buenos_Aires", label: "Buenos Aires", group: "Americas" },
    { zone: "America/Santiago", label: "Santiago", group: "Americas" },
    { zone: "America/Halifax", label: "Halifax", group: "Americas" },
    { zone: "America/Toronto", label: "Toronto", group: "Americas" },
    { zone: "America/New_York", label: "New York", group: "Americas" },
    { zone: "America/Caracas", label: "Caracas", group: "Americas" },
    { zone: "America/Lima", label: "Lima", group: "Americas" },
    { zone: "America/Bogota", label: "Bogota", group: "Americas" },
    { zone: "America/Chicago", label: "Chicago", group: "Americas" },
    { zone: "America/Mexico_City", label: "Mexico City", group: "Americas" },
    { zone: "America/El_Salvador", label: "San Salvador", group: "Americas" },
    { zone: "America/Denver", label: "Denver", group: "Americas" },
    { zone: "America/Phoenix", label: "Phoenix", group: "Americas" },
    { zone: "America/Vancouver", label: "Vancouver", group: "Americas" },
    { zone: "America/Anchorage", label: "Anchorage", group: "Americas" },
    { zone: "America/Juneau", label: "Juneau", group: "Americas" },
    { zone: "Pacific/Honolulu", label: "Honolulu", group: "Pacific" },
    { zone: "Europe/London", label: "London", group: "Europe" },
    { zone: "Europe/Lisbon", label: "Lisbon", group: "Europe" },
    { zone: "Europe/Paris", label: "Paris", group: "Europe" },
    { zone: "Europe/Berlin", label: "Berlin", group: "Europe" },
    { zone: "Europe/Zurich", label: "Zurich", group: "Europe" },
    { zone: "Europe/Madrid", label: "Madrid", group: "Europe" },
    { zone: "Europe/Rome", label: "Rome", group: "Europe" },
    { zone: "Europe/Istanbul", label: "Istanbul", group: "Europe" },
    { zone: "Europe/Moscow", label: "Moscow", group: "Europe" },
    { zone: "Africa/Casablanca", label: "Casablanca", group: "Africa" },
    { zone: "Africa/Lagos", label: "Lagos", group: "Africa" },
    { zone: "Africa/Johannesburg", label: "Johannesburg", group: "Africa" },
    { zone: "Asia/Dubai", label: "Dubai", group: "Asia" },
    { zone: "Asia/Karachi", label: "Karachi", group: "Asia" },
    { zone: "Asia/Kolkata", label: "Kolkata", group: "Asia" },
    { zone: "Asia/Dhaka", label: "Dhaka", group: "Asia" },
    { zone: "Asia/Bangkok", label: "Bangkok", group: "Asia" },
    { zone: "Asia/Jakarta", label: "Jakarta", group: "Asia" },
    { zone: "Asia/Shanghai", label: "Shanghai", group: "Asia" },
    { zone: "Asia/Hong_Kong", label: "Hong Kong", group: "Asia" },
    { zone: "Asia/Singapore", label: "Singapore", group: "Asia" },
    { zone: "Asia/Tokyo", label: "Tokyo", group: "Asia" },
    { zone: "Asia/Seoul", label: "Seoul", group: "Asia" },
    { zone: "Australia/Perth", label: "Perth", group: "Pacific" },
    { zone: "Australia/Sydney", label: "Sydney", group: "Pacific" },
    { zone: "Pacific/Auckland", label: "Auckland", group: "Pacific" }
  ];

  var tzCache = {};
  function tzPref() {
    var v = store.get("fxr-tz", "UTC");
    return typeof v === "string" && v ? v : "UTC";
  }
  /* Resolves a stored preference ("UTC" | "exchange" | IANA id) to a real zone.
     Kept separate from activeZone so the menu can price every row, not just
     the one currently in use. */
  function zoneFor(pref) {
    if (pref !== "exchange") return pref || "UTC";
    var market = (S.series && S.series.asset && S.series.asset.market) || "Forex";
    var map = (window.KRSymbols && KRSymbols.VENUE_TZ) || {};
    return map[market] || "America/New_York";
  }
  function venueName() {
    var market = (S.series && S.series.asset && S.series.asset.market) || "Forex";
    var map = (window.KRSymbols && KRSymbols.VENUE_NAME) || {};
    return map[market] || "Exchange";
  }
  function activeZone() {
    return zoneFor(tzPref());
  }
  function zoneFmt(zone, key, opts) {
    var id = zone + "|" + key;
    if (!tzCache[id]) {
      try {
        tzCache[id] = new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: zone, hourCycle: "h23" }, opts));
      } catch (e) {
        tzCache[id] = new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: "UTC", hourCycle: "h23" }, opts));
      }
    }
    return tzCache[id];
  }
  function zParts(ts) {
    var zone = activeZone();
    var out = {};
    zoneFmt(zone, "parts", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short"
    }).formatToParts(new Date(ts)).forEach(function (part) {
      if (part.type !== "literal") out[part.type] = part.value;
    });
    return out;
  }
  function zoneOffset(zone, ts) {
    if (zone === "UTC") return "UTC";
    try {
      var name = zoneFmt(zone, "offset", { timeZoneName: "shortOffset" })
        .formatToParts(new Date(ts || Date.now()))
        .filter(function (p) { return p.type === "timeZoneName"; })[0];
      var raw = name ? name.value : "GMT";
      return raw.replace("GMT", "UTC").replace(/^UTC$/, "UTC").replace("UTC+0", "UTC").replace("UTC-0", "UTC");
    } catch (e) {
      return "UTC";
    }
  }
  function tzShort() {
    var zone = activeZone();
    if (zone === "UTC") return "UTC";
    var off = zoneOffset(zone);
    return off === "UTC" ? "UTC" : off;
  }
  /* Short badge next to the clock: UTC or the live offset (UTC-4, UTC+5:30 …) */
  function tzLabel() {
    var pref = tzPref();
    if (pref === "UTC") return "UTC";
    return zoneOffset(zoneFor(pref));
  }

  function tzCurrentLabel() {
    var pref = tzPref();
    if (pref === "exchange") {
      var zone = zoneFor(pref);
      return "Exchange · " + venueName() + " (" + zoneOffset(zone) + ")";
    }
    return pref;
  }
  function tzOptionRight(item) {
    return zoneOffset(zoneFor(item.zone));
  }
  function tzOptionName(item) {
    return item.zone === "exchange" ? "Exchange · " + venueName() : item.label;
  }

  function renderTzMenu(filter) {
    var list = $("#tzList");
    if (!list) return;
    var q = (filter || "").trim().toLowerCase();
    var pref = tzPref();
    var html = "";
    var groups = [];
    TZ_LIST.forEach(function (item) {
      var right = tzOptionRight(item);
      var name = tzOptionName(item);
      var text = (name + " " + right + " " + item.zone + " " + item.group).toLowerCase();
      if (q && text.indexOf(q) === -1) return;
      if (!groups.length || groups[groups.length - 1].name !== item.group) {
        groups.push({ name: item.group, items: [] });
      }
      var selected = item.zone === pref;
      groups[groups.length - 1].items.push(
        '<button type="button" class="tz-opt" role="option" data-zone="' + item.zone + '" aria-selected="' + selected + '">' +
        '<svg class="ic ic--xs tick"><use href="#i-check"/></svg>' +
        "<span>" + tzOptionName(item) + "</span>" +
        '<span class="off">' + right + "</span></button>"
      );
    });
    groups.forEach(function (g) {
      if (!g.items.length) return;
      html += '<div class="tz-group">' + g.name + "</div>" + g.items.join("");
    });
    list.innerHTML = html || '<div class="tz-group">No match</div>';
  }

  function openTz() {
    var menu = $("#tzMenu");
    if (!menu) return;
    renderTzMenu($("#tzSearch") ? $("#tzSearch").value : "");
    menu.hidden = false;
    $("#tzBtn").setAttribute("aria-expanded", "true");
    var s = $("#tzSearch");
    if (s) setTimeout(function () { s.focus(); }, 20);
  }
  function closeTz() {
    var menu = $("#tzMenu");
    if (!menu) return;
    menu.hidden = true;
    $("#tzBtn").setAttribute("aria-expanded", "false");
  }
  function syncTzChip() {
    var p = zPartsPlain(Date.now());
    var clock = $("#tzClock");
    if (clock) clock.textContent = p.hour + ":" + p.minute;
    var lbl = $("#tzLabel");
    if (lbl) lbl.textContent = tzLabel();
    var chip = $("#tzChip");
    if (chip) chip.textContent = p.hour + ":" + p.minute + " " + tzShort();
  }
  function setZone(zone) {
    store.set("fxr-tz", zone);
    closeTz();
    syncTzChip();
    scheduleDraw();
    syncSymbolUI();
    toast(zone === "UTC" ? "Chart time zone: UTC" : zone === "exchange" ? "Chart time zone: exchange" : "Chart time zone: " + zone.split("/").pop().replace(/_/g, " "));
  }

  function fmtTime(ts) {
    var p = zParts(ts);
    return p.hour + ":" + p.minute;
  }
  function fmtDay(ts) {
    var p = zParts(ts);
    return parseInt(p.day, 10) + " " + p.month;
  }
  function fmtFull(ts) {
    var p = zParts(ts);
    return parseInt(p.day, 10) + " " + p.month + " " + p.year + " · " + p.hour + ":" + p.minute + " " + tzShort();
  }
  function fmtDateOnly(ts) {
    var p = zParts(ts);
    return parseInt(p.day, 10) + " " + p.month + " " + p.year;
  }
  function zPartsPlain(ts) {
    var p = {};
    zoneFmt(activeZone(), "plain", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(new Date(ts)).forEach(function (part) {
      if (part.type !== "literal") p[part.type] = part.value;
    });
    return p;
  }
  function zoneOffsetMinutes(ts) {
    var z = activeZone();
    if (z === "UTC") return 0;
    var p = zPartsPlain(ts);
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return Math.round((asUtc - ts) / 60000);
  }
  function toZoneInput(ts) {
    var p = zPartsPlain(ts);
    return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute;
  }
  function fromZoneInput(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "");
    if (!m) return null;
    var guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    var off1 = zoneOffsetMinutes(guess);
    var shifted = guess - off1 * 60000;
    var off2 = zoneOffsetMinutes(shifted);
    return guess - off2 * 60000;
  }
  function fmtQty(q) {
    if (q >= 100) return Math.round(q).toString();
    if (q >= 10) return q.toFixed(1).replace(/\.0$/, "");
    return q.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  }

  /* ---------------- series + view ---------------- */
  function drawKey() { return "fxr-draw:" + S.symbolId + ":" + S.tf; }
  function loadDrawings() {
    var list = store.get(drawKey(), []);
    S.drawings = Array.isArray(list) ? list : [];
    S.undo = [];
    S.redo = [];
    S.selected = null;
    S.draft = null;
    syncHistory();
  }
  function saveDrawings() {
    store.set(drawKey(), S.drawings);
    syncHistory();
  }
  function syncHistory() {
    var u = $("#undoBtn"), r = $("#redoBtn");
    if (u) u.disabled = !S.undo.length;
    if (r) r.disabled = !S.redo.length;
  }

  /* Applies an already-built series object (live or synthetic). */
  function applySeries(series, opts) {
    opts = opts || {};
    S.series = series;
    S.data = series.data;
    S.n = S.data.length;
    S.cursor = opts.cursor !== undefined ? opts.cursor : Math.round(S.n * 0.6);
    S.cursor = clamp(S.cursor, 20, S.n - 2);
    S.bars = opts.bars || clamp(Math.round(S.W / 8), 90, 210);
    S.right = S.cursor;
    S.follow = true;
    S.hover = null;
    S.pos = null;
    S.selected = null;
    S.draft = null;
    if (!opts.keepDrawings) loadDrawings();
    syncSymbolUI();
    syncUI();
    syncSourceBadge();
    renderSrcPanel();
    scheduleDraw();
  }

  /* Loads real candles when the data layer can reach a public source,
     otherwise falls back to the deterministic synthetic engine. */
  var loadToken = 0;
  function setSeries(symbolId, tf, opts) {
    opts = opts || {};
    S.symbolId = symbolId;
    S.tf = tf;
    var token = ++loadToken;
    var quick = opts.cursor;
    var loader = (DP && DP.load) ? DP.load(symbolId, tf) : Promise.resolve(K.syntheticSeries(symbolId, tf));

    setLoading(true);
    loader.then(function (series) {
      if (token !== loadToken) return;
      applySeries(series, { cursor: quick, keepDrawings: opts.keepDrawings });
      setLoading(false);
      if (series.synthetic && !warnedSim && DP && DP.status && DP.status.checked &&
          !DP.status.yahoo && !DP.status.binance) {
        warnedSim = true;
        toast("Live feed unreachable — showing simulated candles", true);
      }
    }).catch(function () {
      if (token !== loadToken) return;
      applySeries(K.syntheticSeries(symbolId, tf), { cursor: quick, keepDrawings: opts.keepDrawings });
      setLoading(false);
    });
  }

  var warnedSim = false;
  var loadingState = false;
  function setLoading(on) {
    loadingState = !!on;
    var el = $("#chartWrap");
    if (el) el.classList.toggle("loading", !!on);
    var badge = $("#loadingBadge");
    if (badge) badge.hidden = !on;
    if (on) {
      var b = $("#srcBadge");
      if (b) b.hidden = true;
      var n = $("#srcNote");
      if (n) n.hidden = true;
    } else {
      syncSourceBadge();
    }
  }

  /* "LIVE · Yahoo Finance" / "SIMULATED" chip in the chart legend */
  function syncSourceBadge() {
    var el = $("#srcBadge");
    if (!el) return;
    if (loadingState) { el.hidden = true; return; }
    var src = S.series && S.series.source;
    var live = S.series && !S.series.synthetic;
    var stale = live && S.series.stale;
    el.hidden = false;
    el.className = "src-badge " + (stale ? "src-badge--cache" : live ? "src-badge--live" : "src-badge--sim");
    el.innerHTML = live
      ? '<span class="src-dot"></span>' + (stale ? "CACHED" : "LIVE") + " · " + (src && src.label ? src.label : "feed")
      : '<span class="src-dot"></span>SIMULATED';
    var how = src && src.transport === "snapshot" ? " · site snapshot"
      : src && src.transport === "relay" ? " · via public relay"
      : src && src.transport === "direct" ? " · direct from the exchange" : "";
    var when = src && src.fetchedAt ? fmtFull(src.fetchedAt) : "just now";
    el.title = live
      ? (stale ? "Last saved real prices" : "Real market prices") +
        " from " + (src && src.symbol ? src.symbol : "a public feed") + how + " · " + when
      : "Public feed unavailable for this instrument — using the built-in synthetic engine";
    if (live && src && src.symbol) {
      var sym = $("#srcSymbol");
      if (sym) sym.textContent = src.symbol;
    }
    var note = $("#srcNote");
    if (note) {
      note.hidden = live;
      note.textContent = "Live feed unavailable — these candles are simulated, not market prices.";
      if (stale) {
        note.hidden = false;
        note.textContent = "Offline — showing the last real prices saved for this instrument (" + fmtFull(src.fetchedAt || Date.now()) + ").";
      }
    }
  }

  /* Live / offline switch in the top bar */
  function syncDataMode() {
    var btn = $("#dataMode");
    if (!btn) return;
    var m = DP && DP.mode ? DP.mode() : "synthetic";
    var live = m === "live" || (m === "auto" && S.series && !S.series.synthetic);
    btn.dataset.mode = live ? "live" : "sim";
    btn.setAttribute("aria-pressed", live ? "true" : "false");
    var label = $("#dataModeLabel");
    if (label) label.textContent = m === "auto" ? "Auto" : m === "live" ? "Live" : "Offline";
    btn.setAttribute("aria-label", "Market data mode: " + (label ? label.textContent : m));
    btn.title = m === "live"
      ? "Live market data only — no simulated fallback"
      : m === "synthetic"
        ? "Offline engine — simulated candles"
        : "Auto — real prices when available, labelled fallback otherwise";
    renderSrcPanel();
  }

  /* feed coverage list inside the help dialog */
  function renderSrcPanel() {
    var copy = $("#srcPanelCopy");
    var list = $("#srcPanelList");
    if (!copy || !list || !DP) return;
    var live = DP.liveCount ? DP.liveCount() : 0;
    var total = K.ASSETS.length;
    var st = DP.status || {};
    copy.innerHTML = "<b>" + live + "/" + total + "</b> instruments are mapped to a public symbol — " +
      "Yahoo Finance for indices, futures, metals, energy and spot FX; Binance for crypto. " +
      "The badge on the chart shows the provider, the exact ticker and the fetch time.";
    if ((st.mode === "live") && !(st.yahoo || st.binance)) {
      copy.innerHTML += " This preview has no network access, so every instrument falls back to the offline engine.";
    }
    var via = st.transport === "proxy" ? "same-origin proxy"
      : st.transport === "snapshot" ? "same-origin snapshot (CI)"
      : st.transport === "relay" ? "public relay (no proxy on this host)"
      : st.direct ? "direct from the exchange" : "checked on first load";
    var ser = S.series;
    var snapRow;
    if (ser && ser.snapshot) {
      var mins = Math.max(0, Math.round((Date.now() - ((ser.source && ser.source.fetchedAt) || Date.now())) / 60000));
      snapRow = (ser.stale ? "older copy — fallback" : "fresh") + " · saved " + mins + " min ago";
    } else {
      snapRow = "not used for this chart";
    }
    var rows = [
      ["Yahoo Finance", st.yahoo === true ? "reachable" : st.yahoo === false ? "unavailable" : "unchecked"],
      ["Binance", st.binance === true ? "reachable" : st.binance === false ? "unavailable" : "unchecked"],
      ["Transport", via],
      ["Saved snapshot", snapRow],
      ["Simulated fallback", st.mode === "synthetic" ? "forced on" : "labelled only"]
    ];
    list.innerHTML = rows.map(function (r) {
      return "<li><span>" + r[0] + "</span><b>" + r[1] + "</b></li>";
    }).join("");
  }

  function range() {
    var n = S.n;
    var bars = clamp(Math.round(S.bars), 25, Math.min(900, n));
    var right = clamp(S.right, bars - 1, S.cursor);
    var left = right - bars + 1;
    if (left < 0) { left = 0; right = Math.min(S.cursor, n - 1); }
    return { left: left, right: right, bars: Math.max(2, right - left + 1) };
  }
  function geom() {
    return { x0: PAD.l, y0: PAD.t, x1: S.W - PAD.r, y1: S.H - PAD.b };
  }
  function xAt(i) {
    var g = geom(), r = range();
    return g.x0 + ((i - r.left) / (r.bars - 1)) * (g.x1 - g.x0);
  }
  function iAt(x) {
    var g = geom(), r = range();
    return r.left + ((x - g.x0) / (g.x1 - g.x0)) * (r.bars - 1);
  }
  function visibleStats() {
    var r = range(), g = geom();
    var lo = Infinity, hi = -Infinity;
    var from = Math.max(0, Math.floor(r.left));
    var to = Math.min(S.cursor, Math.ceil(r.right));
    for (var i = from; i <= to; i++) {
      var d = S.data[i];
      if (!d) continue;
      if (d.l < lo) lo = d.l;
      if (d.h > hi) hi = d.h;
    }
    if (S.pos) {
      lo = Math.min(lo, S.pos.stop, S.pos.target);
      hi = Math.max(hi, S.pos.stop, S.pos.target);
    }
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (lo === hi) { lo -= 1; hi += 1; }
    var pad = (hi - lo) * 0.08;
    return { lo: lo - pad, hi: hi + pad, g: g };
  }
  function yPrice(p, sc) {
    var s = sc || visibleStats();
    return s.g.y0 + ((s.hi - p) / (s.hi - s.lo)) * (s.g.y1 - s.g.y0);
  }
  function priceAt(y, sc) {
    var s = sc || visibleStats();
    return s.hi - ((y - s.g.y0) / (s.g.y1 - s.g.y0)) * (s.hi - s.lo);
  }

  /* ---------------- drawing ---------------- */
  function scheduleDraw() {
    if (S.dirty) return;
    S.dirty = true;
    requestAnimationFrame(function () { S.dirty = false; draw(); });
  }

  function niceStep(span, target) {
    var raw = span / (target || 6);
    var pow = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / pow;
    var mult = norm <= 1.2 ? 1 : norm <= 2.4 ? 2 : norm <= 3.5 ? 2.5 : norm <= 7.5 ? 5 : 10;
    return mult * pow;
  }

  function draw() {
    if (!S.W || !S.H || !S.n) return;
    var pal = palette();
    var g = geom(), r = range(), sc = visibleStats();
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, S.W, S.H);

    var plotW = g.x1 - g.x0;
    var plotH = g.y1 - g.y0;
    var barW = plotW / r.bars;
    var candleW = clamp(barW * 0.66, 1, 15);

    /* ---- watermark ---- */
    ctx.save();
    ctx.fillStyle = pal.watermark;
    ctx.font = "800 " + Math.round(clamp(plotW / 9, 40, 96)) + "px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(asset().label, g.x0 + plotW / 2, g.y0 + plotH / 2);
    ctx.restore();

    /* ---- horizontal grid + price axis ---- */
    var step = niceStep(sc.hi - sc.lo, Math.max(3, Math.round(plotH / 58)));
    var first = Math.ceil(sc.lo / step) * step;
    ctx.font = AXIS_FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (var p = first; p <= sc.hi; p += step) {
      var y = Math.round(yPrice(p, sc)) + 0.5;
      if (y < g.y0 - 1 || y > g.y1 + 1) continue;
      ctx.strokeStyle = pal.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.x0, y);
      ctx.lineTo(g.x1, y);
      ctx.stroke();
      ctx.fillStyle = pal.axis;
      ctx.fillText(K.fmt(p, asset().digits), g.x1 + 9, y);
    }

    /* ---- vertical grid + time axis ---- */
    var every = Math.max(1, Math.ceil(92 / Math.max(barW, 1)));
    var start = Math.ceil(r.left / every) * every;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    var prevDay = null;
    for (var i = start; i <= r.right; i += every) {
      if (i > S.cursor) break;
      var d = S.data[i];
      if (!d) continue;
      var x = Math.round(xAt(i)) + 0.5;
      if (x < g.x0 + 10 || x > g.x1 - 10) continue;
      ctx.strokeStyle = pal.grid;
      ctx.beginPath();
      ctx.moveTo(x, g.y0);
      ctx.lineTo(x, g.y1);
      ctx.stroke();
      var day = parseInt(zParts(d.t).day, 10);
      var label;
      if (S.tf === "1D") label = fmtDay(d.t);
      else if (day !== prevDay) label = fmtDay(d.t);
      else label = fmtTime(d.t);
      prevDay = day;
      ctx.fillStyle = pal.axis;
      ctx.fillText(label, clamp(x, g.x0 + 24, g.x1 - 24), g.y1 + 9);
    }

    /* ---- axes frame ---- */
    ctx.strokeStyle = pal.axisLine;
    ctx.beginPath();
    ctx.moveTo(g.x0, g.y1 + 0.5);
    ctx.lineTo(g.x1, g.y1 + 0.5);
    ctx.moveTo(g.x1 + 0.5, g.y0);
    ctx.lineTo(g.x1 + 0.5, g.y1);
    ctx.stroke();

    /* ---- candles ---- */
    var from = Math.max(0, Math.floor(r.left) - 1);
    var to = Math.min(S.cursor, Math.ceil(r.right) + 1);
    for (var c = from; c <= to; c++) {
      var bar = S.data[c];
      if (!bar) continue;
      var cx = xAt(c);
      if (cx < g.x0 - candleW || cx > g.x1 + candleW) continue;
      var bullish = bar.c >= bar.o;
      var col = bullish ? pal.up : pal.down;
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      var xw = Math.round(cx) + 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xw, yPrice(bar.h, sc));
      ctx.lineTo(xw, yPrice(bar.l, sc));
      ctx.stroke();
      var yo = yPrice(bar.o, sc), yc = yPrice(bar.c, sc);
      var top = Math.min(yo, yc);
      var hgt = Math.max(1, Math.abs(yc - yo));
      if (candleW >= 2.4) {
        var drawW = Math.max(1, candleW - 0.6);
        if (isLight() && bullish) {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.strokeRect(Math.round(cx - drawW / 2) + 0.5, Math.round(top) + 0.5, Math.round(drawW), Math.max(1, Math.round(hgt)));
        } else {
          ctx.fillRect(cx - drawW / 2, top, drawW, hgt);
        }
      }
    }

    /* ---- indicators ---- */
    function line(values, color, width, dash) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dash) ctx.setLineDash(dash);
      var started = false;
      for (var j = Math.max(0, Math.floor(r.left)); j <= Math.min(S.cursor, Math.ceil(r.right)); j++) {
        var v = values[j];
        if (v === undefined || v === null || !isFinite(v)) continue;
        var px = xAt(j), py = yPrice(v, sc);
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
    line(S.series.ema21, pal.ema1, 1.4);
    line(S.series.ema50, pal.ema2, 1.4);
    line(S.series.vwap, pal.vwap, 1.2, [4, 4]);

    /* ---- position overlay ---- */
    if (S.pos) drawPosition(pal, sc);

    /* ---- user drawings ---- */
    if (!S.hidden) S.drawings.forEach(function (d) { drawShape(d, pal, sc, d === S.selected); });
    if (S.draft && !S.hidden) drawShape(S.draft, pal, sc, true, true);

    /* ---- last price ---- */
    var last = S.data[S.cursor];
    if (last) {
      var lastUp = last.c >= last.o;
      var ly = yPrice(last.c, sc);
      if (ly >= g.y0 && ly <= g.y1) {
        ctx.save();
        ctx.strokeStyle = lastUp ? pal.up : pal.down;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(g.x0, Math.round(ly) + 0.5);
        ctx.lineTo(g.x1, Math.round(ly) + 0.5);
        ctx.stroke();
        ctx.restore();

        var label = fmtP(last.c);
        ctx.font = AXIS_FONT;
        var tw = ctx.measureText(label).width + 14;
        var ty = clamp(ly, g.y0 + 9, g.y1 - 9);
        ctx.fillStyle = lastUp ? pal.up : pal.down;
        roundRect(g.x1 + 4, ty - 9, Math.max(tw, 64), 18, 4);
        ctx.fill();
        ctx.fillStyle = pal.tagText;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, g.x1 + 11, ty);
      }
    }

    /* ---- crosshair ---- */
    if (S.hover && S.hover.x >= g.x0 && S.hover.x <= g.x1 && S.hover.y >= g.y0 && S.hover.y <= g.y1) {
      var hx = Math.round(xAt(clamp(Math.round(iAt(S.hover.x)), Math.ceil(r.left), S.cursor))) + 0.5;
      var hy = Math.round(S.hover.y) + 0.5;
      ctx.save();
      ctx.strokeStyle = pal.cross;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, g.y0); ctx.lineTo(hx, g.y1);
      ctx.moveTo(g.x0, hy); ctx.lineTo(g.x1, hy);
      ctx.stroke();
      ctx.restore();

      /* price tag */
      var pv = priceAt(hy, sc);
      var pl = fmtP(pv);
      ctx.font = AXIS_FONT;
      var pw = ctx.measureText(pl).width + 14;
      ctx.fillStyle = isLight() ? "#39425a" : "#2b3348";
      roundRect(g.x1 + 4, hy - 9, Math.max(pw, 64), 18, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(pl, g.x1 + 11, hy);

      /* time tag */
      var hi = clamp(Math.round(iAt(S.hover.x)), Math.ceil(r.left), S.cursor);
      var hb = S.data[hi];
      if (hb) {
        var tl = fmtFull(hb.t);
        ctx.font = AXIS_FONT;
        var lw = ctx.measureText(tl).width + 16;
        var tx = clamp(hx - lw / 2, g.x0 + 2, g.x1 - lw - 2);
        ctx.fillStyle = isLight() ? "#39425a" : "#2b3348";
        roundRect(tx, g.y1 + 4, lw, 18, 4);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(tl, tx + lw / 2, g.y1 + 13);
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function anchorXY(a, sc) {
    return { x: xAt(a.i), y: yPrice(a.p, sc) };
  }

  /* ---------------- chart analytics for the drawing tools ---------------- */

  function barAt(i) {
    return S.data[clamp(Math.round(i), 0, S.n - 1)] || null;
  }

  /* Volume-at-price over [from, to]. Instruments that publish no volume
     (spot FX, some cash indices) fall back to time-at-price, which is the
     same histogram with one tick per candle. */
  function volumeProfile(from, to) {
    from = clamp(Math.round(from), 0, S.n - 1);
    to = clamp(Math.round(to), 0, S.n - 1);
    if (to < from) { var t = from; from = to; to = t; }
    if (to - from < 2) return null;
    var lo = Infinity, hi = -Infinity, i, b;
    for (i = from; i <= to; i++) {
      b = S.data[i];
      if (!b) continue;
      if (b.l < lo) lo = b.l;
      if (b.h > hi) hi = b.h;
    }
    if (!(hi > lo)) return null;
    var bins = 44;
    var step = (hi - lo) / bins;
    var vol = [];
    for (i = 0; i < bins; i++) vol.push(0);
    var total = 0;
    for (i = from; i <= to; i++) {
      b = S.data[i];
      if (!b) continue;
      var typical = (b.h + b.l + b.c) / 3;
      var k = clamp(Math.floor((typical - lo) / step), 0, bins - 1);
      var w = b.v > 0 ? b.v : 1;
      vol[k] += w;
      total += w;
    }
    var max = 0, poc = 0;
    for (i = 0; i < bins; i++) if (vol[i] > max) { max = vol[i]; poc = i; }
    if (!max) return null;
    return { lo: lo, hi: hi, step: step, bins: bins, vol: vol, max: max, poc: poc, from: from, to: to, total: total };
  }

  /* Anchored VWAP: running volume-weighted average from the anchor bar. */
  function vwapSeries(fromIdx) {
    var out = new Array(S.n);
    var pv = 0, vv = 0, any = false;
    for (var i = Math.max(0, Math.round(fromIdx)); i <= S.cursor; i++) {
      var b = S.data[i];
      if (!b) continue;
      var typical = (b.h + b.l + b.c) / 3;
      var w = b.v > 0 ? b.v : 1;
      pv += typical * w;
      vv += w;
      out[i] = pv / vv;
      any = true;
    }
    return any ? out : null;
  }

  function fmtSpan(ms) {
    var mins = Math.round(ms / 60000);
    if (mins < 60) return mins + "m";
    var hours = mins / 60;
    if (hours < 48) return (hours < 10 ? hours.toFixed(1) : Math.round(hours)) + "h";
    var days = Math.round(hours / 24);
    return days + "d";
  }

  /* Floating callout used by several tools. */
  function callout(lines, x, y, color) {
    var g = geom();
    ctx.save();
    ctx.font = "10px 'JetBrains Mono', monospace";
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    w += 16;
    var h = lines.length * 14 + 10;
    var bx = clamp(x, g.x0 + 4, g.x1 - w - 4);
    var by = clamp(y, g.y0 + 4, g.y1 - h - 4);
    ctx.fillStyle = hexA(color, 0.92);
    roundRect(bx, by, w, h, 5);
    ctx.fill();
    ctx.fillStyle = "#06080f";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    lines.forEach(function (l, i) { ctx.fillText(l, bx + 8, by + 12 + i * 14); });
    ctx.restore();
  }

  function drawMeasure(d, sc, preview) {
    var a = anchorXY(d.a, sc);
    var b = anchorXY(d.b || d.a, sc);
    var g = geom();
    var up = d.b ? d.b.p >= d.a.p : true;
    var color = up ? "#38e2a0" : "#ff5d7d";
    ctx.save();
    if (preview) ctx.setLineDash([5, 4]);
    ctx.fillStyle = hexA(color, 0.1);
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.strokeStyle = hexA(color, 0.75);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, a.y);
    ctx.moveTo(b.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.restore();

    if (d.b) {
      var dp = d.b.p - d.a.p;
      var pct = d.a.p ? (dp / d.a.p) * 100 : 0;
      var bi = Math.round(d.b.i) - Math.round(d.a.i);
      var bars = Math.max(0, bi) + (S.tf === "1D" ? 0 : 0);
      var span = (barAt(d.b.i).t - barAt(d.a.i).t);
      var lines = [
        signed(dp, asset().digits) + "  " + signed(pct, 2) + "%",
        Math.abs(bi) + (Math.abs(bi) === 1 ? " bar" : " bars") + " · " + fmtSpan(Math.abs(span))
      ];
      if (Math.abs(dp) >= 0 && bars === 0) lines.pop();
      callout(lines, b.x + 10, b.y + 10, color);
    }
  }

  function drawPositionTool(d, sc, preview) {
    var isLong = d.type === "long";
    var a = anchorXY(d.a, sc);
    var b = anchorXY(d.b || d.a, sc);
    var c = d.c ? anchorXY(d.c, sc) : null;
    var g = geom();
    ctx.save();
    if (preview) ctx.setLineDash([6, 4]);
    var entryY = a.y, targetY = b.y, stopY = c ? c.y : null;
    var right = g.x1;
    if (d.b) {
      var profitTop = Math.min(entryY, targetY), profitH = Math.abs(targetY - entryY);
      ctx.fillStyle = "rgba(56,226,160,.16)";
      ctx.fillRect(a.x, profitTop, Math.max(2, right - a.x), profitH);
    }
    if (c) {
      var lossTop = Math.min(entryY, stopY), lossH = Math.abs(stopY - entryY);
      ctx.fillStyle = "rgba(255,93,125,.16)";
      ctx.fillRect(a.x, lossTop, Math.max(2, right - a.x), lossH);
    }
    ctx.lineWidth = 1.3;
    var rows = [
      { y: entryY, col: "#a78bfa", label: (isLong ? "ENTRY " : "ENTRY ") + fmtP(d.a.p) },
      d.b ? { y: targetY, col: "#38e2a0", label: "TARGET " + fmtP(d.b.p) } : null,
      c ? { y: stopY, col: "#ff5d7d", label: "STOP " + fmtP(d.c.p) } : null
    ];
    rows.forEach(function (row) {
      if (!row) return;
      ctx.strokeStyle = row.col;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, Math.round(row.y) + 0.5);
      ctx.lineTo(right, Math.round(row.y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "9px 'JetBrains Mono', monospace";
      var w = ctx.measureText(row.label).width + 10;
      ctx.fillStyle = row.col;
      roundRect(right - w - 4, row.y - 7, w, 14, 3);
      ctx.fill();
      ctx.fillStyle = "#06080f";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(row.label, right - w + 1, row.y);
    });
    ctx.restore();

    if (c && d.b) {
      var risk = Math.abs(d.a.p - d.c.p);
      var reward = Math.abs(d.b.p - d.a.p);
      var rr = risk > 0 ? reward / risk : 0;
      var lines = [
        (isLong ? "LONG" : "SHORT") + " · " + rr.toFixed(2) + "R",
        signed(((d.b.p - d.a.p) / d.a.p) * 100, 2) + "% target",
        "risk " + fmtP(Math.abs(d.a.p - d.c.p))
      ];
      callout(lines, a.x + 10, Math.min(entryY, targetY, stopY) - 46, isLong ? "#38e2a0" : "#ff5d7d");
    }
  }

  function drawBarsPattern(d, sc, preview) {
    var from = Math.round(Math.min(d.a.i, d.b ? d.b.i : d.a.i));
    var to = Math.round(Math.max(d.a.i, d.b ? d.b.i : d.a.i));
    var g = geom();
    var count = to - from + 1;
    if (count < 2) return;
    var bw = (g.x1 - g.x0) / Math.max(1, range().bars);
    var cw = clamp(bw * 0.66, 1, 15);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
    ctx.clip();

    /* source range marker */
    var ax = xAt(from), bx = xAt(to);
    ctx.strokeStyle = "rgba(139,107,255,.85)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(ax, g.y0 + 4, Math.max(1, bx - ax), g.y1 - g.y0 - 8);
    ctx.setLineDash([]);

    /* projection: same candles, repeated right after the source */
    var startIdx = to + 1;
    ctx.globalAlpha = preview ? 0.35 : 0.55;
    for (var k = 0; k < count; k++) {
      var src = S.data[from + k];
      if (!src) continue;
      var px = xAt(startIdx + k);
      if (px > g.x1 + cw) break;
      var up = src.c >= src.o;
      var col = up ? "#38e2a0" : "#ff5d7d";
      ctx.strokeStyle = col;
      ctx.fillStyle = hexA(col, 0.35);
      ctx.lineWidth = 1;
      var xw = Math.round(px) + 0.5;
      ctx.beginPath();
      ctx.moveTo(xw, yPrice(src.h, sc));
      ctx.lineTo(xw, yPrice(src.l, sc));
      ctx.stroke();
      var yo = yPrice(src.o, sc), yc = yPrice(src.c, sc);
      ctx.fillRect(px - cw / 2, Math.min(yo, yc), Math.max(1, cw - 0.6), Math.max(1, Math.abs(yc - yo)));
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.save();
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(167,139,250,.95)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(count + " bars copied →", ax + 4, g.y0 + 8);
    ctx.restore();
  }

  function drawAVWAP(d, sc, preview) {
    var series = vwapSeries(d.a.i);
    if (!series) return;
    var g = geom();
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = "#ffc861";
    ctx.lineWidth = 1.8;
    if (preview) ctx.setLineDash([6, 4]);
    var started = false;
    for (var i = Math.max(0, Math.round(d.a.i)); i <= S.cursor; i++) {
      var v = series[i];
      if (v === undefined || !isFinite(v)) continue;
      var x = xAt(i), y = yPrice(v, sc);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    var ax = xAt(d.a.i), ay = yPrice(d.a.p, sc);
    ctx.fillStyle = "#ffc861";
    ctx.beginPath();
    ctx.arc(ax, ay, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hexA("#ffc861", 0.5);
    ctx.beginPath();
    ctx.moveTo(ax, ay + 4);
    ctx.lineTo(ax, g.y1);
    ctx.stroke();

    var lastV = null;
    for (var j = S.cursor; j >= Math.round(d.a.i); j--) {
      if (series[j] !== undefined && isFinite(series[j])) { lastV = series[j]; break; }
    }
    if (lastV !== null) tagRight("AVWAP " + fmtP(lastV), yPrice(lastV, sc), "#ffc861");
    ctx.restore();
  }

  function drawProfile(d, sc, preview, anchored) {
    var from = Math.round(d.a.i);
    var to = anchored ? S.cursor : Math.round(d.b ? d.b.i : d.a.i);
    var prof = volumeProfile(from, to);
    if (!prof) return;
    var g = geom();
    var rightX = xAt(anchored ? S.cursor : to);
    var maxW = Math.min(180, (g.x1 - g.x0) * 0.34);
    ctx.save();
    ctx.globalAlpha = preview ? 0.6 : 1;

    /* range shading */
    var ax = xAt(Math.min(from, to));
    ctx.fillStyle = "rgba(93,139,255,.07)";
    ctx.fillRect(ax, g.y0, Math.max(2, rightX - ax), g.y1 - g.y0);

    for (var i = 0; i < prof.bins; i++) {
      var price = prof.lo + (i + 0.5) * prof.step;
      var y = yPrice(price, sc);
      if (y < g.y0 - 2 || y > g.y1 + 2) continue;
      var w = (prof.vol[i] / prof.max) * maxW;
      if (w < 0.6) continue;
      var isPoc = i === prof.poc;
      ctx.fillStyle = isPoc ? "rgba(255,200,97,.75)" : "rgba(93,139,255,.42)";
      ctx.fillRect(rightX - w, y - Math.max(1, (g.y1 - g.y0) / prof.bins / 2), w, Math.max(1, (g.y1 - g.y0) / prof.bins - 0.6));
    }

    /* POC line + anchor */
    var pocPrice = prof.lo + (prof.poc + 0.5) * prof.step;
    ctx.strokeStyle = "rgba(255,200,97,.85)";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 3]);
    var py = yPrice(pocPrice, sc);
    ctx.beginPath();
    ctx.moveTo(ax, py);
    ctx.lineTo(g.x1, py);
    ctx.stroke();
    ctx.setLineDash([]);
    tagRight("POC " + fmtP(pocPrice), py, "#ffc861");

    var anchorY = yPrice(barAt(from).c, sc);
    ctx.fillStyle = "#5d8bff";
    ctx.beginPath();
    ctx.arc(xAt(from), anchorY, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShape(d, pal, sc, selected, preview) {
    if (!d || !d.a) return;
    ctx.save();
    ctx.lineWidth = selected ? 2.4 : 1.7;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (preview) ctx.setLineDash([6, 4]);

    var color = d.color || "#a78bfa";
    var a = anchorXY(d.a, sc);
    var b = d.b ? anchorXY(d.b, sc) : null;
    var g = geom();

    if (d.type === "measure") {
      ctx.restore();
      drawMeasure(d, sc, preview);
      drawHandles(d, sc, color, selected, ["a", "b"]);
      return;
    }
    if (d.type === "long" || d.type === "short" || d.type === "forecast") {
      ctx.restore();
      drawPositionTool(d, sc, preview);
      drawHandles(d, sc, color, selected, ["a", "b", "c"]);
      return;
    }
    if (d.type === "bars") {
      ctx.restore();
      drawBarsPattern(d, sc, preview);
      drawHandles(d, sc, "#a78bfa", selected, ["a", "b"]);
      return;
    }
    if (d.type === "avwap") {
      ctx.restore();
      drawAVWAP(d, sc, preview);
      drawHandles(d, sc, "#ffc861", selected, ["a"]);
      return;
    }
    if (d.type === "vprofile") {
      ctx.restore();
      drawProfile(d, sc, preview, false);
      drawHandles(d, sc, "#5d8bff", selected, ["a", "b"]);
      return;
    }
    if (d.type === "avprofile") {
      ctx.restore();
      drawProfile(d, sc, preview, true);
      drawHandles(d, sc, "#5d8bff", selected, ["a"]);
      return;
    }

    if (d.type === "hline") {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(g.x0, a.y);
      ctx.lineTo(g.x1, a.y);
      ctx.stroke();
      tagRight(fmtP(d.a.p), a.y, color);
    } else if (d.type === "vline") {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, g.y0);
      ctx.lineTo(a.x, g.y1);
      ctx.stroke();
      tagBottom(fmtDay(S.data[clamp(Math.round(d.a.i), 0, S.n - 1)].t), a.x, color);
    } else if (d.type === "trend") {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (d.type === "rect") {
      var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      var w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      ctx.fillStyle = hexA(color, 0.12);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color;
      ctx.strokeRect(x, y, w, h);
      if (h > 26) {
        var pct = d.a.p ? (d.b.p - d.a.p) / d.a.p * 100 : 0;
        ctx.fillStyle = color;
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(signed(pct, 2) + "%", x + 5, y + h - 5);
      }
    } else if (d.type === "fib") {
      var levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      var x1 = Math.min(a.x, b.x);
      var x2 = Math.max(g.x1, Math.max(a.x, b.x));
      levels.forEach(function (lv, idx) {
        var yy = a.y + (b.y - a.y) * lv;
        ctx.strokeStyle = hexA(color, idx === 0 || idx === levels.length - 1 ? 0.85 : 0.55);
        ctx.beginPath();
        ctx.moveTo(x1, yy);
        ctx.lineTo(x2, yy);
        ctx.stroke();
        ctx.fillStyle = hexA(color, 0.9);
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        var price = d.a.p + (d.b.p - d.a.p) * lv;
        ctx.fillText(lv.toFixed(3) + "  " + fmtP(price), x1 + 5, yy - 7);
      });
      ctx.strokeStyle = hexA(color, 0.35);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (selected) {
      [a, b].forEach(function (pt) {
        if (!pt) return;
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  /* draggable dots for the tools that use extra anchors */
  function drawHandles(d, sc, color, selected, parts) {
    if (!selected) return;
    ctx.save();
    parts.forEach(function (part) {
      var anchor = d[part];
      if (!anchor) return;
      var pt = anchorXY(anchor, sc);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function tagRight(text, y, color) {
    var g = geom();
    ctx.save();
    ctx.font = "10px 'JetBrains Mono', monospace";
    var w = ctx.measureText(text).width + 12;
    ctx.fillStyle = color;
    roundRect(g.x1 - w - 4, clamp(y, g.y0 + 8, g.y1 - 8) - 8, w, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#06080f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, g.x1 - w / 2 - 4, clamp(y, g.y0 + 8, g.y1 - 8));
    ctx.restore();
  }
  function tagBottom(text, x, color) {
    var g = geom();
    ctx.save();
    ctx.font = "10px 'JetBrains Mono', monospace";
    var w = ctx.measureText(text).width + 12;
    ctx.fillStyle = color;
    roundRect(clamp(x - w / 2, g.x0, g.x1 - w), g.y1 + 4, w, 18, 3);
    ctx.fill();
    ctx.fillStyle = "#06080f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, clamp(x, g.x0 + w / 2, g.x1 - w / 2), g.y1 + 13);
    ctx.restore();
  }

  function hexA(hex, alpha) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var num = parseInt(h, 16);
    return "rgba(" + ((num >> 16) & 255) + "," + ((num >> 8) & 255) + "," + (num & 255) + "," + alpha + ")";
  }

  /* ---------------- position overlay ---------------- */
  function drawPosition(pal, sc) {
    var g = geom();
    var p = S.pos;
    var x1 = clamp(xAt(p.openIdx), g.x0, g.x1);
    var x2 = g.x1;
    var yE = yPrice(p.entry, sc), yS = yPrice(p.stop, sc), yT = yPrice(p.target, sc);

    ctx.save();
    ctx.fillStyle = p.dir > 0 ? "rgba(255,93,125,.10)" : "rgba(56,226,160,.10)";
    ctx.fillRect(x1, Math.min(yE, yS), Math.max(2, x2 - x1), Math.abs(yS - yE));
    ctx.fillStyle = p.dir > 0 ? "rgba(56,226,160,.09)" : "rgba(255,93,125,.09)";
    ctx.fillRect(x1, Math.min(yE, yT), Math.max(2, x2 - x1), Math.abs(yT - yE));

    [
      { y: yE, c: "#a78bfa", label: "ENTRY " + fmtP(p.entry) },
      { y: yS, c: "#ff5d7d", label: "STOP " + fmtP(p.stop) },
      { y: yT, c: "#38e2a0", label: "TARGET " + fmtP(p.target) }
    ].forEach(function (row) {
      if (row.y < g.y0 || row.y > g.y1) return;
      ctx.strokeStyle = row.c;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, Math.round(row.y) + 0.5);
      ctx.lineTo(g.x1, Math.round(row.y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "9px 'JetBrains Mono', monospace";
      var w = ctx.measureText(row.label).width + 10;
      ctx.fillStyle = row.c;
      roundRect(g.x1 - w - 4, row.y - 7, w, 14, 3);
      ctx.fill();
      ctx.fillStyle = "#06080f";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(row.label, g.x1 - w + 1, row.y);
    });
    ctx.restore();
  }

  /* ---------------- hit testing ---------------- */
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = dx * dx + dy * dy;
    var t = len ? ((px - x1) * dx + (py - y1) * dy) / len : 0;
    t = clamp(t, 0, 1);
    return dist(px, py, x1 + t * dx, y1 + t * dy);
  }
  function hitShape(d, x, y, sc) {
    if (!d || !d.a) return null;
    var a = anchorXY(d.a, sc);

    if (d.type === "avwap" || d.type === "avprofile") {
      return dist(x, y, a.x, a.y) < 10 ? "a" : (Math.abs(x - a.x) < 8 ? "a" : null);
    }
    if (d.type === "measure" || d.type === "long" || d.type === "short" || d.type === "forecast" ||
        d.type === "vprofile" || d.type === "bars") {
      var pts = ["a", "b", "c"];
      for (var pi = 0; pi < pts.length; pi++) {
        var anchor = d[pts[pi]];
        if (!anchor) continue;
        var pt = anchorXY(anchor, sc);
        if (dist(x, y, pt.x, pt.y) < 10) return pts[pi];
      }
      var bx = d.b ? anchorXY(d.b, sc) : a;
      var minX = Math.min(a.x, bx.x) - 6, maxX = Math.max(a.x, bx.x) + 6;
      var ys = [a.y, bx.y];
      if (d.c) ys.push(anchorXY(d.c, sc).y);
      var minY = Math.min.apply(null, ys) - 8, maxY = Math.max.apply(null, ys) + 8;
      return x >= minX && x <= maxX && y >= minY && y <= maxY ? "move" : null;
    }
    if (d.type === "hline") return Math.abs(y - a.y) < 7 ? "move" : null;
    if (d.type === "vline") return Math.abs(x - a.x) < 7 ? "move" : null;
    var b = d.b ? anchorXY(d.b, sc) : null;
    if (!b) return null;
    if (dist(x, y, a.x, a.y) < 9) return "a";
    if (dist(x, y, b.x, b.y) < 9) return "b";
    if (d.type === "trend") return segDist(x, y, a.x, a.y, b.x, b.y) < 7 ? "move" : null;
    if (d.type === "rect") {
      var minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
      var minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
      return x >= minX - 4 && x <= maxX + 4 && y >= minY - 4 && y <= maxY + 4 ? "move" : null;
    }
    if (d.type === "fib") {
      /* the whole retracement box is grabbable: level lines are thin targets */
      if (x >= Math.min(a.x, b.x) - 6 && x <= Math.max(a.x, b.x) + 6 &&
          y >= Math.min(a.y, b.y) - 8 && y <= Math.max(a.y, b.y) + 8) return "move";
    }
    return null;
  }
  function hitTest(x, y, sc) {
    for (var i = S.drawings.length - 1; i >= 0; i--) {
      var part = hitShape(S.drawings[i], x, y, sc);
      if (part) return { shape: S.drawings[i], part: part };
    }
    return null;
  }

  /* ---------------- history ---------------- */
  function snapshot() { return JSON.stringify(S.drawings); }
  function pushUndo(snap) {
    S.undo.push(snap || snapshot());
    if (S.undo.length > 60) S.undo.shift();
    S.redo = [];
    syncHistory();
  }
  function undo() {
    if (!S.undo.length) return;
    S.redo.push(snapshot());
    S.drawings = JSON.parse(S.undo.pop());
    S.selected = null;
    saveDrawings();
    scheduleDraw();
    toast("Undo");
  }
  function redo() {
    if (!S.redo.length) return;
    S.undo.push(snapshot());
    S.drawings = JSON.parse(S.redo.pop());
    S.selected = null;
    saveDrawings();
    scheduleDraw();
    toast("Redo");
  }
  function deleteSelected() {
    if (!S.selected) return;
    pushUndo();
    S.drawings = S.drawings.filter(function (d) { return d !== S.selected; });
    S.selected = null;
    saveDrawings();
    scheduleDraw();
    toast("Drawing deleted");
  }
  function clearDrawings() {
    if (!S.drawings.length) { toast("Nothing to clear", true); return; }
    pushUndo();
    S.drawings = [];
    S.selected = null;
    saveDrawings();
    scheduleDraw();
    toast("All drawings cleared — Ctrl+Z to undo");
  }

  /* ---------------- UI sync ---------------- */
  var lastHoverIdx = -1;
  function syncSymbolUI() {
    var a = asset();
    $("#symLabel").textContent = a.label;
    $("#symName").textContent = a.name;
    $("#symIcon").textContent = a.icon;
    $("#lgSym").textContent = a.label + " · " + a.market;
    $("#lgTf").textContent = S.tf;
    $$("#tfGroup button").forEach(function (b) { b.classList.toggle("on", b.dataset.tf === S.tf); });
    document.title = a.label + " · " + S.tf + " — KyorakuReplay terminal";
  }

  function syncUI() {
    var a = asset();
    var bar = S.data[S.cursor];
    if (!bar) return;
    var prev = S.data[S.cursor - 1] || bar;
    var chg = ((bar.c - prev.c) / prev.c) * 100;

    $("#topQuote").textContent = fmtP(bar.c) + "  " + signed(chg, 2) + "%";
    $("#topQuote").className = "rp-quote " + (chg > 0 ? "up" : chg < 0 ? "down" : "");

    $("#lgO").textContent = fmtP(bar.o);
    $("#lgH").textContent = fmtP(bar.h);
    $("#lgL").textContent = fmtP(bar.l);
    $("#lgC").textContent = fmtP(bar.c);
    var chgEl = $("#lgChg");
    chgEl.textContent = signed(chg, 2) + "%";
    chgEl.className = "lg-chg " + (chg > 0 ? "up" : chg < 0 ? "down" : "");

    $("#buyPrice").textContent = fmtP(bar.c + a.spread / 2);
    $("#sellPrice").textContent = fmtP(bar.c - a.spread / 2);
    var qty = K.sizeFor(a, S.risk);
    $("#buyQty").textContent = fmtQty(qty) + " · risk $" + S.risk;
    $("#sellQty").textContent = fmtQty(qty) + " · risk $" + S.risk;
    $("#acctQty").textContent = fmtQty(qty) + " units";
    $("#stopNote").textContent = "Stop " + fmtP(a.stop) + " pts · target 2R";

    $("#cursorDate").textContent = fmtFull(bar.t);
    $("#startDate").textContent = fmtDay(S.data[0].t);
    $("#endDate").textContent = fmtDay(bar.t);
    var prog = $("#progress");
    prog.max = String(S.n - 1);
    prog.value = String(S.cursor);

    var realized = S.trades.reduce(function (sum, t) { return sum + t.pnl; }, 0);
    var open = S.pos ? K.pnl(a, S.pos.entry, bar.c, S.pos.dir, S.pos.qty) : 0;
    $("#acctEquity").textContent = money(100000 + realized + open);
    var openEl = $("#acctOpen");
    openEl.textContent = money(open);
    openEl.style.color = open > 0 ? "var(--mint)" : open < 0 ? "var(--rose)" : "";

    updatePositionUI();
    updateStats();
  }

  /* ---------------- ticket ---------------- */
  function openPosition(dir) {
    if (S.pos) { toast("Close your open position first", true); return; }
    var a = asset();
    var bar = S.data[S.cursor];
    var entry = bar.c + (dir > 0 ? a.spread / 2 : -a.spread / 2);
    var qty = K.sizeFor(a, S.risk);
    S.pos = {
      dir: dir,
      entry: entry,
      qty: qty,
      stop: entry - dir * a.stop,
      target: entry + dir * 2 * a.stop,
      openIdx: S.cursor,
      sym: a.label,
      market: a.market,
      setup: $("#setupSelect").value,
      session: sessionName(),
      t: Date.now()
    };
    toast((dir > 0 ? "Long" : "Short") + " " + fmtQty(qty) + " " + a.label + " @ " + fmtP(entry));
    syncUI();
    scheduleDraw();
  }

  function closePosition(reason, price) {
    if (!S.pos) return;
    var p = S.pos;
    var a = asset();
    var exit = price === undefined ? S.data[S.cursor].c : price;
    var r = ((exit - p.entry) * p.dir) / a.stop;
    var pnl = K.pnl(a, p.entry, exit, p.dir, p.qty);
    var trade = {
      id: "rp-" + Date.now() + "-" + Math.floor(Math.random() * 999),
      date: isoLocal(new Date()),
      sym: p.sym,
      market: p.market,
      dir: p.dir,
      setup: p.setup,
      session: p.session,
      r: Math.round(r * 100) / 100,
      pnl: pnl,
      exitReason: reason,
      entry: p.entry,
      exit: exit,
      qty: p.qty
    };
    S.trades.unshift(trade);
    var journal = store.get("fxr-trades", []);
    if (!Array.isArray(journal)) journal = [];
    journal.push({
      id: trade.id, date: trade.date, sym: trade.sym, market: trade.market,
      dir: trade.dir, setup: trade.setup, session: trade.session, r: trade.r
    });
    store.set("fxr-trades", journal);

    S.pos = null;
    renderFeed();
    toast(reason + " · " + signed(r, 2) + "R · " + money(pnl), r < 0);
    syncUI();
    scheduleDraw();
  }

  function updatePositionUI() {
    var box = $("#posBox");
    if (!S.pos) { box.hidden = true; return; }
    box.hidden = false;
    var p = S.pos;
    var bar = S.data[S.cursor];
    var a = asset();
    var pnl = K.pnl(a, p.entry, bar.c, p.dir, p.qty);
    var r = ((bar.c - p.entry) * p.dir) / a.stop;
    $("#posDir").textContent = p.dir > 0 ? "LONG" : "SHORT";
    $("#posDir").className = "pos-dir" + (p.dir < 0 ? " short" : "");
    $("#posSym").textContent = p.sym;
    var rEl = $("#posR");
    rEl.textContent = signed(r, 2) + "R";
    rEl.className = "pos-r " + (r > 0 ? "up" : r < 0 ? "down" : "");
    $("#posEntry").textContent = fmtP(p.entry);
    $("#posQty").textContent = fmtQty(p.qty);
    $("#posStop").textContent = fmtP(p.stop);
    $("#posTarget").textContent = fmtP(p.target);
    $("#posPnl").textContent = money(pnl);
    $("#posPnl").style.color = pnl > 0 ? "var(--mint)" : pnl < 0 ? "var(--rose)" : "";
  }

  function checkPosition() {
    if (!S.pos) return;
    if (S.cursor <= S.pos.openIdx) return;
    var bar = S.data[S.cursor];
    var p = S.pos;
    var hitStop = p.dir > 0 ? bar.l <= p.stop : bar.h >= p.stop;
    var hitTarget = p.dir > 0 ? bar.h >= p.target : bar.l <= p.target;
    /* conservative: if both touched in one candle, assume the stop filled first */
    if (hitStop) closePosition("Stop hit", p.stop);
    else if (hitTarget) closePosition("Target hit", p.target);
  }

  function renderFeed() {
    var feed = $("#feed");
    if (!feed) return;
    if (!S.trades.length) {
      feed.innerHTML = '<li class="feed-empty">No trades yet — place your first order.</li>';
      return;
    }
    feed.innerHTML = S.trades.slice(0, 7).map(function (t) {
      return '<li><span class="f-dir">' + (t.dir > 0 ? "LONG" : "SHORT") + "</span>" +
        '<span class="f-sym">' + t.sym + "</span>" +
        '<span class="f-r ' + (t.r >= 0 ? "up" : "down") + '">' + signed(t.r, 2) + "R</span></li>";
    }).join("");
  }

  function updateStats() {
    var n = S.trades.length;
    var wins = S.trades.filter(function (t) { return t.r > 0; }).length;
    var net = S.trades.reduce(function (a, t) { return a + t.r; }, 0);
    $("#sTrades").textContent = String(n);
    $("#sWin").textContent = n ? Math.round((wins / n) * 100) + "%" : "—";
    var nr = $("#sNetR");
    nr.textContent = signed(net, 1) + "R";
    nr.className = net > 0 ? "up" : net < 0 ? "down" : "";
  }

  function sessionName() {
    var h = new Date().getUTCHours();
    if (h >= 7 && h < 12) return "London";
    if (h >= 12 && h < 16) return "NY AM";
    if (h >= 16 && h < 21) return "NY PM";
    return "Asia";
  }

  /* ---------------- playback ---------------- */
  function play() {
    if (S.playing) return;
    if (S.cursor >= S.n - 2) { toast("End of replay data — jump back to continue", true); return; }
    S.playing = true;
    setPlayUI();
    tick();
  }
  function pause() {
    S.playing = false;
    if (S.timer) { clearTimeout(S.timer); S.timer = null; }
    setPlayUI();
  }
  function tick() {
    if (!S.playing) return;
    if (S.cursor >= S.n - 2) { pause(); toast("End of replay data", true); return; }
    step(1);
    S.timer = setTimeout(tick, 800 / S.speed);
  }
  function step(delta) {
    var next = clamp(S.cursor + delta, 20, S.n - 2);
    if (next === S.cursor) { if (delta > 0) pause(); return; }
    S.cursor = next;
    if (S.follow) S.right = S.cursor;
    checkPosition();
    syncUI();
    scheduleDraw();
  }
  function setPlayUI() {
    var btn = $("#playBtn");
    btn.innerHTML = '<svg class="ic"><use href="#' + (S.playing ? "i-pause" : "i-play") + '"/></svg>';
    btn.classList.toggle("playing", S.playing);
    btn.setAttribute("aria-label", S.playing ? "Pause replay" : "Play replay");
  }
  function setSpeed(v) {
    S.speed = v;
    $$("#speedGroup button").forEach(function (b) { b.classList.toggle("on", Number(b.dataset.speed) === v); });
  }
  function setCursor(idx, follow) {
    pause();
    S.cursor = clamp(Math.round(idx), 20, S.n - 2);
    S.follow = follow !== false;
    if (S.follow) S.right = S.cursor;
    syncUI();
    scheduleDraw();
  }

  /* ---------------- clock ---------------- */
  function startClock() {
    var el = $("#sessionClock");
    var tick = function () {
      var s = Math.floor((Date.now() - S.start) / 1000);
      if (el) el.textContent = pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
      syncTzChip();
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- resize ---------------- */
  function resize() {
    var rect = wrap.getBoundingClientRect();
    S.W = Math.max(1, Math.round(rect.width));
    S.H = Math.max(1, Math.round(rect.height));
    S.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(S.W * S.dpr);
    canvas.height = Math.round(S.H * S.dpr);
    canvas.style.width = S.W + "px";
    canvas.style.height = S.H + "px";
    scheduleDraw();
  }

  /* ---------------- pointer interactions ---------------- */
  function localPoint(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function withinPlot(pt) {
    var g = geom();
    return pt.x >= g.x0 && pt.x <= g.x1 && pt.y >= g.y0 && pt.y <= g.y1;
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    var pt = localPoint(e);
    var sc = visibleStats();
    canvas.setPointerCapture(e.pointerId);

    if (S.tool === "cursor") {
      var hit = S.hidden || S.locked ? null : hitTest(pt.x, pt.y, sc);
      if (hit) {
        S.selected = hit.shape;
        S.drag = {
          mode: "shape",
          part: hit.part,
          start: pt,
          origin: JSON.parse(JSON.stringify(hit.shape)),
          snapshot: snapshot(),
          moved: false
        };
        scheduleDraw();
        return;
      }
      S.selected = null;
      S.drag = { mode: "pan", start: pt, right: range().right, snapshot: null, moved: false };
      wrap.classList.add("panning");
      scheduleDraw();
      return;
    }

    /* drawing tools */
    var price = priceAt(pt.y, sc);
    var idx = clamp(iAt(pt.x), 0, S.cursor);
    if (S.tool === "hline") {
      S.draft = { type: "hline", a: { i: idx, p: price }, color: "#38e2a0" };
    } else if (S.tool === "vline") {
      S.draft = { type: "vline", a: { i: idx, p: price }, color: "#5d8bff" };
    } else if (S.tool === "trend") {
      S.draft = { type: "trend", a: { i: idx, p: price }, b: { i: idx, p: price }, color: "#a78bfa" };
    } else if (S.tool === "rect") {
      S.draft = { type: "rect", a: { i: idx, p: price }, b: { i: idx, p: price }, color: "#8b6bff" };
    } else if (S.tool === "fib") {
      S.draft = { type: "fib", a: { i: idx, p: price }, b: { i: idx, p: price }, color: "#ffc861" };
    } else if (S.tool === "measure") {
      S.draft = { type: "measure", a: { i: idx, p: price }, b: { i: idx, p: price }, color: "#a78bfa" };
    } else if (S.tool === "long" || S.tool === "short" || S.tool === "forecast") {
      S.draft = {
        type: S.tool,
        a: { i: idx, p: price },
        b: { i: idx, p: price },
        c: { i: idx, p: price },
        color: S.tool === "short" ? "#ff5d7d" : "#38e2a0"
      };
    } else if (S.tool === "bars") {
      S.draft = { type: "bars", a: { i: idx, p: price }, b: { i: idx, p: price }, color: "#a78bfa" };
    } else if (S.tool === "vprofile") {
      S.draft = { type: "vprofile", a: { i: idx, p: price }, b: { i: idx, p: price }, color: "#5d8bff" };
    } else if (S.tool === "avwap" || S.tool === "avprofile") {
      S.draft = {
        type: S.tool,
        a: { i: idx, p: price },
        color: S.tool === "avwap" ? "#ffc861" : "#5d8bff"
      };
    }
    S.drag = { mode: "draw", start: pt };
    scheduleDraw();
  });

  canvas.addEventListener("pointermove", function (e) {
    var pt = localPoint(e);
    var sc = visibleStats();
    if (S.drag) {
      var dx = pt.x - S.drag.start.x;
      var dy = pt.y - S.drag.start.y;

      if (S.drag.mode === "pan") {
        if (Math.abs(dx) > 1) {
          var g = geom();
          var per = (g.x1 - g.x0) / Math.max(1, range().bars - 1);
          S.right = clamp(S.drag.right - dx / per, Math.min(range().bars - 1, S.cursor), S.cursor);
          S.follow = S.right >= S.cursor - 0.5;
          $("#liveBtn").hidden = S.follow;
          scheduleDraw();
        }
      } else if (S.drag.mode === "shape" && S.selected) {
        if (!S.drag.moved && Math.hypot(dx, dy) > 2) {
          pushUndo(S.drag.snapshot);
          S.drag.moved = true;
        }
        if (S.drag.moved) {
          var di = iAt(pt.x) - iAt(S.drag.start.x);
          var dp = priceAt(pt.y, sc) - priceAt(S.drag.start.y, sc);
          var origin = S.drag.origin;
          var shape = S.selected;
          if (S.drag.part === "move") {
            shape.a = { i: origin.a.i + di, p: origin.a.p + dp };
            if (origin.b) shape.b = { i: origin.b.i + di, p: origin.b.p + dp };
            if (origin.c) shape.c = { i: origin.c.i + di, p: origin.c.p + dp };
          } else if (S.drag.part === "a") {
            shape.a = { i: clamp(origin.a.i + di, 0, S.cursor), p: origin.a.p + dp };
          } else if (S.drag.part === "b" && origin.b) {
            shape.b = { i: clamp(origin.b.i + di, 0, S.cursor), p: origin.b.p + dp };
          } else if (S.drag.part === "c" && origin.c) {
            shape.c = { i: clamp(origin.c.i + di, 0, S.cursor), p: origin.c.p + dp };
          }
          scheduleDraw();
        }
      } else if (S.drag.mode === "draw" && S.draft) {
        if (S.draft.b) {
          S.draft.b = {
            i: clamp(iAt(pt.x), 0, S.cursor),
            p: priceAt(clamp(pt.y, geom().y0, geom().y1), sc)
          };
          /* the stop handle of a position tool mirrors the target around entry */
          if (S.draft.c) {
            var entry = S.draft.a.p;
            var distP = S.draft.b.p - entry;
            var stopP = S.draft.type === "short" ? entry + distP * 0.5 : entry - distP * 0.5;
            S.draft.c = { i: S.draft.b.i, p: stopP };
          }
        } else {
          S.draft.a.p = priceAt(clamp(pt.y, geom().y0, geom().y1), sc);
          if (S.draft.type === "vline") S.draft.a.i = clamp(iAt(pt.x), 0, S.cursor);
        }
        scheduleDraw();
      }
    }

    if (withinPlot(pt)) {
      S.hover = pt;
      var hi = clamp(Math.round(iAt(pt.x)), Math.ceil(range().left), S.cursor);
      if (hi !== lastHoverIdx) {
        lastHoverIdx = hi;
        var hb = S.data[hi];
        if (hb) {
          $("#lgO").textContent = fmtP(hb.o);
          $("#lgH").textContent = fmtP(hb.h);
          $("#lgL").textContent = fmtP(hb.l);
          $("#lgC").textContent = fmtP(hb.c);
          var prev = S.data[hi - 1] || hb;
          var ch = ((hb.c - prev.c) / prev.c) * 100;
          var chgEl = $("#lgChg");
          chgEl.textContent = signed(ch, 2) + "%";
          chgEl.className = "lg-chg " + (ch > 0 ? "up" : ch < 0 ? "down" : "");
        }
      }
    } else {
      S.hover = null;
    }
    scheduleDraw();
  });

  function endPointer(e) {
    if (!S.drag) return;
    if (S.drag.mode === "draw" && S.draft) {
      var d = S.draft;
      var moved = d.b ? (Math.abs(d.b.i - d.a.i) > 0.2 || d.b.p !== d.a.p) : true;
      if (moved) {
        pushUndo();
        S.drawings.push(d);
        saveDrawings();
        var names = {
          hline: "Horizontal line added",
          vline: "Vertical line added",
          measure: "Measurement added",
          long: "Long position added",
          short: "Short position added",
          forecast: "Forecast added",
          bars: "Bars pattern added",
          avwap: "Anchored VWAP added",
          vprofile: "Volume profile added",
          avprofile: "Anchored volume profile added"
        };
        toast(names[d.type] || "Drawing added");
      }
      S.draft = null;
      setTool("cursor");
    }
    if (S.drag.mode === "shape" && S.drag.moved) {
      saveDrawings();
    }
    if (S.drag.mode === "pan") wrap.classList.remove("panning");
    S.drag = null;
    scheduleDraw();
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", function () {
    if (!S.drag) { S.hover = null; scheduleDraw(); }
  });

  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    var pt = localPoint(e);
    var r = range();
    var factor = e.deltaY > 0 ? 1.14 : 0.88;
    var nb = clamp(Math.round(r.bars * factor), 25, Math.min(900, S.n));
    if (nb === r.bars) return;
    var g = geom();
    var f = clamp((pt.x - g.x0) / (g.x1 - g.x0), 0, 1);
    var idx = r.left + f * (r.bars - 1);
    var nright = idx + (1 - f) * (nb - 1);
    nright = clamp(nright, nb - 1, S.cursor);
    S.bars = nb;
    S.right = nright;
    S.follow = S.right >= S.cursor - 0.5;
    $("#liveBtn").hidden = S.follow;
    scheduleDraw();
  }, { passive: false });

  canvas.addEventListener("dblclick", function () {
    S.bars = clamp(Math.round(S.W / 8), 90, 210);
    S.right = S.cursor;
    S.follow = true;
    $("#liveBtn").hidden = true;
    scheduleDraw();
  });

  canvas.addEventListener("contextmenu", function (e) {
    if (S.draft) { e.preventDefault(); S.draft = null; setTool("cursor"); scheduleDraw(); }
  });

  /* ---------------- tools ---------------- */
  /* Grouped "Line tools" menu — same order and wording as TradingView's rail menu */
  var TOOL_MENU = [
    { name: "Lines", items: [
      { tool: "trend", bg: "#i-trend", label: "Trend line", key: "T" },
      { tool: "hline", bg: "#i-hline", label: "Horizontal line", key: "H" },
      { tool: "vline", bg: "#i-vline", label: "Vertical line", key: "L" },
      { tool: "rect", bg: "#i-rect", label: "Rectangle zone", key: "R" },
      { tool: "fib", bg: "#i-fib", label: "Fib retracement", key: "F" }
    ] },
    { name: "Forecasting", items: [
      { tool: "long", bg: "#i-longpos", label: "Long position", key: "P" },
      { tool: "short", bg: "#i-shortpos", label: "Short position", key: "O" },
      { tool: "forecast", bg: "#i-forecast", label: "Position forecast", key: "Y" },
      { tool: "bars", bg: "#i-bars", label: "Bars pattern", key: "G" }
    ] },
    { name: "Volume based", items: [
      { tool: "avwap", bg: "#i-avwap", label: "Anchored VWAP", key: "A" },
      { tool: "vprofile", bg: "#i-vprofile", label: "Fixed range volume profile", key: "Z" },
      { tool: "avprofile", bg: "#i-avprofile", label: "Anchored volume profile", key: "⇧A" }
    ] },
    { name: "Measurers", items: [
      { tool: "measure", bg: "#i-measure", label: "Price & date range", key: "M" }
    ] }
  ];
  function renderToolMenu() {
    var body = $("#toolMenuBody");
    if (!body) return;
    body.innerHTML = TOOL_MENU.map(function (g) {
      return '<div class="tmenu-group">' + g.name + "</div>" + g.items.map(function (it) {
        return '<button type="button" class="tmenu-opt" data-tool="' + it.tool + '" role="menuitem">' +
          '<svg class="ic"><use href="' + it.bg + '"/></svg><span>' + it.label + "</span>" +
          "<kbd>" + it.key + "</kbd></button>";
      }).join("");
    }).join("");
  }
  function placeToolMenu() {
    var m = $("#toolMenu"), b = $("#toolMenuBtn");
    if (!m || !b) return;
    var r = b.getBoundingClientRect();
    var h = m.offsetHeight || 480;
    var top = Math.min(Math.max(8, r.top - 8), Math.max(8, window.innerHeight - h - 8));
    m.style.left = Math.round(r.right + 12) + "px";
    m.style.top = Math.round(top) + "px";
  }
  function openToolMenu() {
    var m = $("#toolMenu");
    if (!m) return;
    m.hidden = false;
    placeToolMenu();
    $("#toolMenuBtn").classList.add("on");
    $("#toolMenuBtn").setAttribute("aria-expanded", "true");
  }
  function closeToolMenu() {
    var m = $("#toolMenu");
    if (!m || m.hidden) return;
    m.hidden = true;
    $("#toolMenuBtn").classList.remove("on");
    $("#toolMenuBtn").setAttribute("aria-expanded", "false");
  }

  function setTool(tool) {
    if (S.locked && tool !== "cursor") {
      toast("Drawings are locked — Alt+L to unlock", true);
      return;
    }
    S.tool = tool;
    S.draft = null;
    $$("#toolbar .tool[data-tool]").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === tool); });
    $$("#toolMenuBody .tmenu-opt").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === tool); });
    closeToolMenu();
    wrap.classList.toggle("drawing", tool !== "cursor");
    var hints = {
      trend: "Click, drag and release to draw a trend line · Esc to cancel",
      hline: "Click a price level to place a horizontal line",
      vline: "Click to mark a moment in time",
      rect: "Drag to mark a supply / demand zone",
      fib: "Drag from swing low to swing high (or the reverse)",
      measure: "Drag from A to B — price change, percentage and elapsed time",
      long: "Long position — drag entry to target, the stop is set from the risk",
      short: "Short position — drag entry to target, the stop is set from the risk",
      forecast: "Position forecast — drag from the entry to the projected target",
      bars: "Bars pattern — drag across the candles you want to copy forward",
      avwap: "Click a bar to anchor the VWAP from there",
      vprofile: "Drag across a range to build its volume profile",
      avprofile: "Click a bar to anchor a volume profile to the latest candle"
    };
    var hint = $("#drawHint");
    if (hints[tool]) { hint.textContent = hints[tool]; hint.hidden = false; }
    else hint.hidden = true;
    scheduleDraw();
  }

  function selectSymbol(id) {
    if (S.pos) closePosition("Closed on switch");
    var a = K.get(id);
    setSeries(a.id, S.tf);
    $("#symModal").close();
  }

  function setTF(tf) {
    if (tf === S.tf) return;
    if (S.pos) closePosition("Closed on timeframe change");
    var keep = Math.round((S.cursor / Math.max(1, S.n - 1)) * 1000) / 1000;
    S.symbolId = S.symbolId;
    S.tf = tf;
    setLoading(true);
    loadSeries(S.symbolId, tf).then(function (series) {
      applySeries(series);
      S.cursor = clamp(Math.round(S.n * keep), 20, S.n - 2);
      S.right = S.cursor;
      syncUI();
      scheduleDraw();
      setLoading(false);
    });
    syncSymbolUI();
  }

  function loadSeries(id, tf) {
    return (DP && DP.load) ? DP.load(id, tf) : Promise.resolve(K.syntheticSeries(id, tf));
  }

  /* ---------------- dialogs ---------------- */
  function openDialog(el) {
    if (!el) return;
    if (typeof el.showModal === "function") el.showModal();
    else el.setAttribute("open", "");
  }
  function closeDialog(el) {
    if (!el) return;
    if (typeof el.close === "function") el.close();
    else el.removeAttribute("open");
  }

  var symModal = $("#symModal");
  var symQuery = "";
  var symMkt = "all";

  function renderSymbols() {
    var list = K.search(symQuery).filter(function (a) { return symMkt === "all" || a.market === symMkt; });
    $("#symCount").textContent = list.length + " instruments";
    var box = $("#symList");
    if (!list.length) {
      box.innerHTML = '<p class="sym-empty">No instruments match “' + symQuery.replace(/</g, "&lt;") + '”.</p>';
      return;
    }
    var groups = {};
    K.MARKETS.forEach(function (m) { groups[m] = []; });
    list.forEach(function (a) { (groups[a.market] = groups[a.market] || []).push(a); });
    var html = "";
    K.MARKETS.forEach(function (m) {
      var items = groups[m] || [];
      if (!items.length) return;
      html += '<p class="sym-group">' + m + " · " + items.length + "</p>";
      items.forEach(function (a) {
        html += '<button class="sym-item' + (a.id === S.symbolId ? " on" : "") + '" data-sym="' + a.id + '">' +
          '<span class="si-ico">' + a.icon + "</span>" +
          '<span class="si-main"><b>' + a.label + "</b><small>" + a.name + "</small></span>" +
          '<span class="si-venue">' + a.venue + "</span>" +
          '<svg class="ic ic--sm si-check"><use href="#i-check"/></svg>' +
          "</button>";
      });
    });
    box.innerHTML = html;
  }

  /* ---------------- jump ---------------- */
  function openJump() {
    var bar = S.data[S.cursor];
    $("#jumpInput").value = toZoneInput(bar.t);
    $("#jumpInput").min = toZoneInput(S.data[0].t);
    $("#jumpInput").max = toZoneInput(S.data[S.n - 2].t);
    $("#jumpRange").textContent = "Available: " + fmtFull(S.data[0].t) + " → " + fmtFull(S.data[S.n - 2].t) + " (" + tzShort() + ")";
    var lbl = $("#jumpTzLabel");
    if (lbl) lbl.textContent = "Date & time (" + tzShort() + ")";
    openDialog($("#jumpModal"));
  }
  function jumpToTs(ts) {
    var target = ts;
    var lo = 0, hi = S.n - 1, idx = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (S.data[mid].t <= target) { idx = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    setCursor(clamp(idx, 20, S.n - 2));
    toast("Replay moved to " + fmtFull(S.data[S.cursor].t));
  }
  function parseJump(value) {
    return fromZoneInput(value);
  }
  function quickJump(kind) {
    pause();
    var cur = S.data[S.cursor].t;
    if (kind === "start") return jumpToTs(S.data[0].t);
    if (kind === "end") return jumpToTs(S.data[S.n - 1].t);
    var d = new Date(cur);
    if (kind === "-1M") d.setUTCMonth(d.getUTCMonth() - 1);
    if (kind === "-3M") d.setUTCMonth(d.getUTCMonth() - 3);
    if (kind === "-1Y") d.setUTCFullYear(d.getUTCFullYear() - 1);
    jumpToTs(d.getTime());
  }

  /* ---------------- export + session ---------------- */
  function exportCsv() {
    if (!S.trades.length) { toast("No closed trades to export", true); return; }
    var rows = [["date", "symbol", "market", "direction", "setup", "session", "entry", "exit", "size", "r", "pnl"]];
    S.trades.slice().reverse().forEach(function (t) {
      rows.push([t.date, t.sym, t.market, t.dir > 0 ? "long" : "short", t.setup, t.session,
        t.entry.toFixed(asset().digits), t.exit.toFixed(asset().digits), t.qty, t.r.toFixed(2), t.pnl.toFixed(2)]);
    });
    var csv = rows.map(function (r) { return r.join(","); }).join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kyorakureplay-replay-" + isoLocal(new Date()) + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    toast("Replay ledger exported");
  }

  function endSession() {
    pause();
    if (S.pos) closePosition("Closed at session end");
    var a = asset();
    var net = S.trades.reduce(function (s, t) { return s + t.r; }, 0);
    var wins = S.trades.filter(function (t) { return t.r > 0; }).length;
    var session = {
      id: "s-" + Date.now(),
      sym: a.label,
      symbolId: a.id,
      tf: S.tf,
      session: sessionName(),
      setup: S.trades[0] ? S.trades[0].setup : $("#setupSelect").value,
      progress: Math.round((S.cursor / Math.max(1, S.n - 1)) * 100),
      trades: S.trades.length,
      netR: Math.round(net * 10) / 10,
      win: S.trades.length ? Math.round((wins / S.trades.length) * 100) : 0,
      state: "done",
      when: "Just now",
      createdAt: new Date().toISOString()
    };
    var sessions = store.get("fxr-sessions", []);
    if (!Array.isArray(sessions)) sessions = [];
    sessions.unshift(session);
    store.set("fxr-sessions", sessions.slice(0, 30));
    toast("Session saved — opening your dashboard");
    setTimeout(function () { location.href = "dashboard.html#sessions"; }, 650);
  }

  /* ---------------- debug/self-check ---------------- */
  window.KRReplay = {
    state: S,
    draw: draw,
    setTool: setTool,
    undo: undo,
    redo: redo,
    openPosition: openPosition,
    closePosition: closePosition,
    selectSymbol: selectSymbol,
    setTF: setTF,
    setCursor: setCursor
  };

  /* ---------------- boot ---------------- */
  function boot() {
    var initial = K.ASSETS.filter(function (a) { return a.id === (params.get("sym") || ""); })[0] ||
      K.ASSETS.filter(function (a) { return a.id === "ES"; })[0];
    var tf = K.TF_LIST.indexOf(params.get("tf")) !== -1 ? params.get("tf") : "1m";

    applyTheme(root.dataset.theme === "light" ? "light" : "dark");
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
    else window.addEventListener("resize", resize);

    S.W = Math.max(1, wrap.getBoundingClientRect().width);
    resize();
    S.bars = clamp(Math.round(S.W / 8), 90, 210);

    /* Paint instantly with the built-in engine, then swap in real candles. */
    S.symbolId = initial.id;
    S.tf = tf;
    applySeries(K.syntheticSeries(initial.id, tf));
    S.bars = clamp(Math.round(S.W / 8), 90, 210);
    setLoading(true);
    var bootLoad = (DP && DP.ready) ? DP.ready(initial.id, tf) : Promise.resolve(K.syntheticSeries(initial.id, tf));
    bootLoad.then(function (series) {
      if (S.symbolId !== initial.id || S.tf !== tf) return;
      applySeries(series);
      setLoading(false);
      syncUI();
      syncDataMode();
    }).catch(function () {
      setLoading(false);
      syncDataMode();
    });
    renderFeed();
    updateStats();
    setPlayUI();
    setTool("cursor");
    startClock();

    /* theme */
    $("#themeToggle").addEventListener("click", function () {
      applyTheme(isLight() ? "dark" : "light");
    });

    /* time zone picker */
    renderTzMenu();
    $("#tzBtn").addEventListener("click", function (e) {
      e.stopPropagation();
      var menu = $("#tzMenu");
      if (menu.hidden) openTz(); else closeTz();
    });
    $("#tzMenu").addEventListener("click", function (e) {
      var opt = e.target.closest(".tz-opt");
      if (opt) setZone(opt.dataset.zone);
    });
    $("#tzSearch").addEventListener("input", function (e) {
      renderTzMenu(e.target.value);
    });
    $("#tzSearch").addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeTz(); $("#tzBtn").focus(); }
      if (e.key === "Enter") {
        var first = $("#tzList .tz-opt");
        if (first) setZone(first.dataset.zone);
      }
    });
    document.addEventListener("click", function (e) {
      if (!$("#tz").contains(e.target)) closeTz();
    });

    /* live / auto / offline data mode */
    syncDataMode();
    $("#dataMode").addEventListener("click", function () {
      if (!DP) return;
      var order = ["auto", "live", "synthetic"];
      var next = order[(order.indexOf(DP.mode()) + 1) % order.length];
      DP.setMode(next);
      syncDataMode();
      if (next !== "synthetic") DP.probe().then(syncDataMode);
      toast(next === "synthetic" ? "Offline engine — simulated candles"
        : next === "live" ? "Live feed only — no simulated fallback"
        : "Auto — real prices when the feed responds");
      if (S.pos) closePosition("Closed on data mode change");
      setSeries(S.symbolId, S.tf);
    });

    /* timeframe */
    $("#tfGroup").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-tf]");
      if (btn) setTF(btn.dataset.tf);
    });

    /* playback */
    $("#playBtn").addEventListener("click", function () { S.playing ? pause() : play(); });
    $("#stepBtn").addEventListener("click", function () { pause(); step(1); });
    $("#rewindBtn").addEventListener("click", function () { pause(); step(-1); });
    $("#speedGroup").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-speed]");
      if (btn) setSpeed(Number(btn.dataset.speed));
    });
    $("#progress").addEventListener("input", function (e) {
      pause();
      S.cursor = clamp(Number(e.target.value), 20, S.n - 2);
      S.right = S.cursor;
      S.follow = true;
      $("#liveBtn").hidden = true;
      checkPosition();
      syncUI();
      scheduleDraw();
    });
    $("#jumpLive").addEventListener("click", function () {
      S.right = S.cursor;
      S.follow = true;
      $("#liveBtn").hidden = true;
      scheduleDraw();
    });

    /* tools */
    renderToolMenu();
    $("#toolMenuBtn").addEventListener("click", function (e) {
      e.stopPropagation();
      $("#toolMenu").hidden ? openToolMenu() : closeToolMenu();
    });
    $("#toolMenuX").addEventListener("click", closeToolMenu);
    window.addEventListener("resize", closeToolMenu);
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".tool-fly")) closeToolMenu();
    });
    $("#toolbar").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-tool]");
      if (btn) setTool(btn.dataset.tool);
    });
    $("#clearBtn").addEventListener("click", function (e) {
      if (S.selected && !e.shiftKey) deleteSelected();
      else if (S.selected && e.shiftKey) { S.selected = null; clearDrawings(); }
      else clearDrawings();
    });
    /* eye / lock for the whole drawing layer */
    function syncEyeLock() {
      var eye = $("#eyeBtn"), lock = $("#lockBtn");
      if (eye) {
        eye.classList.toggle("on", S.hidden);
        eye.setAttribute("aria-pressed", S.hidden ? "true" : "false");
        eye.title = S.hidden ? "Show drawings (Alt+H)" : "Hide all drawings (Alt+H)";
        eye.querySelector("use").setAttribute("href", S.hidden ? "#i-eye-off" : "#i-eye");
      }
      if (lock) {
        lock.classList.toggle("on", S.locked);
        lock.setAttribute("aria-pressed", S.locked ? "true" : "false");
        lock.title = S.locked ? "Unlock drawings (Alt+L)" : "Lock drawings (Alt+L)";
        lock.querySelector("use").setAttribute("href", S.locked ? "#i-lock" : "#i-unlock");
      }
      wrap.classList.toggle("locked", S.locked);
    }
    function toggleHidden() {
      S.hidden = !S.hidden;
      store.set("fxr-draw-hidden", S.hidden);
      if (S.hidden) S.selected = null;
      syncEyeLock();
      scheduleDraw();
      toast(S.hidden ? "Drawings hidden — Alt+H to show" : "Drawings shown");
    }
    function toggleLocked() {
      S.locked = !S.locked;
      store.set("fxr-draw-locked", S.locked);
      if (S.locked) { S.selected = null; if (S.tool !== "cursor") setTool("cursor"); }
      syncEyeLock();
      scheduleDraw();
      toast(S.locked ? "Drawings locked — Alt+L to unlock" : "Drawings unlocked");
    }
    S.hidden = !!store.get("fxr-draw-hidden", false);
    S.locked = !!store.get("fxr-draw-locked", false);
    syncEyeLock();
    $("#eyeBtn").addEventListener("click", toggleHidden);
    $("#lockBtn").addEventListener("click", toggleLocked);

    $("#undoBtn").addEventListener("click", undo);
    $("#redoBtn").addEventListener("click", redo);

    /* trading */
    $("#buyBtn").addEventListener("click", function () { openPosition(1); });
    $("#sellBtn").addEventListener("click", function () { openPosition(-1); });
    $("#closePos").addEventListener("click", function () { closePosition("Closed manually"); });
    $("#exportBtn").addEventListener("click", exportCsv);

    /* symbol picker */
    $("#symBtn").addEventListener("click", function () {
      symQuery = "";
      $("#symSearch").value = "";
      renderSymbols();
      openDialog(symModal);
      setTimeout(function () { $("#symSearch").focus(); }, 40);
    });
    $("#symSearch").addEventListener("input", function (e) {
      symQuery = e.target.value;
      renderSymbols();
    });
    $("#symTabs").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-mkt]");
      if (!btn) return;
      symMkt = btn.dataset.mkt;
      $$("#symTabs button").forEach(function (b) { b.classList.toggle("on", b === btn); });
      renderSymbols();
    });
    $("#symList").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-sym]");
      if (btn) selectSymbol(btn.dataset.sym);
    });

    /* dialogs close */
    $$(".rp-modal [data-close]").forEach(function (b) {
      b.addEventListener("click", function () { closeDialog(b.closest("dialog")); });
    });
    $$(".rp-modal").forEach(function (dlg) {
      dlg.addEventListener("click", function (e) {
        if (e.target === dlg) closeDialog(dlg);
      });
    });

    /* jump */
    $("#jumpBtn").addEventListener("click", openJump);
    $("#jumpForm").addEventListener("submit", function (e) {
      var submitter = e.submitter;
      if (submitter && submitter.value === "cancel") return;
      e.preventDefault();
      var ts = parseJump($("#jumpInput").value);
      if (ts === null) return;
      closeDialog($("#jumpModal"));
      jumpToTs(ts);
    });
    $$(".jump-quick button").forEach(function (b) {
      b.addEventListener("click", function () {
        closeDialog($("#jumpModal"));
        quickJump(b.dataset.jump);
      });
    });

    /* help */
    $("#helpBtn").addEventListener("click", function () { renderSrcPanel(); openDialog($("#helpModal")); });

    /* side panel (mobile) */
    function toggleSide(force) {
      var side = $("#sidePanel");
      var open = force !== undefined ? force : !side.classList.contains("open");
      side.classList.toggle("open", open);
      $("#tradeToggle").setAttribute("aria-expanded", String(open));
    }
    $("#tradeToggle").addEventListener("click", function () { toggleSide(); });
    $("#sideClose").addEventListener("click", function () { toggleSide(false); });
    document.addEventListener("click", function (e) {
      var side = $("#sidePanel");
      if (!side.classList.contains("open")) return;
      if (side.contains(e.target) || $("#tradeToggle").contains(e.target)) return;
      toggleSide(false);
    });

    /* fullscreen */
    $("#fullBtn").addEventListener("click", function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    });

    /* end session */
    $("#endBtn").addEventListener("click", endSession);

    /* keyboard */
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || e.target.isContentEditable) return;
      if (document.querySelector("dialog[open]")) return;
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.altKey && e.key.toLowerCase() === "h") { e.preventDefault(); toggleHidden(); return; }
      if (e.altKey && e.key.toLowerCase() === "l") { e.preventDefault(); toggleLocked(); return; }
      if (e.key === " ") { e.preventDefault(); S.playing ? pause() : play(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); pause(); step(1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); pause(); step(-1); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (e.shiftKey) clearDrawings(); else deleteSelected();
        return;
      }
      if (e.key === "Escape") {
        if (!$("#toolMenu").hidden) { closeToolMenu(); return; }
        if (!$("#tzMenu").hidden) { closeTz(); return; }
        if (S.draft) { S.draft = null; setTool("cursor"); }
        else if (S.selected) { S.selected = null; scheduleDraw(); }
        return;
      }
      var keys = {
        v: "cursor", t: "trend", h: "hline", l: "vline", r: "rect", f: "fib",
        m: "measure", p: "long", o: "short", y: "forecast", g: "bars",
        z: "vprofile"
      };
      var key = e.key.toLowerCase();
      if (!mod && e.shiftKey && key === "a") { setTool("avprofile"); return; }
      if (!mod && key === "a") { setTool("avwap"); return; }
      if (!mod && keys[key]) { setTool(keys[key]); return; }
      if (!mod && e.key.toLowerCase() === "b") { openPosition(1); return; }
      if (!mod && e.key.toLowerCase() === "s") { openPosition(-1); return; }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause();
    });

    window.addEventListener("beforeunload", function () {
      if (S.playing) pause();
    });

    setTimeout(function () {
      if (!store.get("fxr-replay-seen", false)) {
        store.set("fxr-replay-seen", true);
        toast("Press Space to play · scroll to zoom · drag to pan");
      }
    }, 900);
  }

  boot();
})();
