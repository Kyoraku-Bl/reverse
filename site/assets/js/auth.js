/* KyorakuReplay — signup / login form */
(function () {
  "use strict";
  var S = window.KYStore;
  var form = document.getElementById("form");
  if (!form) return;
  var page = form.dataset.page;
  var msg = document.getElementById("msg");

  function say(text, ok) {
    msg.textContent = text;
    msg.className = "form-msg" + (ok ? " ok" : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = (document.getElementById("email").value || "").trim();
    var pass = document.getElementById("pass").value || "";
    var nameEl = document.getElementById("name");
    var res;
    if (page === "signup") {
      if (!email) { say("Your email is needed."); return; }
      if (!pass || pass.length < 6) { say("Use at least 6 characters for the password."); return; }
      res = S.signup(email, nameEl ? nameEl.value : "", pass);
    } else {
      res = S.login(email, pass);
    }
    if (res.error) { say(res.error); return; }
    say("Welcome, " + res.user.name + " — opening your dashboard…", true);
    var next = new URLSearchParams(location.search).get("next") || "dashboard.html";
    setTimeout(function () { location.href = next; }, 550);
  });

  /* a returning user who opens /login again should not have to retype */
  var current = S.current();
  if (current && page === "login") {
    var emailInput = document.getElementById("email");
    if (emailInput && !emailInput.value) emailInput.value = current.email;
  }
})();
