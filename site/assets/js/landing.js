/* KyorakuReplay — landing page wiring */
(function () {
  "use strict";
  var F = window.KYFeed, S = window.KYStore, $ = function (s) { return document.querySelector(s); };
  var AR = document.documentElement.lang === "ar";
  var T = AR ? {
    login: "دخول", signup: "سجّل مجاناً", heroSym: "NQ · إي-ميني ناسداك 100 (CME)",
    live: "حي", snap: "لقطة", offline: "المزوّد غير متاح",
    waiting: "الأسعار تصل مع مهمة اللقطة القادمة.",
    noSnap: "اللقطة المنشورة غير متاحة الآن. سيحاول التيرمينال الاتصال الحيّ مباشرة.",
    unavailable: "غير متاح", built: "بُنيت اللقطة", instruments: "أداة"
  } : {
    login: "Log in", signup: "Sign up free", heroSym: "NQ · E-mini Nasdaq-100 (CME)",
    live: "LIVE", snap: "SNAPSHOT", offline: "feed offline",
    waiting: "Quotes arrive with the next snapshot run.",
    noSnap: "The published snapshot is unavailable right now. The terminal will try the live feed directly.",
    unavailable: "unavailable", built: "Snapshot built", instruments: "instruments"
  };

  function fmt(p, dp) {
    return Number(p).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* --- auth slot --- */
  function authSlot() {
    var u = S.current();
    var slot = $("#authSlot");
    if (!slot) return;
    if (u) {
      slot.innerHTML = '<a class="nav__user" href="dashboard.html"><span class="avatar">' + esc(u.initials) + "</span><span style=\"font-size:13px\">" + esc(u.name) + "</span></a>";
    } else {
      slot.innerHTML = '<a class="btn btn--ghost btn--sm" href="login.html" style="margin-' + (AR ? "left" : "right") + ':6px">' + T.login + "</a>" +
        '<a class="btn btn--primary btn--sm" href="signup.html">' + T.signup + "</a>";
    }
  }

  /* --- theme --- */
  function themeBtn() {
    var b = $("#themeBtn");
    if (!b) return;
    b.innerHTML = '<svg class="ic"><use href="#i-' + (S.theme() === "dark" ? "sun" : "moon") + '"/></svg>';
    b.onclick = function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      S.setTheme(next);
      b.innerHTML = '<svg class="ic"><use href="#i-' + (next === "dark" ? "sun" : "moon") + '"/></svg>';
      paint();
    };
  }

  /* --- hero chart --- */
  var heroBars = [];
  function hero() {
    F.load("NQ", "1H").then(function (doc) {
      $("#heroSym").textContent = T.heroSym;
      heroBars = doc.bars;
      var last = doc.bars[doc.bars.length - 1], prev = doc.bars[doc.bars.length - 2];
      $("#heroPx").textContent = fmt(last[4], 2) + "  " + (last[4] >= prev[4] ? "▲" : "▼") + " " +
        Math.abs(((last[4] - prev[4]) / prev[4]) * 100).toFixed(2) + "%";
      var pill = $("#heroPill");
      $("#heroPillText").textContent = doc.transport === "live" ? T.live : T.snap;
      pill.style.color = doc.transport === "live" ? "var(--accent-2)" : "var(--amber)";
      paint();
    }).catch(function () {
      $("#heroPillText").textContent = T.offline;
      $("#heroPill").className = "live-pill";
      $("#heroPill").style.color = "var(--down)";
    });
  }
  function paint() {
    if (heroBars.length) window.KYChart.sparkline($("#heroChart"), heroBars, null);
  }

  /* --- ticker strip --- */
  function ticker() {
    F.quotes(["NQ", "ES", "NAS100", "BTCUSD", "XAUUSD", "EURUSD", "CL", "GER40"]).then(function (q) {
      var ids = Object.keys(q);
      if (!ids.length) { $("#ticker").innerHTML = '<span style="color:var(--muted);font-size:13px">' + T.waiting + "</span>"; return; }
      $("#ticker").innerHTML = ids.map(function (id) {
        var row = q[id], a = F.get(id);
        var d = row.prev ? ((row.last - row.prev) / row.prev) * 100 : 0;
        return '<span class="tick"><b>' + esc(a.label) + "</b><span>" + fmt(row.last, a.dp) + "</span>" +
          '<span class="' + (d >= 0 ? "up" : "down") + '">' + (d >= 0 ? "+" : "") + d.toFixed(2) + "%</span></span>";
      }).join("");
    }).catch(function () {
      $("#ticker").innerHTML = '<span style="color:var(--muted);font-size:13px">' + T.waiting + "</span>";
    });
  }

  /* --- symbol grid --- */
  function symGrid() {
    var picks = ["NQ", "ES", "NAS100", "SPX500", "MNQ", "MES", "BTCUSD", "XAUUSD", "EURUSD", "GER40", "CL", "GC"];
    $("#symGrid").innerHTML = picks.map(function (id) {
      var a = F.get(id);
      return '<a class="sym-card" href="terminal.html?sym=' + a.id + '&tf=15m"><span><b>' + esc(a.label) + "</b><small>" + esc(a.name) + "</small></span>" +
        '<span class="venue">' + esc(a.venue) + "</span></a>";
    }).join("");
  }

  /* --- data panel --- */
  function dataPanel() {
    Promise.all([F.index(), F.quotes()]).then(function (res) {
      var idx = res[0], q = res[1];
      var pill = $("#dataPill");
      if (!idx) {
        pill.textContent = "no snapshot";
        $("#dataBody").innerHTML = '<p class="empty">' + T.noSnap + "</p>";
        return;
      }
      pill.textContent = idx.count + " " + T.instruments;
      pill.style.color = "var(--accent-2)";
      var ids = Object.keys(q).slice(0, 8);
      var rows = ids.map(function (id) {
        var a = F.get(id), row = q[id];
        var age = Math.max(0, Math.round((Date.now() - (row.t * 1000)) / 60000));
        return '<tr><td><b>' + esc(a.label) + "</b></td><td style=\"color:var(--muted)\">" + esc(a.venue) + "</td>" +
          "<td class=\"num\">" + fmt(row.last, a.dp) + "</td><td class=\"num\" style=\"color:var(--muted)\">" + age + "m</td></tr>";
      }).join("");
      $("#dataBody").innerHTML =
        '<table class="tbl"><thead><tr><th>Symbol</th><th>Venue</th><th class="num">Last</th><th class="num">Age</th></tr></thead><tbody>' + rows + "</tbody></table>" +
        '<p style="margin-top:10px;font-size:12px;color:var(--muted)">' + T.built + " " +
        new Date(idx.generatedAt).toLocaleString(AR ? "ar-MA" : "en-GB") + " · " + idx.count + " " + T.instruments + "</p>";
    }).catch(function () {
      $("#dataPill").textContent = T.unavailable;
    });
  }

  authSlot();
  themeBtn();
  symGrid();
  hero();
  ticker();
  dataPanel();
  window.addEventListener("resize", function () { paint(); });
})();
