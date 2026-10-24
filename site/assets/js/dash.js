/* KyorakuReplay — dashboard */
(function () {
  "use strict";
  var S = window.KYStore, F = window.KYFeed, $ = function (s) { return document.querySelector(s); };
  var user = S.current();
  if (!user) { location.replace("login.html?next=dashboard.html"); return; }
  var st = S.state();

  function fmt(p, dp) {
    return Number(p).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function money(v) {
    return (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  $("#who").innerHTML = '<span class="avatar">' + esc(user.initials) + '</span><span style="font-size:13px">' + esc(user.name) + "</span>";
  $("#greeting").textContent = "Welcome back, " + user.name.split(" ")[0];
  $("#subGreeting").textContent = user.email + " · workspace since " + new Date(user.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  /* theme */
  var tb = $("#themeBtn");
  tb.innerHTML = '<svg class="ic"><use href="#i-' + (S.theme() === "dark" ? "sun" : "moon") + '"/></svg>';
  tb.onclick = function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    S.setTheme(next);
    tb.innerHTML = '<svg class="ic"><use href="#i-' + (next === "dark" ? "sun" : "moon") + '"/></svg>';
  };
  $("#logoutBtn").onclick = function () { S.logout(); location.href = "index.html"; };

  /* KPIs */
  var pnl = st.journal.reduce(function (s, j) { return s + j.pnl; }, 0);
  var wins = st.journal.filter(function (j) { return j.pnl > 0; }).length;
  var kp = $("#kPnl");
  kp.textContent = money(pnl);
  kp.className = pnl > 0 ? "up" : pnl < 0 ? "down" : "";
  $("#kTrades").textContent = st.journal.length;
  $("#kWin").textContent = st.journal.length ? Math.round((wins / st.journal.length) * 100) + "%" : "—";
  $("#kOpen").textContent = st.trades.length;

  /* journal */
  var body = $("#journalBody");
  if (!st.journal.length) {
    body.innerHTML = "";
    $("#journalEmpty").hidden = false;
  } else {
    $("#journalEmpty").hidden = true;
    body.innerHTML = st.journal.slice(0, 12).map(function (j) {
      var a = F.get(j.sym);
      var d = new Date(j.at);
      return "<tr><td>" + d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " <span style=\"color:var(--muted)\">" +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + "</span></td>" +
        "<td><b>" + esc(a.label) + '</b> <span style="color:var(--muted);font-size:11px">' + esc(a.venue) + "</span></td>" +
        "<td>" + (j.side === "long" ? "Long" : "Short") + " × " + j.qty + "</td>" +
        '<td class="num">' + fmt(j.entry, a.dp) + '</td><td class="num">' + fmt(j.exit, a.dp) + "</td>" +
        '<td class="num ' + (j.pnl >= 0 ? "up" : "down") + '">' + money(j.pnl) + "</td></tr>";
    }).join("");
  }

  /* watchlist with real quotes */
  var wl = st.watchlist.length ? st.watchlist : ["NQ", "ES", "NAS100"];
  $("#watchList").innerHTML = wl.map(function (id) {
    var a = F.get(id);
    return '<a class="watch__row" href="terminal.html?sym=' + id + '&tf=' + encodeURIComponent(st.tf || "15m") + '">' +
      "<span><b>" + esc(a.label) + '</b><small style="color:var(--muted);font-size:11px;display:block">' + esc(a.venue) + "</small></span>" +
      '<span class="px" data-px="' + id + '">—</span><span class="chg" data-chg="' + id + '">—</span></a>';
  }).join("");
  F.quotes(wl).then(function (q) {
    Object.keys(q).forEach(function (id) {
      var row = q[id], a = F.get(id);
      var px = document.querySelector('[data-px="' + id + '"]');
      var ch = document.querySelector('[data-chg="' + id + '"]');
      if (px) px.textContent = fmt(row.last, a.dp);
      if (ch && row.prev) {
        var d = ((row.last - row.prev) / row.prev) * 100;
        ch.textContent = (d >= 0 ? "+" : "") + d.toFixed(2) + "%";
        ch.className = "chg " + (d >= 0 ? "up" : "down");
      }
    });
  }).catch(function () {});

  /* workspace summary */
  var drawings = Object.keys(st.drawings).reduce(function (n, k) { return n + (st.drawings[k] || []).length; }, 0);
  $("#wsBody").innerHTML =
    '<div class="watch__row" style="cursor:default"><span>Symbol</span><span class="px">' + esc(st.symbol || "NQ") + " · " + esc(st.tf || "15m") + "</span></div>" +
    '<div class="watch__row" style="cursor:default"><span>Drawings saved</span><span class="px">' + drawings + "</span></div>" +
    '<div class="watch__row" style="cursor:default"><span>Sessions</span><span class="px">' + st.sessions.length + "</span></div>" +
    '<p style="color:var(--muted);font-size:12px;margin-top:12px">Everything here is stored under <b style="color:var(--txt-2)">' + esc(user.email) +
    "</b> in this browser. Another email on the same machine sees a separate, empty workspace.</p>";
})();
