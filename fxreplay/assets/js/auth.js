/* KyorakuReplay — auth pages. Local-only accounts: no requests leave the browser. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem("fxr-theme", theme); } catch (e) {}
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f5f7fc" : "#06080f");
    const btn = $("#themeToggle");
    if (btn) {
      btn.setAttribute("aria-label", `Switch to ${theme === "light" ? "dark" : "light"} theme`);
      btn.setAttribute("aria-pressed", String(theme === "light"));
    }
  }
  $("#themeToggle")?.addEventListener("click", () =>
    applyTheme(root.dataset.theme === "light" ? "dark" : "light")
  );
  applyTheme(root.dataset.theme === "light" ? "light" : "dark");

  /* ---------- toast ---------- */
  const stack = $("#toastStack");
  function toast(message, tone = "ok") {
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toast" + (tone === "rose" ? " toast--rose" : "");
    el.innerHTML = `<svg class="ic"><use href="#${tone === "rose" ? "i-alert" : "i-check"}"/></svg><span></span>`;
    el.querySelector("span").textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  /* ---------- helpers ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const show = (id, on) => {
    const el = $("#" + id);
    if (el) el.classList.toggle("show", on);
  };
  const mark = (input, invalid) => input.setAttribute("aria-invalid", String(invalid));

  const stored = (() => {
    try { return JSON.parse(localStorage.getItem("fxr-user") || "null"); } catch (e) { return null; }
  })();

  function saveUser(user) {
    try { localStorage.setItem("fxr-user", JSON.stringify(user)); } catch (e) {}
  }
  /* accounts.js keeps one record per email in this browser. It is what makes
     "your Gmail = your data" true: the same email always resolves to the same
     storage namespace, and a different one starts (and stays) empty. */
  const A = window.KRAcct;
  function adoptWorkspace() {
    if (!A) return;
    try { A.adopt(); } catch (e) {}
  }
  function hashPass(mail, pw) {
    return A ? A.verify(mail, pw) : Promise.resolve({ state: "new" });
  }
  /* the success card reports this account's real numbers, never samples */
  function paintWorkspace() {
    if (!A) return;
    var live = A.get("auto", null);
    var sessions = A.get("sessions", []) || [];
    var trades = A.get("trades", []) || [];
    var done = sessions.filter(function (x) { return x && x.state !== "live"; });
    var r = $("#successReplay");
    if (r) {
      r.textContent = live && live.live
        ? live.live.sym + " · " + live.live.tf + " · " + (live.live.progress || 0) + "% replayed"
        : "No replay session saved yet";
    }
    var t = $("#successTrades");
    if (t) {
      var wins = trades.filter(function (x) { return (x.r || 0) > 0; }).length;
      var net = trades.reduce(function (sum, x) { return sum + (Number(x.r) || 0); }, 0);
      t.textContent = trades.length
        ? trades.length + " journal trades · " + (wins ? Math.round((wins / trades.length) * 100) : 0) + "% win · " + (net > 0 ? "+" : "") + Math.round(net * 10) / 10 + "R"
        : "Empty journal — no demo trades";
    }
    var ss = $("#successSessions");
    if (ss) ss.textContent = done.length + (done.length === 1 ? " completed session" : " completed sessions");
  }
  const capitalize = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  const firstName = (name) => capitalize((name || "").trim().split(/\s+/)[0]) || "trader";

  /* ---------- password visibility ---------- */
  $$(".toggle-pass").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $("#" + btn.dataset.target);
      if (!input) return;
      const showPass = input.type === "password";
      input.type = showPass ? "text" : "password";
      btn.setAttribute("aria-pressed", String(showPass));
      btn.setAttribute("aria-label", showPass ? "Hide password" : "Show password");
      btn.innerHTML = `<svg class="ic"><use href="#${showPass ? "i-eye-off" : "i-eye"}"/></svg>`;
      input.focus();
    });
  });

  /* ---------- plan chip (signup) ---------- */
  const PLAN_LABEL = { free: "Free", intermediate: "Intermediate", pro: "Pro" };
  const planKey = (new URLSearchParams(location.search).get("plan") || "").toLowerCase();
  if (PLAN_LABEL[planKey] && $("#planChip")) {
    $("#planName").textContent = PLAN_LABEL[planKey];
    $("#planChip").classList.add("show");
  }

  if (stored?.email) {
    const emailInput = $("#email");
    if (emailInput && !emailInput.value) emailInput.value = stored.email;
  }

  /* ---------- password strength ---------- */
  const pass = $("#password");
  const bars = $("#strengthBars");
  const label = $("#strengthLabel");
  const LABELS = ["—", "Weak", "Fair", "Good", "Strong"];
  function scorePassword(value) {
    if (!value) return 0;
    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    if (/^(1234|password|qwerty|azerty|1111)/i.test(value)) return 1;
    return Math.max(1, Math.min(4, score - 1));
  }
  pass?.addEventListener("input", () => {
    const level = scorePassword(pass.value);
    if (bars) bars.dataset.level = String(level);
    if (label) {
      label.textContent = LABELS[level];
      label.style.color =
        level >= 4 ? "var(--mint)" : level === 3 ? "#7cc7ff" : level === 2 ? "var(--amber)" : level === 1 ? "var(--rose)" : "";
    }
  });

  /* ---------- signup ---------- */
  const signupForm = $("#signupForm");
  signupForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameEl = $("#fullName");
    const emailEl = $("#email");
    const termsEl = $("#terms");
    const name = nameEl.value.trim();
    const email = emailEl.value.trim();

    const nameBad = name.length < 2;
    const emailBad = !EMAIL_RE.test(email);
    const passBad = (pass?.value || "").length < 8;
    const termsBad = !termsEl.checked;

    show("nameError", nameBad);
    show("emailError", emailBad);
    show("passwordError", passBad);
    show("termsError", termsBad);
    mark(nameEl, nameBad);
    mark(emailEl, emailBad);
    mark(pass, passBad);

    if (nameBad || emailBad || passBad || termsBad) {
      const firstBad = nameBad ? nameEl : emailBad ? emailEl : passBad ? pass : termsEl;
      firstBad.focus();
      toast("Please fix the highlighted fields", "rose");
      return;
    }

    const btn = $("#signupSubmit");
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Creating your account…';
    setTimeout(async () => {
      const plan = PLAN_LABEL[planKey] || "Free";
      try { await (A ? A.remember(name, email, pass ? pass.value : "") : null); } catch (err) {}
      saveUser({ name, email, plan, createdAt: new Date().toISOString() });
      adoptWorkspace();
      btn.disabled = false;
      btn.innerHTML = original;
      $("#successName").textContent = firstName(name);
      $("#successEmail").textContent = email;
      $("#formState").style.display = "none";
      paintWorkspace();
      $("#successState").classList.add("show");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast("Account created — your workspace is saved under " + email);
    }, 750);
  });

  $("#editSignup")?.addEventListener("click", (e) => {
    e.preventDefault();
    $("#successState").classList.remove("show");
    $("#formState").style.display = "";
  });

  /* ---------- login ---------- */
  const loginForm = $("#loginForm");
  loginForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const emailEl = $("#email");
    const email = emailEl.value.trim();
    const passBad = !pass.value;
    const emailBad = !EMAIL_RE.test(email);
    show("emailError", emailBad);
    show("passwordError", passBad);
    mark(emailEl, emailBad);
    mark(pass, passBad);
    if (emailBad || passBad) {
      (emailBad ? emailEl : pass).focus();
      toast("Check your email and password", "rose");
      return;
    }

    const btn = $("#loginSubmit");
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Verifying…";
    setTimeout(async () => {
      const name = stored?.email?.toLowerCase() === email.toLowerCase() ? stored.name : email.split("@")[0];
      let check = { state: "ok" };
      try { check = await hashPass(email, pass.value); } catch (err) {}
      if (check.state === "bad") {
        btn.disabled = false;
        btn.innerHTML = original;
        show("passwordError", true);
        mark(pass, true);
        pass.focus();
        toast("That email already has a workspace here — the password does not match", "rose");
        return;
      }
      const rec = A && A.accounts ? A.accounts()[check.uid] || {} : {};
      saveUser({
        name: rec.name || name,
        email,
        plan: stored?.plan || "Free",
        createdAt: rec.createdAt || stored?.createdAt || new Date().toISOString(),
      });
      adoptWorkspace();
      btn.disabled = false;
      btn.innerHTML = original;
      $("#successName").textContent = firstName(rec.name || name);
      $("#formState").style.display = "none";
      paintWorkspace();
      $("#successState").classList.add("show");
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (check.state === "new") toast("New workspace for " + email + " — everything you do is saved under it");
    }, 700);
  });

  $("#editLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    $("#successState").classList.remove("show");
    $("#formState").style.display = "";
    pass.value = "";
    pass.focus();
  });

  $("#forgotLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    const email = $("#email").value.trim();
    if (!EMAIL_RE.test(email)) {
      show("emailError", true);
      mark($("#email"), true);
      $("#email").focus();
      toast("Enter your email first, then request a reset", "rose");
      return;
    }
    toast(`Password reset link sent to ${email}`);
  });

  /* ---------- social providers ---------- */
  $$("[data-provider]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const provider = btn.dataset.provider;
      const label = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = `Connecting to ${provider}…`;
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = label;
        toast(`${provider} sign-in is not connected in this build`, "rose");
      }, 900);
    });
  });

  /* ---------- clearing inline errors as you type ---------- */
  $$(".field input").forEach((input) => {
    input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      const err = input.closest(".field")?.querySelector(".error");
      err?.classList.remove("show");
    });
  });
})();
