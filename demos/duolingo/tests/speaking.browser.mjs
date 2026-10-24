// Real-browser UI checks. Recognition is deliberately simulated: these checks
// establish integration/lifecycle, not provider availability or pronunciation quality.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["microphone"],
});
await context.addInitScript(() => {
  class SimulatedRecognition {
    start() {
      window.__speech = this;
      this.timer = setTimeout(() => {
        this.onresult?.({
          results: [[{ transcript: window.__testTranscript || "I am agree." }]],
        });
        this.onend?.();
      }, 100);
    }
    stop() {
      clearTimeout(this.timer);
      this.onend?.();
    }
    abort() {
      clearTimeout(this.timer);
      this.aborted = true;
    }
  }
  window.SpeechRecognition = SimulatedRecognition;
  if (navigator.mediaDevices?.getUserMedia) {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await original(options);
      window.__testStream = stream;
      return stream;
    };
  }
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = (s) => page.locator(s).first().click();
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("bloom-speaking-v1")));
try {
  await page.goto(
    `${process.env.BLOOM_URL || "http://localhost:3000"}/#speaking`,
  );
  await page.locator(".speaking-banner").waitFor();
  assert.ok(
    await page
      .locator('.nav-item[data-nav="speaking"][aria-current="page"]')
      .isVisible(),
  );
  assert.equal(
    await page.locator('[data-studio-action="dictate-chat"]').isDisabled(),
    true,
  );
  await page.locator("#speaking-chat-input").fill("I am agree with this idea.");
  await page.locator('#speaking-chat-form [type="submit"]').click();
  assert.match(
    await page.locator(".speaking-correction").textContent(),
    /I agree/,
  );
  await page.locator("#speaking-topic").selectOption("custom");
  await page.locator("#speaking-custom-topic").fill("<script>space</script>");
  await click('[data-studio-action="custom-topic"]');
  await page
    .locator("#speaking-chat-input")
    .fill("<img src=x onerror=alert(1)>");
  await page.locator('#speaking-chat-form [type="submit"]').click();
  assert.equal(
    await page
      .locator(".speaking-message img, .speaking-message script")
      .count(),
    0,
  );
  await page.locator("#speaking-consent").check();
  await click('[data-studio-action="dictate-chat"]');
  await page.waitForFunction(
    () =>
      document.querySelector("#speaking-chat-input")?.value === "I am agree.",
  );
  await page.waitForFunction(
    () => !document.querySelector("#speaking-chat-input").disabled,
  );
  assert.equal(await page.evaluate(() => window.__speech.lang), "en-GB");
  // The transcript is never auto-sent; the learner must check it and submit.
  assert.equal((await saved()).threads["en-A1"].messages.length, 4);
  await page.locator('#speaking-chat-form [type="submit"]').click();
  assert.equal((await saved()).threads["en-A1"].messages.length, 6);
  await click('[data-studio-language="fr"]');
  await click('[data-studio-level="C1"]');
  assert.match(
    await page.locator(".speaking-goal").textContent(),
    /C1 · French/,
  );
  await page.locator("#speaking-chat-input").fill("Je suis 25 ans.");
  await page.locator('#speaking-chat-form [type="submit"]').click();
  assert.match(
    await page.locator(".speaking-correction").textContent(),
    /J’ai 25 ans/,
  );
  await page.reload();
  await page.locator(".speaking-banner").waitFor();
  assert.equal((await saved()).threads["en-A1"].messages.length, 6);
  assert.match(
    await page.locator(".speaking-messages").textContent(),
    /Je suis 25 ans/,
  );
  await click('[data-studio-mode="repeat"]');
  await page.locator("#speaking-heard").fill("Ces mots sont différents.");
  await click('[data-studio-action="compare"]');
  assert.match(
    await page.locator(".speaking-comparison").textContent(),
    /not.*acoustic accuracy score/,
  );
  await click('[data-studio-action="mark-practised"]');
  assert.equal((await saved()).practice["fr-C1-0"], true);
  await page.evaluate(
    () => (window.__testTranscript = "Bonjour tout le monde"),
  );
  await click('[data-studio-action="dictate-repeat"]');
  await page.waitForFunction(
    () =>
      document.querySelector("#speaking-heard")?.value ===
      "Bonjour tout le monde",
  );
  assert.equal(await page.evaluate(() => window.__speech.lang), "fr-FR");
  await page.waitForFunction(
    () => !document.querySelector('[data-studio-action="record"]').disabled,
  );
  // Real MediaRecorder + browser-provided fake input: no physical microphone needed.
  await click('[data-studio-action="record"]');
  await page.waitForFunction(() =>
    document
      .querySelector(".speaking-capture-status")
      ?.textContent.includes("Recording locally"),
  );
  await page.waitForTimeout(300);
  await click('[data-studio-action="stop"]');
  await page.locator("#speaking-playback").waitFor();
  const blobURL = await page.locator("#speaking-playback").getAttribute("src");
  assert.ok(blobURL.startsWith("blob:"));
  assert.ok(
    await page.evaluate(
      async (url) => (await (await fetch(url)).blob()).size,
      blobURL,
    ),
  );
  assert.equal(
    await page.evaluate(() =>
      window.__testStream.getTracks().every((t) => t.readyState === "ended"),
    ),
    true,
  );
  await click('[data-studio-drill="1"]');
  assert.equal(await page.locator("#speaking-playback").count(), 0);
  assert.equal(
    await page.evaluate(async (url) => {
      try {
        await fetch(url);
        return false;
      } catch {
        return true;
      }
    }, blobURL),
    true,
  );
  // Revoking consent actively cancels a running capture and releases the track.
  await click('[data-studio-action="record"]');
  await page.waitForFunction(() =>
    document
      .querySelector(".speaking-capture-status")
      ?.textContent.includes("Recording locally"),
  );
  await page.locator("#speaking-consent").uncheck();
  assert.equal(
    await page.evaluate(() =>
      window.__testStream.getTracks().every((t) => t.readyState === "ended"),
    ),
    true,
  );
  // Unsupported dictation leaves typed/local-recording alternatives usable.
  await page.locator("#speaking-consent").check();
  await click('[data-studio-mode="chat"]');
  await page.evaluate(() => {
    window.SpeechRecognition = undefined;
    window.webkitSpeechRecognition = undefined;
  });
  await click('[data-studio-action="dictate-chat"]');
  assert.match(
    await page.locator(".speaking-capture-status").textContent(),
    /unavailable/,
  );
  for (const width of [360, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const mode of ["chat", "repeat", "challenge"]) {
      await click(`[data-studio-mode="${mode}"]`);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${mode} overflow at ${width}`,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await click('[data-studio-action="record"]');
  await page.waitForFunction(() =>
    document
      .querySelector(".speaking-capture-status")
      ?.textContent.includes("Recording locally"),
  );
  await page.locator('[data-nav="learn"]').first().click();
  assert.equal(
    await page.evaluate(() =>
      window.__testStream.getTracks().every((t) => t.readyState === "ended"),
    ),
    true,
  );
  assert.ok(await page.locator(".speaking-shortcut").isVisible());
  await page.locator(".speaking-shortcut").click();
  page.once("dialog", (d) => d.accept());
  await click('[data-studio-action="forget"]');
  assert.deepEqual((await saved()).threads, {});
  assert.equal((await saved()).consent, false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: speaking deep link/navigation, bilingual levels, local bot corrections, custom-topic HTML safety, dictation integration (simulated), manual send, persistence, transcript comparison, real MediaRecorder with fake audio input, released tracks/revoked URLs, consent cancellation, unsupported dictation fallback, responsive modes, and reset.",
  );
} finally {
  await browser.close();
}
