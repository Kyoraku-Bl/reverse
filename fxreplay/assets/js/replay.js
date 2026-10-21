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
  function fmtTime(ts) {
    var d = new Date(ts);
    return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
  }
  function fmtDay(ts) {
    var d = new Date(ts);
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
  }
  function fmtFull(ts) {
    var d = new Date(ts);
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() + " · " + fmtTime(ts);
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

  function setSeries(symbolId, tf, opts) {
    opts = opts || {};
    S.symbolId = symbolId;
    S.tf = tf;
    S.series = K.series(symbolId, tf);
    S.data = S.series.data;
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
    scheduleDraw();
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
      var day = new Date(d.t).getUTCDate();
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
    S.drawings.forEach(function (d) { drawShape(d, pal, sc, d === S.selected); });
    if (S.draft) drawShape(S.draft, pal, sc, true, true);

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
    setInterval(function () {
      var s = Math.floor((Date.now() - S.start) / 1000);
      el.textContent = pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
    }, 1000);
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
      var hit = hitTest(pt.x, pt.y, sc);
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
          } else if (S.drag.part === "a") {
            shape.a = { i: clamp(origin.a.i + di, 0, S.cursor), p: origin.a.p + dp };
          } else if (S.drag.part === "b" && origin.b) {
            shape.b = { i: clamp(origin.b.i + di, 0, S.cursor), p: origin.b.p + dp };
          }
          scheduleDraw();
        }
      } else if (S.drag.mode === "draw" && S.draft) {
        if (S.draft.b) {
          S.draft.b = {
            i: clamp(iAt(pt.x), 0, S.cursor),
            p: priceAt(clamp(pt.y, geom().y0, geom().y1), sc)
          };
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
        toast(d.type === "hline" ? "Horizontal line added" : d.type === "vline" ? "Vertical line added" : "Drawing added");
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
  function setTool(tool) {
    S.tool = tool;
    S.draft = null;
    $$("#toolbar .tool[data-tool]").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === tool); });
    wrap.classList.toggle("drawing", tool !== "cursor");
    var hints = {
      trend: "Click, drag and release to draw a trend line · Esc to cancel",
      hline: "Click a price level to place a horizontal line",
      vline: "Click to mark a moment in time",
      rect: "Drag to mark a supply / demand zone",
      fib: "Drag from swing low to swing high (or the reverse)"
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
    toast(a.label + " · " + a.market + " loaded");
    $("#symModal").close();
  }

  function setTF(tf) {
    if (tf === S.tf) return;
    if (S.pos) closePosition("Closed on timeframe change");
    var keep = Math.round((S.cursor / Math.max(1, S.n - 1)) * 1000) / 1000;
    setSeries(S.symbolId, tf);
    S.cursor = clamp(Math.round(S.n * keep), 20, S.n - 2);
    S.right = S.cursor;
    syncUI();
    scheduleDraw();
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
    var d = new Date(bar.t);
    var val = d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()) +
      "T" + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
    $("#jumpInput").value = val;
    $("#jumpInput").min = toLocalInput(S.data[0].t);
    $("#jumpInput").max = toLocalInput(S.data[S.n - 2].t);
    $("#jumpRange").textContent = "Available: " + fmtFull(S.data[0].t) + " → " + fmtFull(S.data[S.n - 2].t) + " (UTC)";
    openDialog($("#jumpModal"));
  }
  function toLocalInput(ts) {
    var d = new Date(ts);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()) +
      "T" + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
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
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "");
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
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
    setSeries(initial.id, tf);
    S.bars = clamp(Math.round(S.W / 8), 90, 210);
    resize();
    syncUI();
    renderFeed();
    updateStats();
    setPlayUI();
    setTool("cursor");
    startClock();

    /* theme */
    $("#themeToggle").addEventListener("click", function () {
      applyTheme(isLight() ? "dark" : "light");
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
    $("#toolbar").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-tool]");
      if (btn) setTool(btn.dataset.tool);
    });
    $("#clearBtn").addEventListener("click", function (e) {
      if (S.selected && !e.shiftKey) deleteSelected();
      else if (S.selected && e.shiftKey) { S.selected = null; clearDrawings(); }
      else clearDrawings();
    });
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
    $("#helpBtn").addEventListener("click", function () { openDialog($("#helpModal")); });

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
      if (e.key === " ") { e.preventDefault(); S.playing ? pause() : play(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); pause(); step(1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); pause(); step(-1); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (e.shiftKey) clearDrawings(); else deleteSelected();
        return;
      }
      if (e.key === "Escape") {
        if (S.draft) { S.draft = null; setTool("cursor"); }
        else if (S.selected) { S.selected = null; scheduleDraw(); }
        return;
      }
      var keys = { v: "cursor", t: "trend", h: "hline", l: "vline", r: "rect", f: "fib" };
      if (!mod && keys[e.key.toLowerCase()]) { setTool(keys[e.key.toLowerCase()]); return; }
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
