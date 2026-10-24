// Optional real-browser smoke test. Requires Playwright and a Chromium install.
// The application itself has no package dependencies.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const url = process.env.BLOOM_URL || "http://localhost:3000";
const click = (selector) => page.locator(selector).first().click();
const data = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("bloom-language-learning-v1")),
  );
async function answerQuestion(answer, wrong = false) {
  const texts = await page.locator(".answer").allTextContents();
  const i = texts.findIndex((t) => t.slice(1).trim() === answer);
  assert.ok(i >= 0, `Correct option exists: ${answer}`);
  await page
    .locator(".answer")
    .nth(wrong ? (i + 1) % 3 : i)
    .click();
  await click('[data-action="check"]');
  assert.ok(
    await page.locator(wrong ? ".feedback-bad" : ".feedback-good").isVisible(),
  );
  await click('[data-action="next-question"]');
}
async function getLesson(id) {
  return page.evaluate(
    async (id) => (await import("./curriculum.js")).getLesson(id),
    id,
  );
}
try {
  await page.goto(url);
  await page.locator(".hero").waitFor();
  assert.equal(await page.locator(".lesson-card").count(), 5);
  await click('[data-language="fr"]');
  await click('[data-level="C1"]');
  assert.equal(await page.locator('[data-start="fr-C1-5"]').count(), 1);
  await click('[data-start="fr-C1-5"]');
  assert.equal(await page.locator("#app").evaluate((e) => e.inert), true);
  await click('[data-action="begin-questions"]');
  const french = await getLesson("fr-C1-5");
  await answerQuestion(french.questions[0].answer, true);
  await click('[data-action="pause"]');
  await click('[data-action="confirm-pause"]');
  await page.reload();
  await page.locator(".lesson-screen").waitFor();
  assert.equal((await data()).session.index, 1);
  for (const q of french.questions.slice(1)) await answerQuestion(q.answer);
  await page
    .locator("#writing-draft")
    .fill(
      "Une hausse des visites peut coexister avec des dépenses stables. Les indicateurs sont différents.",
    );
  await page.reload();
  await page.locator("#writing-draft").waitFor();
  assert.match(
    await page.locator("#writing-draft").inputValue(),
    /indicateurs/,
  );
  await click('[data-action="reflect"]');
  await page.locator("#self-reviewed").check();
  await click('[data-action="complete"]');
  let s = await data();
  assert.equal(s.completed["fr-C1-5"].best, 5);
  assert.equal(s.xp, 35);
  assert.equal(s.completed["fr-C1-5"].selfReviewed, true);
  await page.reload();
  await page.locator(".completion").waitFor();
  assert.equal((await data()).xp, 35);
  await page
    .locator("#completion-note")
    .fill('<script>alert("not executed")</script> Une découverte.');
  await click('[data-action="save-completion-note"]');
  await click('[data-action="finish"]');
  await click('[data-language="en"]');
  await click('[data-level="A1"]');
  await click('.lesson-card [data-start="en-A1-1"]');
  await click('[data-action="begin-questions"]');
  const english = await getLesson("en-A1-1");
  for (const q of english.questions) await answerQuestion(q.answer);
  await click('[data-action="skip-writing"]');
  await click('[data-action="complete"]');
  await click('[data-action="finish"]');
  s = await data();
  assert.equal(s.completed["en-A1-1"].best, 6);
  assert.equal(s.completed["fr-C1-5"].best, 5);
  assert.equal(s.xp, 75);
  await click('[data-action="goal"]');
  await click('[data-goal="3"]');
  assert.equal((await data()).goal, 3);
  await click('[data-save="en-A1-2"]');
  assert.ok((await data()).saved.includes("en-A1-2"));
  await click('[data-nav="explore"]');
  assert.equal(await page.locator(".lesson-card").count(), 50);
  await page.locator("#library-language").selectOption("fr");
  await page.locator("#library-level").selectOption("C1");
  assert.equal(await page.locator(".lesson-card").count(), 5);
  await page.locator("#course-search").fill("impossible-query");
  assert.equal(await page.locator(".lesson-card").count(), 0);
  assert.ok(await page.locator(".empty-state").isVisible());
  await click('[data-nav="notebook"]');
  assert.match(
    await page.locator(".note-card").first().textContent(),
    /<script>/,
  );
  assert.equal(await page.locator(".note-card script").count(), 0);
  await click('[data-action="add-note"]');
  await page.locator("#note-text").fill("A useful rule.");
  await page.locator('#note-form [type="submit"]').click();
  assert.equal((await data()).notes.length, 2);
  await page.locator("[data-edit-note]").last().click();
  await page.locator("#note-text").fill("A revised useful rule.");
  await page.locator('#note-form [type="submit"]').click();
  assert.ok(
    (await data()).notes.some((n) => n.text === "A revised useful rule."),
  );
  await page.locator("[data-delete-note]").last().click();
  await click("#confirm-delete");
  assert.equal((await data()).notes.length, 1);
  await click('[data-nav="review"]');
  await click('[data-action="review-start"]');
  await click('[data-action="review-flip"]');
  await click('[data-action="review-known"]');
  assert.equal(Object.keys((await data()).reviews).length, 1);
  await click('[data-action="review-flip"]');
  await click('[data-action="review-again"]');
  assert.ok(
    Object.values((await data()).reviews).some((r) => r.interval === 0),
  );
  await click('[data-nav="settings"]');
  await page.locator("#display-name").fill("<img src=x onerror=alert(1)>");
  await page.locator('#profile-form [type="submit"]').click();
  assert.equal(await page.locator(".user-mini img").count(), 0);
  await click('[data-action="sound"]');
  assert.equal((await data()).sound, false);
  await click('[data-nav="progress"]');
  assert.match(await page.locator(".stat-box").first().textContent(), /2/);
  // All language/level combinations and every page fit small screens.
  await click('[data-nav="learn"]');
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Dashboard overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["explore", "review", "notebook", "progress"]) {
    await click(`[data-nav="${route}"]`);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${route} overflows on mobile`,
    );
  }
  // Settings remain available from the mobile profile avatar.
  await page.locator(".topbar .avatar").click();
  await click('[data-action="reset"]');
  await click('[data-action="confirm-reset"]');
  assert.equal((await data()).xp, 0);
  assert.equal((await data()).notes.length, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: French C1, English A1, wrong/correct feedback, pause/reload, writing recovery, idempotent completion, independent progress, goals, bookmarks, search, notes CRUD/escaping, review scheduling, settings, responsive routes, and reset.",
  );
} finally {
  await browser.close();
}
