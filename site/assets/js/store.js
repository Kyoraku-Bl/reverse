/* KyorakuReplay — local accounts and per-email state
 *
 * There is no server. An account lives in this browser, and everything a user
 * creates (sessions, trades, drawings, watchlist) is stored under a key made
 * from their email, so two people on the same machine never see each other's
 * numbers.
 */
(function (global) {
  "use strict";

  var A = "ky.accounts";
  var S = "ky.session";

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function keyFor(email) { return "ky.u." + hash(String(email).trim().toLowerCase()); }

  function accounts() { return read(A, {}); }

  function signup(email, name, password) {
    email = String(email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That email does not look right." };
    if (!password || password.length < 6) return { error: "Use at least 6 characters." };
    var all = accounts();
    if (all[email]) return { error: "This email already has an account. Log in instead." };
    all[email] = {
      email: email,
      name: (name || email.split("@")[0]).trim(),
      pass: hash(password + "|ky"),
      createdAt: Date.now()
    };
    write(A, all);
    session(email);
    return { user: publicUser(all[email]) };
  }

  function login(email, password) {
    email = String(email || "").trim().toLowerCase();
    var all = accounts();
    var u = all[email];
    if (!u) return { error: "No account for this email on this browser." };
    if (u.pass !== hash(password + "|ky")) return { error: "Wrong password." };
    session(email);
    return { user: publicUser(u) };
  }

  function session(email) {
    write(S, { email: email, at: Date.now() });
    var st = state();
    if (!st.createdAt) { st.createdAt = Date.now(); save(st); }
  }
  function logout() { localStorage.removeItem(S); }

  function current() {
    var s = read(S, null);
    if (!s || !s.email) return null;
    var u = accounts()[s.email];
    return u ? publicUser(u) : null;
  }

  function publicUser(u) {
    return { email: u.email, name: u.name, createdAt: u.createdAt, initials: initials(u.name || u.email) };
  }
  function initials(s) {
    var parts = String(s).replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
    return ((parts[0] || "?")[0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  /* ---------------- per-user workspace ---------------- */
  function blank() {
    return {
      createdAt: Date.now(),
      theme: null,
      watchlist: ["NQ", "ES", "NAS100", "BTCUSD"],
      symbol: "NQ",
      tf: "15m",
      trades: [],
      journal: [],
      drawings: {},
      sessions: [],
      settings: { showVolume: true, showEma: true, grid: true, sessions: true }
    };
  }

  function state() {
    var u = current();
    if (!u) return blank();
    var k = keyFor(u.email);
    var st = read(k, null);
    if (!st) { st = blank(); write(k, st); }
    st.trades = st.trades || [];
    st.journal = st.journal || [];
    st.drawings = st.drawings || {};
    st.sessions = st.sessions || [];
    st.watchlist = st.watchlist || [];
    st.settings = st.settings || {};
    return st;
  }
  function save(st) {
    var u = current();
    if (!u) return;
    write(keyFor(u.email), st);
  }
  function patch(fn) {
    var st = state();
    fn(st);
    save(st);
    return st;
  }

  /* ---------------- theme ---------------- */
  function theme() {
    var saved = null;
    try { saved = localStorage.getItem("ky.theme"); } catch (e) {}
    if (saved) return saved;
    var u = current();
    if (u) {
      var st = state();
      if (st.theme) return st.theme;
    }
    /* the terminal is a night-time tool; light is one click away */
    return "dark";
  }
  function setTheme(t) {
    try { localStorage.setItem("ky.theme", t); } catch (e) {}
    document.documentElement.setAttribute("data-theme", t);
    var u = current();
    if (u) patch(function (st) { st.theme = t; });
  }
  function bootTheme() {
    document.documentElement.setAttribute("data-theme", theme());
  }

  global.KYStore = {
    accounts: accounts, signup: signup, login: login, logout: logout,
    current: current, state: state, save: save, patch: patch, blank: blank,
    theme: theme, setTheme: setTheme, bootTheme: bootTheme,
    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  };
  bootTheme();
})(window);
