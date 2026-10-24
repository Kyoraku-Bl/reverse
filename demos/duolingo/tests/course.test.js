import test from "node:test";
import assert from "node:assert/strict";
import { ALL_LESSONS, COURSES, LEVELS, getLesson } from "../curriculum.js";
import {
  defaults,
  normalize,
  localDay,
  shiftDay,
  streak,
  completeSession,
} from "../state.js";

test("both languages have five distinct lessons at every level A1–C1", () => {
  assert.deepEqual(
    LEVELS.map((l) => l.id),
    ["A1", "A2", "B1", "B2", "C1"],
  );
  assert.equal(ALL_LESSONS.length, 50);
  assert.equal(new Set(ALL_LESSONS.map((l) => l.id)).size, 50);
  for (const language of ["en", "fr"])
    for (const level of LEVELS) {
      const lessons = COURSES[language][level.id];
      assert.equal(lessons.length, 5);
      assert.equal(new Set(lessons.map((l) => l.passage)).size, 5);
      for (const lesson of lessons) {
        assert.equal(lesson.language, language);
        assert.equal(lesson.level, level.id);
        assert.ok(lesson.note.length > 100);
        assert.ok(lesson.passage.length > 80);
        assert.ok(lesson.writing && lesson.model && lesson.focus);
        assert.equal(lesson.vocabulary.length, 3);
        assert.equal(lesson.questions.length, 6);
        for (const question of lesson.questions) {
          assert.equal(
            new Set(question.options).size,
            3,
            `${lesson.id}: ${question.prompt}`,
          );
          assert.equal(
            question.options.filter((o) => o === question.answer).length,
            1,
          );
          assert.ok(question.explanation);
        }
        assert.equal(lesson.questions.at(-1).passage, lesson.passage);
      }
    }
});

test("all 300 question prompts have explanations and the 50 reading questions use their own passages", () => {
  assert.equal(
    ALL_LESSONS.reduce((n, l) => n + l.questions.length, 0),
    300,
  );
  assert.equal(
    ALL_LESSONS.filter((l) => l.questions.at(-1).passage === l.passage).length,
    50,
  );
  assert.equal(getLesson("unknown"), undefined);
});

test("malformed and stale persisted values do not replace valid defaults", () => {
  for (const raw of [null, false, 123, "text", []])
    assert.deepEqual(normalize(raw), defaults());
  const s = normalize({
    name: "<script>test</script>",
    language: "es",
    levels: { en: "C9", fr: "C1" },
    goal: -1,
    xp: "100",
    completed: { invalid: { best: 6 } },
    notes: [null, {}],
    saved: ["invalid", "fr-C1-1", "fr-C1-1"],
    session: { id: "invalid" },
  });
  assert.equal(s.language, "en");
  assert.equal(s.levels.en, "A1");
  assert.equal(s.levels.fr, "C1");
  assert.equal(s.goal, 2);
  assert.equal(s.xp, 0);
  assert.equal(s.session, null);
  assert.deepEqual(s.notes, []);
  assert.deepEqual(s.saved, ["fr-C1-1"]);
  assert.equal(s.name, "<script>test</script>");
});

test("local calendar streak handles today, grace for yesterday, missed days and year boundaries", () => {
  assert.equal(localDay(new Date(2026, 9, 24, 23, 59)), "2026-10-24");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  assert.equal(streak({ "2026-10-22": 1, "2026-10-23": 2 }, "2026-10-24"), 2);
  assert.equal(streak({ "2026-10-22": 1 }, "2026-10-24"), 0);
  assert.equal(streak({ "2026-10-23": 1, "2026-10-24": 2 }, "2026-10-24"), 2);
  assert.equal(streak({}, "2026-10-24"), 0);
});

const session = (id = "en-A1-1") => ({
  id,
  stage: "reflect",
  index: 5,
  answers: [true, false, true, true, false, true],
  writing: "My first piece of writing.",
  selected: 0,
  checked: true,
  awarded: false,
  selfReviewed: true,
});
test("completion is idempotent, retains best score and separates language progress", () => {
  const s = defaults();
  s.session = session();
  assert.equal(completeSession(s, "2026-10-24"), 30);
  assert.equal(completeSession(s, "2026-10-24"), 0);
  assert.equal(s.completed["en-A1-1"].attempts, 1);
  assert.equal(s.activity["2026-10-24"], 1);
  s.session = session("fr-C1-5");
  assert.equal(completeSession(s, "2026-10-24"), 30);
  assert.equal(s.xp, 60);
  assert.equal(s.activity["2026-10-24"], 2);
  assert.equal(s.completed["en-A1-1"].best, 4);
  assert.equal(s.completed["fr-C1-5"].best, 4);
  s.session = {
    ...session(),
    answers: Array(6).fill(false),
    writing: "A new draft.",
    selfReviewed: false,
  };
  assert.equal(completeSession(s, "2026-10-25"), 10);
  assert.equal(s.completed["en-A1-1"].best, 4);
  assert.equal(s.completed["en-A1-1"].attempts, 2);
  assert.equal(s.completed["en-A1-1"].selfReviewed, false);
  assert.equal(s.completed["en-A1-1"].writing, "A new draft.");
  s.session = { ...session(), writing: "", selfReviewed: false };
  completeSession(s, "2026-10-25");
  assert.equal(s.completed["en-A1-1"].writing, "A new draft.");
});

test("an incomplete quiz or wrong stage cannot earn completion XP", () => {
  const s = defaults();
  s.session = { ...session(), answers: [true] };
  assert.equal(completeSession(s), 0);
  s.session = { ...session(), stage: "question" };
  assert.equal(completeSession(s), 0);
  assert.equal(s.xp, 0);
  assert.equal(Object.keys(s.completed).length, 0);
});

test("a paused session, notes and progress survive JSON serialization", () => {
  const s = defaults();
  s.session = { ...session("fr-B2-3"), stage: "write", awarded: false };
  s.notes.push({
    id: "note-1",
    lessonId: "en-A1-1",
    date: "2026-10-24",
    text: "A little discovery.",
  });
  s.saved = ["fr-C1-5"];
  s.reviews["en-A1-1:0"] = { due: "2026-10-25", interval: 1 };
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))), s);
});
