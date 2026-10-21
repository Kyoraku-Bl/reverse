/* =========================================================
   KyorakuReplay — dashboard
   Demo data lives in localStorage. No network, no backend.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- helpers ---------------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var KEY = {
    user: "fxr-user",
    theme: "fxr-theme",
    trades: "fxr-trades",
    sessions: "fxr-sessions",
    prefs: "fxr-prefs",
    votes: "fxr-mentor-votes",
    notif: "fxr-notif-read",
    usage: "fxr-mentor-usage",
    plan: "fxr-review-plan"
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function iso(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
  function daysAgo(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; }
  function monthShort(d) { return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]; }
  function fmtDate(isoStr) {
    var p = String(isoStr).split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return monthShort(d) + " " + d.getDate();
  }
  function fmtDateLong(isoStr) {
    var p = String(isoStr).split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()] + ", " + monthShort(d) + " " + d.getDate();
  }
  function signed(n, digits) {
    var v = Number(n) || 0;
    var s = v.toFixed(digits === undefined ? 1 : digits);
    return (v > 0 ? "+" : "") + (s === "-0.0" ? "0.0" : s);
  }
  function money(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  /* ---------------- seed data ---------------- */
  var MARKETS = {
    "EUR/USD": "Forex", "GBP/USD": "Forex", "USD/JPY": "Forex",
    "XAU/USD": "Metals", "NAS100": "Indices", "BTC/USD": "Crypto",
    "ES1": "Futures", "USOIL": "Energy"
  };
  var MARKET_ICON = {
    Forex: "€", Metals: "Au", Indices: "NQ", Crypto: "₿", Futures: "ES", Energy: "CL"
  };
  var MARKET_TONE = { Forex: "", Metals: "amber", Indices: "", Crypto: "amber", Futures: "mint", Energy: "amber" };
  var RISK_PER_R = 1000;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function seedTrades() {
    var rand = mulberry32(20261021);
    var setups = ["Pullback", "Breakout", "Reversal", "Range fade", "Liquidity sweep", "News play"];
    var sessions = ["London", "NY AM", "NY PM", "Asia"];
    var syms = Object.keys(MARKETS);
    var out = [];
    var recent = [
      { d: 0, sym: "EUR/USD", dir: 1, setup: "Pullback", session: "London", r: 1.8 },
      { d: 0, sym: "NAS100", dir: 1, setup: "Breakout", session: "NY AM", r: -1.0 },
      { d: 1, sym: "GBP/USD", dir: -1, setup: "Liquidity sweep", session: "London", r: 2.4 },
      { d: 1, sym: "XAU/USD", dir: 1, setup: "Range fade", session: "NY PM", r: -1.6 },
      { d: 2, sym: "BTC/USD", dir: 1, setup: "Breakout", session: "Asia", r: 0.9 },
      { d: 3, sym: "ES1", dir: -1, setup: "Reversal", session: "NY AM", r: 1.2 },
      { d: 3, sym: "EUR/USD", dir: -1, setup: "Pullback", session: "NY PM", r: -1.0 },
      { d: 4, sym: "USOIL", dir: 1, setup: "Range fade", session: "NY PM", r: -2.2 },
      { d: 5, sym: "USD/JPY", dir: 1, setup: "Breakout", session: "Asia", r: 0.6 },
      { d: 6, sym: "NAS100", dir: -1, setup: "Liquidity sweep", session: "NY AM", r: -1.0 },
      { d: 7, sym: "XAU/USD", dir: 1, setup: "Breakout", session: "London", r: 1.4 },
      { d: 8, sym: "EUR/USD", dir: 1, setup: "Pullback", session: "NY AM", r: -1.0 }
    ];
    recent.forEach(function (t, i) {
      t.date = iso(daysAgo(t.d));
      t.market = MARKETS[t.sym];
      t.id = "t-r" + i;
      out.push(t);
    });

    var offset = 9;
    var idx = 0;
    while (out.length < 44 && offset < 82) {
      var perDay = rand() > 0.55 ? 2 : 1;
      for (var k = 0; k < perDay && out.length < 44; k++) {
        var sym = syms[Math.floor(rand() * syms.length)];
        var session = sessions[Math.floor(rand() * sessions.length)];
        var r;
        var roll = rand();
        if (roll < 0.06) r = 0;
        else if (roll < 0.44) r = -1;
        else if (roll < 0.55) r = -(1.1 + rand() * 0.9);
        else r = 0.4 + rand() * 2.9;
        // losses cluster in the NY afternoon, like the insight says
        if (session === "NY PM" && rand() < 0.62) r = -(0.8 + rand() * 0.8);
        out.push({
          id: "t-g" + (idx++),
          date: iso(daysAgo(offset + Math.floor(rand() * 2))),
          sym: sym,
          market: MARKETS[sym],
          dir: rand() > 0.5 ? 1 : -1,
          setup: setups[Math.floor(rand() * setups.length)],
          session: session,
          r: Math.round(r * 10) / 10
        });
      }
      offset += 1 + (rand() > 0.7 ? 1 : 0);
    }
    out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return out;
  }

  function seedSessions() {
    return [
      { id: "s1", sym: "EUR/USD", tf: "1m", session: "London", setup: "Pullback", progress: 62, trades: 7, netR: 8.4, win: 71, state: "live", when: "4 minutes ago" },
      { id: "s2", sym: "NAS100", tf: "5m", session: "NY AM", setup: "Breakout", progress: 100, trades: 12, netR: 3.1, win: 58, state: "done", when: "Yesterday" },
      { id: "s3", sym: "XAU/USD", tf: "15m", session: "NY PM", setup: "Liquidity sweep", progress: 100, trades: 9, netR: -4.6, win: 33, state: "done", when: "2 days ago" },
      { id: "s4", sym: "BTC/USD", tf: "1H", session: "Asia", setup: "Reversal", progress: 100, trades: 6, netR: 2.2, win: 67, state: "done", when: "4 days ago" }
    ];
  }

  var PREF_DEFAULTS = {
    symbol: "EUR/USD", tf: "5m", tz: "Africa/Casablanca", exp: "1–3 years trading",
    autoplay: true, confirm: true, calendar: false,
    weekly: true, alerts: true, product: false
  };

  var state = {
    user: null,
    trades: [],
    sessions: [],
    prefs: {},
    votes: {},
    usage: 0,
    plan: [0],
    view: "overview",
    journalFilter: "all",
    journalSearch: "",
    journalMarket: "all",
    journalSort: "desc",
    journalLimit: 12,
    equityRange: "90",
    chart: null,
    hoverIdx: -1,
    notifRead: false
  };

  /* ---------------- toasts ---------------- */
  var toastStack = $("#toastStack");
  function toast(message, kind) {
    if (!toastStack) return;
    var el = document.createElement("div");
    el.className = "toast" + (kind === "error" ? " toast--rose" : "");
    el.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-' + (kind === "error" ? "info" : "check") + '"/></svg>';
    var span = document.createElement("span");
    span.textContent = message;
    el.appendChild(span);
    toastStack.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 2800);
  }

  /* ---------------- user ---------------- */
  function firstName(name) {
    var n = String(name || "Trader").trim().split(/\s+/)[0] || "Trader";
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  function planLabel(plan) {
    if (!plan) return "Free";
    var p = String(plan).toLowerCase();
    if (p === "pro" || p === "annual pro") return "Pro";
    if (p === "intermediate") return "Intermediate";
    if (p === "free") return "Free";
    return String(plan).charAt(0).toUpperCase() + String(plan).slice(1);
  }
  function planClass(plan) {
    var p = planLabel(plan).toLowerCase();
    return p === "pro" ? "pro" : p === "free" ? "free" : "";
  }

  /* ---------------- computed stats ---------------- */
  function computeStats(trades) {
    var wins = 0, losses = 0, be = 0, grossWin = 0, grossLoss = 0;
    trades.forEach(function (t) {
      if (t.r > 0) { wins++; grossWin += t.r; }
      else if (t.r < 0) { losses++; grossLoss += Math.abs(t.r); }
      else be++;
    });
    var net = trades.reduce(function (a, t) { return a + t.r; }, 0);
    var streak = 0, bestStreak = 0;
    trades.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (t) {
      if (t.r > 0) { streak++; bestStreak = Math.max(bestStreak, streak); }
      else streak = 0;
    });
    return {
      count: trades.length,
      wins: wins,
      losses: losses,
      be: be,
      winRate: trades.length ? (wins / trades.length) * 100 : 0,
      net: net,
      avg: trades.length ? net / trades.length : 0,
      pf: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
      grossWin: grossWin,
      grossLoss: grossLoss,
      bestStreak: bestStreak
    };
  }
  function inWindow(trades, fromISO, toISO) {
    return trades.filter(function (t) {
      return (!fromISO || t.date >= fromISO) && (!toISO || t.date <= toISO);
    });
  }
  function curve(trades) {
    var sorted = trades.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
    var total = 0;
    return sorted.map(function (t) {
      total += t.r;
      return { date: t.date, r: t.r, cum: total };
    });
  }
  function maxDrawdown(points) {
    var peak = 0, dd = 0;
    points.forEach(function (p) {
      peak = Math.max(peak, p.cum);
      dd = Math.min(dd, p.cum - peak);
    });
    return dd;
  }

  /* ---------------- DOM rendering: chrome ---------------- */
  function applyUser() {
    var u = state.user || { name: "Trader", email: "you@email.com", plan: "free" };
    var first = firstName(u.name);
    var initial = first.charAt(0).toUpperCase();
    var plan = planLabel(u.plan);
    var pcls = planClass(u.plan);

    ["#userName", "#userNameLg", "#greetName"].forEach(function (sel) { var el = $(sel); if (el) el.textContent = first; });
    var full = $("#userEmail"); if (full) full.textContent = u.email || "you@email.com";
    ["#userPlan", "#userPlanPill", "#wsPlan"].forEach(function (sel) { var el = $(sel); if (el) el.textContent = plan; });
    ["#userPlanPill", "#wsPlan"].forEach(function (sel) {
      var el = $(sel); if (!el) return;
      el.className = "plan-pill " + pcls;
    });
    ["#userAvatar", "#userAvatarLg", "#wsAvatar"].forEach(function (sel) {
      var el = $(sel); if (el) el.textContent = initial;
    });
    var ws = $("#wsName"); if (ws) ws.textContent = first + "’s workspace";

    var up = $(".upgrade");
    if (up) {
      var title = up.querySelector("b");
      var copy = up.querySelector("p");
      var cta = up.querySelector("a");
      if (planClass(u.plan) === "free") {
        if (title) title.textContent = "Free plan";
        if (copy) copy.textContent = "Unlock futures data, seconds timeframes and unlimited Mentor AI.";
        if (cta) cta.textContent = "Upgrade to Pro";
      } else if (planClass(u.plan) === "pro") {
        if (title) title.textContent = "Pro trial · 9 days left";
        if (copy) copy.textContent = "Futures data, seconds timeframes and unlimited Mentor AI.";
        if (cta) cta.textContent = "Manage plan";
      } else {
        if (title) title.textContent = "Intermediate plan";
        if (copy) copy.textContent = "Add futures, seconds timeframes and the full Mentor AI feed.";
        if (cta) cta.textContent = "Compare plans";
      }
    }
    var planChip = $("#planProgressChip");
    if (planChip) planChip.textContent = "1 / 4";
  }

  function syncThemeUI() {
    var theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    var btn = $("#themeToggle");
    if (btn) btn.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
    $$(".theme-opt").forEach(function (b) {
      b.classList.toggle("on", b.dataset.theme === theme);
    });
  }

  function toggleTheme(force) {
    var current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    var next = force || (current === "light" ? "dark" : "light");
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY.theme, next); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? "#f5f7fc" : "#06080f");
    syncThemeUI();
    drawEquity(state.hoverIdx);
  }

  /* ---------------- sidebar / routing ---------------- */
  var VIEW_META = {
    overview: ["Overview", "Your edge at a glance"],
    sessions: ["Replay sessions", "Saved replays and their stats"],
    journal: ["Journal", "Every trade, honestly logged"],
    prop: ["Prop challenges", "Simulated rules, real feedback"],
    mentor: ["Mentor AI", "Insights from your own trades"],
    indicators: ["Indicators", "Chart defaults for new replays"],
    settings: ["Settings", "Profile, replay defaults and alerts"]
  };

  function setView(name, opts) {
    if (!VIEW_META[name]) name = "overview";
    state.view = name;
    $$(".view").forEach(function (v) {
      v.hidden = v.dataset.view !== name;
    });
    $$(".sn-link").forEach(function (a) {
      var on = a.dataset.view === name;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    var meta = VIEW_META[name];
    var t = $("#viewTitle"); if (t) t.textContent = meta[0];
    var s = $("#viewSub");
    if (s) {
      if (name === "sessions") s.textContent = state.sessions.length + " saved sessions · 1 in progress";
      else if (name === "journal") s.textContent = state.trades.length + " trades · " + computeStats(state.trades).wins + " wins";
      else if (name === "mentor") s.textContent = "Insights from " + state.trades.length + " logged trades";
      else s.textContent = meta[1];
    }
    document.title = meta[0] + " — KyorakuReplay";
    closeDrawer();
    closeAllPops();
    if (name === "overview" || name === "journal") drawEquity(state.hoverIdx);
    if (!opts || !opts.silent) {
      if (history.replaceState) history.replaceState(null, "", "#" + name);
    }
    closeDrawer();
    var scroller = $("#mainScroll");
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function openDrawer() {
    var sb = $("#sidebar");
    var scrim = $("#scrim");
    if (!sb) return;
    sb.classList.add("open");
    if (scrim) { scrim.hidden = false; requestAnimationFrame(function () { scrim.classList.add("in"); }); }
    var mb = $("#menuBtn"); if (mb) mb.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    var sb = $("#sidebar");
    var scrim = $("#scrim");
    if (!sb) return;
    sb.classList.remove("open");
    if (scrim) {
      scrim.classList.remove("in");
      setTimeout(function () { if (!scrim.classList.contains("in")) scrim.hidden = true; }, 220);
    }
    var mb = $("#menuBtn"); if (mb) mb.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  /* ---------------- popovers ---------------- */
  function closeAllPops() {
    $$(".pop").forEach(function (p) { p.hidden = true; });
    $$("[aria-haspopup]").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  }
  function bindPop(btnSel, popSel) {
    var btn = $(btnSel);
    var pop = $(popSel);
    if (!btn || !pop) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !pop.hidden;
      closeAllPops();
      if (!open) {
        pop.hidden = false;
        btn.setAttribute("aria-expanded", "true");
      }
    });
    pop.addEventListener("click", function (e) { e.stopPropagation(); });
  }

  /* ---------------- overview ---------------- */
  function renderOverview() {
    var trades = state.trades;
    var all = computeStats(trades);
    var now = new Date();
    var thisMonth = iso(now).slice(0, 7);

    var today = $("#todayLabel");
    if (today) {
      today.textContent = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()] +
        " · " + MONTHS[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear();
    }

    // 30 day windows
    var last30 = inWindow(trades, iso(daysAgo(30)), iso(daysAgo(0)));
    var prev30 = inWindow(trades, iso(daysAgo(60)), iso(daysAgo(31)));
    var s30 = computeStats(last30);
    var p30 = computeStats(prev30);
    var sAll = all;

    var netEl = $("#stNetR");
    if (netEl) {
      netEl.textContent = signed(sAll.net) + "R";
      netEl.className = "st-value " + (sAll.net > 0 ? "mint" : sAll.net < 0 ? "rose" : "");
    }
    var netDelta = $("#stNetRDelta");
    if (netDelta) {
      var diff = s30.net - p30.net;
      netDelta.textContent = signed(diff) + "R";
      netDelta.className = "delta " + (diff > 0 ? "up" : diff < 0 ? "down" : "flat");
    }

    var winEl = $("#stWin");
    if (winEl) winEl.textContent = Math.round(s30.winRate) + "%";
    var winDelta = $("#stWinDelta");
    if (winDelta) {
      var wd = s30.winRate - p30.winRate;
      winDelta.textContent = (wd > 0 ? "+" : "") + wd.toFixed(0) + " pts";
      winDelta.className = "delta " + (wd > 0 ? "up" : wd < 0 ? "down" : "flat");
    }

    var pfEl = $("#stPF");
    if (pfEl) pfEl.textContent = isFinite(s30.pf) ? s30.pf.toFixed(2) : "∞";
    var pfCopy = $("#stPFCopy");
    if (pfCopy) {
      if (!isFinite(s30.pf)) pfCopy.textContent = "No losing trades in this window";
      else pfCopy.textContent = "Gross win " + signed(s30.grossWin) + "R / loss " + signed(-s30.grossLoss) + "R";
    }

    var monthTrades = trades.filter(function (t) { return t.date.slice(0, 7) === thisMonth; });
    var prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var prevMonth = prevMonthDate.getFullYear() + "-" + pad(prevMonthDate.getMonth() + 1);
    var prevMonthTrades = trades.filter(function (t) { return t.date.slice(0, 7) === prevMonth; });
    var tEl = $("#stTrades");
    if (tEl) tEl.textContent = String(monthTrades.length);
    var tDelta = $("#stTradesDelta");
    if (tDelta) {
      var td = monthTrades.length - prevMonthTrades.length;
      tDelta.textContent = (td > 0 ? "+" : "") + td + " vs last month";
      tDelta.className = "delta " + (td > 0 ? "up" : td < 0 ? "down" : "flat");
    }

    renderWeek();
    renderRecent();
    renderInsight();
    renderContinue();
    drawEquity(state.hoverIdx);
  }

  function renderContinue() {
    var live = state.sessions.filter(function (s) { return s.state === "live"; })[0] || state.sessions[0];
    if (!live) return;
    var el = $("#contPrice");
    var pct = $("#contPct");
    var bar = $("#contBar");
    var tr = $("#contTrades");
    var rr = $("#contR");
    var wr = $("#contWin");
    if (pct) pct.textContent = live.progress + "%";
    if (bar) bar.style.width = live.progress + "%";
    if (tr) tr.textContent = String(live.trades);
    if (rr) { rr.textContent = signed(live.netR) + "R"; rr.className = live.netR >= 0 ? "mint" : "rose"; }
    if (wr) wr.textContent = live.win + "%";
    if (el) {
      el.textContent = live.sym === "EUR/USD" ? "1.08633" : live.sym === "NAS100" ? "20,418.5" : live.sym === "XAU/USD" ? "2,412.80" : "67,240.0";
    }
    // deterministic sparkline
    var pts = [], v = 0, rand = mulberry32(live.id.length * 137 + 11);
    for (var i = 0; i < 26; i++) {
      v += (rand() - 0.42) * 8;
      pts.push(v);
    }
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts), span = max - min || 1;
    var d = pts.map(function (p, i) {
      var x = (i / (pts.length - 1)) * 220;
      var y = 54 - ((p - min) / span) * 46;
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
    var line = $("#contLine");
    var area = $("#contArea");
    if (line) line.setAttribute("d", d);
    if (area) area.setAttribute("d", d + " L220 62 L0 62 Z");
  }

  function renderWeek() {
    var chart = $("#weekChart");
    if (!chart) return;
    var now = new Date();
    now.setHours(12, 0, 0, 0);
    var dow = (now.getDay() + 6) % 7;
    var monday = new Date(now);
    monday.setDate(now.getDate() - dow);

    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      var key = iso(d);
      var dayTrades = state.trades.filter(function (t) { return t.date === key; });
      var sum = dayTrades.reduce(function (a, t) { return a + t.r; }, 0);
      days.push({ label: DOW[i], sum: sum, count: dayTrades.length, future: d > now });
    }
    var max = Math.max.apply(null, days.map(function (d) { return Math.abs(d.sum); }).concat([1]));
    chart.innerHTML = days.map(function (d) {
      var share = Math.abs(d.sum) / max;
      var cls = d.sum > 0 ? "up" : d.sum < 0 ? "down" : "";
      var h = Math.max(share * 50, d.sum === 0 ? 0 : 4);
      return '<div class="wcol" aria-label="' + d.label + ": " + signed(d.sum) + 'R">' +
        '<span class="wval ' + cls + '">' + (d.sum === 0 ? "·" : signed(d.sum)) + "</span>" +
        '<div class="wtrack"><i class="wbar ' + cls + '" style="height:' + h.toFixed(1) + '%"></i></div>' +
        '<span class="wday">' + d.label + "</span></div>";
    }).join("");

    var total = days.reduce(function (a, d) { return a + d.sum; }, 0);
    var best = days.slice().sort(function (a, b) { return b.sum - a.sum; })[0];
    var weekTrades = days.reduce(function (a, d) { return a + d.count; }, 0);
    var green = days.filter(function (d) { return d.sum > 0; }).length;

    var totalEl = $("#weekTotal");
    if (totalEl) { totalEl.textContent = signed(total) + "R"; totalEl.className = "week-total " + (total >= 0 ? "mint" : "rose"); }
    var bestEl = $("#weekBest");
    if (bestEl) bestEl.textContent = best && best.sum > 0 ? best.label + " " + signed(best.sum) + "R" : "—";
    var avgEl = $("#weekAvg");
    if (avgEl) avgEl.textContent = weekTrades ? signed(total / weekTrades, 2) + "R" : "—";
    var greenEl = $("#weekGreen");
    if (greenEl) greenEl.textContent = green + " / 7";
  }

  function marketBadge(sym) {
    var m = MARKETS[sym] || "Forex";
    var tone = MARKET_TONE[m] || "";
    return '<span class="sym-ico' + (tone ? " sym-ico--" + tone : "") + '">' + (MARKET_ICON[m] || "€") + "</span>";
  }

  function renderRecent() {
    var tbody = $("#recentTable") ? $("#recentTable").querySelector("tbody") : null;
    if (!tbody) return;
    var rows = state.trades.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, 5);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No trades logged yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (t) {
      return "<tr>" +
        '<td class="mono">' + fmtDate(t.date) + "</td>" +
        '<td><span class="sym-cell">' + marketBadge(t.sym) + escapeHtml(t.sym) + "</span></td>" +
        "<td>" + escapeHtml(t.setup) + "</td>" +
        "<td>" + escapeHtml(t.session) + "</td>" +
        '<td class="ta-end"><span class="res ' + (t.r > 0 ? "up" : t.r < 0 ? "down" : "be") + '">' + signed(t.r) + "</span></td>" +
        '<td class="ta-end mono">' + (t.r >= 0 ? "+" : "−") + money(Math.abs(t.r * RISK_PER_R)).slice(1) + "</td>" +
        "</tr>";
    }).join("");
  }

  function sessionStats() {
    var bySession = {};
    ["London", "NY AM", "NY PM", "Asia"].forEach(function (s) { bySession[s] = { n: 0, net: 0, wins: 0, losses: 0 }; });
    state.trades.forEach(function (t) {
      var b = bySession[t.session];
      if (!b) return;
      b.n++; b.net += t.r;
      if (t.r > 0) b.wins++; else if (t.r < 0) b.losses++;
    });
    return bySession;
  }
  function worstSession() {
    var by = sessionStats();
    var worst = null;
    Object.keys(by).forEach(function (k) {
      if (by[k].n >= 3 && (!worst || by[k].net < by[worst].net)) worst = k;
    });
    return worst || "NY PM";
  }
  function setupStats() {
    var by = {};
    state.trades.forEach(function (t) {
      if (!by[t.setup]) by[t.setup] = { n: 0, net: 0, wins: 0 };
      by[t.setup].n++; by[t.setup].net += t.r;
      if (t.r > 0) by[t.setup].wins++;
    });
    return by;
  }
  function bestSetup() {
    var by = setupStats(), best = null;
    Object.keys(by).forEach(function (k) {
      if (by[k].n < 4) return;
      var exp = by[k].net / by[k].n;
      if (!best || exp > best.exp) best = { name: k, exp: exp, n: by[k].n, wins: by[k].wins, net: by[k].net };
    });
    return best;
  }

  function renderInsight() {
    var by = sessionStats();
    var worst = worstSession();
    var overshoot = state.trades.filter(function (t) { return t.r < -1.2; });
    var impact = overshoot.reduce(function (a, t) { return a + (t.r + 1); }, 0);
    var el = $("#ovInsight");
    var tags = $("#ovInsightTags");
    if (el) {
      if (overshoot.length >= 3) {
        el.innerHTML = "Your biggest leak isn’t entries — it’s <b>holding losers past invalidation</b>. " +
          overshoot.length + " of your " + computeStats(state.trades).losses +
          " losing trades closed beyond the planned stop, worth <b class=\"rose\">" + signed(impact) + "R</b>.";
      } else if (by[worst] && by[worst].n) {
        el.innerHTML = "Your edge is strongest in London. <b>" + worst + " keeps giving it back</b> — " +
          signed(by[worst].net) + "R across " + by[worst].n + " trades so far.";
      } else {
        el.innerHTML = "Log a few more trades and Mentor AI will start ranking your leaks by cost.";
      }
    }
    if (tags) {
      var list = ["Stop discipline", worst, signed(impact) + "R impact"];
      tags.innerHTML = list.map(function (t, i) {
        return '<span class="tag' + (i === 2 ? " tag--rose" : "") + '">' + escapeHtml(t) + "</span>";
      }).join("");
    }
  }

  /* ---------------- equity chart ---------------- */
  function equityTrades() {
    var trades = state.trades.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (state.equityRange === "all") return trades;
    var days = state.equityRange === "30" ? 30 : 90;
    return trades.filter(function (t) { return t.date >= iso(daysAgo(days)); });
  }

  function drawEquity(hoverIdx) {
    var canvas = $("#equityChart");
    if (!canvas || !canvas.getContext) return;
    var wrap = canvas.parentElement;
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var points = curve(equityTrades());
    var pad = { l: 36, r: 12, t: 14, b: 22 };
    var innerW = Math.max(1, w - pad.l - pad.r);
    var innerH = Math.max(1, h - pad.t - pad.b);
    var dark = document.documentElement.dataset.theme !== "light";
    var grid = dark ? "rgba(255,255,255,.07)" : "rgba(16,24,40,.09)";
    var label = dark ? "rgba(139,147,171,.85)" : "rgba(104,113,138,.95)";

    if (points.length < 2) {
      ctx.fillStyle = label;
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Not enough trades in this window yet", w / 2, h / 2);
      state.chart = null;
      var tip0 = $("#equityTip"); if (tip0) tip0.hidden = true;
      return;
    }

    var values = points.map(function (p) { return p.cum; }).concat([0]);
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (min === max) { max = min + 1; }
    var padY = (max - min) * 0.12;
    min -= padY; max += padY;
    var x = function (i) { return pad.l + (i / (points.length - 1)) * innerW; };
    var y = function (v) { return pad.t + (1 - (v - min) / (max - min)) * innerH; };

    // grid + y labels
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (var g = 0; g <= 3; g++) {
      var val = min + ((max - min) / 3) * g;
      var gy = y(val);
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, Math.round(gy) + 0.5);
      ctx.lineTo(w - pad.r, Math.round(gy) + 0.5);
      ctx.stroke();
      ctx.fillStyle = label;
      ctx.fillText(signed(val).replace(".0", "") + "R", pad.l - 8, gy);
    }

    // zero line
    if (min < 0 && max > 0) {
      ctx.strokeStyle = dark ? "rgba(255,255,255,.16)" : "rgba(16,24,40,.18)";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.l, y(0));
      ctx.lineTo(w - pad.r, y(0));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // area
    var grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    grad.addColorStop(0, "rgba(139,107,255,.30)");
    grad.addColorStop(0.7, "rgba(139,107,255,.06)");
    grad.addColorStop(1, "rgba(139,107,255,0)");
    ctx.beginPath();
    ctx.moveTo(x(0), y(0));
    points.forEach(function (p, i) { ctx.lineTo(x(i), y(p.cum)); });
    ctx.lineTo(x(points.length - 1), h - pad.b);
    ctx.lineTo(x(0), h - pad.b);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    points.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(x(i), y(p.cum));
      else ctx.lineTo(x(i), y(p.cum));
    });
    ctx.strokeStyle = dark ? "#a78bfa" : "#6d54e6";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // last point
    var lastIdx = points.length - 1;
    var lx = x(lastIdx), ly = y(points[lastIdx].cum);
    ctx.beginPath();
    ctx.arc(lx, ly, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#a78bfa" : "#6d54e6";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx, ly, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(139,107,255,.18)";
    ctx.fill();

    // x labels
    ctx.fillStyle = label;
    ctx.font = "10px Inter, sans-serif";
    ctx.textBaseline = "top";
    var picks = [0, Math.floor(points.length / 2), points.length - 1];
    picks.forEach(function (i, n) {
      ctx.textAlign = n === 0 ? "left" : n === picks.length - 1 ? "right" : "center";
      ctx.fillText(fmtDate(points[i].date), x(i), h - pad.b + 7);
    });

    // hover marker
    if (hoverIdx >= 0 && hoverIdx < points.length) {
      var hx = x(hoverIdx), hy = y(points[hoverIdx].cum);
      ctx.strokeStyle = dark ? "rgba(255,255,255,.28)" : "rgba(16,24,40,.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, pad.t);
      ctx.lineTo(hx, h - pad.b);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#eef1fa" : "#0c1120";
      ctx.fill();
      ctx.strokeStyle = dark ? "#a78bfa" : "#6d54e6";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    state.chart = { points: points, x: x, y: y, pad: pad, w: w, h: h };

    // footer stats
    var dd = maxDrawdown(points);
    var stats = computeStats(equityTrades());
    var ddEl = $("#eqDD"); if (ddEl) ddEl.textContent = dd ? signed(dd) + "R" : "0.0R";
    var stEl = $("#eqStreak"); if (stEl) stEl.textContent = stats.bestStreak + " wins";
    var avEl = $("#eqAvg"); if (avEl) avEl.textContent = signed(stats.avg, 2) + "R";
    if (hoverIdx < 0) {
      var tip = $("#equityTip");
      if (tip) tip.hidden = true;
    }
  }

  function bindEquityHover() {
    var canvas = $("#equityChart");
    var tip = $("#equityTip");
    if (!canvas || !tip) return;
    canvas.addEventListener("pointermove", function (e) {
      if (!state.chart) return;
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var c = state.chart;
      if (mx < c.pad.l - 6 || mx > c.w - c.pad.r + 6) { hideTip(); return; }
      var rel = (mx - c.pad.l) / Math.max(1, c.w - c.pad.l - c.pad.r);
      var idx = Math.round(rel * (c.points.length - 1));
      idx = Math.max(0, Math.min(c.points.length - 1, idx));
      var p = c.points[idx];
      tip.hidden = false;
      tip.innerHTML = '<span class="card-sub">' + fmtDateLong(p.date) + "</span><br><b>" +
        signed(p.cum) + "R</b> <span class=\"mint\">(" + signed(p.r) + "R)</span>";
      tip.style.left = Math.round(c.x(idx)) + "px";
      tip.style.top = Math.round(c.y(p.cum)) + "px";
      if (idx !== state.hoverIdx) {
        state.hoverIdx = idx;
        drawEquity(idx);
      }
    });
    canvas.addEventListener("pointerleave", hideTip);
    function hideTip() {
      tip.hidden = true;
      if (state.hoverIdx !== -1) {
        state.hoverIdx = -1;
        drawEquity(-1);
      }
    }
  }

  /* ---------------- sessions ---------------- */
  function renderSessions() {
    var grid = $("#sessionGrid");
    var empty = $("#sessionsEmpty");
    if (!grid) return;
    if (!state.sessions.length) {
      grid.innerHTML = "";
      if (empty) empty.hidden = false;
    } else {
      if (empty) empty.hidden = true;
      grid.innerHTML = state.sessions.map(function (s) {
        return '<article class="session-card" data-id="' + s.id + '">' +
          '<div class="sc-head"><div class="sc-sym">' + marketBadge(s.sym) + escapeHtml(s.sym) + "</div>" +
          '<span class="chip ' + (s.state === "live" ? "chip--mint" : "") + '">' + (s.state === "live" ? '<span class="live-dot"></span> In progress' : "Complete") + "</span></div>" +
          '<div class="sc-tags"><span class="chip">' + escapeHtml(s.tf) + "</span><span class=\"chip\">" + escapeHtml(s.session) + "</span><span class=\"chip\">" + escapeHtml(s.setup) + "</span></div>" +
          '<div class="sc-meta"><div><small>Trades</small><b>' + s.trades + "</b></div>" +
          '<div><small>Net R</small><b class="' + (s.netR >= 0 ? "mint" : "rose") + '">' + signed(s.netR) + "</b></div>" +
          "<div><small>Win rate</small><b>" + s.win + "%</b></div></div>" +
          '<div class="sc-bar-wrap"><div class="bar"><i style="width:' + s.progress + '%"></i></div><span>' + s.progress + "%</span></div>" +
          '<div class="sc-foot"><a class="btn btn-primary btn-sm" href="index.html#terminal">' + (s.state === "live" ? "Resume" : "Replay again") + "</a>" +
          '<button class="btn btn-ghost btn-sm sc-del" data-del="' + s.id + '" aria-label="Delete session">' +
          '<svg class="ic"><use href="#i-trash"/></svg></button></div>' +
          '<p class="card-sub" style="margin-top:9px">Saved ' + escapeHtml(s.when) + "</p>" +
          "</article>";
      }).join("");
    }
    var badge = $("#navSessionCount");
    if (badge) badge.textContent = String(state.sessions.length);
  }

  /* ---------------- journal ---------------- */
  function filteredTrades() {
    var q = state.journalSearch.trim().toLowerCase();
    var rows = state.trades.slice();
    if (state.journalFilter === "win") rows = rows.filter(function (t) { return t.r > 0; });
    else if (state.journalFilter === "loss") rows = rows.filter(function (t) { return t.r < 0; });
    else if (state.journalFilter === "be") rows = rows.filter(function (t) { return t.r === 0; });
    if (state.journalMarket !== "all") rows = rows.filter(function (t) { return t.market === state.journalMarket; });
    if (q) rows = rows.filter(function (t) {
      return (t.sym + " " + t.setup + " " + t.session + " " + t.market).toLowerCase().indexOf(q) !== -1;
    });
    rows.sort(function (a, b) {
      var cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      return state.journalSort === "desc" ? -cmp : cmp;
    });
    return rows;
  }

  function renderJournal() {
    var allStats = computeStats(state.trades);
    var set = function (sel, txt, cls) {
      var el = $(sel); if (!el) return;
      el.textContent = txt;
      if (cls !== undefined) el.className = cls;
    };
    set("#jNetR", signed(allStats.net) + "R", allStats.net >= 0 ? "mint" : "rose");
    set("#jWin", Math.round(allStats.winRate) + "%");
    set("#jPF", isFinite(allStats.pf) ? allStats.pf.toFixed(2) : "∞");
    set("#jCount", String(allStats.count));
    set("#jAvg", signed(allStats.avg, 2) + "R");

    var rows = filteredTrades();
    var shown = rows.slice(0, state.journalLimit);
    var body = $("#journalBody");
    if (body) {
      if (!shown.length) {
        body.innerHTML = '<tr><td colspan="9" class="empty-cell">No trades match these filters.</td></tr>';
      } else {
        body.innerHTML = shown.map(function (t) {
          return "<tr>" +
            '<td class="mono">' + fmtDate(t.date) + "</td>" +
            '<td><span class="sym-cell">' + marketBadge(t.sym) + escapeHtml(t.sym) + "</span></td>" +
            "<td>" + escapeHtml(t.market) + "</td>" +
            '<td><span class="dir-pill dir-pill--' + (t.dir > 0 ? "long" : "short") + '">' + (t.dir > 0 ? "Long" : "Short") + "</span></td>" +
            "<td>" + escapeHtml(t.setup) + "</td>" +
            "<td>" + escapeHtml(t.session) + "</td>" +
            '<td class="ta-end"><span class="res ' + (t.r > 0 ? "up" : t.r < 0 ? "down" : "be") + '">' + signed(t.r) + "</span></td>" +
            '<td class="ta-end mono ' + (t.r >= 0 ? "mint" : "rose") + '">' + (t.r >= 0 ? "+" : "−") + money(Math.abs(t.r * RISK_PER_R)).slice(1) + "</td>" +
            '<td class="ta-end"><button class="row-x" data-del-trade="' + t.id + '" aria-label="Delete trade"><svg class="ic"><use href="#i-trash"/></svg></button></td>' +
            "</tr>";
        }).join("");
      }
    }
    var count = $("#journalCount");
    if (count) count.textContent = "Showing " + shown.length + " of " + rows.length + " trades";
    var more = $("#loadMoreBtn");
    if (more) more.hidden = shown.length >= rows.length;

    var badge = $("#navTradeCount");
    if (badge) badge.textContent = String(state.trades.length);
  }

  /* ---------------- prop ---------------- */
  function renderProp() {
    var grid = $("#propGrid");
    if (!grid) return;
    grid.innerHTML =
      '<article class="prop-card prop-card--on">' +
        '<div class="prop-head"><div><b>$100k Evaluation</b><small>FTMO-style · Phase 1</small></div><span class="chip chip--mint">On track</span></div>' +
        '<div class="prop-big">$106,420.00</div><div class="prop-sub">Balance · +6.42% since start</div>' +
        '<div class="prop-goals">' +
          '<div class="goal"><div class="goal-top"><span>Profit target</span><span><b>$8,000</b> / $10,000</span></div><div class="bar"><i style="width:80%"></i></div></div>' +
          '<div class="goal"><div class="goal-top"><span>Max drawdown</span><span><b class="mint">$1,180</b> / $5,000</span></div><div class="bar bar--rose"><i style="width:24%"></i></div></div>' +
        "</div>" +
        '<ul class="pc-rules"><li><span class="rule-dot ok"></span>Daily loss limit<span>OK</span></li>' +
        '<li><span class="rule-dot ok"></span>Consistency rule<span>OK</span></li>' +
        '<li><span class="rule-dot warn"></span>Min. trading days<span>4 / 5</span></li></ul>' +
        '<a class="btn btn-primary btn-sm" href="index.html#terminal">Continue challenge</a>' +
        '<p class="prop-sub" style="margin:10px 0 0">Day 12 of 30 · resets in 18 days</p>' +
      "</article>" +
      '<article class="prop-card prop-card--locked">' +
        '<div class="prop-head"><div><b>$50k Phase 2</b><small>Unlocks when Phase 1 passes</small></div><span class="chip">Locked</span></div>' +
        '<div class="prop-big">$50,000</div><div class="prop-sub">Target $3,000 · max DD $2,500</div>' +
        '<div class="prop-goals">' +
          '<div class="goal"><div class="goal-top"><span>Phase 1 progress</span><span><b>80%</b></span></div><div class="bar"><i style="width:80%"></i></div></div>' +
        "</div>" +
        '<ul class="pc-rules"><li><span class="rule-dot"></span>Daily loss limit<span>$1,000</span></li>' +
        '<li><span class="rule-dot"></span>Min. trading days<span>5</span></li>' +
        '<li><span class="rule-dot"></span>Max contracts<span>5</span></li></ul>' +
        '<button class="btn btn-ghost btn-sm pc-rules-btn">View rule set</button>' +
      "</article>" +
      '<article class="prop-card prop-card--locked">' +
        '<div class="prop-head"><div><b>$200k Evaluation</b><small>Pro plan only</small></div><span class="chip chip--violet">Pro</span></div>' +
        '<div class="prop-big">$200,000</div><div class="prop-sub">Target $12,000 · max DD $10,000</div>' +
        '<ul class="pc-rules"><li><span class="rule-dot"></span>Simulator<span>Included</span></li>' +
        '<li><span class="rule-dot"></span>Futures data<span>Pro</span></li>' +
        '<li><span class="rule-dot"></span>Mentor AI<span>Unlimited</span></li></ul>' +
        '<a class="btn btn-ghost btn-sm" href="index.html#pricing">Unlock with Pro</a>' +
      "</article>";
    var badge = $("#navChallengeCount");
    if (badge) badge.textContent = "2";
  }

  /* ---------------- mentor ---------------- */
  function mentorItems() {
    var by = sessionStats();
    var worst = worstSession();
    var ws = by[worst] || { n: 0, net: 0, wins: 0 };
    var overshoot = state.trades.filter(function (t) { return t.r < -1.2; });
    var impact = overshoot.reduce(function (a, t) { return a + (t.r + 1); }, 0);
    var best = bestSetup();
    var all = computeStats(state.trades);
    var longT = state.trades.filter(function (t) { return t.dir > 0; });
    var shortT = state.trades.filter(function (t) { return t.dir < 0; });
    var longW = longT.filter(function (t) { return t.r > 0; }).length;
    var shortW = shortT.filter(function (t) { return t.r > 0; }).length;

    var items = [];
    items.push({
      id: "m1",
      sev: overshoot.length ? "high" : "good",
      title: "You hold losers " + (overshoot.length ? Math.round((overshoot.length / Math.max(1, all.losses)) * 100) + "% past invalidation" : "to the stop"),
      copy: overshoot.length
        ? "Across <b>" + overshoot.length + " trades</b> you closed beyond the planned stop. Had you exited at −1R, your book would be <b class=\"mint\">" + signed(Math.abs(impact)) + "R better</b>."
        : "Every losing trade closed at or inside −1R. That is the single hardest habit to build — keep it.",
      metrics: [["Impact", signed(impact) + "R"], ["Occurrences", String(overshoot.length)], ["Confidence", "92%"]],
      tags: ["Risk", "Stop discipline"]
    });
    items.push({
      id: "m2",
      sev: ws.n && ws.net < 0 ? "high" : "med",
      title: worst + " is where your edge flips",
      copy: "<b>" + worst + "</b> accounts for " + signed(ws.net) + "R over " + ws.n +
        " trades, while London carries your book. You are trading your best setups in your worst window.",
      metrics: [["Net R", signed(ws.net)], ["Trades", String(ws.n)], ["Win rate", Math.round(ws.n ? (ws.wins / ws.n) * 100 : 0) + "%"]],
      tags: [worst, "Timing"]
    });
    if (best) {
      items.push({
        id: "m3",
        sev: "good",
        title: best.name + " is your highest-expectancy setup",
        copy: "<b>" + best.name + "</b> returns " + signed(best.exp, 2) + "R per trade over " + best.n +
          " samples (" + Math.round((best.wins / best.n) * 100) + "% win rate). Size this one, not the news plays.",
        metrics: [["Expectancy", signed(best.exp, 2) + "R"], ["Sample", best.n + " trades"], ["Net", signed(best.net) + "R"]],
        tags: ["Setup", best.name]
      });
    }
    items.push({
      id: "m4",
      sev: "med",
      title: (longW / Math.max(1, longT.length) >= shortW / Math.max(1, shortT.length) ? "Shorts" : "Longs") + " are dragging your win rate",
      copy: "Longs win <b>" + Math.round((longW / Math.max(1, longT.length)) * 100) + "%</b> (" + longT.length +
        " trades), shorts win <b>" + Math.round((shortW / Math.max(1, shortT.length)) * 100) + "%</b> (" + shortT.length +
        " trades). Cut the weaker side until the sample says otherwise.",
      metrics: [["Long win", Math.round((longW / Math.max(1, longT.length)) * 100) + "%"], ["Short win", Math.round((shortW / Math.max(1, shortT.length)) * 100) + "%"], ["Sample", String(state.trades.length)]],
      tags: ["Direction", "Selectivity"]
    });
    return items;
  }

  function renderMentor() {
    var feed = $("#mentorFeed");
    if (!feed) return;
    var items = mentorItems();
    feed.innerHTML = items.map(function (m) {
      var voted = state.votes[m.id];
      return '<article class="mentor-item" data-sev="' + m.sev + '">' +
        '<div class="mi-head"><h3 class="mi-title">' + escapeHtml(m.title) + "</h3>" +
        '<span class="mi-sev">' + (m.sev === "high" ? "High impact" : m.sev === "med" ? "Watch" : "Strength") + "</span></div>" +
        '<p class="mi-copy">' + m.copy + "</p>" +
        '<div class="mi-metric">' + m.metrics.map(function (x) { return "<span>" + escapeHtml(x[0]) + "<b>" + escapeHtml(x[1]) + "</b></span>"; }).join("") + "</div>" +
        '<div class="mi-foot"><div class="tag-row" style="margin:0">' + m.tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; }).join("") + "</div>" +
        '<div class="mi-actions"><button data-vote="' + m.id + '" class="' + (voted === "helpful" ? "on" : "") + '">Helpful</button>' +
        '<button data-dismiss="' + m.id + '">Dismiss</button></div></div></article>';
    }).join("");

    var dot = $("#navMentorDot");
    if (dot) dot.hidden = Object.keys(state.votes).length > 0;
  }

  var PLAN_ITEMS = [
    "Review your 3 worst trades",
    "Write your London playbook",
    "Compare breakout vs pullback",
    "Re-run the $100k challenge sim"
  ];

  function renderPlan() {
    var list = $("#planList");
    if (!list) return;
    list.innerHTML = PLAN_ITEMS.map(function (t, i) {
      var done = state.plan.indexOf(i) !== -1;
      return '<li class="' + (done ? "done" : "") + '" data-plan="' + i + '" role="button" tabindex="0">' +
        '<span class="plan-check"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span>' +
        "<span>" + escapeHtml(t) + "</span></li>";
    }).join("");
    var chip = $("#planProgressChip");
    if (chip) chip.textContent = state.plan.length + " / " + PLAN_ITEMS.length;
    var bar = $("#planBar");
    if (bar) bar.style.width = Math.round((state.plan.length / PLAN_ITEMS.length) * 100) + "%";
  }

  function usageMax() {
    var p = planLabel(state.user && state.user.plan).toLowerCase();
    return p === "free" ? 5 : p === "intermediate" ? 15 : 20;
  }
  function renderUsage() {
    var max = usageMax();
    var used = Math.min(state.usage, max);
    var el = $("#usageCount"); if (el) el.textContent = String(used);
    var bar = $("#usageBar"); if (bar) bar.style.width = Math.round((used / max) * 100) + "%";
    var chip = $("#planProgressChip");
    if (chip) chip.textContent = "1 / 4";
  }

  function answerFor(q) {
    var text = String(q || "").toLowerCase();
    var by = sessionStats();
    var worst = worstSession();
    var ws = by[worst] || { n: 0, net: 0, wins: 0 };
    var best = bestSetup();
    var overshoot = state.trades.filter(function (t) { return t.r < -1.2; });
    var impact = overshoot.reduce(function (a, t) { return a + (t.r + 1); }, 0);

    if (/ny|afternoon|pm|session|time/.test(text)) {
      return "<b>" + worst + "</b> is your weakest window: " + signed(ws.net) + "R over " + ws.n +
        " trades. Your London trades are " + signed((by.London ? by.London.net : 0) - ws.net) +
        "R better in aggregate. Try one setup, half size, and a hard stop on that session for two weeks.";
    }
    if (/breakout|setup|strategy|expectancy/.test(text)) {
      if (!best) return "Not enough repeat setups yet — log at least four trades per setup and I can rank them by expectancy.";
      return "<b>" + best.name + "</b> is your best setup: " + signed(best.exp, 2) + "R expectancy over " + best.n +
        " trades. Your sample is still small, so keep sizing it the same way for another 10 trades before you scale.";
    }
    if (/stop|loss|risk|drawdown|hold/.test(text)) {
      return overshoot.length
        ? "You have " + overshoot.length + " closes worse than −1.2R. Exiting at the planned stop would have added <b>" +
          signed(Math.abs(impact)) + "R</b> to your book. The entry is not the problem; the exit is."
        : "Your stops are clean — no close beyond −1.2R. Keep the hard stop in the terminal on so the rule enforces itself.";
    }
    return "Over your last " + state.trades.length + " trades you are " + signed(computeStats(state.trades).net) +
      "R with a " + Math.round(computeStats(state.trades).winRate) + "% win rate. The single biggest gain right now is the " +
      worst + " session: it costs you more than any other window. Ask me about a setup, a session or your stops.";
  }

  function runAnalysis() {
    var btn = $("#runAnalysis");
    if (btn) { btn.disabled = true; btn.textContent = "Analysing…"; }
    setTimeout(function () {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg class="ic ic--sm"><use href="#i-spark"/></svg> Run analysis';
      }
      state.usage = Math.min(usageMax(), state.usage + 1);
      write(KEY.usage, state.usage);
      renderUsage();
      renderMentor();
      toast("Analysis complete · " + state.trades.length + " trades scanned");
    }, 900);
  }

  /* ---------------- indicators ---------------- */
  var INDICATORS = [
    { id: "ema", name: "EMA 20 / 50", desc: "Trend context on every chart", val: "20 · 50", on: true },
    { id: "vwap", name: "Session VWAP", desc: "Rolling 96-bar VWAP with bands", val: "96 bars", on: true },
    { id: "rsi", name: "RSI 14", desc: "Momentum panel under the chart", val: "14", on: true },
    { id: "atr", name: "ATR 14", desc: "Used for R sizing suggestions", val: "14", on: true },
    { id: "vp", name: "Volume profile", desc: "Histogram of traded volume by price", val: "session", on: false },
    { id: "cal", name: "Economic calendar", desc: "High-impact events pinned to candles", val: "high", on: false }
  ];

  function renderIndicators() {
    var list = $("#indicatorList");
    if (!list) return;
    list.innerHTML = INDICATORS.map(function (i) {
      return '<div class="ind-row"><span class="ind-ico"><svg class="ic"><use href="#i-activity"/></svg></span>' +
        '<div class="ind-meta"><b>' + escapeHtml(i.name) + "</b><small>" + escapeHtml(i.desc) + "</small></div>" +
        '<span class="ind-val">' + escapeHtml(i.val) + "</span>" +
        '<label class="switch"><input type="checkbox" data-ind="' + i.id + '"' + (i.on ? " checked" : "") +
        ' aria-label="Toggle ' + escapeHtml(i.name) + '" /><i></i></label></div>';
    }).join("");
    var active = INDICATORS.filter(function (i) { return i.on; }).length;
    var chip = $("#indicatorCount");
    if (chip) chip.textContent = active + " active";
  }

  /* ---------------- settings ---------------- */
  function fillSettings() {
    var u = state.user || {};
    var name = $("#setName"); if (name) name.value = u.name || "";
    var email = $("#setEmail"); if (email) email.value = u.email || "";
    var tz = $("#setTz"); if (tz) tz.value = state.prefs.tz || PREF_DEFAULTS.tz;
    var exp = $("#setExp"); if (exp) exp.value = state.prefs.exp || PREF_DEFAULTS.exp;
    var sym = $("#setSymbol"); if (sym) sym.value = state.prefs.symbol || PREF_DEFAULTS.symbol;
    var tf = $("#setTf"); if (tf) tf.value = state.prefs.tf || PREF_DEFAULTS.tf;
    ["autoplay", "confirm", "calendar", "weekly", "alerts", "product"].forEach(function (k) {
      var el = $("#set" + k.charAt(0).toUpperCase() + k.slice(1));
      if (el) el.checked = state.prefs[k] !== undefined ? !!state.prefs[k] : PREF_DEFAULTS[k];
    });
    syncThemeUI();
  }

  function savePrefs() {
    write(KEY.prefs, state.prefs);
  }

  function readPrefs() {
    var stored = read(KEY.prefs, null) || {};
    var out = {};
    Object.keys(PREF_DEFAULTS).forEach(function (k) {
      out[k] = stored[k] !== undefined ? stored[k] : PREF_DEFAULTS[k];
    });
    return out;
  }

  /* ---------------- dialogs ---------------- */
  function openDialog(id) {
    var dlg = typeof id === "string" ? $(id) : id;
    if (!dlg) return null;
    if (dlg.open) return dlg;
    try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }
    return dlg;
  }
  function closeDialog(dlg) {
    if (!dlg) return;
    if (dlg.open && dlg.close) dlg.close();
    else dlg.removeAttribute("open");
  }

  function initTradeForm() {
    var form = $("#tradeForm");
    var dlg = $("#tradeModal");
    if (!form || !dlg) return;
    var dir = 1;
    var dirBox = $("#tDir");
    if (dirBox) {
      dirBox.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-dir]");
        if (!b) return;
        dir = parseInt(b.dataset.dir, 10);
        $$("button", dirBox).forEach(function (x) { x.classList.toggle("on", x === b); });
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var action = e.submitter ? e.submitter.value : "save";
      if (action !== "save") { closeDialog(dlg); return; }
      var symEl = $("#tSymbol");
      var sym = symEl ? symEl.value : "EUR/USD";
      var dateEl = $("#tDate");
      var dt = dateEl && dateEl.value ? dateEl.value : iso(new Date());
      var rEl = $("#tR");
      var r = rEl ? parseFloat(rEl.value) : NaN;
      if (!isFinite(r) || r < -3 || r > 10) {
        toast("Result must be between −3R and +10R", "error");
        if (rEl) rEl.focus();
        return;
      }
      var trade = {
        id: "t-" + Date.now().toString(36),
        date: dt,
        sym: sym,
        market: MARKETS[sym] || "Forex",
        dir: dir,
        setup: $("#tSetup") ? $("#tSetup").value : "Breakout",
        session: $("#tSession") ? $("#tSession").value : "London",
        r: r
      };
      state.trades.unshift(trade);
      write(KEY.trades, state.trades);
      refreshAll();
      closeDialog(dlg);
      toast("Trade logged · " + sym + " " + signed(r) + "R");
    });
  }

  function initSessionForm() {
    var form = $("#sessionForm");
    var dlg = $("#sessionModal");
    if (!form || !dlg) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var action = e.submitter ? e.submitter.value : "save";
      if (action !== "save") { closeDialog(dlg); return; }
      var sym = $("#sSymbol") ? $("#sSymbol").value : "EUR/USD";
      state.sessions.unshift({
        id: "s" + Date.now().toString(36),
        sym: sym,
        tf: $("#sTf") ? $("#sTf").value : "15m",
        session: $("#sSession") ? $("#sSession").value : "London",
        setup: $("#sSetup") ? $("#sSetup").value : "Breakout",
        progress: 0,
        trades: 0,
        netR: 0,
        win: 0,
        state: "live",
        when: "just now"
      });
      write(KEY.sessions, state.sessions);
      renderSessions();
      setView("sessions");
      closeDialog(dlg);
      toast("Session created · " + sym + " opens in the terminal");
    });
  }

  function confirmAction(title, copy, label, fn) {
    var dlg = openDialog("#confirmModal");
    var t = $("#confirmTitle"); if (t) t.textContent = title;
    var c = $("#confirmCopy"); if (c) c.textContent = copy;
    var ok = $("#confirmOk");
    if (ok) {
      ok.textContent = label;
      ok.onclick = function () {
        closeDialog(dlg);
        fn();
      };
    }
    var cancel = $("#confirmCancel");
    if (cancel) cancel.onclick = function () { closeDialog(dlg); };
  }

  function resetDemo() {
    state.trades = seedTrades();
    state.sessions = seedSessions();
    state.votes = {};
    state.usage = planLabel(state.user && state.user.plan).toLowerCase() === "free" ? 1 : 12;
    state.prefs = Object.assign({}, PREF_DEFAULTS);
    write(KEY.trades, state.trades);
    write(KEY.sessions, state.sessions);
    write(KEY.votes, state.votes);
    write(KEY.usage, state.usage);
    write(KEY.prefs, state.prefs);
    state.journalLimit = 12;
    state.hoverIdx = -1;
    fillSettings();
    refreshAll();
    toast("Demo workspace reset · 44 sample trades restored");
  }

  /* ---------------- refresh ---------------- */
  function refreshAll() {
    applyUser();
    renderOverview();
    renderSessions();
    renderJournal();
    renderProp();
    renderMentor();
    renderPlan();
    renderUsage();
    renderIndicators();
    renderWeek();
    if (state.view === "journal" || state.view === "overview") drawEquity(state.hoverIdx);
  }

  /* ---------------- gate / auth ---------------- */
  function bootUser() {
    var user = read(KEY.user, null);
    if (user && user.name) {
      state.user = user;
      return true;
    }
    return false;
  }

  function showGate() {
    var gate = $("#gate");
    if (!gate) return;
    if (gate.open) return;
    try { gate.showModal(); } catch (e) { gate.setAttribute("open", ""); }
    var demo = $("#demoLogin");
    if (demo) {
      demo.addEventListener("click", function () {
        var user = { name: "Mack", email: "mack@demo.kyorakureplay.com", plan: "pro", createdAt: new Date().toISOString(), demo: true };
        write(KEY.user, user);
        state.user = user;
        state.usage = 12;
        write(KEY.usage, state.usage);
        if (gate.open && gate.close) gate.close();
        applyUser();
        refreshAll();
        toast("Demo workspace ready · welcome, Mack");
      });
    }
    // no cancel path: the workspace needs a session
    gate.addEventListener("cancel", function (e) { e.preventDefault(); });
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    // theme
    var tt = $("#themeToggle");
    if (tt) tt.addEventListener("click", function () { toggleTheme(); });
    var picker = $("#themePicker");
    if (picker) {
      picker.addEventListener("click", function (e) {
        var b = e.target.closest("[data-theme]");
        if (!b) return;
        toggleTheme(b.dataset.theme);
      });
    }
    syncThemeUI();

    // nav
    $$(".sn-link").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        setView(a.dataset.view);
      });
    });
    $$("[href^='#']").forEach(function (a) {
      if (a.classList.contains("sn-link")) return;
      var href = a.getAttribute("href");
      if (!href || href === "#" || href.length < 2) return;
      var target = href.slice(1);
      if (!VIEW_META[target]) return;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        setView(target);
      });
    });
    window.addEventListener("hashchange", function () {
      var v = (location.hash || "#overview").slice(1);
      if (v !== state.view) setView(v, { silent: true });
    });

    // sidebar drawer
    var mb = $("#menuBtn");
    if (mb) mb.addEventListener("click", openDrawer);
    var sbClose = $("#sbClose");
    if (sbClose) sbClose.addEventListener("click", closeDrawer);
    var scrim = $("#scrim");
    if (scrim) scrim.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeDrawer(); closeAllPops(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        var s = $("#globalSearch");
        if (s) { if (getComputedStyle(s.parentElement).display === "none") { setView("journal"); } s.focus(); }
      }
    });

    // popovers
    bindPop("#userBtn", "#userPop");
    bindPop("#notifBtn", "#notifPop");
    bindPop("#workspaceBtn", "#workspacePop");
    document.addEventListener("click", closeAllPops);

    var logout = function () {
      drop(KEY.user);
      window.location.href = "login.html";
    };
    ["#logoutBtn", "#logoutBtn2"].forEach(function (sel) { var b = $(sel); if (b) b.addEventListener("click", logout); });

    var workspacePop = $("#workspacePop");
    if (workspacePop) {
      workspacePop.addEventListener("click", function (e) {
        var demoAction = e.target.closest("[data-demo-action]");
        if (demoAction) {
          closeAllPops();
          toast("Team workspaces are part of Pro+ · 1 seat used here");
        }
      });
    }

    // notifications
    var notifications = [
      { dot: "warn", title: "Challenge risk alert", copy: "You are at 24% of your max drawdown on the $100k evaluation.", time: "12m ago" },
      { dot: "", title: "New Mentor AI finding", copy: "Stop discipline is costing you more than any entry pattern.", time: "1h ago" },
      { dot: "ok", title: "Weekly review ready", copy: "Last week: +4.2R across 11 trades, 64% win rate.", time: "2d ago" }
    ];
    var notifList = $("#notifList");
    if (notifList) {
      notifList.innerHTML = notifications.map(function (n) {
        return '<div class="notif"><span class="notif-dot ' + n.dot + '"></span><div class="notif-body"><b>' +
          escapeHtml(n.title) + "</b><small>" + escapeHtml(n.copy) + " · " + escapeHtml(n.time) + "</small></div></div>";
      }).join("");
    }
    state.notifRead = read(KEY.notif, false) === true;
    var notifDot = $("#notifDot");
    if (notifDot) notifDot.classList.toggle("off", state.notifRead);
    var markRead = $("#markRead");
    if (markRead) {
      markRead.addEventListener("click", function () {
        state.notifRead = true;
        write(KEY.notif, true);
        if (notifDot) notifDot.classList.add("off");
        toast("Notifications marked as read");
      });
    }

    // overview actions
    var quick = $("#quickTrade");
    if (quick) quick.addEventListener("click", function () { openTradeModal(); });
    var addTrade = $("#addTradeBtn");
    if (addTrade) addTrade.addEventListener("click", function () { openTradeModal(); });
    var newSession = $("#newSessionBtn");
    if (newSession) newSession.addEventListener("click", function () {
      var dateEl = $("#tDate");
      if (dateEl) dateEl.value = iso(new Date());
      openDialog("#sessionModal");
    });

    // sessions
    var grid = $("#sessionGrid");
    if (grid) {
      grid.addEventListener("click", function (e) {
        var del = e.target.closest("[data-del]");
        if (!del) return;
        var id = del.dataset.del;
        var name = (state.sessions.filter(function (s) { return s.id === id; })[0] || {}).sym || "session";
        confirmAction("Delete this session?", "The session and its candles are removed from your workspace. Journal trades stay.", "Delete session", function () {
          state.sessions = state.sessions.filter(function (s) { return s.id !== id; });
          write(KEY.sessions, state.sessions);
          renderSessions();
          toast(name + " session deleted");
        });
      });
    }

    // journal filters
    var jf = $("#journalFilter");
    if (jf) {
      jf.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-filter]");
        if (!b) return;
        state.journalFilter = b.dataset.filter;
        $$("button", jf).forEach(function (x) { x.classList.toggle("on", x === b); });
        state.journalLimit = 12;
        renderJournal();
      });
    }
    var js = $("#journalSearch");
    if (js) {
      js.addEventListener("input", function () {
        state.journalSearch = js.value;
        state.journalLimit = 12;
        renderJournal();
      });
    }
    var gs = $("#globalSearch");
    if (gs) {
      gs.addEventListener("input", function () {
        state.journalSearch = gs.value;
        var input = $("#journalSearch");
        if (input) input.value = gs.value;
        state.journalLimit = 12;
        if (state.journalSearch.length > 1 && state.view !== "journal") setView("journal", { silent: true });
        renderJournal();
      });
    }
    var mf = $("#marketFilter");
    if (mf) {
      mf.addEventListener("change", function () {
        state.journalMarket = mf.value;
        state.journalLimit = 12;
        renderJournal();
      });
    }
    var sortR = $("#sortR");
    if (sortR) {
      var flip = function () {
        state.journalSort = state.journalSort === "desc" ? "asc" : "desc";
        var icon = sortR.querySelector("svg");
        if (icon) icon.style.transform = state.journalSort === "desc" ? "none" : "rotate(180deg)";
        renderJournal();
      };
      sortR.addEventListener("click", flip);
      sortR.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
      });
    }
    var more = $("#loadMoreBtn");
    if (more) {
      more.addEventListener("click", function () {
        state.journalLimit += 12;
        renderJournal();
      });
    }
    var jbody = $("#journalBody");
    if (jbody) {
      jbody.addEventListener("click", function (e) {
        var b = e.target.closest("[data-del-trade]");
        if (!b) return;
        var id = b.dataset.delTrade;
        var t = state.trades.filter(function (x) { return x.id === id; })[0];
        state.trades = state.trades.filter(function (x) { return x.id !== id; });
        write(KEY.trades, state.trades);
        refreshAll();
        toast((t ? t.sym : "Trade") + " removed from journal");
      });
    }

    // export
    var exportCsv = function () {
      var rows = [["date", "symbol", "market", "direction", "setup", "session", "r", "pnl_usd"]];
      state.trades.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (t) {
        rows.push([t.date, t.sym, t.market, t.dir > 0 ? "long" : "short", t.setup, t.session, t.r, Math.round(t.r * RISK_PER_R)]);
      });
      var csv = rows.map(function (r) { return r.join(","); }).join("\n");
      try {
        var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "kyorakureplay-journal.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        toast("Exported " + state.trades.length + " trades to CSV");
      } catch (err) {
        toast("Export is not available in this browser", "error");
      }
    };
    var ex1 = $("#exportBtn"); if (ex1) ex1.addEventListener("click", exportCsv);
    var ex2 = $("#exportBtn2"); if (ex2) ex2.addEventListener("click", exportCsv);

    // equity range
    var range = $("#equityRange");
    if (range) {
      range.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-range]");
        if (!b) return;
        state.equityRange = b.dataset.range;
        $$("button", range).forEach(function (x) { x.classList.toggle("on", x === b); });
        state.hoverIdx = -1;
        drawEquity(-1);
      });
    }

    // prop rules
    var propGrid = $("#propGrid");
    if (propGrid) {
      propGrid.addEventListener("click", function (e) {
        if (e.target.closest(".pc-rules-btn")) toast("Phase 2 unlocks when Phase 1 is verified · $3,000 target, $2,500 max DD");
      });
    }

    // mentor
    var run = $("#runAnalysis");
    if (run) run.addEventListener("click", runAnalysis);
    var feed = $("#mentorFeed");
    if (feed) {
      feed.addEventListener("click", function (e) {
        var vote = e.target.closest("[data-vote]");
        if (vote) {
          var id = vote.dataset.vote;
          state.votes[id] = state.votes[id] === "helpful" ? null : "helpful";
          if (!state.votes[id]) delete state.votes[id];
          write(KEY.votes, state.votes);
          renderMentor();
          toast(state.votes[id] ? "Marked helpful · the next analysis weighs it more" : "Vote removed");
          return;
        }
        var dis = e.target.closest("[data-dismiss]");
        if (dis) {
          state.votes[dis.dataset.dismiss] = "dismissed";
          write(KEY.votes, state.votes);
          renderMentor();
          toast("Finding dismissed · run an analysis to refresh");
        }
      });
    }
    var askBtn = $("#askBtn");
    if (askBtn) askBtn.addEventListener("click", ask);
    var askInput = $("#askInput");
    if (askInput) {
      askInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); ask(); }
      });
    }
    function ask() {
      var input = $("#askInput");
      var box = $("#askAnswer");
      if (!input || !box) return;
      var q = input.value.trim();
      if (!q) { toast("Type a question first", "error"); input.focus(); return; }
      box.hidden = false;
      box.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      setTimeout(function () {
        box.innerHTML = answerFor(q);
        input.value = "";
      }, 800);
    }
    $$("[data-q]").forEach(function (b) {
      b.addEventListener("click", function () {
        var input = $("#askInput");
        if (input) input.value = b.dataset.q;
        ask();
      });
    });

    var planList = $("#planList");
    if (planList) {
      var togglePlan = function (li) {
        if (!li) return;
        var i = parseInt(li.dataset.plan, 10);
        var at = state.plan.indexOf(i);
        if (at === -1) state.plan.push(i);
        else state.plan.splice(at, 1);
        write(KEY.plan, state.plan);
        renderPlan();
        toast(at === -1 ? "Review task checked off" : "Review task reopened");
      };
      planList.addEventListener("click", function (e) { togglePlan(e.target.closest("[data-plan]")); });
      planList.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePlan(e.target.closest("[data-plan]")); }
      });
    }

    // indicators
    var indList = $("#indicatorList");
    if (indList) {
      indList.addEventListener("change", function (e) {
        var input = e.target.closest("[data-ind]");
        if (!input) return;
        var item = INDICATORS.filter(function (i) { return i.id === input.dataset.ind; })[0];
        if (!item) return;
        item.on = input.checked;
        var active = INDICATORS.filter(function (i) { return i.on; }).length;
        var chip = $("#indicatorCount");
        if (chip) chip.textContent = active + " active";
        toast(item.name + (item.on ? " enabled" : " disabled") + " on new charts");
      });
    }

    // settings
    var profile = $("#profileForm");
    if (profile) {
      profile.addEventListener("submit", function (e) {
        e.preventDefault();
        var nameEl = $("#setName");
        var emailEl = $("#setEmail");
        var name = nameEl ? nameEl.value.trim() : "";
        var email = emailEl ? emailEl.value.trim() : "";
        if (name.length < 2) { toast("Enter your full name", "error"); if (nameEl) nameEl.focus(); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast("That email does not look right", "error"); if (emailEl) emailEl.focus(); return; }
        state.user = Object.assign({}, state.user || {}, { name: name, email: email });
        write(KEY.user, state.user);
        state.prefs.tz = $("#setTz") ? $("#setTz").value : state.prefs.tz;
        state.prefs.exp = $("#setExp") ? $("#setExp").value : state.prefs.exp;
        savePrefs();
        applyUser();
        renderOverview();
        toast("Profile saved");
      });
    }
    var bindPref = function (sel, key) {
      var el = $(sel);
      if (!el) return;
      el.addEventListener("change", function () {
        state.prefs[key] = el.type === "checkbox" ? el.checked : el.value;
        savePrefs();
        toast("Preference saved · " + key);
      });
    };
    bindPref("#setSymbol", "symbol");
    bindPref("#setTf", "tf");
    bindPref("#setAutoplay", "autoplay");
    bindPref("#setConfirm", "confirm");
    bindPref("#setCalendar", "calendar");
    bindPref("#setWeekly", "weekly");
    bindPref("#setAlerts", "alerts");
    bindPref("#setProduct", "product");

    var reset = $("#resetBtn");
    if (reset) reset.addEventListener("click", function () {
      confirmAction("Reset demo data?", "This restores the sample journal, sessions and insights. Your profile and theme stay as they are.", "Reset data", resetDemo);
    });
    var footReset = $("#footReset");
    if (footReset) {
      footReset.addEventListener("click", function (e) {
        e.preventDefault();
        confirmAction("Reset demo data?", "This restores the sample journal, sessions and insights. Your profile and theme stay as they are.", "Reset data", resetDemo);
      });
    }

    // dialogs: cancel buttons & forms
    initTradeForm();
    initSessionForm();
    $$("button[value='cancel']").forEach(function (b) {
      b.addEventListener("click", function (e) {
        var dlg = b.closest("dialog");
        if (dlg) { e.preventDefault(); closeDialog(dlg); }
      });
    });

    // resize
    var debounce = null;
    window.addEventListener("resize", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        state.hoverIdx = -1;
        drawEquity(-1);
        if (window.innerWidth > 1024) closeDrawer();
      }, 140);
    });
    if (window.ResizeObserver) {
      var wrap = $("#equityChart") ? $("#equityChart").parentElement : null;
      if (wrap) new ResizeObserver(function () {
        state.hoverIdx = -1;
        drawEquity(-1);
      }).observe(wrap);
    }
    bindEquityHover();

    // gate cancel lock (also when opened later)
    var gate = $("#gate");
    if (gate) gate.addEventListener("cancel", function (e) { e.preventDefault(); });
  }

  function openTradeModal() {
    var dlg = $("#tradeModal");
    var dateEl = $("#tDate");
    if (dateEl) dateEl.value = iso(new Date());
    var rEl = $("#tR");
    if (rEl) rEl.value = "1.5";
    var dirBox = $("#tDir");
    if (dirBox) $$("button", dirBox).forEach(function (x) { x.classList.toggle("on", x.dataset.dir === "1"); });
    openDialog(dlg);
  }

  /* ---------------- init ---------------- */
  function init() {
    var signedIn = bootUser();
    state.prefs = readPrefs();
    state.trades = read(KEY.trades, null) || seedTrades();
    if (!read(KEY.trades, null)) write(KEY.trades, state.trades);
    state.sessions = read(KEY.sessions, null) || seedSessions();
    if (!read(KEY.sessions, null)) write(KEY.sessions, state.sessions);
    state.votes = read(KEY.votes, {}) || {};
    state.plan = read(KEY.plan, null) || [0];
    if (!Array.isArray(state.plan)) state.plan = [0];
    state.usage = read(KEY.usage, null);
    if (state.usage === null) {
      state.usage = planLabel(state.user && state.user.plan).toLowerCase() === "free" ? 1 : 12;
      write(KEY.usage, state.usage);
    }

    wire();

    applyUser();
    fillSettings();
    refreshAll();

    if (!signedIn) {
      setView("overview", { silent: true });
      drawEquity(-1);
      showGate();
      return;
    }

    var v = (location.hash || "").slice(1);
    setView(VIEW_META[v] ? v : "overview", { silent: true });
    if (!VIEW_META[v]) history.replaceState(null, "", "#overview");

    // greet line rotates on what the data says
    var stats = computeStats(state.trades);
    var gl = $("#greetLine");
    if (gl) {
      if (stats.net > 0) gl.textContent = "You’re " + signed(stats.net) + "R up across " + stats.count + " logged trades. Keep the process boring.";
      else gl.textContent = "Down " + signed(stats.net) + "R so far. One clean session at a time — the journal will show it.";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
