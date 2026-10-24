/* KyorakuReplay — terminal wiring */
(function () {
  "use strict";

  var F = window.KYFeed, S = window.KYStore;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var qs = new URLSearchParams(location.search);
  var st = S.state();
  var user = S.current();

  var state = {
    asset: F.get(qs.get("sym") || st.symbol || "NQ"),
    tf: F.TF_LIST.indexOf(qs.get("tf")) >= 0 ? qs.get("tf") : (st.tf || "15m"),
    bars: [],
    loading: false,
    replay: false,
    playing: false,
    speed: 450,
    timer: null,
    price: null
  };

  var chart = new window.KYChart($("#chart"), {
    zone: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } })(),
    onHover: onHover
  });

  /* ---------------- UI helpers ---------------- */
  var toastTimer = null;
  function toast(msg, err) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 2800);
  }
  function fmt(p, dp) {
    if (p == null || !isFinite(p)) return "—";
    return Number(p).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function pct(a, b) {
    if (!b) return 0;
    return ((a - b) / b) * 100;
  }
  function money(v) {
    return (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* ---------------- segments ---------------- */
  function buildSegments() {
    var tf = $("#tfSeg");
    tf.innerHTML = F.TF_LIST.map(function (t) {
      return '<button data-tf="' + t + '" class="' + (t === state.tf ? "on" : "") + '">' + t + "</button>";
    }).join("");
    tf.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tf]");
      if (!b) return;
      setTf(b.dataset.tf);
    });
    var rg = $("#rangeSeg");
    rg.innerHTML = ["1D", "5D", "1M", "3M", "6M", "1Y", "ALL"].map(function (k) {
      return '<button data-range="' + k + '">' + k + "</button>";
    }).join("");
    rg.addEventListener("click", function (e) {
      var b = e.target.closest("[data-range]");
      if (!b) return;
      $$("#rangeSeg button").forEach(function (x) { x.classList.toggle("on", x === b); });
      var span = F.RANGE_MS[b.dataset.range];
      var step = F.TF[state.tf] * 1000;
      var n = b.dataset.range === "ALL" ? state.bars.length : Math.round(span / step);
      chart.bars = Math.max(20, Math.min(n, state.bars.length));
      chart.draw();
    });
  }

  /* ---------------- legend / status ---------------- */
  function renderLegend(hover) {
    var a = state.asset;
    var i = hover && hover.index != null ? hover.index : Math.min(state.bars.length - 1, chart.cursor == null ? state.bars.length - 1 : chart.cursor);
    var b = state.bars[i];
    if (!b) return;
    var prev = state.bars[i - 1];
    var chg = prev ? pct(b[4], prev[4]) : 0;
    $("#lgSym").textContent = a.label;
    $("#lgTf").textContent = a.venue + " · " + state.tf;
    var chgEl = $("#lgChg");
    chgEl.textContent = (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%";
    chgEl.className = "legend__chg " + (chg >= 0 ? "up" : "down");
    $("#lgOhlc").innerHTML =
      "<span><i>O</i> " + fmt(b[1], a.dp) + "</span>" +
      "<span><i>H</i> " + fmt(b[2], a.dp) + "</span>" +
      "<span><i>L</i> " + fmt(b[3], a.dp) + "</span>" +
      "<span><i>C</i> " + fmt(b[4], a.dp) + "</span>" +
      (b[5] ? "<span><i>V</i> " + Number(b[5]).toLocaleString("en-US") + "</span>" : "");
  }

  function renderStatus() {
    var a = state.asset;
    $("#symLabel").textContent = a.label;
    $("#symName").textContent = a.name + " · " + a.venue;
    $("#stSymbol").textContent = a.id + " · " + a.symbol + " · " + a.venue;
    if (state.bars.length) {
      var t0 = chart.timeOf(state.bars[0][0]), t1 = chart.timeOf(state.bars[state.bars.length - 1][0]);
      $("#stRange").textContent = t0.day + " → " + t1.day;
      $("#stBars").textContent = state.bars.length.toLocaleString("en-US") + " candles";
    } else {
      $("#stRange").textContent = "—";
      $("#stBars").textContent = "no candles";
    }
    try { $("#stTz").textContent = chart.zone; } catch (e) {}
    $("#stFeed").textContent = state.feedLine || "—";
  }

  function setPill(kind, text, title) {
    var p = $("#srcPill");
    p.className = "pill " + kind;
    $("#srcText").textContent = text;
    p.title = title || text;
  }

  /* ---------------- load ---------------- */
  function load(keepCursor) {
    var a = state.asset;
    state.loading = true;
    setPill("", "loading…");
    $("#chartNote").hidden = true;
    if (!keepCursor) exitReplay(true);

    return F.load(a.id, state.tf).then(function (doc) {
      state.bars = doc.bars;
      state.doc = doc;
      state.loading = false;
      var last = doc.bars[doc.bars.length - 1];
      state.price = last ? last[4] : null;
      chart.setData(doc.bars, { dp: a.dp, tick: a.tick, drawings: st.drawings[a.id] || [] });
      var alive = doc.transport === "live";
      setPill(alive ? "live" : "snap", alive ? "LIVE · " + doc.provider : "SNAPSHOT · " + doc.provider,
        doc.symbol + " · fetched " + new Date(doc.fetchedAt).toLocaleTimeString());
      var minutes = Math.max(0, Math.round((Date.now() - doc.fetchedAt) / 60000));
      state.feedLine = doc.provider + " " + doc.symbol + " · " + (alive ? "live" : minutes + " min old");
      $("#chartNote").hidden = true;
      persist({ symbol: a.id, tf: state.tf });
      renderLegend();
      renderStatus();
      renderWatch();
      paintQuotes();
      renderPositions();
      return doc;
    }).catch(function (err) {
      state.loading = false;
      state.bars = [];
      chart.setData([], { dp: a.dp, tick: a.tick });
      setPill("dead", "no data", String(err && err.message || err));
      state.feedLine = "unreachable";
      $("#chartNote").hidden = false;
      $("#chartNote").textContent = "The feed could not be reached for " + a.id +
        ". Nothing is drawn, because a chart with invented candles is worse than no chart. Retry in a moment or pick another instrument.";
      renderStatus();
      renderLegend();
      throw err;
    });
  }

  function persist(patch) {
    st = S.patch(function (s) { Object.assign(s, patch); });
  }

  function setSymbol(id) {
    state.asset = F.get(id);
    if (st.watchlist.indexOf(state.asset.id) === -1) {
      st.watchlist = st.watchlist.concat([state.asset.id]).slice(0, 14);
      S.save(st);
    }
    history.replaceState(null, "", "?sym=" + encodeURIComponent(state.asset.id) + "&tf=" + state.tf);
    load();
  }

  function setTf(tf) {
    state.tf = tf;
    $$("#tfSeg button").forEach(function (b) { b.classList.toggle("on", b.dataset.tf === tf); });
    persist({ tf: tf });
    history.replaceState(null, "", "?sym=" + encodeURIComponent(state.asset.id) + "&tf=" + tf);
    load();
  }

  function onHover(h) {
    renderLegend(h || null);
  }

  /* ---------------- watchlist ---------------- */
  function renderWatch() {
    var wl = st.watchlist.length ? st.watchlist : ["NQ", "ES", "NAS100"];
    var box = $("#wlList");
    box.innerHTML = wl.map(function (id) {
      var a = F.get(id);
      return '<div class="wl__row ' + (id === state.asset.id ? "on" : "") + '" data-sym="' + id + '">' +
        '<span><b>' + esc(a.label) + "</b><small>" + esc(a.venue) + "</small></span>" +
        '<span class="wl__px" data-px="' + id + '">—</span>' +
        '<span class="wl__chg" data-chg="' + id + '">—</span>' +
        '<button class="wl__x" data-remove="' + id + '" title="Remove">×</button>' +
        "</div>";
    }).join("");
  }

  function paintQuotes() {
    F.quotes(st.watchlist).then(function (q) {
      Object.keys(q).forEach(function (id) {
        var row = q[id];
        if (!row || !row.last) return;
        var px = document.querySelector('[data-px="' + id + '"]');
        var ch = document.querySelector('[data-chg="' + id + '"]');
        var a = F.get(id);
        if (px) px.textContent = fmt(row.last, a.dp);
        if (ch && row.prev) {
          var d = pct(row.last, row.prev);
          ch.textContent = (d >= 0 ? "+" : "") + d.toFixed(2) + "%";
          ch.className = "wl__chg " + (d >= 0 ? "up" : "down");
        }
      });
    }).catch(function () {});
  }

  /* ---------------- positions / journal ---------------- */
  function lastPrice() {
    var i = chart.cursor == null ? state.bars.length - 1 : chart.cursor;
    var b = state.bars[i];
    return b ? b[4] : null;
  }

  function openTrade(side) {
    var px = lastPrice();
    if (px == null) { toast("No price to trade yet", true); return; }
    var qty = Math.max(1, parseInt($("#qtyInput").value, 10) || 1);
    var stopTicks = Math.max(0, parseInt($("#riskInput").value, 10) || 0);
    var a = state.asset;
    st.trades.push({
      id: S.uid(), sym: a.id, side: side, qty: qty,
      entry: px, stop: stopTicks ? px + (side === "long" ? -1 : 1) * stopTicks * a.tick : null,
      stopTicks: stopTicks, openedAt: Date.now(), tf: state.tf
    });
    S.save(st);
    renderPositions();
    toast((side === "long" ? "Long " : "Short ") + qty + " " + a.label + " @ " + fmt(px, a.dp));
  }

  function renderPositions() {
    var a = state.asset;
    var px = lastPrice();
    var box = $("#posList");
    if (!st.trades.length) {
      box.innerHTML = '<p class="empty">No open positions. Use the ticket below the rail.</p>';
      return;
    }
    box.innerHTML = st.trades.map(function (t) {
      var asset = F.get(t.sym);
      var cur = t.sym === a.id ? px : t.entry;
      var ticks = (cur - t.entry) / (asset.tick || 0.01) * (t.side === "long" ? 1 : -1);
      var pnl = t.qty * ticks * (asset.tickValue || 1);
      var un = t.sym === a.id;
      return '<div class="ord">' +
        '<div class="ord__top"><span class="ord__side ' + t.side + '">' + (t.side === "long" ? "LONG" : "SHORT") + "</span>" +
        "<b>" + esc(asset.label) + "</b><span style=\"margin-left:auto\" class=\"" + (pnl >= 0 ? "up" : "down") + "\">" +
        (un ? money(pnl) : "—") + "</span></div>" +
        '<div class="ord__row"><span>' + t.qty + " × " + (asset.contract || asset.name) + "</span><span>" + fmt(t.entry, asset.dp) + "</span></div>" +
        '<div class="ord__row"><span>now</span><span>' + (un ? fmt(cur, asset.dp) : "switch symbol") + "</span></div>" +
        (t.stop ? '<div class="ord__row"><span>stop</span><span>' + fmt(t.stop, asset.dp) + "</span></div>" : "") +
        '<button class="btn btn--ghost btn--sm ord__close" data-close="' + t.id + '">Close</button>' +
        "</div>";
    }).join("");
  }

  function closeTrade(id) {
    var i = st.trades.findIndex(function (t) { return t.id === id; });
    if (i < 0) return;
    var t = st.trades[i];
    var a = F.get(t.sym);
    var px = t.sym === state.asset.id ? lastPrice() : t.entry;
    var ticks = (px - t.entry) / (a.tick || 0.01) * (t.side === "long" ? 1 : -1);
    var pnl = t.qty * ticks * (a.tickValue || 1);
    st.trades.splice(i, 1);
    st.journal.unshift({
      id: t.id, sym: t.sym, side: t.side, qty: t.qty, entry: t.entry, exit: px,
      pnl: pnl, ticks: ticks, at: Date.now(), tf: t.tf
    });
    S.save(st);
    renderPositions();
    renderJournal();
    toast("Closed " + a.label + " · " + money(pnl), pnl < 0);
  }

  function renderJournal() {
    var body = $("#jrnBody");
    if (!st.journal.length) {
      body.innerHTML = "";
      $("#jrnEmpty").hidden = false;
      return;
    }
    $("#jrnEmpty").hidden = true;
    body.innerHTML = st.journal.slice(0, 40).map(function (j) {
      var d = new Date(j.at);
      return "<tr><td>" + d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + "</td><td>" + j.sym +
        "</td><td class=\"num " + (j.pnl >= 0 ? "up" : "down") + "\">" + money(j.pnl) + "</td></tr>";
    }).join("");
  }

  /* ---------------- replay ---------------- */
  function enterReplay() {
    if (!state.bars.length) return;
    state.replay = true;
    $("#replaybar").hidden = false;
    $("#replayBtn").classList.add("on");
    var start = Math.max(20, Math.floor(state.bars.length * 0.55));
    var from = qs.get("at") ? state.bars.findIndex(function (b) { return b[0] >= Number(qs.get("at")) / 1000; }) : -1;
    chart.setCursor(from > 10 ? from : start);
    /* keep a few future candles on screen so the veil is visible, like a replay
       desk: the bar you are about to trade sits near the right edge */
    chart.offset = Math.min(state.bars.length - 1, chart.cursor + 3);
    chart.draw();
    updateReplayPos();
  }
  function exitReplay(silent) {
    if (!state.replay) return;
    state.replay = false;
    stop();
    $("#replaybar").hidden = true;
    $("#replayBtn").classList.remove("on");
    if (!silent && state.bars.length) {
      chart.setCursor(state.bars.length - 1);
      chart.offset = state.bars.length - 1;
      chart.draw();
    }
  }
  function play() {
    if (!state.replay) enterReplay();
    state.playing = true;
    $("#playBtn").innerHTML = '<svg class="ic"><use href="#i-pause"/></svg>';
    tick();
  }
  function stop() {
    state.playing = false;
    clearTimeout(state.timer);
    $("#playBtn").innerHTML = '<svg class="ic"><use href="#i-play"/></svg>';
  }
  function tick() {
    if (!state.playing) return;
    if (chart.cursor >= state.bars.length - 1) { stop(); toast("End of the loaded data"); return; }
    chart.revealTo(chart.cursor + 1);
    if (chart.offset - chart.cursor < 3) chart.offset = Math.min(state.bars.length - 1, chart.cursor + 3);
    state.price = state.bars[chart.cursor][4];
    renderLegend();
    renderPositions();
    updateReplayPos();
    state.timer = setTimeout(tick, state.speed);
  }
  function step() {
    stop();
    if (!state.replay) enterReplay();
    if (chart.cursor >= state.bars.length - 1) return;
    chart.revealTo(chart.cursor + 1);
    renderLegend();
    renderPositions();
    updateReplayPos();
  }
  function updateReplayPos() {
    if (chart.cursor == null) return;
    var b = state.bars[chart.cursor];
    if (!b) return;
    var t = chart.timeOf(b[0]);
    $("#replayPos").textContent = t.day + " " + t.hm + " · " + (chart.cursor + 1) + "/" + state.bars.length;
  }

  /* ---------------- csv ---------------- */
  function downloadCsv() {
    if (!state.bars.length) { toast("No candles to export", true); return; }
    var rows = ["time,open,high,low,close,volume"];
    for (var i = 0; i < state.bars.length; i++) {
      var b = state.bars[i];
      rows.push([new Date(b[0] * 1000).toISOString(), b[1], b[2], b[3], b[4], b[5] || 0].join(","));
    }
    var name = state.asset.id + "_" + state.tf + "_" + (state.doc ? state.doc.provider : "feed") + ".csv";
    var blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    toast("Saved " + name + " · " + (rows.length - 1).toLocaleString("en-US") + " candles");
  }

  /* ---------------- symbol modal ---------------- */
  function renderSearch(q) {
    var list = F.search(q);
    var box = $("#symList");
    if (!list.length) { box.innerHTML = '<p class="empty">Nothing matches “' + esc(q) + '”.</p>'; return; }
    var groups = {};
    list.forEach(function (a) { (groups[a.market] = groups[a.market] || []).push(a); });
    var html = "";
    F.MARKETS.forEach(function (m) {
      if (!groups[m]) return;
      html += '<p class="sym-group">' + m + " · " + groups[m].length + "</p>";
      html += groups[m].map(function (a) {
        return '<button class="sym-item ' + (a.id === state.asset.id ? "on" : "") + '" data-sym="' + a.id + '">' +
          '<span class="k">' + esc(a.id.slice(0, 4)) + "</span>" +
          '<span class="m"><b>' + esc(a.label) + "</b><small>" + esc(a.name) + "</small></span>" +
          '<span class="v">' + esc(a.venue) + "</span></button>";
      }).join("");
    });
    box.innerHTML = html;
  }
  function openSearch() {
    $("#symModal").hidden = false;
    var input = $("#symSearch");
    input.value = "";
    renderSearch("");
    setTimeout(function () { input.focus(); }, 30);
  }
  function closeSearch() { $("#symModal").hidden = true; }

  /* ---------------- user modal ---------------- */
  function openUser() {
    var u = S.current();
    $("#userModal").hidden = false;
    if (!u) {
      $("#userTitle").textContent = "Account";
      $("#userBody").innerHTML =
        '<p style="color:var(--muted);font-size:13px;margin-bottom:14px">You are replaying as a guest. Create a free account to keep your sessions, trades and drawings per email.</p>' +
        '<a class="btn btn--primary btn--block" href="signup.html">Create free account</a>' +
        '<a class="btn btn--ghost btn--block" href="login.html" style="margin-top:8px">Log in</a>';
      return;
    }
    var closed = st.journal.length;
    var pnl = st.journal.reduce(function (s, j) { return s + j.pnl; }, 0);
    $("#userTitle").textContent = u.name;
    $("#userBody").innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span class="avatar">' + esc(u.initials) + "</span>" +
      "<span><b style=\"display:block;font-size:13px\">" + esc(u.name) + "</b><span style=\"color:var(--muted);font-size:12px\">" + esc(u.email) + "</span></span></div>" +
      '<div class="ord__row"><span>Trades closed</span><span>' + closed + "</span></div>" +
      '<div class="ord__row"><span>Net P&amp;L</span><span class="' + (pnl >= 0 ? "up" : "down") + '">' + (pnl >= 0 ? "+" : "") + "$" + pnl.toFixed(2) + "</span></div>" +
      '<a class="btn btn--ghost btn--block" href="dashboard.html" style="margin-top:12px">Open dashboard</a>' +
      '<button class="btn btn--block" id="logoutBtn" style="margin-top:8px">Log out</button>';
    var lb = $("#logoutBtn");
    if (lb) lb.onclick = function () { S.logout(); location.href = "index.html"; };
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    buildSegments();
    renderWatch();
    renderJournal();
    paintQuotes();
    setInterval(paintQuotes, 60000);

    $("#symBtn").onclick = openSearch;
    $("#symClose").onclick = closeSearch;
    $("#symSearch").addEventListener("input", function (e) { renderSearch(e.target.value); });
    $("#symList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-sym]");
      if (!b) return;
      closeSearch();
      setSymbol(b.dataset.sym);
    });
    $("#symModal").addEventListener("click", function (e) { if (e.target.id === "symModal") closeSearch(); });

    $("#wlList").addEventListener("click", function (e) {
      var rm = e.target.closest("[data-remove]");
      if (rm) {
        e.stopPropagation();
        st.watchlist = st.watchlist.filter(function (x) { return x !== rm.dataset.remove; });
        S.save(st);
        renderWatch(); paintQuotes();
        return;
      }
      var row = e.target.closest("[data-sym]");
      if (row) setSymbol(row.dataset.sym);
    });

    $("#posList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-close]");
      if (b) closeTrade(b.dataset.close);
    });

    $$("[data-tool]").forEach(function (b) {
      b.onclick = function () {
        $$("[data-tool]").forEach(function (x) { x.classList.toggle("on", x === b); });
        chart.setTool(b.dataset.tool);
      };
    });
    $("#undoBtn").onclick = function () { if (!chart.undo()) toast("Nothing to undo", true); saveDrawings(); };
    $("#clearBtn").onclick = function () { chart.clearDrawings(); saveDrawings(); toast("Drawings cleared"); };

    $$(".rail__tabs button").forEach(function (b) {
      b.onclick = function () {
        $$(".rail__tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
        $$(".rail-pane").forEach(function (p) { p.classList.toggle("on", p.id === "pane" + b.dataset.tab.charAt(0).toUpperCase() + b.dataset.tab.slice(1)); });
      };
    });

    $("#buyBtn").onclick = function () { openTrade("long"); };
    $("#sellBtn").onclick = function () { openTrade("short"); };

    $("#replayBtn").onclick = function () {
      if (state.replay) exitReplay(); else enterReplay();
    };
    $("#playBtn").onclick = function () { state.playing ? stop() : play(); };
    $("#stepBtn").onclick = step;
    $("#exitReplay").onclick = function () { exitReplay(); };
    $("#speedSeg").addEventListener("click", function (e) {
      var b = e.target.closest("[data-speed]");
      if (!b) return;
      state.speed = Number(b.dataset.speed);
      $$("#speedSeg button").forEach(function (x) { x.classList.toggle("on", x === b); });
      if (state.playing) { stop(); play(); }
    });
    $("#jumpBtn").onclick = function () {
      $("#jumpModal").hidden = false;
      if (state.bars.length) {
        var b = state.bars[chart.cursor == null ? state.bars.length - 1 : chart.cursor];
        $("#jumpInput").value = new Date(b[0] * 1000).toISOString().slice(0, 16);
        $("#jumpRange").textContent = "Available: " + new Date(state.bars[0][0] * 1000).toISOString().slice(0, 16) +
          " → " + new Date(state.bars[state.bars.length - 1][0] * 1000).toISOString().slice(0, 16) + " UTC";
      }
    };
    $("#jumpClose").onclick = function () { $("#jumpModal").hidden = true; };
    $("#jumpGo").onclick = function () {
      var v = $("#jumpInput").value;
      if (!v) return;
      var ts = Math.floor(new Date(v + "Z").getTime() / 1000);
      var idx = -1;
      for (var i = 0; i < state.bars.length; i++) { if (state.bars[i][0] >= ts) { idx = i; break; } }
      if (idx < 0) { toast("That date is after the last candle", true); return; }
      $("#jumpModal").hidden = true;
      if (!state.replay) enterReplay();
      chart.setCursor(idx);
      chart.offset = Math.min(state.bars.length - 1, idx + 3);
      chart.draw();
      updateReplayPos();
    };

    $("#csvBtn").onclick = downloadCsv;
    $("#themeBtn").onclick = function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      S.setTheme(next);
      $("#themeBtn").innerHTML = '<svg class="ic"><use href="#i-' + (next === "dark" ? "sun" : "moon") + '"/></svg>';
      chart.draw();
    };
    $("#themeBtn").innerHTML = '<svg class="ic"><use href="#i-' + (S.theme() === "dark" ? "sun" : "moon") + '"/></svg>';
    $("#userBtn").onclick = openUser;
    $("#userClose").onclick = function () { $("#userModal").hidden = true; };

    document.addEventListener("keydown", function (e) {
      var inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (e.key === "Escape") {
        $("#symModal").hidden = true; $("#jumpModal").hidden = true; $("#userModal").hidden = true;
      }
      if (inField) return;
      if (e.key === "/") { e.preventDefault(); openSearch(); }
      if (e.key === " ") { e.preventDefault(); state.playing ? stop() : play(); }
      if (e.key === "ArrowRight") { e.preventDefault(); step(); }
      if (e.key === "ArrowLeft") {
        e.preventDefault(); stop();
        if (!state.replay) enterReplay();
        chart.setCursor(chart.cursor - 1);
        renderLegend(); updateReplayPos();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (chart.undo()) saveDrawings();
      }
      if (e.key.toLowerCase() === "r") { state.replay ? exitReplay() : enterReplay(); }
    });

    $("#chartHost").addEventListener("dblclick", function (e) {
      if (e.target.closest("#replaybar")) return;
    });

    if (user) {
      $("#userBtn").innerHTML = '<span class="avatar" style="width:26px;height:26px;font-size:11px">' + esc(user.initials) + "</span>";
    }
  }

  function saveDrawings() {
    st.drawings[state.asset.id] = chart.exportDrawings();
    S.save(st);
  }

  /* expose for tests */
  window.KYTerminal = { state: state, chart: chart, setSymbol: setSymbol, setTf: setTf };

  wire();
  load().catch(function () {});
})();
