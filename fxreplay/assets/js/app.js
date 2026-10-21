/* KyorakuReplay — design study — interactive demo
   All market data is procedurally generated for demonstration purposes. */
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------------------------------------------------------
     Utilities
  --------------------------------------------------------- */
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const fmtPrice = (v, d) =>
    v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtUsd = (v) =>
    (v < 0 ? "−" : "+") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtR = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(2) + "R";

  /* ---------------------------------------------------------
     Theme + language
  --------------------------------------------------------- */
  const root = document.documentElement;
  const isLight = () => root.dataset.theme === "light";
  const LANG = root.lang === "ar" ? "ar" : "en";
  const monthsEN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthsAR = ["جانفي","فيفري","مارس","أفريل","ماي","جوان","جويلية","أوت","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const MONTHS = LANG === "ar" ? monthsAR : monthsEN;
  const MKT_AR = { Forex: "فوركس", Futures: "عقود آجلة", Crypto: "عملات رقمية", Indices: "مؤشرات", Metals: "معادن", Energy: "طاقة" };
  const PLAN_AR = { Free: "مجاني", Intermediate: "متوسط", Pro: "احترافي" };
  const STR = {
    en: {
      long: "LONG", short: "SHORT", openLong: "Long", openShort: "Short",
      opened: (d, s) => `${d} ${s} opened · risk $100`,
      closed: (s, r) => `Closed ${s} · ${r}`,
      stopped: (r) => `Stopped out · ${r}`,
      targetHit: (r) => `Target hit · ${r}`,
      alreadyOpen: "Close your open position first",
      endData: "End of replay data — jump back to continue",
      showing: (n, t) => `Showing ${n} of ${t} assets`,
      matching: (n, t) => `Showing ${n} of ${t} matching assets`,
      noMatch: (q) => `No assets match “${q}”. Try another symbol.`,
      trades: (n) => (n === 1 ? "1 trade" : `${n} trades`),
      subscribed: "Subscribed to product updates",
      movedTo: (d) => "Replay moved to " + d,
      jumped: "Replay jumped to the latest candle",
      showAll: "Show all assets", showFewer: "Show fewer assets",
      proOnly: "Pro only", pips: " pips", pts: " pts",
      invalidEmail: "Please enter a valid email address.",
      subscribedNote: "You're on the list — check your inbox to confirm.",
      welcome: (n) => `Welcome back${n ? ", " + n : ""} — session restored`,
      account: "My account",
    },
    ar: {
      long: "شراء", short: "بيع", openLong: "شراء", openShort: "بيع",
      opened: (d, s) => `تم فتح ${d} على ${s} · المخاطرة 100$`,
      closed: (s, r) => `تم إغلاق ${s} · ${r}`,
      stopped: (r) => `ضرب وقف الخسارة · ${r}`,
      targetHit: (r) => `تم الوصول للهدف · ${r}`,
      alreadyOpen: "أغلق الصفقة المفتوحة أولاً",
      endData: "انتهت بيانات إعادة العرض — ارجع للخلف للمتابعة",
      showing: (n, t) => `عرض ${n} من ${t} أصل`,
      matching: (n, t) => `عرض ${n} من ${t} أصل مطابق`,
      noMatch: (q) => `لا توجد أصول تطابق «${q}». جرّب رمزاً آخر.`,
      trades: (n) => (n === 1 ? "صفقة واحدة" : `${n} صفقة`),
      subscribed: "تم الاشتراك في تحديثات المنتج",
      movedTo: (d) => "تم نقل العرض إلى " + d,
      jumped: "تم الانتقال إلى آخر شمعة",
      showAll: "عرض كل الأصول", showFewer: "عرض أقل",
      proOnly: "Pro فقط", pips: " نقطة", pts: " نقطة",
      invalidEmail: "المرجى إدخال بريد إلكتروني صحيح.",
      subscribedNote: "تمت إضافتك للقائمة — تحقق من بريدك للتأكيد.",
      welcome: (n) => `مرحباً بعودتك${n ? "، " + n : ""} — تمت استعادة الجلسة`,
      account: "حسابي",
    },
  };
  const T = STR[LANG];
  const mktLabel = (m) => (LANG === "ar" ? MKT_AR[m] || m : m);
  const planLabel = (p) => (LANG === "ar" ? PLAN_AR[p] || p : p);

  function applyTheme(theme, announce) {
    root.dataset.theme = theme;
    try { localStorage.setItem("fxr-theme", theme); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f5f7fc" : "#06080f");
    $$("[id^='themeToggle']").forEach((btn) => {
      const next = theme === "light" ? "dark" : "light";
      btn.setAttribute("aria-label", `Switch to ${next} theme`);
      btn.setAttribute("title", `Switch to ${next} theme`);
      btn.setAttribute("aria-pressed", String(theme === "light"));
    });
    if (announce) toast(theme === "light" ? "Light mode on" : "Dark mode on");
    draw();
  }
  $$("[id^='themeToggle']").forEach((btn) =>
    btn.addEventListener("click", () => applyTheme(isLight() ? "dark" : "light", true))
  );
  function fmtDate(ts, tf, withTime = true) {
    const d = new Date(ts);
    const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    if (!withTime) return `${date} ${d.getUTCFullYear()}`;
    const intraday = tf !== "1D";
    if (intraday) {
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${date} ${d.getUTCFullYear()} · ${hh}:${mm}`;
    }
    return `${date} ${d.getUTCFullYear()}`;
  }
  function fmtAxis(ts, tf) {
    const d = new Date(ts);
    if (tf === "1D") return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }

  /* Toast */
  const toastStack = $("#toastStack");
  function toast(message, tone = "ok") {
    if (!toastStack) return;
    const el = document.createElement("div");
    el.className = "toast" + (tone === "rose" ? " toast--rose" : "");
    const icon = tone === "rose" ? "i-close" : "i-check";
    el.innerHTML = `<svg class="ic"><use href="#${icon}"/></svg><span>${message}</span>`;
    toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 320);
    }, 2800);
  }

  /* ---------------------------------------------------------
     Header / navigation / chrome
  --------------------------------------------------------- */
  const header = $("#siteHeader");
  const progress = $("#scrollProgress");
  const toTop = $("#toTop");

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle("scrolled", y > 8);
    toTop.classList.toggle("show", y > 700);
    const height = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (height > 0 ? (y / height) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  $("#announceClose")?.addEventListener("click", () => $(".announce")?.classList.add("hide"));

  const menuToggle = $("#menuToggle");
  const mobileNav = $("#mobileNav");
  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    mobileNav.hidden = open;
  });
  $$("#mobileNav a").forEach((a) =>
    a.addEventListener("click", () => {
      mobileNav.hidden = true;
      menuToggle.setAttribute("aria-expanded", "false");
    })
  );

  const navItem = $(".nav-item.has-menu");
  if (navItem) {
    const trigger = $(".nav-link", navItem);
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = navItem.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e) => {
      if (!navItem.contains(e.target)) {
        navItem.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        navItem.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Reveal on scroll */
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* Animated counters */
  const counters = $$("[data-count]");
  const animateCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const compact = el.dataset.format === "compact";
    const suffix = el.dataset.suffix || "";
    const dur = 1500;
    const t0 = performance.now();
    const tick = (t) => {
      const p = clamp((t - t0) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = target * eased;
      let text;
      if (compact) text = v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : Math.round(v).toLocaleString();
      else text = v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      el.textContent = text + (p === 1 ? suffix : "");
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            animateCount(en.target);
            cio.unobserve(en.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((c) => cio.observe(c));
  } else counters.forEach(animateCount);

  /* Tabs */
  const tabs = $$(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.toggle("on", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      });
      $$(".tab-panel").forEach((p) => {
        const show = p.id === "panel-" + tab.dataset.tab;
        p.classList.toggle("show", show);
        p.hidden = !show;
      });
    });
    tab.addEventListener("keydown", (e) => {
      const i = tabs.indexOf(tab);
      let next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); next.focus(); next.click(); }
    });
  });

  /* FAQ */
  $$(".faq-item").forEach((item) => {
    const btn = $(".faq-q", item);
    const ans = $(".faq-a", item);
    const setOpen = (open) => {
      item.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      ans.style.maxHeight = open ? ans.scrollHeight + "px" : "0px";
    };
    setOpen(item.classList.contains("open"));
    btn.addEventListener("click", () => setOpen(!item.classList.contains("open")));
  });

  /* Billing toggle */
  const billing = $(".billing-toggle");
  let period = "annual";
  function applyBilling(next) {
    period = next;
    $$("button", billing).forEach((b) => b.classList.toggle("on", b.dataset.period === period));
    $$(".price-amount b").forEach((el) => {
      const value = el.dataset[period];
      el.textContent = value;
    });
    $$("[data-bill]").forEach((el) => {
      if (period === "annual") {
        const card = el.closest(".price-card");
        const price = parseInt($(".price-amount b", card).dataset.annual, 10);
        el.textContent = price === 0 ? "Free forever · no card required" : `Billed annually · $${price * 12} / year`;
      } else {
        const card = el.closest(".price-card");
        const price = parseInt($(".price-amount b", card).dataset.monthly, 10);
        el.textContent = price === 0 ? "Free forever · no card required" : `Billed monthly · cancel anytime`;
      }
    });
  }
  billing?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-period]");
    if (btn) applyBilling(btn.dataset.period);
  });

  /* Keep open FAQ answers sized to their content */
  function syncFaqHeights() {
    $$(".faq-item.open .faq-a").forEach((a) => { a.style.maxHeight = a.scrollHeight + "px"; });
  }
  window.addEventListener("resize", syncFaqHeights);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncFaqHeights);

  /* Newsletter */
  const newsletter = $("#newsletter");
  newsletter?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#newsletterEmail");
    const note = $("#newsletterNote");
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
    note.className = "newsletter-note " + (ok ? "ok" : "err");
    note.textContent = ok ? T.subscribedNote : T.invalidEmail;
    if (ok) { input.value = ""; toast(T.subscribed); }
  });

  /* Feature card cursor glow */
  $$(".feature-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------------------------------------------------------
     Market data
  --------------------------------------------------------- */
  const TF_MS = { "1s": 1000, "1m": 60000, "5m": 300000, "15m": 900000, "1H": 3600000, "4H": 14400000, "1D": 86400000 };
  const TF_VOL = { "1s": 0.13, "1m": 1, "5m": 1.9, "15m": 3, "1H": 5.5, "4H": 9, "1D": 14 };

  const SYMBOLS = [
    { id: "EURUSD", label: "EUR/USD", market: "Forex", icon: "€", base: 1.0842, digits: 5, pip: 0.0001, stopPips: 20, spread: 0.5, vol: 0.00013 },
    { id: "GBPUSD", label: "GBP/USD", market: "Forex", icon: "£", base: 1.2718, digits: 5, pip: 0.0001, stopPips: 22, spread: 0.7, vol: 0.00016 },
    { id: "USDJPY", label: "USD/JPY", market: "Forex", icon: "¥", base: 156.42, digits: 3, pip: 0.01, stopPips: 24, spread: 0.6, vol: 0.00018 },
    { id: "XAUUSD", label: "XAU/USD", market: "Metals", icon: "Au", base: 2341.60, digits: 2, pip: 0.1, stopPips: 48, spread: 2.2, vol: 0.00035 },
    { id: "NAS100", label: "NAS100", market: "Indices", icon: "N", base: 20142.5, digits: 1, pip: 1, stopPips: 32, spread: 1.4, vol: 0.00045 },
    { id: "BTCUSD", label: "BTC/USD", market: "Crypto", icon: "₿", base: 64210, digits: 1, pip: 1, stopPips: 260, spread: 12, vol: 0.0012 },
    { id: "ES1", label: "ES1", market: "Futures", icon: "ES", base: 5421.25, digits: 2, pip: 0.25, stopPips: 14, spread: 0.5, vol: 0.00035 },
    { id: "USOIL", label: "USOIL", market: "Energy", icon: "O", base: 78.42, digits: 2, pip: 0.01, stopPips: 32, spread: 2, vol: 0.0009 },
    { id: "GBPJPY", label: "GBP/JPY", market: "Forex", icon: "£", base: 199.85, digits: 3, pip: 0.01, stopPips: 28, spread: 1.1, vol: 0.0002 },
  ];


  const seriesCache = new Map();

  function buildSeries(meta, tf) {
    const key = meta.id + ":" + tf;
    if (seriesCache.has(key)) return seriesCache.get(key);
    const n = 3000;
    const rand = mulberry32(hashSeed(key));
    const sig = meta.vol * (TF_VOL[tf] || 1);
    const step = TF_MS[tf] || 60000;
    const t0 = Date.now() - n * step;
    const data = [];
    let price = meta.base * (0.97 + rand() * 0.03);
    let bias = 0;
    for (let i = 0; i < n; i++) {
      if (i % 85 === 0) bias = (rand() - 0.46) * sig * 0.8;
      const wave = Math.sin(i / 34) * sig * 0.25;
      const shock = rand() < 0.01 ? (rand() - 0.5) * sig * 6 : 0;
      const revert = -0.06 * Math.log(price / meta.base);
      const ret = bias + wave + (rand() - 0.5) * sig * 1.7 + shock + revert;
      const open = price;
      const close = Math.max(open * (1 + ret), meta.base * 0.5);
      const wick = sig * (0.3 + rand() * 0.9);
      const high = Math.max(open, close) * (1 + rand() * wick);
      const low = Math.min(open, close) * (1 - rand() * wick);
      const digits = meta.digits;
      const round = (v) => +v.toFixed(digits);
      data.push({
        t: t0 + i * step,
        o: round(open), h: round(high), l: round(low), c: round(close),
        v: Math.round(400 + rand() * 1600),
      });
      price = close;
    }
    // normalise the tail towards the advertised price
    const factor = meta.base / data[data.length - 1].c;
    data.forEach((d) => {
      d.o = +(d.o * factor).toFixed(meta.digits);
      d.h = +(d.h * factor).toFixed(meta.digits);
      d.l = +(d.l * factor).toFixed(meta.digits);
      d.c = +(d.c * factor).toFixed(meta.digits);
    });

    // EMA 21 / EMA 50
    const ema = (len) => {
      const out = new Array(n);
      const k = 2 / (len + 1);
      let prev = data[0].c;
      for (let i = 0; i < n; i++) {
        prev = i === 0 ? data[i].c : data[i].c * k + prev * (1 - k);
        out[i] = prev;
      }
      return out;
    };
    // rolling VWAP (96-bar window)
    const vwap = new Array(n);
    const win = 96;
    let pv = 0, vv = 0;
    const queue = [];
    for (let i = 0; i < n; i++) {
      const typical = (data[i].h + data[i].l + data[i].c) / 3;
      const pvt = typical * data[i].v;
      queue.push([pvt, data[i].v]);
      pv += pvt; vv += data[i].v;
      if (queue.length > win) { const [p, v] = queue.shift(); pv -= p; vv -= v; }
      vwap[i] = pv / vv;
    }
    const series = { data, ema21: ema(21), ema50: ema(50), vwap, meta, tf, step };
    seriesCache.set(key, series);
    return series;
  }

  /* ---------------------------------------------------------
     Terminal state & chart
  --------------------------------------------------------- */
  const canvas = $("#priceChart");
  const chartBox = $("#chartBox");
  const ctx = canvas.getContext("2d");
  const state = {
    symbol: SYMBOLS[0],
    tf: "1m",
    index: 2400,
    zoom: 118,
    playing: false,
    speed: 2,
    ema: true,
    vwap: true,
    hover: -1,
    position: null,
    trades: [],
    geom: null,
    userInteracted: false,
  };

  function currentSeries() { return buildSeries(state.symbol, state.tf); }
  function availableIndex() {
    const s = currentSeries();
    const avail = s.data.length - 40;
    return { min: 60, max: avail };
  }

  function palette() {
    if (isLight()) {
      return {
        grid: "rgba(16,24,40,0.075)", axis: "rgba(84,94,118,0.9)", crosshair: "rgba(16,24,40,0.25)",
        upW: "rgba(16,150,105,0.9)", upB: "rgba(18,172,122,0.95)",
        downW: "rgba(214,52,88,0.85)", downB: "rgba(232,70,105,0.92)",
        vwap: "rgba(186,126,20,0.8)", ema50: "rgba(66,104,214,0.8)", ema21: "rgba(122,86,226,0.92)",
        tagUp: "#0e8f66", tagDown: "#c23a57", tagText: "#ffffff", hoverText: "rgba(16,24,40,0.8)",
      };
    }
    return {
      grid: "rgba(255,255,255,0.045)", axis: "rgba(139,147,171,0.62)", crosshair: "rgba(255,255,255,0.22)",
      upW: "rgba(56,226,160,0.85)", upB: "rgba(56,226,160,0.92)",
      downW: "rgba(255,93,125,0.85)", downB: "rgba(255,93,125,0.92)",
      vwap: "rgba(255,200,97,0.55)", ema50: "rgba(93,139,255,0.7)", ema21: "rgba(167,139,250,0.9)",
      tagUp: "#1f9e75", tagDown: "#c43e5b", tagText: "#fff", hoverText: "rgba(255,255,255,0.82)",
    };
  }

  function draw() {
    const s = currentSeries();
    const pal = palette();
    const rect = chartBox.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const pl = 6, pr = 64, pt = 26, pb = 20;
    const plotW = W - pl - pr, plotH = H - pt - pb;
    if (plotW < 20 || plotH < 20) return;

    const end = clamp(state.index, 10, s.data.length);
    const count = Math.min(state.zoom, end);
    const start = end - count;
    const slice = s.data.slice(start, end);
    if (slice.length < 2) return;

    let min = Infinity, max = -Infinity;
    for (const c of slice) { if (c.l < min) min = c.l; if (c.h > max) max = c.h; }
    if (state.ema) {
      for (let i = start; i < end; i++) {
        min = Math.min(min, s.ema21[i], s.ema50[i]);
        max = Math.max(max, s.ema21[i], s.ema50[i]);
      }
    }
    if (state.vwap) for (let i = start; i < end; i++) { min = Math.min(min, s.vwap[i]); max = Math.max(max, s.vwap[i]); }
    if (state.position) { min = Math.min(min, state.position.entry); max = Math.max(max, state.position.entry); }
    const pad = (max - min) * 0.09 || max * 0.001;
    min -= pad; max += pad;

    const bw = plotW / count;
    const body = Math.max(1.2, Math.min(9, bw * 0.62));
    const xFor = (i) => pl + (i + 0.5) * bw;
    const yFor = (p) => pt + ((max - p) / (max - min)) * plotH;
    const digits = state.symbol.digits;

    state.geom = { pl, pr, pt, pb, plotW, plotH, bw, start, end, min, max, xFor, yFor };

    /* grid */
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = "middle";
    const rows = 5;
    const yLastRaw = yFor(slice[slice.length - 1].c);
    for (let i = 0; i <= rows; i++) {
      const y = pt + (plotH / rows) * i;
      ctx.strokeStyle = pal.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pl, Math.round(y) + 0.5); ctx.lineTo(pl + plotW, Math.round(y) + 0.5); ctx.stroke();
      if (Math.abs(y - yLastRaw) < 16) continue;
      const price = max - ((max - min) / rows) * i;
      ctx.fillStyle = pal.axis;
      ctx.textAlign = "left";
      ctx.fillText(fmtPrice(price, digits), pl + plotW + 8, y);
    }
    const cols = Math.min(6, Math.max(3, Math.floor(plotW / 130)));
    for (let i = 0; i <= cols; i++) {
      const x = pl + (plotW / cols) * i;
      ctx.strokeStyle = pal.grid;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, pt); ctx.lineTo(Math.round(x) + 0.5, pt + plotH); ctx.stroke();
      const idx = clamp(Math.floor(start + (count - 1) * (i / cols)), 0, s.data.length - 1);
      ctx.fillStyle = pal.axis;
      ctx.textAlign = i === 0 ? "left" : i === cols ? "right" : "center";
      ctx.fillText(fmtAxis(s.data[idx].t, state.tf), x, pt + plotH + 11);
    }

    /* candles */
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      const x = Math.round(xFor(i)) + 0.5;
      const up = c.c >= c.o;
      const col = up ? "#38e2a0" : "#ff5d7d";
      ctx.strokeStyle = up ? pal.upW : pal.downW;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yFor(c.h)); ctx.lineTo(x, yFor(c.l));
      ctx.stroke();
      const yo = yFor(c.o), yc = yFor(c.c);
      const top = Math.min(yo, yc);
      const hgt = Math.max(1.4, Math.abs(yc - yo));
      ctx.fillStyle = up ? pal.upB : pal.downB;
      ctx.fillRect(x - body / 2, top, body, hgt);
    }

    /* helpers */
    const line = (values, color, width, dash) => {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.lineJoin = "round";
      for (let i = 0; i < count; i++) {
        const v = values[start + i];
        const x = xFor(i), y = yFor(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    if (state.vwap) line(s.vwap, pal.vwap, 1.2, [4, 4]);
    if (state.ema) {
      line(s.ema50, pal.ema50, 1.3);
      line(s.ema21, pal.ema21, 1.5);
    }

    /* entry line */
    if (state.position) {
      const p = state.position;
      const y = yFor(p.entry);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = p.dir > 0 ? "rgba(56,226,160,0.65)" : "rgba(255,93,125,0.65)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + plotW, y); ctx.stroke();
      ctx.restore();
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = p.dir > 0 ? pal.tagUp : pal.tagDown;
      ctx.textAlign = "right";
      ctx.fillText(`${p.dir > 0 ? "LONG" : "SHORT"} ${fmtPrice(p.entry, digits)}`, pl + plotW - 4, y - 8);
    }

    /* last price */
    const last = slice[slice.length - 1];
    const yLast = yFor(last.c);
    const up = last.c >= last.o;
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = up ? "rgba(56,226,160,0.4)" : "rgba(255,93,125,0.4)";
    ctx.beginPath(); ctx.moveTo(pl, yLast); ctx.lineTo(pl + plotW + 4, yLast); ctx.stroke();
    ctx.restore();
    const label = fmtPrice(last.c, digits);
    ctx.font = '9.5px "JetBrains Mono", ui-monospace, monospace';
    const tw = ctx.measureText(label).width + 12;
    const bx = pl + plotW + 4, by = yLast - 9;
    ctx.fillStyle = up ? pal.tagUp : pal.tagDown;
    roundRect(ctx, bx, by, Math.max(tw, pr - 8), 18, 4);
    ctx.fill();
    ctx.fillStyle = pal.tagText;
    ctx.textAlign = "center";
    ctx.fillText(label, bx + Math.max(tw, pr - 8) / 2, yLast);
    ctx.textAlign = "left";

    /* hover crosshair */
    if (state.hover >= 0 && state.hover < count) {
      const hc = slice[state.hover];
      const x = xFor(state.hover);
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = pal.crosshair;
      ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pt + plotH); ctx.stroke();
      ctx.restore();
      const y = yFor(hc.c);
      ctx.fillStyle = hc.c >= hc.o ? pal.tagUp : pal.tagDown;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.hoverText;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText(fmtAxis(hc.t, state.tf), x, pt + plotH + 11);
    }

    /* OHLC readout */
    const ref = state.hover >= 0 && state.hover < count ? slice[state.hover] : last;
    $("#chartOhlc").innerHTML = `<span>O</span> <b>${fmtPrice(ref.o, digits)}</b> <span>H</span> <b>${fmtPrice(ref.h, digits)}</b> <span>L</span> <b>${fmtPrice(ref.l, digits)}</b> <span>C</span> <b class="${ref.c >= ref.o ? "mint" : "rose"}">${fmtPrice(ref.c, digits)}</b>`;
    $("#chartDate").textContent = fmtDate(last.t, state.tf);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* price / panel sync */
  function updateQuote() {
    const s = currentSeries();
    const last = s.data[clamp(state.index - 1, 0, s.data.length - 1)];
    const prev = s.data[clamp(state.index - 1 - 24, 0, s.data.length - 1)];
    const digits = state.symbol.digits;
    const chg = ((last.c - prev.c) / prev.c) * 100;
    $("#symPrice").textContent = fmtPrice(last.c, digits);
    const delta = $("#symDelta");
    delta.textContent = (chg >= 0 ? "+" : "−") + Math.abs(chg).toFixed(2) + "%";
    delta.className = chg >= 0 ? "up" : "rose";
    const half = state.symbol.spread * state.symbol.pip * 0.5;
    $("#bidPrice").textContent = fmtPrice(last.c - half, digits);
    $("#askPrice").textContent = fmtPrice(last.c + half, digits);

    const ranges = availableIndex();
    const scrub = $("#scrub");
    scrub.min = ranges.min;
    scrub.max = ranges.max;
    scrub.value = state.index;
    const pct = ((state.index - ranges.min) / (ranges.max - ranges.min)) * 100;
    scrub.style.setProperty("--p", pct + "%");

    $("#dateStart").textContent = fmtDate(s.data[ranges.min].t, state.tf);
    $("#dateNow").textContent = fmtDate(last.t, state.tf);

    /* watchlist active row */
    const row = $(`.wl-row[data-id="${state.symbol.id}"]`);
    if (row) {
      $(".wl-px", row).textContent = fmtPrice(last.c, digits);
      const c = $(".wl-chg", row);
      c.textContent = (chg >= 0 ? "+" : "−") + Math.abs(chg).toFixed(2) + "%";
      c.className = "wl-chg " + (chg >= 0 ? "up" : "down");
    }
  }

  /* position UI */
  function updatePosition() {
    const pos = state.position;
    const empty = $("#posEmpty"), live = $("#posLive");
    const card = $("#posCard");
    if (!pos) {
      empty.hidden = false; live.hidden = true;
      card.classList.remove("live");
      return;
    }
    empty.hidden = true; live.hidden = false;
    card.classList.add("live");
    const s = currentSeries();
    const price = s.data[clamp(state.index - 1, 0, s.data.length - 1)].c;
    const R = ((price - pos.entry) / pos.stopDist) * pos.dir;
    const usd = R * 100;
    const pips = ((price - pos.entry) / state.symbol.pip) * pos.dir;
    $("#posDir").textContent = pos.dir > 0 ? T.long : T.short;
    $("#posDir").className = "pos-dir" + (pos.dir < 0 ? " short" : "");
    $("#posSym").textContent = state.symbol.label;
    const rEl = $("#posR");
    rEl.textContent = fmtR(R);
    rEl.className = R >= 0 ? "" : "neg";
    $("#posUsd").textContent = fmtUsd(usd);
    $("#posEntry").textContent = fmtPrice(pos.entry, state.symbol.digits);
    $("#posNow").textContent = fmtPrice(price, state.symbol.digits);
    const unit = state.symbol.market === "Forex" ? T.pips : T.pts;
    $("#posPips").textContent = (pips >= 0 ? "+" : "−") + Math.abs(pips).toFixed(1) + unit;
    $("#posRisk").textContent = LANG === "ar" ? "مخاطرة 100$" : "Risk $100";
    const bar = $("#posBar");
    const pct = clamp(((R + 1) / 3) * 100, 2, 100);
    bar.style.width = pct + "%";
    bar.className = R >= 0 ? "" : "neg";
  }

  function updateJournal() {
    const trades = state.trades;
    const n = trades.length;
    $("#tradeCount").textContent = T.trades(n);
    if (!n) {
      $("#statWin").textContent = "—"; $("#statR").textContent = "—"; $("#statPF").textContent = "—";
      return;
    }
    const wins = trades.filter((t) => t.r > 0);
    const losses = trades.filter((t) => t.r < 0);
    const winRate = Math.round((wins.length / n) * 100);
    const netR = trades.reduce((a, t) => a + t.r, 0);
    const grossW = wins.reduce((a, t) => a + t.r, 0);
    const grossL = Math.abs(losses.reduce((a, t) => a + t.r, 0));
    const pf = grossL > 0 ? (grossW / grossL).toFixed(2) : grossW > 0 ? "∞" : "0.00";
    $("#statWin").textContent = winRate + "%";
    $("#statR").textContent = (netR >= 0 ? "+" : "−") + Math.abs(netR).toFixed(1) + "R";
    $("#statPF").textContent = pf;

    const list = $("#tradeLog");
    list.innerHTML = trades
      .slice(0, 14)
      .map(
        (t) => `<li class="jrow"><span class="jd ${t.dir > 0 ? "" : "s"}">${t.dir > 0 ? "L" : "S"}</span><span>${t.sym}</span><span class="jr ${t.r >= 0 ? "pos" : "neg"}">${fmtR(t.r)}</span></li>`
      )
      .join("");
  }

  function openPosition(dir) {
    if (state.position) { toast(T.alreadyOpen, "rose"); return; }
    const s = currentSeries();
    const candle = s.data[clamp(state.index - 1, 0, s.data.length - 1)];
    const half = state.symbol.spread * state.symbol.pip * 0.5;
    const entry = candle.c + half * dir;
    const stopDist = state.symbol.pip * state.symbol.stopPips;
    state.position = {
      dir,
      entry,
      stopDist,
      stop: entry - stopDist * dir,
      target: entry + stopDist * 2 * dir,
      sym: state.symbol.label,
      opened: candle.t,
    };
    state.userInteracted = true;
    updatePosition();
    draw();
    toast(T.opened(dir > 0 ? T.openLong : T.openShort, state.symbol.label));
  }

  function closePosition(reason = "manual") {
    const pos = state.position;
    if (!pos) return;
    const s = currentSeries();
    const candle = s.data[clamp(state.index - 1, 0, s.data.length - 1)];
    let price = candle.c;
    if (reason === "stop") price = pos.stop;
    if (reason === "target") price = pos.target;
    const r = ((price - pos.entry) / pos.stopDist) * pos.dir;
    state.position = null;
    state.trades.unshift({ dir: pos.dir, sym: pos.sym, r: +r.toFixed(2), usd: r * 100, t: candle.t });
    updatePosition();
    updateJournal();
    draw();
    if (reason === "stop") toast(T.stopped(fmtR(r)), "rose");
    else if (reason === "target") toast(T.targetHit(fmtR(r)));
    else toast(T.closed(pos.sym, fmtR(r)), r >= 0 ? "ok" : "rose");
  }

  /* replay engine */
  let rafId = null, lastTick = 0, autoStarted = false;

  function advance(steps = 1) {
    const ranges = availableIndex();
    if (state.index >= ranges.max) {
      pause();
      toast(T.endData);
      return;
    }
    state.index = Math.min(ranges.max, state.index + steps);
    const s = currentSeries();
    const candle = s.data[state.index - 1];
    const pos = state.position;
    if (pos) {
      const hitStop = pos.dir > 0 ? candle.l <= pos.stop : candle.h >= pos.stop;
      const hitTarget = pos.dir > 0 ? candle.h >= pos.target : candle.l <= pos.target;
      if (hitStop) closePosition("stop");
      else if (hitTarget) closePosition("target");
    }
    updateQuote();
    updatePosition();
    draw();
  }

  function loop(t) {
    if (!state.playing) return;
    const interval = 520 / state.speed;
    if (t - lastTick >= interval) {
      const steps = interval < 34 ? 2 : 1;
      lastTick = t;
      advance(steps);
    }
    rafId = requestAnimationFrame(loop);
  }
  function play() {
    if (state.playing) return;
    state.playing = true;
    lastTick = 0;
    $("#playBtn").innerHTML = '<svg class="ic"><use href="#i-pause"/></svg>';
    $("#playBtn").setAttribute("aria-label", "Pause replay");
    rafId = requestAnimationFrame(loop);
  }
  function pause() {
    state.playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    $("#playBtn").innerHTML = '<svg class="ic"><use href="#i-play"/></svg>';
    $("#playBtn").setAttribute("aria-label", "Play replay");
  }

  /* watchlist */
  function addWatchlistRow(meta) {
    const s = buildSeries(meta, "1m");
    const idx = 2400;
    const last = s.data[idx];
    const prev = s.data[idx - 24];
    const chg = ((last.c - prev.c) / prev.c) * 100;
    const row = document.createElement("button");
    row.className = "wl-row" + (meta.id === state.symbol.id ? " on" : "");
    row.dataset.id = meta.id;
    row.innerHTML = `<span class="wl-sym"><span class="wl-flag">${meta.icon}</span>${meta.label}</span>
      <span class="wl-px">${fmtPrice(last.c, meta.digits)}</span>
      <span></span>
      <span class="wl-chg ${chg >= 0 ? "up" : "down"}">${(chg >= 0 ? "+" : "−") + Math.abs(chg).toFixed(2)}%</span>`;
    row.addEventListener("click", () => selectSymbol(meta.id));
    return row;
  }

  function selectSymbol(id) {
    const meta = SYMBOLS.find((s) => s.id === id);
    if (!meta || meta.id === state.symbol.id) return;
    if (state.position) closePosition("manual");
    pause();
    state.symbol = meta;
    state.index = 2400;
    state.hover = -1;
    state.userInteracted = true;
    $("#symLabel").textContent = meta.label;
    $("#symIcon").textContent = meta.icon;
    $("#symMarket").textContent = meta.market;
    $$(".wl-row").forEach((r) => r.classList.toggle("on", r.dataset.id === meta.id));
    updateQuote();
    updatePosition();
    updateJournal();
    draw();
  }

  /* build watchlist */
  const watchlistEl = $("#watchlist");
  SYMBOLS.forEach((m) => watchlistEl.appendChild(addWatchlistRow(m)));

  /* timeframe buttons */
  $$("#tfGroup button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("on")) return;
      $$("#tfGroup button").forEach((b) => b.classList.toggle("on", b === btn));
      if (state.position) closePosition("manual");
      pause();
      state.tf = btn.dataset.tf;
      state.index = 2400;
      state.hover = -1;
      state.userInteracted = true;
      updateQuote();
      updatePosition();
      draw();
    });
  });

  $("#emaBtn").addEventListener("click", function () {
    state.ema = !state.ema;
    this.classList.toggle("on", state.ema);
    this.setAttribute("aria-pressed", String(state.ema));
    draw();
  });
  $("#vwapBtn").addEventListener("click", function () {
    state.vwap = !state.vwap;
    this.classList.toggle("on", state.vwap);
    this.setAttribute("aria-pressed", String(state.vwap));
    draw();
  });
  $("#zoomIn").addEventListener("click", () => { state.zoom = Math.max(40, Math.round(state.zoom * 0.78)); draw(); });
  $("#zoomOut").addEventListener("click", () => { state.zoom = Math.min(400, Math.round(state.zoom * 1.28)); draw(); });
  $("#playBtn").addEventListener("click", () => { state.userInteracted = true; state.playing ? pause() : play(); });
  $("#stepBtn").addEventListener("click", () => { pause(); state.userInteracted = true; advance(1); });
  $("#speedSel").addEventListener("change", (e) => { state.speed = parseFloat(e.target.value); });
  const jumpModal = $("#jumpModal");
  const jumpDates = $("#jumpDates");
  function openJumpModal() {
    pause();
    state.userInteracted = true;
    const s = currentSeries();
    const range = availableIndex();
    const presets = [
      { idx: range.max, label: "Newest data point" },
      { idx: Math.max(range.min, range.max - 180), label: "Recent price action" },
      { idx: Math.max(range.min, range.max - 720), label: "Earlier in the session" },
      { idx: Math.max(range.min, range.max - 1440), label: "Start of this window" },
    ];
    const rel = (ts) => {
      const mins = Math.max(0, Math.round((s.data[range.max - 1].t - ts) / 60000));
      if (mins < 1) return "Latest";
      if (mins < 120) return mins + " min back";
      if (mins < 2880) return Math.round(mins / 60) + " h back";
      return Math.round(mins / 1440) + " days back";
    };
    jumpDates.innerHTML = presets
      .map(
        (p) => `<button class="jm-date" data-idx="${p.idx}"><svg class="ic"><use href="#i-calendar"/></svg><span class="jm-date-main"><b>${fmtDate(s.data[p.idx].t, state.tf)}</b><small>${p.label}</small></span><span class="jm-date-tag">${rel(s.data[p.idx].t)}</span></button>`
      )
      .join("");
    $$(".jm-date", jumpDates).forEach((btn) =>
      btn.addEventListener("click", () => {
        state.index = clamp(parseInt(btn.dataset.idx, 10), 60, s.data.length - 40);
        closeJump();
        updateQuote();
        updatePosition();
        draw();
        toast(T.movedTo(fmtDate(s.data[state.index - 1].t, state.tf, false)));
      })
    );
    if (typeof jumpModal.showModal === "function") jumpModal.showModal();
    else jumpModal.setAttribute("open", "");
  }
  function closeJump() {
    if (typeof jumpModal.close === "function") jumpModal.close();
    else jumpModal.removeAttribute("open");
  }
  $("#jumpBtn").addEventListener("click", openJumpModal);
  $("#jumpClose").addEventListener("click", closeJump);
  $("#jumpLatest").addEventListener("click", () => {
    const range = availableIndex();
    state.index = range.max;
    closeJump();
    updateQuote(); updatePosition(); draw();
    toast(T.jumped);
  });
  jumpModal.addEventListener("click", (e) => { if (e.target === jumpModal) closeJump(); });

  const scrub = $("#scrub");
  scrub.addEventListener("input", () => {
    pause();
    state.userInteracted = true;
    state.index = clamp(parseInt(scrub.value, 10), 60, currentSeries().data.length - 40);
    state.hover = -1;
    updateQuote();
    updatePosition();
    draw();
  });

  $("#buyBtn").addEventListener("click", () => openPosition(1));
  $("#sellBtn").addEventListener("click", () => openPosition(-1));
  $("#closePos").addEventListener("click", () => closePosition("manual"));

  /* chart hover */
  chartBox.addEventListener("mousemove", (e) => {
    const g = state.geom;
    if (!g) return;
    const rect = chartBox.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.floor((x - g.pl) / g.bw);
    if (idx >= 0 && idx < g.end - g.start) {
      if (state.hover !== idx) { state.hover = idx; draw(); }
    } else if (state.hover !== -1) {
      state.hover = -1; draw();
    }
  });
  chartBox.addEventListener("mouseleave", () => {
    state.hover = -1;
    draw();
  });
  chartBox.addEventListener("wheel", (e) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    state.zoom = clamp(Math.round(state.zoom * (e.deltaY > 0 ? 1.12 : 0.89)), 40, 400);
    draw();
  }, { passive: false });

  const ro = new ResizeObserver(() => draw());
  ro.observe(chartBox);

  /* keyboard */
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;
    if ($("#jumpModal") && $("#jumpModal").open) return;
    const termRect = $("#terminal").getBoundingClientRect();
    const termVisible = termRect.top < window.innerHeight * 0.85 && termRect.bottom > window.innerHeight * 0.15;
    if (!termVisible) return;
    if (e.code === "Space") {
      e.preventDefault();
      state.userInteracted = true;
      state.playing ? pause() : play();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      pause(); state.userInteracted = true; advance(1);
    } else if (e.key.toLowerCase() === "b") {
      openPosition(1);
    } else if (e.key.toLowerCase() === "s") {
      openPosition(-1);
    }
  });

  /* auto-start replay when terminal is visible */
  if ("IntersectionObserver" in window) {
    const tio = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && !autoStarted && !state.userInteracted) {
            autoStarted = true;
            setTimeout(() => { if (!state.userInteracted) play(); }, 900);
            tio.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );
    tio.observe($("#terminal"));
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

  /* ---------------------------------------------------------
     Ticker
  --------------------------------------------------------- */
  const tickerTrack = $("#tickerTrack");
  const tickerItems = SYMBOLS.map((meta) => {
    const s = buildSeries(meta, "1H");
    const idx = 2400;
    const chg = ((s.data[idx].c - s.data[idx - 8].c) / s.data[idx - 8].c) * 100;
    return { meta, price: s.data[idx].c, chg };
  });
  const tickerHTML = tickerItems
    .map(
      (t) => `<span class="tk-item"><span class="tk-sym">${t.meta.label}</span><span class="tk-px">${fmtPrice(t.price, t.meta.digits)}</span><span class="tk-chg ${t.chg >= 0 ? "up" : "down"}">${(t.chg >= 0 ? "+" : "−") + Math.abs(t.chg).toFixed(2)}%</span></span>`
    )
    .join("");
  tickerTrack.innerHTML = tickerHTML + tickerHTML;

  /* heatmap */
  const heat = $("#heatmap");
  if (heat) {
    const rand = mulberry32(42);
    let cells = "";
    for (let i = 0; i < 112; i++) {
      const v = rand();
      const cls = v > 0.88 ? "l4" : v > 0.72 ? "l3" : v > 0.55 ? "l2" : v < 0.12 ? "r" : "";
      cells += `<i class="${cls}"></i>`;
    }
    heat.innerHTML = cells;
  }

  /* ---------------------------------------------------------
     Asset universe
  --------------------------------------------------------- */
  const FX_CURRENCIES = [
    ["USD", "US Dollar"], ["EUR", "Euro"], ["GBP", "British Pound"], ["JPY", "Japanese Yen"],
    ["AUD", "Australian Dollar"], ["NZD", "New Zealand Dollar"], ["CAD", "Canadian Dollar"],
    ["CHF", "Swiss Franc"], ["MXN", "Mexican Peso"], ["ZAR", "South African Rand"],
    ["TRY", "Turkish Lira"], ["SEK", "Swedish Krona"], ["NOK", "Norwegian Krone"],
  ];
  const FX_PRIORITY = [
    ["EUR", "USD"], ["GBP", "USD"], ["USD", "JPY"], ["USD", "CAD"], ["AUD", "USD"], ["USD", "CHF"],
    ["NZD", "USD"], ["EUR", "GBP"], ["EUR", "JPY"], ["GBP", "JPY"], ["AUD", "JPY"], ["EUR", "CHF"],
    ["GBP", "CHF"], ["EUR", "AUD"], ["EUR", "CAD"], ["EUR", "NZD"], ["GBP", "AUD"], ["GBP", "CAD"],
    ["AUD", "CAD"], ["AUD", "NZD"], ["AUD", "CHF"], ["CAD", "CHF"], ["NZD", "CAD"], ["NZD", "JPY"],
    ["CAD", "JPY"], ["CHF", "JPY"], ["USD", "MXN"], ["USD", "ZAR"], ["USD", "TRY"], ["USD", "SEK"],
    ["USD", "NOK"], ["EUR", "TRY"], ["EUR", "SEK"], ["EUR", "NOK"], ["EUR", "ZAR"], ["EUR", "MXN"],
  ];
  const CRYPTO = [
    ["BTC", "Bitcoin"], ["ETH", "Ethereum"], ["SOL", "Solana"], ["BNB", "BNB"], ["XRP", "XRP"],
    ["ADA", "Cardano"], ["DOGE", "Dogecoin"], ["AVAX", "Avalanche"], ["LINK", "Chainlink"], ["DOT", "Polkadot"],
    ["MATIC", "Polygon"], ["LTC", "Litecoin"], ["BCH", "Bitcoin Cash"], ["XLM", "Stellar"], ["TRX", "TRON"],
    ["ATOM", "Cosmos"], ["NEAR", "NEAR Protocol"], ["APT", "Aptos"], ["ARB", "Arbitrum"], ["OP", "Optimism"],
    ["SUI", "Sui"], ["SEI", "Sei"], ["INJ", "Injective"], ["TIA", "Celestia"], ["RUNE", "THORChain"],
    ["AAVE", "Aave"], ["UNI", "Uniswap"], ["MKR", "Maker"], ["CRV", "Curve"], ["FTM", "Fantom"],
    ["ALGO", "Algorand"], ["ETC", "Ethereum Classic"], ["FIL", "Filecoin"], ["EOS", "EOS"], ["XTZ", "Tezos"],
    ["HBAR", "Hedera"], ["ICP", "Internet Computer"], ["RNDR", "Render"], ["GRT", "The Graph"], ["SAND", "The Sandbox"],
    ["MANA", "Decentraland"], ["AXS", "Axie Infinity"], ["GALA", "Gala"], ["THETA", "Theta"], ["VET", "VeChain"],
    ["CHZ", "Chiliz"], ["ENS", "Ethereum Name Service"], ["COMP", "Compound"], ["SNX", "Synthetix"], ["PEPE", "Pepe"],
  ];
  const INDICES = [
    ["NAS100", "Nasdaq 100"], ["US500", "S&P 500"], ["US30", "Dow Jones 30"], ["US2000", "Russell 2000"],
    ["GER40", "DAX 40"], ["UK100", "FTSE 100"], ["FRA40", "CAC 40"], ["EU50", "Euro Stoxx 50"],
    ["JP225", "Nikkei 225"], ["HK50", "Hang Seng"], ["AUS200", "ASX 200"], ["ESP35", "IBEX 35"],
    ["ITA40", "FTSE MIB"], ["SUI30", "Swiss Market"], ["NED25", "AEX 25"], ["SWE30", "OMX Stockholm 30"],
    ["NOR25", "OBX 25"], ["DEN25", "OMX Copenhagen 25"], ["FIN25", "OMX Helsinki 25"], ["BEL20", "BEL 20"],
    ["AUT20", "ATX 20"], ["POL20", "WIG 20"], ["CZE15", "PX 15"], ["GRE20", "Athens General"],
    ["HUN12", "BUX 12"], ["RUS50", "MOEX 50"], ["IND50", "Nifty 50"], ["CHN50", "FTSE China 50"],
    ["KOR200", "KOSPI 200"], ["TAI50", "Taiwan 50"], ["SG25", "Straits Times 25"], ["THAI50", "SET 50"],
    ["MAL30", "FTSE Bursa 30"], ["IDX30", "IDX 30"], ["BRA50", "Bovespa 50"], ["MEX35", "IPC 35"],
  ];
  const METALS = [
    ["XAUUSD", "Gold Spot"], ["XAGUSD", "Silver Spot"], ["XPTUSD", "Platinum Spot"], ["XPDUSD", "Palladium Spot"],
    ["XAUAUD", "Gold / AUD"], ["XAUEUR", "Gold / EUR"], ["XAUGBP", "Gold / GBP"], ["XAUJPY", "Gold / JPY"],
    ["XAGEUR", "Silver / EUR"], ["XAGGBP", "Silver / GBP"], ["XAGAUD", "Silver / AUD"], ["XAGJPY", "Silver / JPY"],
    ["COPPER", "Copper"], ["ALU", "Aluminium"], ["NICKEL", "Nickel"], ["ZINC", "Zinc"],
    ["LEAD", "Lead"], ["TIN", "Tin"],
  ];
  const ENERGY = [
    ["USOIL", "WTI Crude"], ["UKOIL", "Brent Crude"], ["NATGAS", "Henry Hub Gas"], ["HEATOIL", "Heating Oil"],
    ["RBOB", "RBOB Gasoline"], ["PROPANE", "Propane"], ["DIESEL", "Diesel"], ["JETFUEL", "Jet Fuel"],
    ["COAL", "Thermal Coal"], ["URANIUM", "Uranium"], ["ETHANOL", "Ethanol"], ["TTFGAS", "TTF Gas"],
    ["EUCARBON", "EU Carbon"], ["WTI1M", "WTI Front Month"], ["BRENT1M", "Brent Front Month"], ["GASOIL", "Gas Oil"],
  ];
  const FUTURES = [
    ["CME_MINI:ES1", "E-Mini S&P 500", "CME", 2012], ["CME_MINI:MES", "Micro E-Mini S&P 500", "CME", 2019],
    ["CME_MINI:NQ1", "E-Mini Nasdaq 100", "CME", 2012], ["CME_MINI:MNQ", "Micro E-Mini Nasdaq 100", "CME", 2019],
    ["CME_MINI:YM1", "E-Mini Dow 30", "CME", 2012], ["CME_MINI:MYM", "Micro E-Mini Dow", "CME", 2019],
    ["CME_MINI:RTY1", "E-Mini Russell 2000", "CME", 2012], ["CME_MINI:M2K", "Micro E-Mini Russell", "CME", 2019],
    ["CME_MINI:6E", "Euro FX Futures", "CME", 2012], ["CME_MINI:M6E", "Micro EUR/USD", "CME", 2019],
    ["CME_MINI:6B", "British Pound Futures", "CME", 2012], ["CME_MINI:M6B", "Micro GBP/USD", "CME", 2019],
    ["CME_MINI:6J", "Japanese Yen Futures", "CME", 2012], ["CME_MINI:6A", "Australian Dollar Futures", "CME", 2012],
    ["CME_MINI:6C", "Canadian Dollar Futures", "CME", 2012], ["CME_MINI:6S", "Swiss Franc Futures", "CME", 2012],
    ["CME_MINI:6N", "New Zealand Dollar Futures", "CME", 2012], ["CME_MINI:6M", "Mexican Peso Futures", "CME", 2012],
    ["CME_MINI:6Z", "South African Rand Futures", "CME", 2013], ["CME_MINI:6K", "Chinese Yuan Futures", "CME", 2013],
    ["CME_MINI:6L", "Brazilian Real Futures", "CME", 2013], ["CME_MINI:6R", "Russian Ruble Futures", "CME", 2013],
    ["CME_MINI:E7", "E-Mini Euro FX", "CME", 2012], ["CME_MINI:J7", "E-Mini Japanese Yen", "CME", 2012],
    ["CME_MINI:A6", "E-Mini Australian Dollar", "CME", 2012], ["CME_MINI:B6", "E-Mini British Pound", "CME", 2012],
    ["CME_MINI:HE", "Lean Hog Futures", "CME", 2012], ["CME_MINI:LE", "Live Cattle Futures", "CME", 2012],
    ["CME_MINI:GF", "Feeder Cattle Futures", "CME", 2012], ["CME_MINI:NKD", "Nikkei 225 Futures", "CME", 2012],
    ["CBOT:ZC1", "Corn Futures", "CBOT", 2012], ["CBOT:XC", "Mini Corn", "CBOT", 2012],
    ["CBOT:ZS1", "Soybean Futures", "CBOT", 2012], ["CBOT:XK", "Mini Soybean", "CBOT", 2012],
    ["CBOT:ZW1", "Chicago Wheat", "CBOT", 2012], ["CBOT:XW", "Mini Wheat", "CBOT", 2012],
    ["CBOT:ZM1", "Soybean Meal", "CBOT", 2012], ["CBOT:ZL1", "Soybean Oil", "CBOT", 2012],
    ["CBOT:ZO1", "Oats Futures", "CBOT", 2012], ["CBOT:ZR1", "Rough Rice", "CBOT", 2012],
    ["CBOT:KE1", "KC HRW Wheat", "CBOT", 2012], ["CBOT:ZF1", "5-Year T-Note", "CBOT", 2012],
    ["CBOT:ZN1", "10-Year T-Note", "CBOT", 2012], ["CBOT:TN1", "Ultra 10-Year", "CBOT", 2016],
    ["CBOT:ZB1", "30-Year T-Bond", "CBOT", 2012], ["CBOT:UB1", "Ultra T-Bond", "CBOT", 2012],
    ["CBOT:ZT1", "2-Year T-Note", "CBOT", 2012], ["CBOT:ZQ1", "30-Day Fed Funds", "CBOT", 2012],
    ["CBOT:SR3", "3-Month SOFR", "CBOT", 2018], ["CBOT:EH", "Ethanol Futures", "CBOT", 2012],
    ["NYMEX:CL1", "WTI Crude Oil", "NYMEX", 2012], ["NYMEX:MCL", "Micro WTI Crude", "NYMEX", 2019],
    ["NYMEX:QM", "E-Mini Crude Oil", "NYMEX", 2012], ["NYMEX:BZ1", "Brent Crude", "NYMEX", 2012],
    ["NYMEX:NG1", "Henry Hub Natural Gas", "NYMEX", 2012], ["NYMEX:MNG", "Micro Natural Gas", "NYMEX", 2019],
    ["NYMEX:HO1", "NY Harbor ULSD", "NYMEX", 2012], ["NYMEX:RB1", "RBOB Gasoline", "NYMEX", 2012],
    ["NYMEX:UX1", "Uranium Futures", "NYMEX", 2012], ["NYMEX:DC1", "Class III Milk", "NYMEX", 2012],
    ["COMEX:GC1", "Gold Futures", "COMEX", 2012], ["COMEX:MGC", "Micro Gold", "COMEX", 2019],
    ["COMEX:SI1", "Silver Futures", "COMEX", 2012], ["COMEX:SIL", "Micro Silver", "COMEX", 2019],
    ["COMEX:HG1", "Copper Futures", "COMEX", 2012], ["COMEX:MHG", "Micro Copper", "COMEX", 2019],
    ["COMEX:PL1", "Platinum Futures", "COMEX", 2012], ["COMEX:PA1", "Palladium Futures", "COMEX", 2012],
    ["COMEX:ALI", "Aluminium Futures", "COMEX", 2012], ["COMEX:CB1", "Cobalt Futures", "COMEX", 2014],
    ["ICE:KC1", "Arabica Coffee", "ICE", 2012], ["ICE:SB1", "Raw Sugar", "ICE", 2012],
    ["ICE:CC1", "Cocoa Futures", "ICE", 2012], ["ICE:CT1", "Cotton Futures", "ICE", 2012],
    ["ICE:OJ1", "Orange Juice", "ICE", 2012], ["ICE:LCC", "London Cocoa", "ICE", 2012],
    ["ICE:LRC", "London Robusta", "ICE", 2012], ["ICE:LSB", "London Sugar", "ICE", 2012],
    ["ICE:WBS", "London White Sugar", "ICE", 2012], ["ICE:DX1", "US Dollar Index", "ICE", 2012],
    ["ICE:B1", "ICE Brent", "ICE", 2012], ["ICE:GASOIL", "ICE Gas Oil", "ICE", 2012],
    ["EUREX:FGBL", "Euro Bund", "EUREX", 2012], ["EUREX:FGBM", "Euro Bobl", "EUREX", 2012],
    ["EUREX:FGBS", "Euro Schatz", "EUREX", 2012], ["EUREX:FGBX", "Euro Buxl", "EUREX", 2012],
    ["EUREX:FDAX", "DAX Futures", "EUREX", 2012], ["EUREX:FDXM", "Mini DAX", "EUREX", 2012],
    ["EUREX:FESX", "Euro Stoxx 50", "EUREX", 2012], ["EUREX:FSXE", "Mini Euro Stoxx", "EUREX", 2012],
    ["EUREX:FCE", "CAC 40 Futures", "EUREX", 2012], ["EUREX:FBTP", "BTP Futures", "EUREX", 2012],
    ["CBOE:VX1", "VIX Futures", "CBOE", 2012], ["CBOE:VXM", "Mini VIX", "CBOE", 2015],
  ];

  function buildAssets() {
    const assets = [];
    const push = (code, name, market, broker, res, since, plan) =>
      assets.push({ code, name, market, broker, res, since, plan });

    FUTURES.forEach(([code, name, broker, since]) => push(code, name, "Futures", broker, "1s → 12M", since, "Pro"));
    CRYPTO.forEach(([c, name]) => push(c + "USD", name, "Crypto", "Binance", "1s → 12M", 2017, "Free"));
    INDICES.forEach(([c, name]) => push(c, name, "Indices", "Kyoraku", "1s → 12M", 2008, "Free"));
    METALS.forEach(([c, name]) => push(c, name, "Metals", "OANDA", "1s → 12M", 2005, "Intermediate"));
    ENERGY.forEach(([c, name]) => push(c, name, "Energy", "NYMEX", "1s → 12M", 2007, "Intermediate"));

    const pairs = [];
    const seen = new Set();
    FX_PRIORITY.forEach(([a, b]) => {
      const key = a + b;
      if (!seen.has(key)) { seen.add(key); pairs.push([a, b]); }
    });
    FX_CURRENCIES.forEach(([a]) =>
      FX_CURRENCIES.forEach(([b]) => {
        if (a === b) return;
        const key = a + b;
        if (!seen.has(key)) { seen.add(key); pairs.push([a, b]); }
      })
    );
    const needed = 310 - assets.length;
    pairs.slice(0, needed).forEach(([a, b]) => {
      const exotic = !["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"].includes(a) ||
        !["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"].includes(b);
      push(a + b, `${a}/${b}`, "Forex", "OANDA", exotic ? "1m → 12M" : "1s → 12M", exotic ? 2010 : 2003, exotic ? "Intermediate" : "Free");
    });
    return assets;
  }

  const ASSETS = buildAssets();
  const marketBadge = (m) => `<span class="mkt-pill" data-m="${m}">${mktLabel(m)}</span>`;
  const planBadge = (p) => `<span class="plan-pill ${p === "Free" ? "free" : p === "Pro" ? "pro" : "inter"}">${p === "Pro" ? T.proOnly : planLabel(p)}</span>`;
  const iconFor = (asset) => {
    const map = { Forex: asset.code.slice(0, 2), Crypto: asset.code.slice(0, 2), Futures: "F", Indices: "IDX", Metals: "Au", Energy: "EN" };
    return map[asset.market] || "FX";
  };

  const assetsBody = $("#assetsBody");
  const assetsCount = $("#assetsCount");
  const showAllBtn = $("#showAllAssets");
  const assetSearch = $("#assetSearch");
  const assetFilters = $("#marketFilters");
  const assetState = { market: "all", query: "", all: false };

  function renderAssets() {
    const q = assetState.query.trim().toLowerCase();
    const list = ASSETS.filter((a) => {
      const marketOk = assetState.market === "all" || a.market === assetState.market;
      const queryOk = !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
      return marketOk && queryOk;
    });
    const shown = assetState.all ? list : list.slice(0, 10);
    assetsBody.innerHTML = shown.length
      ? shown
          .map(
            (a) => `<tr>
              <td><div class="a-sym"><span class="a-icon">${iconFor(a)}</span><span><span class="a-name">${a.name}</span><span class="a-code">${a.code}</span></span></div></td>
              <td>${marketBadge(a.market)}</td>
              <td>${a.broker}</td>
              <td class="tf-mono">${a.res}</td>
              <td class="tf-mono">${a.since}</td>
              <td>${planBadge(a.plan)}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">${T.noMatch(assetState.query)}</td></tr>`;
    const totalLabel = assetState.market === "all" && !q ? 310 : list.length;
    assetsCount.textContent = q || assetState.market !== "all"
      ? T.matching(shown.length, list.length)
      : T.showing(shown.length, totalLabel);
    showAllBtn.innerHTML = (assetState.all ? T.showFewer : T.showAll) + ' <svg class="ic ic--sm"><use href="#i-arrow"/></svg>';
    showAllBtn.style.display = list.length > 10 ? "" : "none";
  }

  assetFilters?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-market]");
    if (!btn) return;
    assetState.market = btn.dataset.market;
    $$(".filter", assetFilters).forEach((b) => b.classList.toggle("on", b === btn));
    renderAssets();
  });
  assetSearch?.addEventListener("input", () => {
    assetState.query = assetSearch.value;
    assetState.all = true;
    renderAssets();
  });
  showAllBtn?.addEventListener("click", () => {
    assetState.all = !assetState.all;
    renderAssets();
  });
  renderAssets();

  /* ---------------------------------------------------------
     Init terminal
  --------------------------------------------------------- */
  function initTerminal() {
    $("#symLabel").textContent = state.symbol.label;
    $("#symIcon").textContent = state.symbol.icon;
    $("#symMarket").textContent = state.symbol.market;
    updateQuote();
    updatePosition();
    updateJournal();
    draw();
  }
  initTerminal();
  applyBilling("annual");
  applyTheme(root.dataset.theme === "light" ? "light" : "dark", false);

  /* signed-in state + welcome hand-off from the auth pages */
  let user = null;
  try { user = JSON.parse(localStorage.getItem("fxr-user") || "null"); } catch (e) {}
  const displayName = (name) => {
    const first = (name || "").trim().split(/\s+/)[0];
    if (!first) return "";
    return LANG === "ar" ? first : first.charAt(0).toUpperCase() + first.slice(1);
  };
  if (user && user.name) {
    $$(".login-link").forEach((a) => {
      a.textContent = displayName(user.name);
      a.setAttribute("title", T.account);
      a.setAttribute("href", "dashboard.html");
    });
  }
  const params = new URLSearchParams(location.search);
  if (params.get("welcome") === "1") {
    setTimeout(() => toast(T.welcome(user && user.name ? displayName(user.name) : "")), 500);
    params.delete("welcome");
    const qs = params.toString();
    history.replaceState({}, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }
  window.addEventListener("storage", (e) => {
    if (e.key === "fxr-theme") {
      root.dataset.theme = e.newValue === "light" ? "light" : "dark";
      draw();
    }
  });
  window.addEventListener("load", draw);
  window.addEventListener("resize", () => setTimeout(draw, 80));
})();
