import { getLesson, LEVELS, LANGUAGES } from "./curriculum.js";
export const STORAGE_KEY = "bloom-language-learning-v1";
export const defaults = () => ({
  version: 1,
  name: "friend",
  language: "en",
  levels: { en: "A1", fr: "A1" },
  xp: 0,
  goal: 2,
  completed: {},
  activity: {},
  notes: [],
  saved: [],
  reviews: {},
  session: null,
  sound: true,
});
const nonnegative = (n) => Number.isFinite(n) && n >= 0;
export function normalize(raw) {
  const state = defaults();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return state;
  if (typeof raw.name === "string" && raw.name.trim())
    state.name = raw.name.trim().slice(0, 30);
  if (Object.hasOwn(LANGUAGES, raw.language)) state.language = raw.language;
  for (const language of Object.keys(LANGUAGES))
    if (LEVELS.some((l) => l.id === raw.levels?.[language]))
      state.levels[language] = raw.levels[language];
  if (nonnegative(raw.xp)) state.xp = Math.floor(raw.xp);
  if ([1, 2, 3, 5].includes(raw.goal)) state.goal = raw.goal;
  if (typeof raw.sound === "boolean") state.sound = raw.sound;
  if (raw.completed && typeof raw.completed === "object")
    for (const [id, entry] of Object.entries(raw.completed)) {
      if (
        getLesson(id) &&
        entry &&
        nonnegative(entry.best) &&
        entry.best <= 6 &&
        nonnegative(entry.attempts) &&
        typeof entry.date === "string"
      ) {
        state.completed[id] = {
          best: entry.best,
          attempts: Math.floor(entry.attempts),
          date: entry.date,
          writing:
            typeof entry.writing === "string"
              ? entry.writing.slice(0, 8000)
              : "",
          selfReviewed: entry.selfReviewed === true,
        };
      }
    }
  if (raw.activity && typeof raw.activity === "object")
    for (const [day, count] of Object.entries(raw.activity))
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && nonnegative(count))
        state.activity[day] = Math.floor(count);
  if (Array.isArray(raw.notes))
    state.notes = raw.notes
      .filter(
        (n) =>
          n &&
          typeof n.id === "string" &&
          getLesson(n.lessonId) &&
          typeof n.text === "string" &&
          typeof n.date === "string",
      )
      .map((n) => ({
        id: n.id,
        lessonId: n.lessonId,
        text: n.text.slice(0, 8000),
        date: n.date,
      }));
  if (Array.isArray(raw.saved))
    state.saved = [...new Set(raw.saved.filter((id) => getLesson(id)))];
  if (raw.reviews && typeof raw.reviews === "object")
    for (const [id, value] of Object.entries(raw.reviews))
      if (
        getLesson(id.split(":")[0]) &&
        value &&
        typeof value.due === "string" &&
        nonnegative(value.interval)
      )
        state.reviews[id] = {
          due: value.due,
          interval: Math.min(30, value.interval),
        };
  const s = raw.session;
  if (
    s &&
    getLesson(s.id) &&
    ["study", "question", "write", "reflect", "complete"].includes(s.stage) &&
    Number.isInteger(s.index) &&
    s.index >= 0 &&
    s.index < 6 &&
    Array.isArray(s.answers) &&
    s.answers.length <= 6 &&
    s.answers.every((a) => typeof a === "boolean") &&
    typeof s.writing === "string"
  ) {
    state.session = {
      id: s.id,
      stage: s.stage,
      index: s.index,
      answers: s.answers,
      writing: s.writing.slice(0, 8000),
      selected:
        Number.isInteger(s.selected) && s.selected >= 0 && s.selected < 3
          ? s.selected
          : null,
      checked: s.checked === true,
      awarded: s.awarded === true,
      selfReviewed: s.selfReviewed === true,
    };
  }
  return state;
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDay(date, amount) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return localDay(d);
}
export function streak(activity, today = localDay()) {
  let day = activity[today] ? today : shiftDay(today, -1),
    count = 0;
  while (activity[day]) {
    count++;
    day = shiftDay(day, -1);
  }
  return count;
}
export function completeSession(state, today = localDay()) {
  const s = state.session;
  if (
    !s ||
    s.stage !== "reflect" ||
    !getLesson(s.id) ||
    s.awarded ||
    s.answers.length !== 6
  )
    return 0;
  const score = s.answers.filter(Boolean).length;
  const old = state.completed[s.id];
  state.completed[s.id] = {
    best: Math.max(old?.best || 0, score),
    attempts: (old?.attempts || 0) + 1,
    date: today,
    writing: s.writing.trim() ? s.writing : old?.writing || "",
    selfReviewed: s.writing.trim()
      ? s.selfReviewed
      : old?.selfReviewed || false,
  };
  const earned = 10 + score * 5;
  state.xp += earned;
  state.activity[today] = (state.activity[today] || 0) + 1;
  s.awarded = true;
  s.stage = "complete";
  return earned;
}
