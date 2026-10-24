/* KyorakuReplay — chart engine
 * Canvas candles + volume + axes + crosshair + drawings + replay cursor.
 * No libraries. Coordinates are (bar index, price); everything else derives.
 */
(function (global) {
  "use strict";

  var UP_LIGHT = "#089981", DOWN_LIGHT = "#f23645";
  var UP_DARK = "#26a69a", DOWN_DARK = "#ef5350";

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function nice(v) { return Math.round(v * 1e6) / 1e6; }

  function KYChart(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts;
    this.data = [];
    this.bars = 150;          /* candles visible */
    this.offset = 0;          /* index of the rightmost visible candle */
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.zone = opts.zone || "UTC";
    this.showVolume = true;
    this.showEma = true;
    this.showGrid = true;
    this.showSessions = true;
    this.dp = 2;
    this.tick = 0.01;
    this.drawings = [];
    this.undoStack = [];
    this.pending = null;
    this.hover = null;
    this.cursor = null;       /* replay cursor index (last revealed bar) */
    this.tool = "cursor";
    this.onHover = null;
    this.onView = null;
    this.minBars = 20;
    this._bind();
    this._resize();
    var self = this;
    if (global.ResizeObserver) {
      this.ro = new ResizeObserver(function () { self._resize(); self.draw(); });
      this.ro.observe(canvas.parentElement || canvas);
    } else {
      global.addEventListener("resize", function () { self._resize(); self.draw(); });
    }
  }

  KYChart.prototype.theme = function () {
    var light = document.documentElement.getAttribute("data-theme") === "light";
    return light ? {
      bg: "#ffffff", grid: "rgba(16,24,40,.07)", axis: "rgba(16,24,40,.12)",
      txt: "#475467", txtStrong: "#101828", up: UP_LIGHT, down: DOWN_LIGHT,
      cross: "rgba(16,24,40,.45)", labelBg: "#101828", labelTx: "#ffffff",
      volUp: "rgba(8,153,129,.42)", volDown: "rgba(242,54,69,.42)",
      daySep: "rgba(16,24,40,.16)", ema1: "#2962ff", ema2: "#ff9800",
      lastGlow: "rgba(8,153,129,.12)", panel: "rgba(16,24,40,.03)"
    } : {
      bg: "#0d1117", grid: "rgba(255,255,255,.055)", axis: "rgba(255,255,255,.12)",
      txt: "#8b93a7", txtStrong: "#e9edf7", up: UP_DARK, down: DOWN_DARK,
      cross: "rgba(255,255,255,.5)", labelBg: "#2b3242", labelTx: "#ffffff",
      volUp: "rgba(38,166,154,.38)", volDown: "rgba(239,83,80,.38)",
      daySep: "rgba(255,255,255,.14)", ema1: "#2962ff", ema2: "#ff9800",
      lastGlow: "rgba(38,166,154,.12)", panel: "rgba(255,255,255,.02)"
    };
  };

  KYChart.prototype.setData = function (bars, meta) {
    this.data = bars || [];
    meta = meta || {};
    this.dp = meta.dp != null ? meta.dp : this.dp;
    this.tick = meta.tick || this.tick;
    this.drawings = meta.drawings || [];
    this.undoStack = [];
    this.cursor = this.data.length ? this.data.length - 1 : null;
    this.offset = this.data.length - 1;
    this.bars = clamp(Math.round(this.width / 7.2), 90, 220);
    this.offset = clamp(this.offset, this.bars - 1, Math.max(0, this.data.length - 1));
    this.draw();
  };

  KYChart.prototype.setCursor = function (i) {
    if (!this.data.length) return;
    this.cursor = clamp(i, 10, this.data.length - 1);
    this.offset = clamp(this.offset, 0, this.data.length - 1);
    this.draw();
  };

  KYChart.prototype.revealTo = function (i) {
    this.cursor = clamp(i, 10, this.data.length - 1);
    if (this.cursor > this.offset) this.offset = this.cursor;
    this.draw();
  };

  KYChart.prototype._resize = function () {
    var host = this.canvas.parentElement;
    var w = (host && host.clientWidth) || this.canvas.clientWidth || 800;
    var h = (host && host.clientHeight) || this.canvas.clientHeight || 460;
    this.width = Math.max(320, w);
    this.height = Math.max(240, h);
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  KYChart.prototype.layout = function () {
    var axisW = 64, axisH = 24;
    var volH = this.showVolume ? Math.round(this.height * 0.17) : 0;
    var gap = volH ? 8 : 0;
    var plotH = this.height - axisH;
    return {
      x: 0, y: 0, w: this.width - axisW, h: plotH,
      priceH: plotH - volH - gap, volY: plotH - volH, volH: volH,
      axisW: axisW, axisH: axisH
    };
  };

  KYChart.prototype.visible = function () {
    var n = this.data.length;
    if (!n) return { i0: 0, i1: 0, count: 0 };
    var count = clamp(Math.round(this.bars), this.minBars, n);
    var i1 = clamp(Math.round(this.offset), count - 1, n - 1);
    var i0 = Math.max(0, i1 - count + 1);
    return { i0: i0, i1: i1, count: i1 - i0 + 1 };
  };

  KYChart.prototype.priceRange = function (v, L) {
    var lo = Infinity, hi = -Infinity;
    for (var i = v.i0; i <= v.i1; i++) {
      var b = this.data[i];
      if (!b) continue;
      if (b[3] < lo) lo = b[3];
      if (b[2] > hi) hi = b[2];
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    var pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.001 || 1;
    lo -= pad; hi += pad;
    return { lo: lo, hi: hi };
  };

  KYChart.prototype.xOf = function (i, v, L) {
    var barW = L.w / v.count;
    return (i - v.i0 + 0.5) * barW;
  };
  KYChart.prototype.yOf = function (p, r, L) {
    return L.priceH - ((p - r.lo) / (r.hi - r.lo)) * L.priceH;
  };
  KYChart.prototype.priceAtY = function (y, r, L) {
    return r.lo + ((L.priceH - y) / L.priceH) * (r.hi - r.lo);
  };
  KYChart.prototype.indexAtX = function (x, v, L) {
    var barW = L.w / v.count;
    return Math.round(v.i0 + x / barW - 0.5);
  };

  KYChart.prototype.fmtPrice = function (p) {
    return Number(p).toLocaleString("en-US", { minimumFractionDigits: this.dp, maximumFractionDigits: this.dp });
  };
  KYChart.prototype.timeOf = function (ts) {
    var d = new Date(ts * 1000);
    var parts;
    try {
      parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: this.zone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false
      }).formatToParts(d);
    } catch (e) {
      return d.toISOString().slice(0, 16).replace("T", " ");
    }
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return { y: o.year, m: o.month, d: o.day, H: o.hour === "24" ? "00" : o.hour, M: o.minute,
             day: o.year + "-" + o.month + "-" + o.day, hm: (o.hour === "24" ? "00" : o.hour) + ":" + o.minute };
  };

  /* ---------------- drawing ---------------- */
  KYChart.prototype.draw = function () {
    var c = this.ctx, T = this.theme(), L = this.layout();
    c.save();
    c.clearRect(0, 0, this.width, this.height);
    c.fillStyle = T.bg;
    c.fillRect(0, 0, this.width, this.height);
    if (!this.data.length) {
      c.fillStyle = T.txt;
      c.font = "13px " + getComputedStyle(document.body).getPropertyValue("--sans");
      c.textAlign = "center";
      c.fillText("No candles for this instrument yet", this.width / 2, this.height / 2);
      c.restore();
      return;
    }
    var v = this.visible();
    var r = this.priceRange(v, L);
    this._v = v; this._r = r; this._L = L;

    if (this.showGrid) this._grid(T, L, v, r);
    if (this.showSessions) this._daySeparators(T, L, v);
    this._volume(T, L, v);
    if (this.showEma) { this._ema(T, L, v, r, 20, T.ema1); this._ema(T, L, v, r, 50, T.ema2); }
    this._candles(T, L, v, r);
    this._drawings(T, L, v, r);
    this._lastPrice(T, L, v, r);
    this._axes(T, L, v, r);
    if (this.hover) this._crosshair(T, L, v, r);
    if (this.cursor != null && this.cursor < this.data.length - 1) this._replayVeil(T, L, v, r);
    c.restore();
  };

  KYChart.prototype._grid = function (T, L, v, r) {
    var c = this.ctx, steps = 6;
    c.strokeStyle = T.grid; c.lineWidth = 1;
    c.beginPath();
    for (var k = 0; k <= steps; k++) {
      var y = Math.round((L.priceH / steps) * k) + 0.5;
      c.moveTo(0, y); c.lineTo(L.w, y);
    }
    var bars = 6;
    for (var j = 0; j <= bars; j++) {
      var x = Math.round((L.w / bars) * j) + 0.5;
      c.moveTo(x, 0); c.lineTo(x, L.h);
    }
    c.stroke();
  };

  KYChart.prototype._daySeparators = function (T, L, v) {
    var c = this.ctx;
    var last = null;
    c.save();
    c.setLineDash([3, 4]);
    c.strokeStyle = T.daySep;
    c.beginPath();
    for (var i = v.i0; i <= v.i1; i++) {
      var t = this.timeOf(this.data[i][0]);
      if (last && t.day !== last) {
        var x = Math.round(this.xOf(i, v, L) - (L.w / v.count) / 2) + 0.5;
        c.moveTo(x, 0); c.lineTo(x, L.h);
      }
      last = t.day;
    }
    c.stroke();
    c.restore();
  };

  KYChart.prototype._volume = function (T, L, v) {
    if (!this.showVolume) return;
    var c = this.ctx;
    var max = 0;
    for (var i = v.i0; i <= v.i1; i++) if (this.data[i][5] > max) max = this.data[i][5];
    if (!max) max = 1;
    var barW = L.w / v.count;
    var bw = Math.max(1, barW * 0.66);
    for (var j = v.i0; j <= v.i1; j++) {
      var b = this.data[j];
      if (this.cursor != null && j > this.cursor) continue;
      var h = (b[5] / max) * (L.volH - 12);
      var x = this.xOf(j, v, L) - bw / 2;
      c.fillStyle = b[4] >= b[1] ? T.volUp : T.volDown;
      c.fillRect(x, L.volY + (L.volH - h), bw, h);
    }
  };

  KYChart.prototype._ema = function (T, L, v, r, period, color) {
    var c = this.ctx;
    var k = 2 / (period + 1), ema = null, started = false;
    var pts = [];
    for (var i = 0; i <= v.i1; i++) {
      var close = this.data[i][4];
      if (!started) {
        if (i < period) { ema = ema == null ? close : ema + close; continue; }
        ema = ema / period; started = true;
      } else {
        ema = close * k + ema * (1 - k);
      }
      if (i >= v.i0) pts.push([this.xOf(i, v, L), this.yOf(ema, r, L)]);
    }
    if (pts.length < 2) return;
    c.save();
    c.beginPath();
    c.rect(0, 0, L.w, L.priceH);
    c.clip();
    c.strokeStyle = color;
    c.globalAlpha = 0.9;
    c.lineWidth = 1.4;
    c.beginPath();
    pts.forEach(function (p, idx) { idx ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
    c.stroke();
    c.restore();
  };

  KYChart.prototype._candles = function (T, L, v, r) {
    var c = this.ctx;
    var barW = L.w / v.count;
    var bw = Math.max(1, Math.min(barW * 0.72, 18));
    c.save();
    c.beginPath();
    c.rect(0, 0, L.w, L.priceH);
    c.clip();
    for (var i = v.i0; i <= v.i1; i++) {
      var b = this.data[i];
      if (this.cursor != null && i > this.cursor) continue;
      var up = b[4] >= b[1];
      var col = up ? T.up : T.down;
      var x = this.xOf(i, v, L);
      var yO = this.yOf(b[1], r, L), yC = this.yOf(b[4], r, L);
      var yH = this.yOf(b[2], r, L), yL = this.yOf(b[3], r, L);
      c.strokeStyle = col;
      c.fillStyle = col;
      c.lineWidth = Math.max(1, Math.min(barW * 0.12, 1.4));
      c.beginPath();
      c.moveTo(Math.round(x) + 0.5, yH);
      c.lineTo(Math.round(x) + 0.5, yL);
      c.stroke();
      var top = Math.min(yO, yC), hgt = Math.max(1, Math.abs(yC - yO));
      if (bw <= 1.6) {
        c.fillRect(Math.round(x) - 0.5, top, 1.2, hgt);
      } else if (up) {
        c.fillRect(x - bw / 2, top, bw, hgt);
      } else {
        c.fillRect(x - bw / 2, top, bw, hgt);
      }
    }
    c.restore();
  };

  KYChart.prototype._axes = function (T, L, v, r) {
    var c = this.ctx;
    c.strokeStyle = T.axis;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(L.w + 0.5, 0); c.lineTo(L.w + 0.5, L.h);
    c.moveTo(0, L.h + 0.5); c.lineTo(this.width, L.h + 0.5);
    c.stroke();

    c.fillStyle = T.txt;
    c.font = "11px -apple-system, Segoe UI, Roboto, sans-serif";
    c.textAlign = "left";
    c.textBaseline = "middle";
    var steps = 6;
    for (var k = 0; k <= steps; k++) {
      var y = (L.priceH / steps) * k;
      var price = r.hi - ((r.hi - r.lo) / steps) * k;
      if (y > L.priceH - 4) continue;
      c.fillText(this.fmtPrice(price), L.w + 9, y + 6);
    }
    /* volume axis caption */
    if (this.showVolume) {
      c.fillStyle = T.txt;
      c.globalAlpha = 0.7;
      c.fillText("Vol", L.w + 9, L.volY + 10);
      c.globalAlpha = 1;
    }

    /* time labels */
    c.textBaseline = "top";
    var barW = L.w / v.count;
    var want = Math.max(60, barW * 9);
    var stepBars = Math.max(1, Math.ceil(want / barW));
    c.textAlign = "center";
    for (var i = v.i0; i <= v.i1; i += stepBars) {
      var t = this.timeOf(this.data[i][0]);
      var x = this.xOf(i, v, L);
      if (x < 26 || x > L.w - 26) continue;
      c.fillStyle = T.txt;
      c.fillText(t.hm, x, L.h + 6);
    }
    c.restore && c.restore();
  };

  KYChart.prototype._lastPrice = function (T, L, v, r) {
    var b = this.data[Math.min(v.i1, this.cursor == null ? v.i1 : this.cursor)];
    if (!b) return;
    var c = this.ctx;
    var y = this.yOf(b[4], r, L);
    var up = b[4] >= b[1];
    c.save();
    c.setLineDash([2, 3]);
    c.strokeStyle = up ? T.up : T.down;
    c.globalAlpha = .8;
    c.beginPath();
    c.moveTo(0, Math.round(y) + 0.5);
    c.lineTo(L.w, Math.round(y) + 0.5);
    c.stroke();
    c.restore();
    var label = this.fmtPrice(b[4]);
    c.font = "600 11px -apple-system, Segoe UI, Roboto, sans-serif";
    var w = c.measureText(label).width + 14;
    c.fillStyle = up ? T.up : T.down;
    roundRect(c, L.w + 2, y - 9, Math.max(w, 58), 18, 3);
    c.fill();
    c.fillStyle = "#fff";
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText(label, L.w + 9, y + 0.5);
  };

  KYChart.prototype._crosshair = function (T, L, v, r) {
    var c = this.ctx, h = this.hover;
    var x = this.xOf(h.index, v, L);
    var y = clamp(h.y, 0, L.priceH);
    c.save();
    c.setLineDash([3, 3]);
    c.strokeStyle = T.cross;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(Math.round(x) + 0.5, 0); c.lineTo(Math.round(x) + 0.5, L.h);
    c.moveTo(0, Math.round(y) + 0.5); c.lineTo(L.w, Math.round(y) + 0.5);
    c.stroke();
    c.restore();
    var price = this.priceAtY(y, r, L);
    var label = this.fmtPrice(price);
    c.font = "600 11px -apple-system, Segoe UI, Roboto, sans-serif";
    var tw = c.measureText(label).width + 14;
    c.fillStyle = T.labelBg;
    roundRect(c, L.w + 2, y - 9, Math.max(tw, 58), 18, 3);
    c.fill();
    c.fillStyle = T.labelTx;
    c.textAlign = "left"; c.textBaseline = "middle";
    c.fillText(label, L.w + 9, y + 0.5);

    var t = this.timeOf(this.data[h.index][0]);
    var tl = t.day + " " + t.hm;
    var bw = c.measureText(tl).width + 16;
    c.fillStyle = T.labelBg;
    roundRect(c, clamp(x - bw / 2, 0, L.w - bw), L.h + 3, bw, 18, 3);
    c.fill();
    c.fillStyle = T.labelTx;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(tl, clamp(x, bw / 2, L.w - bw / 2), L.h + 12.5);
  };

  KYChart.prototype._replayVeil = function (T, L, v, r) {
    if (this.cursor == null) return;
    var c = this.ctx;
    var x = this.xOf(this.cursor, v, L) + (L.w / v.count) / 2;
    if (x >= L.w) return;
    c.save();
    c.fillStyle = T.panel;
    c.fillRect(x, 0, L.w - x, L.h);
    c.strokeStyle = T.cross;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(x, 0); c.lineTo(x, L.h);
    c.stroke();
    c.restore();
  };

  /* ---------------- drawings ---------------- */
  KYChart.prototype._pt = function (index, price) {
    var v = this._v, r = this._r, L = this._L;
    return [this.xOf(index, v, L), this.yOf(price, r, L)];
  };

  KYChart.prototype._drawings = function (T, L, v, r) {
    var c = this.ctx;
    var self = this;
    c.save();
    c.beginPath();
    c.rect(0, 0, L.w, L.h);
    c.clip();
    (this.drawings || []).forEach(function (d) { self._oneDrawing(c, d, T); });
    if (this.pending && this.pending.points.length) {
      var preview = JSON.parse(JSON.stringify(this.pending));
      if (this.hover) preview.points.push([this.hover.index, this.priceAtY(this.hover.y, r, L)]);
      self._oneDrawing(c, preview, T, true);
    }
    c.restore();
  };

  KYChart.prototype._oneDrawing = function (c, d, T, preview) {
    var pts = d.points || [];
    if (!pts.length) return;
    var p = pts.map(function (q) { return this._pt(q[0], q[1]); }.bind(this));
    var col = d.color || (T === this.theme() ? "#7c6cff" : "#7c6cff");
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineWidth = preview ? 1.2 : 1.6;
    c.globalAlpha = preview ? 0.7 : 1;
    if (d.type === "hline") {
      c.beginPath();
      c.moveTo(0, p[0][1]); c.lineTo(this._L.w, p[0][1]);
      c.stroke();
      c.font = "600 10px -apple-system, Segoe UI, Roboto, sans-serif";
      var txt = this.fmtPrice(d.points[0][1]);
      var tw = c.measureText(txt).width + 12;
      c.fillStyle = col;
      roundRect(c, this._L.w + 2, p[0][1] - 8, Math.max(tw, 54), 16, 3);
      c.fill();
      c.fillStyle = "#fff";
      c.textAlign = "left"; c.textBaseline = "middle";
      c.fillText(txt, this._L.w + 8, p[0][1]);
    } else if (d.type === "trend" && pts.length >= 2) {
      var a = p[0], b = p[1];
      c.beginPath();
      c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
      c.stroke();
      [a, b].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], 3, 0, 7); c.fill(); });
    } else if (d.type === "rect" && pts.length >= 2) {
      var x = Math.min(p[0][0], p[1][0]), y = Math.min(p[0][1], p[1][1]);
      var w = Math.abs(p[1][0] - p[0][0]), h = Math.abs(p[1][1] - p[0][1]);
      c.globalAlpha = preview ? 0.12 : 0.16;
      c.fillRect(x, y, w, h);
      c.globalAlpha = preview ? 0.7 : 1;
      c.strokeRect(x, y, w, h);
    } else if (d.type === "fib" && pts.length >= 2) {
      var lo = Math.min(p[0][1], p[1][1]), hi = Math.max(p[0][1], p[1][1]);
      var x0 = Math.min(p[0][0], p[1][0]), x1 = Math.max(p[0][0], p[1][0]);
      var levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      c.font = "10px -apple-system, Segoe UI, Roboto, sans-serif";
      c.textAlign = "left"; c.textBaseline = "middle";
      levels.forEach(function (lv) {
        var y = lo + (hi - lo) * lv;
        c.globalAlpha = lv === 0 || lv === 1 ? .85 : .5;
        c.beginPath();
        c.moveTo(x0 - 20, y); c.lineTo(x1 + 20, y);
        c.stroke();
        c.globalAlpha = .9;
        c.fillStyle = col;
        c.fillText((lv * 100).toFixed(1) + "%", x1 + 24, y);
      });
      c.globalAlpha = 1;
      c.fillStyle = col;
    } else if (d.type === "long" && pts.length >= 2) {
      var ex = p[0], st = p[1];
      var boxW = 46;
      var risk = Math.abs(st[1] - ex[1]);
      c.fillStyle = "rgba(8,153,129,.18)";
      c.fillRect(ex[0], Math.min(ex[1], ex[1] - risk * 2), boxW, risk * 2);
      c.fillStyle = "rgba(242,54,69,.18)";
      c.fillRect(ex[0], Math.max(ex[1], ex[1] + risk), boxW, risk);
      c.strokeStyle = T.up;
      c.strokeRect(ex[0], Math.min(ex[1], ex[1] - risk * 2), boxW, risk * 2);
      c.strokeStyle = T.down;
      c.strokeRect(ex[0], Math.max(ex[1], ex[1] + risk), boxW, risk);
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]);
      c.stroke();
    }
    c.globalAlpha = 1;
  };

  KYChart.prototype.addDrawing = function (d) {
    this.drawings.push(d);
    this.undoStack.push({ type: "add", drawing: d });
    this.draw();
  };
  KYChart.prototype.undo = function () {
    var act = this.undoStack.pop();
    if (!act) return false;
    if (act.type === "add") {
      var i = this.drawings.indexOf(act.drawing);
      if (i >= 0) this.drawings.splice(i, 1);
    }
    this.draw();
    return true;
  };
  KYChart.prototype.clearDrawings = function () {
    this.undoStack.push({ type: "clear", drawings: this.drawings.slice() });
    this.drawings = [];
    this.draw();
  };

  /* ---------------- interaction ---------------- */
  KYChart.prototype._pos = function (ev) {
    var rect = this.canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };

  KYChart.prototype._hit = function (pos) {
    var v = this._v, r = this._r, L = this._L;
    if (!v || !r) return null;
    var index = clamp(this.indexAtX(pos.x, v, L), v.i0, v.i1);
    return { index: index, price: this.priceAtY(pos.y, r, L), x: pos.x, y: pos.y };
  };

  KYChart.prototype._bind = function () {
    var self = this, dragging = false, lastX = 0, moved = 0;

    this.canvas.addEventListener("pointermove", function (ev) {
      var pos = self._pos(ev);
      var h = self._hit(pos);
      if (dragging) {
        var barW = self._L.w / self._v.count;
        var shift = Math.round((lastX - pos.x) / barW);
        if (shift) {
          self.offset = clamp(self.offset + shift, Math.min(self.bars - 1, self.data.length - 1), self.data.length - 1);
          lastX = pos.x;
          moved += Math.abs(shift);
          self.draw();
        }
      }
      if (h) { self.hover = h; if (!dragging) self.draw(); }
      if (self.onHover && h) self.onHover(h);
    });

    this.canvas.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0) return;
      var pos = self._pos(ev);
      var h = self._hit(pos);
      dragging = true; lastX = pos.x; moved = 0;
      try { self.canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      if (self.tool !== "cursor" && h) {
        if (!self.pending) self.pending = { type: self.tool, points: [[h.index, h.price]], color: "#7c6cff" };
        else {
          self.pending.points.push([h.index, h.price]);
          self.addDrawing(self.pending);
          self.pending = null;
          if (!self.opts.stickyTools) self.setTool("cursor");
        }
      }
    });

    this.canvas.addEventListener("pointerup", function (ev) {
      dragging = false;
      try { self.canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
    });
    this.canvas.addEventListener("pointerleave", function () {
      dragging = false;
      self.hover = null;
      self.draw();
      if (self.onHover) self.onHover(null);
    });

    this.canvas.addEventListener("dblclick", function () {
      self.offset = Math.min(self.data.length - 1, self.cursor == null ? self.data.length - 1 : self.cursor);
      self.bars = clamp(Math.round(self.width / 7.2), 90, 220);
      self.draw();
    });

    this.canvas.addEventListener("wheel", function (ev) {
      if (!self.data.length) return;
      ev.preventDefault();
      var pos = self._pos(ev);
      var L = self._L, v = self._v;
      var dir = ev.deltaY > 0 ? 1 : -1;
      var factor = dir > 0 ? 1.12 : 1 / 1.12;
      var anchor = self.indexAtX(pos.x, v, L);
      var before = (anchor - v.i0) / v.count;
      var next = clamp(Math.round(self.bars * factor), self.minBars, self.data.length);
      self.bars = next;
      var count = clamp(Math.round(self.bars), self.minBars, self.data.length);
      var right = clamp(Math.round(anchor + count * (1 - before)), count - 1, self.data.length - 1);
      self.offset = right;
      self.draw();
    }, { passive: false });

    global.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
        if (self.opts.suppressKeys) return;
      }
    });
  };

  KYChart.prototype.setTool = function (t) {
    this.tool = t;
    this.pending = null;
    this.canvas.style.cursor = t === "cursor" ? "crosshair" : "copy";
    this.draw();
  };

  KYChart.prototype.exportDrawings = function () { return JSON.parse(JSON.stringify(this.drawings)); };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* chart used on the landing page: tiny, no interaction */
  KYChart.sparkline = function (canvas, bars, T) {
    var c = canvas.getContext("2d");
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = canvas.parentElement.clientWidth || 600;
    var h = canvas.parentElement.clientHeight || 300;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    if (!bars || bars.length < 2) return;
    var slice = bars.slice(-Math.min(140, bars.length));
    var lo = Infinity, hi = -Infinity;
    slice.forEach(function (b) { lo = Math.min(lo, b[3]); hi = Math.max(hi, b[2]); });
    var pad = (hi - lo) * 0.12 || 1;
    lo -= pad; hi += pad;
    var x = function (i) { return (i / (slice.length - 1)) * (w - 16) + 8; };
    var y = function (p) { return h - 14 - ((p - lo) / (hi - lo)) * (h - 34); };
    /* area */
    var grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(38,166,154,.26)");
    grad.addColorStop(1, "rgba(38,166,154,0)");
    c.beginPath();
    slice.forEach(function (b, i) { i ? c.lineTo(x(i), y(b[4])) : c.moveTo(x(i), y(b[4])); });
    c.lineTo(x(slice.length - 1), h);
    c.lineTo(x(0), h);
    c.closePath();
    c.fillStyle = grad;
    c.fill();
    c.beginPath();
    slice.forEach(function (b, i) { i ? c.lineTo(x(i), y(b[4])) : c.moveTo(x(i), y(b[4])); });
    c.strokeStyle = T && T.up || "#26a69a";
    c.lineWidth = 1.8;
    c.stroke();
  };

  global.KYChart = KYChart;
})(window);
