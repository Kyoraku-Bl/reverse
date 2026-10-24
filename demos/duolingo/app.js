import { SpeakingStudio } from "./speaking.js";
import {
  LEVELS,
  LANGUAGES,
  COURSES,
  ALL_LESSONS,
  getLesson,
} from "./curriculum.js";
import {
  STORAGE_KEY,
  defaults,
  normalize,
  localDay,
  shiftDay,
  streak,
  completeSession,
} from "./state.js";
const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
let storageAvailable = true,
  state;
try {
  state = normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
} catch {
  state = defaults();
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    storageAvailable = false;
    toast(
      "Browser storage is unavailable. Keep this tab open to retain your progress.",
    );
  }
}
let page = "learn",
  search = "",
  libraryLevel = "all",
  libraryLanguage = "all",
  review = null,
  toastTimer,
  modalReturnFocus;
const iconPaths = {
  mic: '<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3zM12 6v15"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9zM2 13l10 6 10-6M2 17l10 6 10-6"/>',
  note: '<path d="M7 3h13v18H5V5M3 7h4M3 11h4M3 15h4M10 8h6M10 12h6M10 16h4"/>',
  chart: '<path d="M4 20V4M4 20h17M8 16v-4M13 16V8M18 16V4"/>',
  settings:
    '<path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3z"/><circle cx="12" cy="11" r="3"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  leaf: '<path d="M20 3C4 2 1 12 7 17S21 16 20 3ZM5 21 16 9"/>',
  flame:
    '<path d="M13 2c2 7-6 8-3 13 2-1 3-3 3-5 5 3 8 7 5 11H7C1 15 8 10 9 6c1 2 2 2 2 2z"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18M7 15h3m4 0h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  bookmark: '<path d="M6 3h12v19l-6-4-6 4z"/>',
  audio:
    '<path d="M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  heart: '<path d="M12 21 3 12C-2 4 8-1 12 6c4-7 14-2 9 6z"/>',
  spark:
    '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.spark}</svg>`;
}
function flag(language) {
  return language === "fr"
    ? '<svg class="flag-svg" viewBox="0 0 30 22" aria-hidden="true"><rect width="10" height="22" fill="#42649e"/><rect x="10" width="10" height="22" fill="#fffdf9"/><rect x="20" width="10" height="22" fill="#d57573"/></svg>'
    : '<svg class="flag-svg" viewBox="0 0 30 22" aria-hidden="true"><rect width="30" height="22" fill="#526686"/><path d="m0 0 30 22m0-22L0 22" stroke="#fffdf9" stroke-width="6"/><path d="m0 0 30 22m0-22L0 22" stroke="#d77679" stroke-width="2"/><path d="M15 0v22M0 11h30" stroke="#fffdf9" stroke-width="8"/><path d="M15 0v22M0 11h30" stroke="#ce6b72" stroke-width="4"/></svg>';
}
const topicPaths = {
  "👋": '<path d="M14 26V12a3 3 0 0 1 6 0v10V8a3 3 0 0 1 6 0v14V11a3 3 0 0 1 6 0v14-8a3 3 0 0 1 6 0v13c0 9-6 13-13 13-5 0-8-3-11-7L7 27c-3-4 2-7 5-3l5 6"/>',
  "☀️": '<circle cx="24" cy="24" r="9"/><path d="M24 4v5m0 30v5M4 24h5m30 0h5M10 10l4 4m20 20 4 4M10 38l4-4m20-20 4-4"/>',
  "☕": '<path d="M8 19h26v10a12 12 0 0 1-26 0zm26 2h3a6 6 0 0 1 0 12h-4M7 42h30M15 12V6m9 6V6"/>',
  "🗺️": '<path d="m5 12 12-6 14 6 12-6v31l-12 6-14-6-12 6zm12-6v31m14-25v31"/>',
  "🎨": '<path d="M25 5C3 5-4 33 14 42c7 3 12-1 9-6-4-6 1-8 7-5 16 7 24-26-5-26Z"/><circle cx="13" cy="23" r="2"/><circle cx="20" cy="14" r="2"/><circle cx="32" cy="15" r="2"/><circle cx="37" cy="24" r="2"/>',
  "📷": '<path d="M5 15h9l4-7h12l4 7h9v26H5z"/><circle cx="24" cy="27" r="9"/><path d="M9 20h3"/>',
  "🧳": '<rect x="6" y="15" width="36" height="27" rx="5"/><path d="M17 15V7h14v8M14 15v27m20-27v27"/>',
  "🛍️": '<path d="M8 17h32l3 26H5zm9 0V9a7 7 0 0 1 14 0v8"/>',
  "🌿": '<path d="M23 44V14M23 27C6 28 5 13 5 13c16-1 18 14 18 14Zm0-8C23 4 39 4 39 4c2 14-16 15-16 15Zm0 20c1-15 18-15 18-15 0 14-18 15-18 15Z"/>',
  "✨": '<path d="m25 4 5 14 14 5-14 5-5 15-5-15-15-5 15-5ZM8 3v7M4 6h8"/>',
  "📚": '<path d="M7 8h8v34H7zm12-4h8v38h-8zm12 7 8-2 8 31-8 2zM7 33h8M19 32h8"/>',
  "🌱": '<path d="M24 43V24M24 27C5 29 5 8 5 8c18-1 19 19 19 19Zm0-4C24 5 43 6 43 6c2 18-19 17-19 17ZM11 43h26"/>',
  "💬": '<path d="M42 24c0 10-9 17-20 17l-12 4 3-9C-3 20 9 3 24 5c10 0 18 8 18 19Z"/><path d="M13 20h20M13 28h12"/>',
  "✉️": '<rect x="5" y="10" width="38" height="29" rx="4"/><path d="m6 13 18 14 18-14M6 37l12-14m24 14L30 23"/>',
  "♻️": '<path d="m16 10 7-7 9 15h-8m8 0 3-8M39 24l7 10-6 7H27l5-7m-5 7 6 5M17 40H5L2 31l9-14 3 8m-3-8-8 1"/>',
  "💻": '<path d="M9 6h30v25H9zm-5 31 5-6h30l5 6v5H4zM18 36h12"/>',
  "📰": '<path d="M5 7h32v34H5zm32 8h6v26h-6M11 14h8v9h-8zm14 0h6m-6 7h6M11 30h20M11 35h15"/>',
  "⏳": '<path d="M10 4h28M10 44h28M14 4v9c0 7 20 15 20 22v9M34 4v9c0 7-20 15-20 22v9M16 36h16M18 12h12"/>',
  "🤝": '<path d="m3 22 9-12 10 3 8-3 15 14-10 17-7-2-7 2L3 25m19-12-7 10 5 4 8-8 9 8m-17 0 11 12M8 17l7 6"/>',
  "🔗": '<path d="m19 13 5-5a11 11 0 0 1 16 16l-6 6M29 35l-5 5A11 11 0 0 1 8 24l6-6m1 15 18-18"/>',
  "🔍": '<circle cx="20" cy="20" r="14"/><path d="m30 30 14 14M15 17a7 7 0 0 1 7-4"/>',
  "🏛️": '<path d="M3 17 24 4l21 13zM5 44h38M8 38h32M10 20v18m9-18v18m10-18v18m9-18v18"/>',
  "🎭": '<path d="M5 6q10 7 22 0v17q-11 21-22 0zM27 17q7 4 16 0v16q-8 19-17 0M10 15h3m7 0h3M10 25q6 6 12 0M32 27h2m4 0h2"/>',
  "🕊️": '<path d="M8 41C3 15 24 0 42 6c1 21-11 32-30 29M5 44l25-25m-10 11v-9m3 6h10"/>',
  "🧩": '<path d="M6 6h12c-3 12 15 12 12 0h12v12c-12-3-12 15 0 12v12H30c3-12-15-12-12 0H6V30c12 3 12-15 0-12z"/>',
};
function topicIcon(symbol) {
  return `<svg class="topic-svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${topicPaths[symbol] || topicPaths["✨"]}</svg>`;
}
function brand() {
  return '<div class="brand"><span class="brand-mark" aria-hidden="true">✿</span><span class="brand-name">bloom</span></div>';
}
function illustration() {
  return `<svg viewBox="0 0 300 290" fill="none" aria-hidden="true"><ellipse cx="161" cy="178" rx="116" ry="111" fill="#e0e9cb"/><circle cx="233" cy="63" r="22" fill="#edce84"/><path d="M82 75q-30-24-36 3 14 14 36-3" fill="#c8d9ae"/><path d="M49 77q7 12 26 13" stroke="#a9c08e" stroke-width="2"/><path d="m242 111 7-10m-4 16 13-2M72 126l-4-9m-3 17-11-1" stroke="#a8ba8d" stroke-width="2" stroke-linecap="round"/><path d="M64 283q-6-31 12-45 15 17-1 46M68 267q-22-3-26-21 18-5 26 21" fill="#91a97b"/><path d="M237 283q-4-39 20-60 18 23-7 61M244 258q-21-13-19-34 23 3 19 34" fill="#90a879"/><path d="M94 288v-85q4-45 56-45 57-1 67 45l13 85" fill="#688f6e"/><path d="M114 182q-19 32-26 77l-20 7q-7-57 24-89" fill="#e2ad86"/><path d="m199 176 24 41q8 17-5 26l-21-26" fill="#e2ad86"/><path d="M143 149v24q14 14 27-1v-29" fill="#d89e75"/><ellipse cx="155" cy="119" rx="39" ry="47" fill="#e7b58e"/><path d="M113 115q-18-53 28-57 42-15 57 32l-5 29q-18-6-21-38-10 22-49 26l-1 31" fill="#3b4939"/><path d="M130 122v5m42-5v5" stroke="#4d5540" stroke-width="3.5" stroke-linecap="round"/><path d="M145 143q8 6 16-1" stroke="#a96d59" stroke-width="2" stroke-linecap="round"/><path d="M116 120q-11-62 33-65 51-7 52 60" stroke="#eee5ce" stroke-width="10"/><rect x="105" y="108" width="16" height="32" rx="8" fill="#d9cbb3"/><rect x="190" y="107" width="16" height="32" rx="8" fill="#d9cbb3"/><path d="m103 220 44-11 50 17-10 64-48-18-45 8z" fill="#eee6cf"/><path d="m147 209-8 63 48 18 10-64z" fill="#f8f0dc"/><path d="m148 219 34 11m-36-1 33 11m-35-1 33 11m-34-1 24 9" stroke="#c5c4a5" stroke-width="2"/><path d="m107 235 22-5m-24 16 22-5m-23 15 21-5" stroke="#c5c4a5" stroke-width="2"/><ellipse cx="97" cy="251" rx="9" ry="15" transform="rotate(-25 97 251)" fill="#e7b58e"/><ellipse cx="198" cy="253" rx="9" ry="15" transform="rotate(20 198 253)" fill="#e7b58e"/><g transform="rotate(-11 65 166)"><rect x="25" y="147" width="66" height="35" rx="11" fill="#fcfdf5"/><path d="m68 180 5 10 4-11" fill="#fcfdf5"/><text x="58" y="169" font-family="Georgia,serif" font-size="17" fill="#68805b" text-anchor="middle">hello!</text></g><g transform="rotate(10 240 153)"><rect x="211" y="137" width="76" height="34" rx="11" fill="#f7e5c9"/><path d="m225 169-4 10 12-9" fill="#f7e5c9"/><text x="249" y="159" font-family="Georgia,serif" font-size="15" fill="#a88c64" text-anchor="middle">bonjour!</text></g><path d="m273 191 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#c6b98c"/></svg>`;
}
const navItems = [
  ["learn", "home", "My learning"],
  ["explore", "grid", "Explore courses"],
  ["speaking", "mic", "Speaking"],
  ["review", "layers", "Word studio"],
  ["notebook", "note", "My notebook"],
  ["progress", "chart", "My progress"],
  ["settings", "settings", "Settings"],
];
const titles = {
  speaking: [
    "Find your voice, one conversation at a time.",
    "English & French speaking practice · A1 to C1 · always free",
  ],
  learn: [
    "Your little daily adventure.",
    "A few new words today. A whole new world tomorrow.",
  ],
  explore: [
    "A world of possibility.",
    "English & French. Every level. Completely free.",
  ],
  review: [
    "Make those words your own.",
    "A little recall helps new words become familiar friends.",
  ],
  notebook: [
    "Your collection of little discoveries.",
    "Thoughts, saved lessons, and writing worth coming back to.",
  ],
  progress: [
    "Look how you’re growing.",
    "Every bit of practice counts. This is your journey, at your pace.",
  ],
  settings: [
    "Make yourself at home.",
    "Your space, your rhythm, your learning.",
  ],
};
function completedCount(language) {
  return Object.keys(state.completed).filter((id) =>
    id.startsWith(language + "-"),
  ).length;
}
function nextLesson() {
  const units = COURSES[state.language][state.levels[state.language]];
  return units.find((u) => !state.completed[u.id]) || units[0];
}
function render() {
  const [title, subtitle] = titles[page];
  const today = localDay(),
    active = streak(state.activity);
  $("#app").innerHTML =
    `<div class="layout"><aside class="sidebar">${brand()}<div class="nav-label">YOUR LITTLE WORLD</div><nav class="nav" aria-label="Main navigation">${navItems.map(([key, i, label]) => `<button class="nav-item ${page === key ? "active" : ""}" data-nav="${key}" ${page === key ? 'aria-current="page"' : ""}>${icon(i)}<span>${label}</span>${key === "explore" ? '<span class="badge">FREE</span>' : ""}</button>`).join("")}</nav><div class="sidebar-spacer"></div><div class="sidebar-note"><span class="tiny-flower" aria-hidden="true">✿</span><strong>Good things take practice.</strong><p>No rush. No paywalls.<br>Just a little growth, every day.</p></div><div class="sidebar-footer"><button class="user-mini" data-nav="settings"><span class="avatar">${esc(state.name[0].toUpperCase())}</span><div><strong>${state.name === "friend" ? "A curious human" : esc(state.name)}</strong><small>Lifelong learner</small></div>${icon("settings")}</button></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumbs">Your workspace ${icon("chevron")} <b>${esc(navItems.find((n) => n[0] === page)[2])}</b></div><div class="mobile-brand"><span class="brand-mark" aria-hidden="true">✿</span>bloom</div><div class="topbar-right"><span class="free-label">${icon("leaf")} Free to learn. Free to grow.</span><button class="streak-pill" data-action="streak" aria-label="${active} day learning streak">${icon("leaf")} ${active} day${active === 1 ? "" : "s"}</button><button class="avatar" data-nav="settings" aria-label="Open your settings">${esc(state.name[0].toUpperCase())}</button></div></header><main id="main" tabindex="-1"><div class="page-head"><div><h1>${esc(title)}${page === "learn" ? '<span class="greeting-flower" aria-hidden="true">✳</span>' : ""}</h1><p>${esc(subtitle)}</p></div><span class="date-label">${icon("calendar")}${new Date().toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}</span></div>${!storageAvailable ? '<p class="storage-warning">Browser storage is unavailable. Progress will last only while this tab stays open.</p>' : ""}${page === "learn" ? dashboard() : page === "explore" ? explorePage() : page === "review" ? reviewPage() : page === "notebook" ? notebookPage() : page === "progress" ? progressPage() : page === "speaking" ? '<div id="speaking-studio"></div>' : settingsPage()}</main><footer class="page-footer"><span>${icon("leaf")} Made for curious minds. Open to everyone.</span><span>English & French · A1 to C1 · 100% free</span></footer></div></div>`;
  if (page === "explore") bindSearch();
  if (page === "speaking") studio.mount($("#speaking-studio"));
}
function dashboard() {
  const next = nextLesson(),
    resume = state.session && !["complete"].includes(state.session.stage),
    level = LEVELS.find((l) => l.id === state.levels[state.language]);
  return `<div class="dashboard-grid"><div class="main-column"><section class="hero"><div class="hero-copy"><div class="eyebrow"><span></span>GROW A LITTLE, EVERY DAY</div><h2>A little practice.<br>A world of possibility.</h2><p>Free English & French, from A1 to C1 practice. No account, no payments. Just pick a language and begin.</p><button class="btn" ${resume ? 'data-action="resume"' : `data-start="${next.id}"`}>${resume ? "Pick up where you left off" : "Start learning for free"} ${icon("arrow")}</button></div><div class="hero-stamp">${icon("spark")} Small steps. Real growth.</div><div class="hero-art">${illustration()}</div></section><div class="quick-guide"><span>New here?</span> Pick English or French below. Start at A1, or choose any level. Progress saves automatically.</div><button class="speaking-shortcut" data-nav="speaking">${icon("mic")}<span><strong>Give your words a voice.</strong><small>Meet Pip · free speaking practice, A1–C1</small></span>${icon("arrow")}</button><div class="section-heading"><h2>Your languages</h2><span class="meta">Two languages. Endless possibilities.</span></div><div class="language-grid">${Object.entries(
    LANGUAGES,
  )
    .map(
      ([key, l]) =>
        `<button class="language-card ${state.language === key ? "selected" : ""}" data-language="${key}" aria-pressed="${state.language === key}"><span class="flag-circle" aria-hidden="true">${flag(key)}</span><div><h3>${l.name}</h3><p>${key === "en" ? "Open new doors" : "Une nouvelle aventure"} · ${completedCount(key)}/25</p><div class="course-mini-progress"><span style="width:${completedCount(key) * 4}%"></span></div></div>${state.language === key ? '<span class="selected-tick">✓</span>' : ""}</button>`,
    )
    .join(
      "",
    )}</div><div class="section-heading course-heading"><div><h2>Your ${LANGUAGES[state.language].name} journey</h2><span class="free-chip">ALL LEVELS FREE</span></div><button class="text-btn" data-action="levels">Find your level ${icon("arrow")}</button></div>${levelTabs()}<div class="level-description"><strong>${esc(level.description)}</strong><span>5 lessons · ~50 min</span></div><div class="lesson-grid">${COURSES[state.language][level.id].map((u) => lessonCard(u, u.id === next.id)).join("")}</div><p class="course-disclaimer">No hearts to lose. No locked lessons. Start at any level, revisit anytime.<br>CEFR-inspired practice, not a certified or exhaustive course. Build real-world conversation alongside these lessons.</p></div>${rightColumn()}</div>`;
}
function levelTabs() {
  return `<div class="level-tabs" role="group" aria-label="Choose your learning level">${LEVELS.map((l, i) => `<button class="level-tab ${state.levels[state.language] === l.id ? "active" : ""}" data-level="${l.id}" aria-pressed="${state.levels[state.language] === l.id}">${l.id} <small>${["Beginner", "Elementary", "Intermediate", "Upper int.", "Advanced"][i]}</small></button>`).join("")}</div>`;
}
function lessonCard(u, next = false) {
  const done = state.completed[u.id],
    saved = state.saved.includes(u.id);
  return `<article class="lesson-card ${next && !done ? "next" : ""}"><div class="card-top"><span class="lesson-icon" aria-hidden="true">${topicIcon(u.icon)}</span><div class="card-top-actions"><span class="lesson-tag ${done ? "done" : ""}">${done ? "✓ Practised" : next ? "Up next" : u.level + " · Lesson " + u.number}</span><button class="save-btn ${saved ? "saved" : ""}" data-save="${u.id}" aria-label="${saved ? "Unsave" : "Save"} ${esc(u.title)}" aria-pressed="${saved}">${icon("bookmark")}</button></div></div><h3>${esc(u.title)}</h3><p>${esc(u.focus)}</p><div class="lesson-bottom"><small>${icon("clock")} ~10 min · ${done ? `${done.best}/6 best` : "6 questions"}</small><button class="text-btn" data-start="${u.id}" aria-label="${done ? "Practise" : "Start"} ${esc(u.title)}">${done ? "Revisit" : "Let’s begin"} ${icon("arrow")}</button></div></article>`;
}
function rightColumn() {
  const done = state.activity[localDay()] || 0,
    percentage = Math.min(1, done / state.goal),
    word = LANGUAGES[state.language].word;
  return `<aside class="right-column" aria-label="Your daily inspiration"><section class="panel goal-panel"><div class="panel-heading"><h2>A little goal for today</h2>${icon("target")}</div><div class="goal-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="51" fill="none" stroke="#f0f2e8" stroke-width="8"/><circle cx="60" cy="60" r="51" fill="none" stroke="#adbf8b" stroke-width="8" stroke-linecap="round" stroke-dasharray="${percentage * 320.45} 320.45"/></svg><div><strong>${done}<span> / ${state.goal}</span></strong><small>lessons today</small></div></div><p class="goal-message"><b>${done >= state.goal ? "Look at you grow!" : "You’re planting something good."}</b>${done >= state.goal ? "Your daily goal is in full bloom." : "A little progress is still progress."}</p><button class="text-btn" data-action="goal">Make it your own ${icon("chevron")}</button></section><section class="panel word-panel"><div class="word-eyebrow">${icon("spark")} A WORD TO FALL IN LOVE WITH</div><div class="word-title"><h3>${word[0]}</h3><button class="audio-btn" data-audio="word" aria-label="Hear ${word[0]}">${icon("audio")}</button></div><div class="pronunciation">${state.language === "en" ? "noun · English" : "verb · français"}</div><p>${word[1]}</p><div class="word-footer">A SMALL WORD. A WHOLE NEW FEELING.</div></section><section class="panel week-panel"><h2>Your week in little steps</h2><p>Showing up is something to be proud of.</p><div class="week">${weekDays()
    .map(
      (d) =>
        `<div class="day"><span>${d.label}</span><span class="day-dot ${state.activity[d.date] ? "practiced" : "no-practice"} ${d.date === localDay() ? "today" : ""}" title="${d.date}: ${state.activity[d.date] || 0} lessons">${state.activity[d.date] ? "✓" : "·"}</span></div>`,
    )
    .join(
      "",
    )}</div><div class="week-caption">${icon("leaf")} ${streak(state.activity) ? `${streak(state.activity)} day${streak(state.activity) === 1 ? "" : "s"} of growing. Keep it gentle.` : "Your next little step can be today."}</div></section><div class="quote-card"><div class="quote-mark">“</div><p>A different language is<br>a different vision of life.</p><small>FEDERICO FELLINI</small></div></aside>`;
}
function weekDays() {
  const d = new Date(),
    offset = (d.getDay() + 6) % 7;
  const monday = shiftDay(localDay(), -offset);
  return Array.from({ length: 7 }, (_, i) => ({
    date: shiftDay(monday, i),
    label: ["M", "T", "W", "T", "F", "S", "S"][i],
  }));
}
function filteredLessons() {
  return ALL_LESSONS.filter(
    (u) =>
      (libraryLanguage === "all" || u.language === libraryLanguage) &&
      (libraryLevel === "all" || u.level === libraryLevel) &&
      `${u.title} ${u.focus} ${u.note}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
}
function explorePage() {
  return `<div class="filter-row"><label class="search-bar">${icon("search")}<input id="course-search" type="search" placeholder="Find your next discovery…" value="${esc(search)}" aria-label="Search lesson titles and topics"></label><select id="library-language" aria-label="Filter by language"><option value="all">Both languages</option>${Object.entries(
    LANGUAGES,
  )
    .map(
      ([k, l]) =>
        `<option value="${k}" ${libraryLanguage === k ? "selected" : ""}>${l.name}</option>`,
    )
    .join(
      "",
    )}</select><select id="library-level" aria-label="Filter by level"><option value="all">Every level</option>${LEVELS.map((l) => `<option ${libraryLevel === l.id ? "selected" : ""}>${l.id}</option>`).join("")}</select></div><div class="section-heading"><h2>Choose what makes you curious</h2><span class="meta" id="search-count">${filteredLessons().length} free lessons</span></div><div class="lesson-grid library-grid" id="library-results">${searchResults()}</div><p class="course-disclaimer">All 50 lessons are open from day one: 25 English and 25 French lessons, with 300 questions and 50 writing prompts. Level labels are intended difficulty guides, not placement assessments or qualifications.</p>`;
}
function searchResults() {
  const lessons = filteredLessons();
  return lessons.length
    ? lessons.map((u) => lessonCard(u)).join("")
    : `<div class="empty-state"><span class="empty-icon">${icon("search")}</span><h2>A different path, perhaps?</h2><p>No lessons match these filters. Try another word or choose every level.</p></div>`;
}
function bindSearch() {
  const refresh = () => {
    $("#library-results").innerHTML = searchResults();
    $("#search-count").textContent = `${filteredLessons().length} free lessons`;
  };
  $("#course-search").oninput = (e) => {
    search = e.target.value;
    refresh();
  };
  $("#library-language").onchange = (e) => {
    libraryLanguage = e.target.value;
    refresh();
  };
  $("#library-level").onchange = (e) => {
    libraryLevel = e.target.value;
    refresh();
  };
}
function reviewPool(includeFuture = false) {
  const ids = [
    ...new Set([...Object.keys(state.completed), ...state.saved]),
  ].filter((id) => id.startsWith(state.language + "-"));
  if (!ids.length) ids.push(COURSES[state.language].A1[0].id);
  return ids
    .flatMap((id) =>
      getLesson(id).vocabulary.map(([word, meaning], i) => ({
        id: `${id}:${i}`,
        word,
        meaning,
        lessonId: id,
      })),
    )
    .filter(
      (card) =>
        includeFuture ||
        !state.reviews[card.id] ||
        state.reviews[card.id].due <= localDay(),
    );
}
function reviewPage() {
  if (!review) {
    const cards = reviewPool();
    return `<div class="review-area"><div class="language-grid">${Object.entries(
      LANGUAGES,
    )
      .map(
        ([k, l]) =>
          `<button class="language-card ${state.language === k ? "selected" : ""}" data-language="${k}" aria-pressed="${state.language === k}"><span class="flag-circle">${flag(k)}</span><h3>${l.name}</h3></button>`,
      )
      .join(
        "",
      )}</div><div class="empty-state" style="margin-top:22px"><span class="empty-icon">${topicIcon("🌱")}</span><h2>${cards.length ? "A few familiar faces. A few new words." : "All caught up. Let it settle."}</h2><p>${cards.length ? `${cards.length} words are ready to revisit. Recall the meaning, then turn the card over. Words come from your practised and bookmarked lessons.` : "Your next reviews are scheduled. You can still practise without changing their schedule."}</p><button class="btn" data-action="review-start">${cards.length ? "Start a gentle review" : "Practise all words"} ${icon("arrow")}</button><p class="review-hint" style="margin-top:17px">“Got it” schedules a word for later. “Again” keeps it in today’s queue.<br>New here? Your first three words are ready to explore.</p></div></div>`;
  }
  if (review.index >= review.cards.length)
    return `<div class="review-area"><div class="empty-state"><span class="empty-icon">${topicIcon("✨")}</span><h2>A little more familiar.</h2><p>You reviewed ${review.cards.length} words. ${review.again.length ? `${review.again.length} could use another look.` : "Give yourself a moment to let them sink in."}</p><button class="btn" data-action="review-end">${review.again.length ? "Revisit the tricky ones" : "Back to your journey"} ${icon("arrow")}</button></div></div>`;
  const card = review.cards[review.index];
  return `<div class="review-area"><div class="review-count"><span>${flag(state.language)} ${LANGUAGES[state.language].name} word studio</span><span>${review.index + 1} / ${review.cards.length}</span></div><div class="flashcard"><div class="eyebrow">${review.flipped ? "A LITTLE CONNECTION" : "DOES THIS RING A BELL?"}</div><h2>${esc(card.word)}</h2><button class="audio-btn" data-audio="review" aria-label="Hear ${esc(card.word)}">${icon("audio")}</button>${review.flipped ? `<p>${esc(card.meaning)}</p>` : "<p>Try recalling the meaning before you turn it over.</p>"}</div><div class="review-controls">${review.flipped ? '<button class="btn light" data-action="review-again">A little more practice</button><button class="btn" data-action="review-known">Got it ✓</button>' : '<button class="btn" data-action="review-flip">Turn the card over ' + icon("arrow") + "</button>"}</div><p class="review-hint">${review.practice ? "Extra practice mode · your scheduled review dates won’t change." : "No timer. No pressure. Make a connection at your own pace."}</p></div>`;
}
function notebookPage() {
  const writing = Object.entries(state.completed).filter(([, v]) => v.writing);
  return `<div class="section-heading"><h2>Your notes <span class="meta">(${state.notes.length})</span></h2><button class="btn light" data-action="add-note">+ A little note</button></div>${
    state.notes.length
      ? state.notes
          .slice()
          .reverse()
          .map(
            (n) =>
              `<article class="note-card"><div class="note-header"><strong>${esc(getLesson(n.lessonId).icon + " " + getLesson(n.lessonId).title)}</strong><span class="free-chip">${getLesson(n.lessonId).level}</span></div><div class="note-date">${LANGUAGES[getLesson(n.lessonId).language].name} · ${esc(n.date)}</div><p>${esc(n.text)}</p><div class="note-actions"><button data-edit-note="${esc(n.id)}">Edit note</button><button class="delete" data-delete-note="${esc(n.id)}">Delete</button><button data-start="${n.lessonId}">Revisit lesson →</button></div></article>`,
          )
          .join("")
      : `<div class="empty-state"><span class="empty-icon">${icon("note")}</span><h2>A space for your “aha!” moments.</h2><p>Save a helpful rule, a favourite phrase, or a question to explore. It all belongs here.</p></div>`
  }<div class="section-heading"><h2>Saved for a little later</h2><span class="meta">${state.saved.length} lessons</span></div><div class="lesson-grid library-grid">${state.saved.length ? state.saved.map((id) => lessonCard(getLesson(id))).join("") : '<div class="empty-state"><p style="margin:0 auto">Tap the bookmark on a lesson to keep it close. Its vocabulary will join your Word studio.</p></div>'}</div>${writing.length ? `<div class="section-heading"><h2>Your writing practice</h2><span class="meta">Self-reviewed, not automatically graded</span></div>${writing.map(([id, entry]) => `<article class="note-card"><div class="note-header"><strong>${esc(getLesson(id).title)}</strong><button class="text-btn" data-model="${id}">See sample response ${icon("arrow")}</button></div><div class="note-date">${id.split("-")[1]} · ${esc(entry.date)} · ${entry.selfReviewed ? "Self-reviewed" : "Draft / not reviewed"}</div><p lang="${getLesson(id).language}">${esc(entry.writing)}</p></article>`).join("")}` : ""}`;
}
function progressPage() {
  const counts = Object.values(state.activity).reduce((a, b) => a + b, 0),
    writing = Object.values(state.completed).filter(
      (e) => e.selfReviewed,
    ).length;
  return `<div class="stat-grid">${[
    ["leaf", Object.keys(state.completed).length, "Unique lessons practised"],
    ["spark", state.xp, "Practice XP earned"],
    ["calendar", streak(state.activity), "Day learning streak"],
    ["note", writing, "Writing tasks self-reviewed"],
  ]
    .map(
      ([i, n, l]) =>
        `<div class="stat-box">${icon(i)}<strong>${n}</strong><small>${l}</small></div>`,
    )
    .join("")}</div><div class="progress-courses">${Object.entries(LANGUAGES)
    .map(
      ([k, l]) =>
        `<section class="panel progress-course"><h2>${flag(k)} ${l.name} <small style="color:#68775b;font-weight:400;font-size:11px">${completedCount(k)} / 25 lessons</small></h2>${LEVELS.map(
          (level) => {
            const n = COURSES[k][level.id].filter(
              (u) => state.completed[u.id],
            ).length;
            return `<div class="level-progress"><div><span>${level.id} · ${level.name}</span><small>${n} / 5 practised</small></div><div class="progress-track"><span style="width:${n * 20}%"></span></div></div>`;
          },
        ).join("")}</section>`,
    )
    .join(
      "",
    )}</div><div class="panel" style="margin-top:22px"><h2 style="margin-bottom:15px">Practice, not perfection.</h2><p class="info-copy">You’ve completed <strong>${counts} practice session${counts === 1 ? "" : "s"}</strong> across <strong>${Object.keys(state.activity).length} active day${Object.keys(state.activity).length === 1 ? "" : "s"}</strong>. Completing a lesson records participation; quiz scores measure only those six questions. They do not certify CEFR proficiency. Your next step might be a real conversation, an article, or simply revisiting a tricky word.</p><button class="btn light" data-nav="learn">Keep growing ${icon("arrow")}</button></div>`;
}
function settingsPage() {
  return `<div class="settings"><section class="panel"><h2>A familiar face</h2><form id="profile-form"><div class="field"><label for="display-name">What should we call you?</label><input id="display-name" value="${esc(state.name)}" required maxlength="30" autocomplete="given-name"><small>Saved only in this browser. No account or email needed.</small></div><button class="btn" type="submit">Save your name ${icon("check")}</button></form></section><section class="panel"><h2>Your learning rhythm</h2><div class="setting-row"><div>Daily goal<p>${state.goal} lesson${state.goal === 1 ? "" : "s"} per day · change it anytime</p></div><button class="btn light" data-action="goal">Adjust</button></div><div class="setting-row"><div>Pronunciation audio<p>Uses your browser’s available English and French voices.</p></div><button class="toggle ${state.sound ? "on" : ""}" data-action="sound" role="switch" aria-label="Pronunciation audio" aria-checked="${state.sound}"><span></span></button></div><p class="info-copy">Playback is always started by you, never automatically. Voices and availability depend on your browser and operating system. Speaking Studio offers optional microphone controls with a separate consent choice. Local recordings stay in the tab; browser dictation may use a provider’s network speech service. Some playback voices may also use a network service.</p></section><section class="panel"><h2>Yours, and yours alone.</h2><p class="info-copy">All 50 lessons, 300 questions, 50 writing prompts, and review tools are free. No subscriptions, ads, hearts, payments, or premium tiers. Progress and notes stay in this browser’s local storage. Clearing browser data removes them. Bloom does not run a server database. Browser dictation may send audio to your browser provider; see the Speaking Studio privacy notice.</p><p class="info-copy">Original, CEFR-inspired material for A1–C1 practice. This is not an accredited or comprehensive curriculum, a placement test, or a guarantee of fluency. Writing and speaking benefit from feedback from a qualified teacher or fluent speaker.</p><button class="btn light" data-action="export">${icon("download")} Export my progress</button><p class="info-copy" style="margin-top:13px">The export is a personal JSON record; in-app import is not currently available.</p></section><section class="panel"><h2>A fresh page</h2><p class="info-copy">Reset all Bloom progress, notes, reviews, speaking history, and settings in this browser. Your old Duolingo-style demo data is kept separate and is not changed.</p><button class="btn light" data-action="reset">Reset my learning data</button></section></div>`;
}
function navigate(next) {
  if (!titles[next]) return;
  studio.leave();
  page = next;
  history.replaceState(null, "", `#${next}`);
  review = null;
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#main").focus({ preventScroll: true });
}
function toast(text) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function openDialog(title, html, bind) {
  modalReturnFocus = document.activeElement;
  $("#app").inert = true;
  $("#lesson-root").inert = true;
  $("#modal-root").innerHTML =
    `<div class="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="close" data-action="close-dialog" aria-label="Close dialog">${icon("close")}</button><h2 id="dialog-title">${esc(title)}</h2>${html}</section></div>`;
  bind?.();
  $(".dialog button, .dialog input")?.focus();
}
function closeDialog() {
  $("#modal-root").innerHTML = "";
  $("#lesson-root").inert = false;
  $("#app").inert = Boolean($(".lesson-screen"));
  modalReturnFocus?.isConnected && modalReturnFocus.focus();
}
function goalDialog() {
  openDialog(
    "Find your gentle rhythm.",
    `<p>A goal should fit your day, not the other way around. You can change it whenever you like.</p><div class="goal-options">${[1, 2, 3, 5].map((n) => `<button class="goal-option ${state.goal === n ? "selected" : ""}" data-goal="${n}" aria-pressed="${state.goal === n}"><strong>${n} lesson${n === 1 ? "" : "s"}</strong><small>${n === 1 ? "A little daily ritual" : n === 2 ? "Room to explore" : n === 3 ? "A deeper dive" : "An extra-curious day"} · ~${n * 10} min</small></button>`).join("")}</div>`,
  );
}
function noteDialog(id = null, lessonId = null) {
  const existing = state.notes.find((n) => n.id === id);
  openDialog(
    existing ? "A little edit." : "Keep a little discovery.",
    `<form id="note-form"><div class="field"><label for="note-lesson">Connected to</label><select id="note-lesson">${ALL_LESSONS.map((u) => `<option value="${u.id}" ${(existing?.lessonId || lessonId || nextLesson().id) === u.id ? "selected" : ""}>${LANGUAGES[u.language].name} · ${u.level} · ${esc(u.title)}</option>`).join("")}</select></div><div class="field"><label for="note-text">Your note</label><textarea id="note-text" required maxlength="8000" rows="5" placeholder="A phrase, a rule, a little aha…">${esc(existing?.text || "")}</textarea></div><button class="btn full" type="submit">Save to my notebook ${icon("note")}</button></form>`,
    () => {
      $("#note-form").onsubmit = (e) => {
        e.preventDefault();
        const text = $("#note-text").value.trim();
        if (!text) return toast("Add a little thought before saving.");
        const note = {
          id:
            existing?.id ||
            `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          lessonId: $("#note-lesson").value,
          text,
          date: localDay(),
        };
        if (existing)
          state.notes = state.notes.map((n) => (n.id === id ? note : n));
        else state.notes.push(note);
        save();
        closeDialog();
        render();
        toast("A little discovery, safely kept.");
      };
    },
  );
}
function speak(text, language = state.language, rate = 0.85) {
  if (!state.sound)
    return toast("Pronunciation audio is off. You can turn it on in Settings.");
  if (!("speechSynthesis" in window))
    return toast("Pronunciation audio is unavailable in this browser.");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANGUAGES[language].locale;
  utterance.rate = rate;
  utterance.onerror = (e) => {
    if (e.error !== "interrupted" && e.error !== "canceled")
      toast(
        "Audio could not play. Your device may need a voice for this language.",
      );
  };
  speechSynthesis.speak(utterance);
}
function toggleSaved(id) {
  if (!getLesson(id)) return;
  state.saved = state.saved.includes(id)
    ? state.saved.filter((s) => s !== id)
    : [...state.saved, id];
  save();
  render();
}
function reviewMark(known) {
  if (!review || !review.flipped || review.index >= review.cards.length) return;
  const card = review.cards[review.index],
    old = state.reviews[card.id];
  if (!review.practice) {
    const interval = known
      ? Math.min(30, Math.max(1, (old?.interval || 0) * 2))
      : 0;
    state.reviews[card.id] = { interval, due: shiftDay(localDay(), interval) };
    save();
  }
  if (!known) review.again.push(card);
  review.index++;
  review.flipped = false;
  render();
}
function startLesson(id, replace = false) {
  const u = getLesson(id);
  if (!u) return;
  if (state.session?.id === id && state.session.stage !== "complete") {
    showLesson();
    return;
  }
  if (state.session && state.session.stage !== "complete" && !replace) {
    openDialog(
      "A little change of direction?",
      `<p>Your current lesson is paused. Starting a different lesson will replace that unfinished session. Completed lessons and notes stay safe.</p><div class="dialog-actions"><button class="btn light" data-action="close-dialog">Stay here</button><button class="btn" id="replace-session">Start this lesson</button></div>`,
      () => {
        $("#replace-session").onclick = () => {
          closeDialog();
          startLesson(id, true);
        };
      },
    );
    return;
  }
  state.session = {
    id,
    stage: "study",
    index: 0,
    answers: [],
    writing: "",
    selected: null,
    checked: false,
    awarded: false,
    selfReviewed: false,
  };
  state.language = u.language;
  state.levels[u.language] = u.level;
  save();
  showLesson();
}
function showLesson() {
  const u = getLesson(state.session.id);
  state.language = u.language;
  state.levels[u.language] = u.level;
  save();
  render();
  $("#app").inert = true;
  renderLesson();
  window.speechSynthesis?.cancel();
}
function arrangedOptions(u, index) {
  const options = [...u.questions[index].options];
  let seed = [...u.id].reduce((n, c) => n + c.charCodeAt(0), 0) + index;
  for (let i = options.length - 1; i > 0; i--) {
    const j = seed % (i + 1);
    [options[i], options[j]] = [options[j], options[i]];
    seed = Math.floor(seed / 3) + 7;
  }
  return options;
}
function renderLesson(focus = "heading") {
  const s = state.session;
  if (!s) {
    $("#lesson-root").innerHTML = "";
    $("#app").inert = false;
    return;
  }
  const u = getLesson(s.id),
    language = LANGUAGES[u.language];
  const stageLabel =
    s.stage === "study"
      ? "Get comfortable"
      : s.stage === "question"
        ? `A little practice · ${s.index + 1}/6`
        : s.stage === "write"
          ? "Make it yours"
          : s.stage === "reflect"
            ? "Reflect & grow"
            : "A little growth";
  const progress =
    s.stage === "study"
      ? 0
      : s.stage === "question"
        ? (s.index + (s.checked ? 1 : 0)) / 8
        : s.stage === "write"
          ? 6 / 8
          : s.stage === "reflect"
            ? 7 / 8
            : 1;
  let body = "",
    footer = "";
  if (s.stage === "study") {
    body = `<div class="eyebrow">${flag(u.language)} ${language.name} · ${u.level} · LESSON ${u.number}</div><h1 tabindex="-1">${esc(u.title)}</h1><p class="lesson-lead">${esc(u.focus)} · ~10 minutes · always free</p><section class="study-note"><h2>A little idea to take with you</h2><p>${esc(u.note)}</p></section><div class="section-heading"><h2>Three words to make friends with</h2></div><div class="vocab-list">${u.vocabulary.map(([word, meaning], i) => `<div class="vocab-row"><div><strong lang="${u.language}">${esc(word)}</strong><small>${esc(meaning)}</small></div><button class="audio-btn" data-vocab-audio="${i}" aria-label="Hear ${esc(word)}">${icon("audio")}</button></div>`).join("")}</div><div class="section-heading"><h2>A little reading</h2><button class="text-btn" data-audio="passage">${icon("audio")} Listen</button></div><div class="reading-block" lang="${u.language}"><p>${esc(u.passage)}</p></div><p class="review-hint">Read it aloud if you can. Speaking practice here is self-directed, not recorded or graded.</p>`;
    footer = `<span class="footer-hint">No timer. Revisit this explanation anytime.</span><button class="btn" data-action="begin-questions">Let’s try it ${icon("arrow")}</button>`;
  } else if (s.stage === "question") {
    const question = u.questions[s.index],
      options = arrangedOptions(u, s.index),
      correct = s.checked && options[s.selected] === question.answer;
    body = `<div class="eyebrow">${flag(u.language)} ${u.level} · ${s.index < 3 ? "WORDS IN YOUR WORLD" : s.index < 5 ? "LET’S CONNECT THE IDEAS" : "READ BETWEEN THE WORDS"}</div><h1 tabindex="-1">${esc(question.prompt)}</h1><p class="lesson-lead">${s.index < 3 ? "Choose the meaning that fits." : s.index < 5 ? "Choose the answer that fits best." : "Return to the text. The clue is in there."}</p>${question.passage ? `<div class="reading-block" lang="${u.language}"><div class="reading-header">A LITTLE READING<button class="audio-btn" data-audio="passage" aria-label="Listen to the passage">${icon("audio")}</button></div><p>${esc(question.passage)}</p></div>` : ""}<div class="answers" role="group" aria-label="Answer choices">${options.map((answer, i) => `<button class="answer ${s.selected === i ? "selected" : ""} ${s.checked && answer === question.answer ? "correct" : ""} ${s.checked && s.selected === i && !correct ? "incorrect" : ""}" data-answer="${i}" aria-pressed="${s.selected === i}" ${s.checked ? "disabled" : ""}><span class="key">${i + 1}</span>${esc(answer)}</button>`).join("")}</div>${!s.checked ? '<p class="review-hint" style="margin-top:20px">Tip: use keys 1–3, then Enter to check.</p>' : ""}`;
    footer = s.checked
      ? `<div class="feedback" role="status"><strong>${correct ? "A little connection made. ✓" : "A useful little discovery."}</strong><p>${esc(question.explanation)}${!correct ? " Mistakes are part of learning. No penalties here." : ""}</p></div><button class="btn" data-action="next-question">Keep going ${icon("arrow")}</button>`
      : `<button class="text-btn" data-action="lesson-help">A little reminder ${icon("book")}</button><button class="btn" data-action="check" ${s.selected === null ? "disabled" : ""}>Check my answer ${icon("check")}</button>`;
  } else if (s.stage === "write") {
    const target = {
      A1: "15–30",
      A2: "30–50",
      B1: "50–80",
      B2: "80–120",
      C1: "100–160",
    }[u.level];
    body = `<div class="eyebrow">${flag(u.language)} ${u.level} · YOUR WORDS, YOUR WAY</div><h1 tabindex="-1">Make it your own.</h1><p class="lesson-lead">A little writing makes room for your own voice.</p><section class="study-note"><h2>Your writing invitation</h2><p>${esc(u.writing)}</p></section><label for="writing-draft" class="sr-only">Your ${language.name} writing practice</label><textarea id="writing-draft" class="writing-input" lang="${u.language}" maxlength="8000" placeholder="${u.language === "fr" ? "Écrivez quelques phrases ici…" : "Let a few words find their way here…"}">${esc(s.writing)}</textarea><div class="writing-meta"><span id="word-count">${wordCount(s.writing)} words</span><span>Aim for ${target} words if you’d like.</span></div><p class="review-hint" style="margin-top:20px">Your draft saves as you type. Compare it with a short sample next.<br>No AI grading or teacher feedback is provided. Sample responses are illustrations, not the only correct answer.</p>`;
    footer = `<button class="text-btn" data-action="skip-writing">Leave writing for later</button><button class="btn" data-action="reflect" ${s.writing.trim() ? "" : "disabled"}>Read & reflect ${icon("arrow")}</button>`;
  } else if (s.stage === "reflect") {
    body = `<div class="eyebrow">${flag(u.language)} ${u.level} · A MOMENT TO REFLECT</div><h1 tabindex="-1">Notice what’s growing.</h1><p class="lesson-lead">Different words can express the same good idea.</p>${s.writing ? `<div class="section-heading"><h2>Your words</h2><button class="text-btn" data-action="edit-writing">Keep shaping it</button></div><div class="note-card"><p lang="${u.language}" style="margin:0">${esc(s.writing)}</p></div>` : '<p class="info-copy">Writing is saved for another day. You can revisit this lesson anytime.</p>'}<section class="model-answer"><h2>A short sample, not a perfect script</h2><p lang="${u.language}">${esc(u.model)}</p></section><div class="self-check"><strong>A gentle self-check</strong><ul><li>Did I respond to the invitation?</li><li>Did I try the key idea: ${esc(u.focus)}?</li><li>Can I read it aloud and explain what I mean?</li></ul><label><input type="checkbox" id="self-reviewed" ${s.selfReviewed ? "checked" : ""} ${s.writing ? "" : "disabled"}> I compared my response with the sample and reviewed these points.</label></div>`;
    footer = `<span class="footer-hint">Self-review is a practice step, not an automated assessment.</span><button class="btn" data-action="complete">Finish this little chapter ${icon("check")}</button>`;
  } else {
    const score = s.answers.filter(Boolean).length;
    body = `<div class="completion"><div class="completion-flower" aria-hidden="true">✿</div><div class="eyebrow" style="justify-content:center">A LITTLE MORE YOU THAN YESTERDAY</div><h1 tabindex="-1">Look at you grow.</h1><p>${esc(u.title)} · ${language.name} ${u.level}</p><div class="completion-stats"><div class="completion-stat"><strong>+${10 + score * 5}</strong><small>Practice XP</small></div><div class="completion-stat"><strong>${score}/6</strong><small>Quiz correct</small></div><div class="completion-stat"><strong>${streak(state.activity)}</strong><small>Day streak</small></div></div><p class="completion-note">${score < 6 ? "Every tricky answer is a chance to reconnect. Revisit this lesson whenever you like." : "Six little connections made. Give them room to settle, then try using them in real life."} ${s.selfReviewed ? "Your writing is saved in your notebook." : s.writing ? "Your writing draft is saved in your notebook." : "You can return for writing practice anytime."}</p><button class="btn" data-action="finish">Back to my garden ${icon("arrow")}</button><button class="btn light" data-action="completion-review">Revisit my words ${icon("layers")}</button><div class="inline-note" style="text-align:left"><label for="completion-note">Keep a little discovery from this lesson</label><textarea id="completion-note" maxlength="8000" placeholder="A word, a rule, an aha…"></textarea><button class="btn light" data-action="save-completion-note">Save to my notebook ${icon("note")}</button></div></div>`;
    footer = `<span class="footer-hint">Practice completed. No proficiency level or qualification is awarded.</span><button class="text-btn" data-action="lesson-help">Revisit the key idea ${icon("book")}</button>`;
  }
  let feedbackClass = "";
  if (s.stage === "question" && s.checked)
    feedbackClass =
      arrangedOptions(u, s.index)[s.selected] === u.questions[s.index].answer
        ? "feedback-good"
        : "feedback-bad";
  $("#lesson-root").innerHTML =
    `<section class="lesson-screen" role="dialog" aria-modal="true" aria-label="${esc(u.title)} lesson"><div class="lesson-shell"><header class="lesson-header">${brand()}<div class="progress-track" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><span style="width:${progress * 100}%"></span></div><span class="lesson-status">${stageLabel}</span><button class="close-lesson" data-action="pause" aria-label="Pause lesson and save progress">${icon("close")}</button></header><main class="lesson-body">${body}</main><footer class="lesson-footer ${feedbackClass}">${footer}</footer></div></section>`;
  if (s.stage === "write")
    $("#writing-draft").oninput = (e) => {
      s.writing = e.target.value;
      s.selfReviewed = false;
      save();
      $("#word-count").textContent = `${wordCount(s.writing)} words`;
      $('[data-action="reflect"]').disabled = !s.writing.trim();
    };
  if (s.stage === "reflect")
    $("#self-reviewed").onchange = (e) => {
      s.selfReviewed = e.target.checked;
      save();
    };
  if (focus === "heading") {
    $(".lesson-body h1")?.focus({ preventScroll: true });
    $(".lesson-screen").scrollTop = 0;
  }
  if (focus === "answer")
    $(`[data-answer="${s.selected}"]`)?.focus({ preventScroll: true });
  if (focus === "feedback")
    $('[data-action="next-question"]')?.focus({ preventScroll: true });
}
function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}
function checkAnswer() {
  const s = state.session;
  if (!s || s.stage !== "question" || s.checked || s.selected === null) return;
  const u = getLesson(s.id);
  s.answers.push(
    arrangedOptions(u, s.index)[s.selected] === u.questions[s.index].answer,
  );
  s.checked = true;
  save();
  renderLesson("feedback");
}
function hideLesson() {
  window.speechSynthesis?.cancel();
  $("#lesson-root").innerHTML = "";
  $("#app").inert = false;
  render();
  $("#main").focus({ preventScroll: true });
}
function pauseLesson() {
  if (state.session?.stage === "complete") {
    state.session = null;
    save();
    hideLesson();
    return;
  }
  openDialog(
    "A little breather?",
    `<p>Your place and writing draft are saved in this browser. Come back when you’re ready. There’s no rush.</p><div class="dialog-actions"><button class="btn light" data-action="close-dialog">Keep learning</button><button class="btn" data-action="confirm-pause">Pause & save</button></div>`,
  );
}
function dispatch(action) {
  const s = state.session;
  switch (action) {
    case "close-dialog":
      return closeDialog();
    case "resume":
      if (s) return showLesson();
      break;
    case "goal":
      return goalDialog();
    case "streak":
      return openDialog(
        "Little steps add up.",
        `<p>You have a ${streak(state.activity)}-day streak. A completed lesson on consecutive local calendar days keeps it growing. If you haven’t practised today, yesterday’s streak stays visible until the end of today.</p><p>A missed day simply starts a new chapter. No gems, fees, or penalties.</p>`,
      );
    case "levels":
      return openDialog(
        "Start where you feel curious.",
        `<p>There’s no placement test or locked path. Use these as guides and change level anytime.</p>${LEVELS.map((l) => `<div class="level-progress"><div><strong>${l.id} · ${l.name}</strong></div><small>${l.skill}</small></div>`).join("")}<p>Labels indicate intended practice difficulty, not an assessment of your ability. All explanations use English as the support language; French examples and passages are in French.</p>`,
      );
    case "sound":
      state.sound = !state.sound;
      save();
      render();
      return;
    case "add-note":
      return noteDialog();
    case "export": {
      const blob = new Blob(
          [
            JSON.stringify(
              { ...state, speaking: studio.exportData() },
              null,
              2,
            ),
          ],
          {
            type: "application/json",
          },
        ),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `bloom-progress-${localDay()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Your personal learning record is ready.");
      return;
    }
    case "reset":
      return openDialog(
        "Turn to a fresh page?",
        `<p>This permanently removes your Bloom progress, writing, notes, speaking history, and preferences from this browser. Export your record first if you’d like a copy.</p><div class="dialog-actions"><button class="btn light" data-action="close-dialog">Keep my garden</button><button class="btn danger" data-action="confirm-reset">Yes, reset everything</button></div>`,
      );
    case "confirm-reset":
      state = defaults();
      studio.reset();
      save();
      closeDialog();
      page = "learn";
      review = null;
      hideLesson();
      toast("A fresh page. A little room to grow.");
      return;
    case "review-start": {
      const cards = reviewPool();
      review = {
        cards: cards.length ? cards : reviewPool(true),
        index: 0,
        flipped: false,
        again: [],
        practice: !cards.length,
      };
      render();
      return;
    }
    case "review-flip":
      if (review) {
        review.flipped = true;
        render();
      }
      return;
    case "review-known":
      return reviewMark(true);
    case "review-again":
      return reviewMark(false);
    case "review-end":
      if (review?.again.length) {
        review = {
          ...review,
          cards: review.again,
          index: 0,
          flipped: false,
          again: [],
        };
        render();
      } else navigate("learn");
      return;
    case "begin-questions":
      if (s && s.stage === "study") {
        s.stage = "question";
        save();
        renderLesson();
      }
      return;
    case "check":
      return checkAnswer();
    case "next-question":
      if (s?.stage === "question" && s.checked) {
        if (s.index === 5) s.stage = "write";
        else {
          s.index++;
          s.selected = null;
          s.checked = false;
        }
        save();
        renderLesson();
      }
      return;
    case "reflect":
      if (s?.stage === "write" && s.writing.trim()) {
        s.stage = "reflect";
        save();
        renderLesson();
      }
      return;
    case "skip-writing":
      if (s?.stage === "write") {
        s.stage = "reflect";
        s.selfReviewed = false;
        save();
        renderLesson();
      }
      return;
    case "edit-writing":
      if (s?.stage === "reflect") {
        s.stage = "write";
        save();
        renderLesson();
      }
      return;
    case "complete":
      if (s?.stage === "reflect") {
        completeSession(state);
        save();
        render();
        renderLesson();
      }
      return;
    case "finish":
      if (s?.stage === "complete") {
        state.session = null;
        save();
        page = "learn";
        hideLesson();
      }
      return;
    case "completion-review":
      if (s?.stage === "complete") {
        state.session = null;
        save();
        page = "review";
        review = null;
        hideLesson();
      }
      return;
    case "save-completion-note": {
      if (s?.stage !== "complete") return;
      const text = $("#completion-note").value.trim();
      if (!text) return toast("Add a little discovery first.");
      state.notes.push({
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        lessonId: s.id,
        text,
        date: localDay(),
      });
      save();
      $("#completion-note").value = "";
      toast("Your discovery is saved in your notebook.");
      return;
    }
    case "pause":
      return pauseLesson();
    case "confirm-pause":
      save();
      closeDialog();
      hideLesson();
      toast("Your place is saved. See you when you’re ready.");
      return;
    case "lesson-help":
      if (s) {
        const u = getLesson(s.id);
        return openDialog("A little reminder.", `<p>${esc(u.note)}</p>`);
      }
      return;
  }
}
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.nav) return navigate(b.dataset.nav);
  if (b.dataset.action) return dispatch(b.dataset.action);
  if (b.dataset.start) return startLesson(b.dataset.start);
  if (b.dataset.language) {
    state.language = b.dataset.language;
    review = null;
    save();
    render();
    return;
  }
  if (b.dataset.level) {
    state.levels[state.language] = b.dataset.level;
    save();
    render();
    return;
  }
  if (b.dataset.save) return toggleSaved(b.dataset.save);
  if (b.dataset.goal) {
    state.goal = Number(b.dataset.goal);
    save();
    closeDialog();
    render();
    toast("A little goal that fits your day.");
    return;
  }
  if (b.dataset.answer !== undefined) {
    const s = state.session;
    if (s?.stage !== "question" || s.checked) return;
    s.selected = Number(b.dataset.answer);
    save();
    renderLesson("answer");
    return;
  }
  if (b.dataset.vocabAudio !== undefined) {
    const u = getLesson(state.session.id);
    return speak(u.vocabulary[Number(b.dataset.vocabAudio)][0], u.language);
  }
  if (b.dataset.audio) {
    if (b.dataset.audio === "word") speak(LANGUAGES[state.language].word[0]);
    else if (b.dataset.audio === "review" && review)
      speak(review.cards[review.index].word);
    else if (b.dataset.audio === "passage" && state.session) {
      const u = getLesson(state.session.id);
      speak(u.passage, u.language);
    }
    return;
  }
  if (b.dataset.editNote) return noteDialog(b.dataset.editNote);
  if (b.dataset.deleteNote) {
    const id = b.dataset.deleteNote;
    return openDialog(
      "Let this little note go?",
      `<p>This removes the note from this browser. Your lesson progress will stay safe.</p><div class="dialog-actions"><button class="btn light" data-action="close-dialog">Keep note</button><button class="btn danger" id="confirm-delete">Delete note</button></div>`,
      () => {
        $("#confirm-delete").onclick = () => {
          state.notes = state.notes.filter((n) => n.id !== id);
          save();
          closeDialog();
          render();
        };
      },
    );
  }
  if (b.dataset.model) {
    const u = getLesson(b.dataset.model);
    openDialog(
      "One possible way to say it.",
      `<p>${esc(u.writing)}</p><div class="model-answer"><p lang="${u.language}">${esc(u.model)}</p></div><p>This is a short example, not the only correct response. No automatic writing assessment is provided.</p>`,
    );
  }
});
document.addEventListener("submit", (event) => {
  if (event.target.id === "profile-form") {
    event.preventDefault();
    const name = $("#display-name").value.trim();
    if (!name) return toast("What would you like us to call you?");
    state.name = name;
    save();
    render();
    toast(`A little more you. Welcome, ${name}.`);
  }
});
document.addEventListener("keydown", (event) => {
  const dialog = $(".dialog"),
    lessonScreen = $(".lesson-screen");
  if (event.key === "Escape") {
    event.preventDefault();
    if (dialog) closeDialog();
    else if (lessonScreen) pauseLesson();
    return;
  }
  const focusRoot = dialog || lessonScreen;
  if (event.key === "Tab" && focusRoot) {
    const elements = [
      ...focusRoot.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea, select, [tabindex="0"]',
      ),
    ].filter((e) => !e.closest("[inert]"));
    const first = elements[0],
      last = elements.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement.tagName === "H1")
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (
    dialog ||
    !lessonScreen ||
    /^(TEXTAREA|INPUT|SELECT)$/.test(event.target.tagName)
  )
    return;
  const s = state.session;
  if (s?.stage === "question" && !s.checked && /^[1-3]$/.test(event.key)) {
    event.preventDefault();
    s.selected = Number(event.key) - 1;
    save();
    renderLesson("answer");
  }
  if (s?.stage === "question" && event.key === "Enter" && s.selected !== null) {
    const target = event.target;
    if (target.matches("[data-answer]") || target.tagName !== "BUTTON") {
      event.preventDefault();
      s.checked ? dispatch("next-question") : checkAnswer();
    }
  }
});
$("#modal-root").addEventListener("click", (event) => {
  if (event.target.classList.contains("overlay")) closeDialog();
});
const studio = new SpeakingStudio({
  preferences: () => ({
    language: state.language,
    level: state.levels[state.language],
  }),
  changePreferences: (language, level) => {
    state.language = language;
    state.levels[language] = level;
    save();
  },
  speak,
  notify: toast,
});
const initialRoute =
  location.hash === "#speaking-privacy" ? "speaking" : location.hash.slice(1);
if (Object.hasOwn(titles, initialRoute)) page = initialRoute;
render();
if (state.session && page !== "speaking") showLesson();
