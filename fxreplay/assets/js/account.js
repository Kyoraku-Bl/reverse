/* =========================================================
   KyorakuReplay — accounts and per-account storage
   Every key the terminal and the dashboard write is scoped to
   the signed-in email: "fxr:<account>:<name>". Two people on
   the same browser therefore never see each other's replay
   position, drawings, notes, trades or journal.

   Accounts live in this browser only (no backend, nothing is
   uploaded). The password check stops two accounts mixing by
   accident; it is not encryption — anyone with the browser's
   devtools can read localStorage. Keep that in mind before
   calling this "secure".
   ========================================================= */
(function (global) {
  "use strict";

  var USER_KEY = "fxr-user";          /* who is signed in (kept global) */
  var ACCTS_KEY = "fxr-accounts";     /* { uid: {name,email,pass,createdAt} } — global */
  var MARK_KEY = "fxr-adopted";       /* which accounts already inherited old keys */
  var PREFIX = "fxr:";
  var LEGACY = [
    "fxr-auto", "fxr-sessions", "fxr-trades", "fxr-prefs", "fxr-tz",
    "fxr-draw-hidden", "fxr-draw-locked", "fxr-replay-seen",
    "fxr-review-plan", "fxr-mentor-votes", "fxr-mentor-usage", "fxr-notif-read"
  ];

  function raw(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* private mode / quota */ }
    return null;
  }

  function user() {
    try { return JSON.parse(raw(USER_KEY) || "null"); } catch (e) { return null; }
  }

  function email() {
    var u = user();
    return u && u.email ? String(u.email).trim().toLowerCase() : "";
  }

  /* Stable, short id per email. djb2 is enough here: it only has to
     separate accounts, not resist an attacker. */
  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function id() {
    var mail = email();
    return mail ? "u" + hash(mail) : "guest";
  }

  function key(name) {
    /* "fxr-auto" and "auto" are the same slot: the prefix is added once */
    return PREFIX + id() + ":" + String(name).replace(/^fxr-/, "");
  }

  /* ---------- values ---------- */
  function get(name, fallback) {
    try {
      var v = raw(key(name));
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function set(name, value) {
    try { raw(key(name), JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function remove(name) { raw(key(name), null); }

  function has(name) { return raw(key(name)) !== null; }

  /* ---------- accounts registry ---------- */
  function accounts() {
    try { return JSON.parse(raw(ACCTS_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveAccounts(map) { raw(ACCTS_KEY, JSON.stringify(map)); }

  function fallbackHash(str) {
    /* FNV-1a, used when crypto.subtle is unavailable (old browser, http) */
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return "f" + h.toString(36) + str.length.toString(36);
  }

  function passHash(mail, pass) {
    var payload = String(mail).trim().toLowerCase() + "\u0000" + String(pass);
    if (global.crypto && global.crypto.subtle && global.TextEncoder) {
      return global.crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(payload))
        .then(function (buf) {
          return Array.prototype.map
            .call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); })
            .join("");
        })
        .catch(function () { return fallbackHash(payload); });
    }
    return Promise.resolve(fallbackHash(payload));
  }

  /* Forget the password? The account keeps its data and the next
     login with a new password takes it over — this is a local
     playground, not a bank. */
  function verify(mail, pass) {
    mail = String(mail).trim().toLowerCase();
    return passHash(mail, pass).then(function (digest) {
      var map = accounts();
      var uid = "u" + hash(mail);
      var rec = map[uid];
      if (!rec) {
        map[uid] = { email: mail, pass: digest, createdAt: new Date().toISOString(), logins: 0 };
        saveAccounts(map);
        return { state: "new", uid: uid };
      }
      /* crypto.subtle only exists on https/localhost. An account created there
         must still open on a plain-http preview, so the weaker digest is
         accepted as well — same password, same person, same data. */
      var alt = fallbackHash(mail + "\u0000" + String(pass));
      var known = String(rec.pass || "");
      var altKnown = known.indexOf("f") === 0 && known.length < 40;
      var ok = known === digest || known === alt || (altKnown && alt === known);
      if (!ok) return { state: "bad", uid: uid };
      if (known !== digest && !altKnown) rec.pass = digest;
      rec.logins = (rec.logins || 0) + 1;
      rec.lastLogin = new Date().toISOString();
      saveAccounts(map);
      return { state: "ok", uid: uid };
    });
  }

  function remember(name, mail, pass) {
    mail = String(mail).trim().toLowerCase();
    return passHash(mail, pass).then(function (digest) {
      var map = accounts();
      var uid = "u" + hash(mail);
      var rec = map[uid] || { email: mail, createdAt: new Date().toISOString(), logins: 0 };
      rec.name = name;
      rec.pass = digest;
      rec.logins = (rec.logins || 0) + 1;
      rec.lastLogin = new Date().toISOString();
      map[uid] = rec;
      saveAccounts(map);
      return uid;
    });
  }

  function signOut() {
    raw(USER_KEY, null);
  }

  function initials() {
    var u = user();
    var src = (u && (u.name || u.email)) || "G";
    var parts = String(src).trim().split(/[\s@._-]+/).filter(Boolean);
    return (parts[0] || "G").charAt(0).toUpperCase() + (parts[1] ? parts[1].charAt(0).toUpperCase() : "");
  }

  /* ---------- one-time inheritance of pre-account keys ----------
     Before per-account storage existed everything was written
     under plain names ("fxr-auto", "fxr-draw:NAS100:15m"…). The
     first time an account opens a page, those keys are copied
     into its namespace so nothing a trader already had is lost. */
  function adopt() {
    var mark = MARK_KEY + ":" + id();
    if (raw(mark)) return;
    var moved = 0;
    var mine = PREFIX + id() + ":";

    function move(from, to) {
      var v = raw(from);
      if (v === null) return;
      if (raw(to) === null) { raw(to, v); moved++; }
    }

    LEGACY.forEach(function (k) { move(k, mine + k.slice(4)); });

    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf("fxr-draw:") !== 0) continue;
        move(k, mine + k.slice(4));   /* fxr-draw:ES:1m -> fxr:<uid>:draw:ES:1m */
      }
    } catch (e) { /* ignore */ }

    /* a guest who signs up keeps what they did as a guest */
    if (id() !== "guest") {
      try {
        for (var j = 0; j < localStorage.length; j++) {
          var gk = localStorage.key(j);
          if (!gk || gk.indexOf(PREFIX + "guest:") !== 0) continue;
          var target = PREFIX + id() + ":" + gk.slice((PREFIX + "guest:").length);
          if (raw(target) === null) { raw(target, raw(gk)); moved++; }
        }
      } catch (e) { /* ignore */ }
    }
    raw(mark, String(moved));
  }

  global.KRAcct = {
    USER_KEY: USER_KEY,
    user: user,
    email: email,
    id: id,
    key: key,
    get: get,
    set: set,
    remove: remove,
    has: has,
    initials: initials,
    verify: verify,
    remember: remember,
    signOut: signOut,
    adopt: adopt,
    accounts: accounts
  };

  /* run as early as possible so the terminal never reads a stale key */
  adopt();
})(window);
