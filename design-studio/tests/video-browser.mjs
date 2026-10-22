import { chromium } from "@playwright/test";
import Chromium, { inflate } from "@sparticuz/chromium";
import { createRequire } from "node:module";
import { createApp } from "../server/app.mjs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { makeFixtures } from "./video-fixtures.mjs";
const require = createRequire(import.meta.url),
  root = path.resolve(
    path.dirname(require.resolve("@sparticuz/chromium")),
    "..",
  );
const libs = await inflate(path.join(root, "bin/al2023.tar.br"));
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-video-browser-"));
const fixtures = await makeFixtures(dir),
  backend = createApp({ dataDir: path.join(dir, "data") });
const server = backend.app.listen(0, "0.0.0.0");
await new Promise((r) => server.once("listening", r));
const browser = await chromium.launch({
  executablePath: await Chromium.executablePath(),
  args: Chromium.args,
  env: {
    ...process.env,
    LD_LIBRARY_PATH: `${libs}/lib:${process.env.LD_LIBRARY_PATH || ""}`,
  },
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await fs.mkdir("test-results", { recursive: true });
const tab = async (name) =>
  page.locator(".ve-nav").getByRole("button", { name, exact: true }).click();
try {
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page
    .getByRole("button", { name: "New here? Create a free account" })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Video Sam");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("videosam@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("secure-video-browser-password");
  await page
    .getByRole("button", { name: "Create free account", exact: true })
    .click();
  await page.getByRole("button", { name: "Video studio", exact: true }).click();
  await page.getByRole("button", { name: "New video", exact: true }).click();
  await page
    .getByLabel("Video title", { exact: true })
    .fill("My actual montage");
  await page
    .locator('.video-editor input[type="file"]')
    .setInputFiles([fixtures.red, fixtures.blue, fixtures.music]);
  await page
    .locator(".ve-media-list>div")
    .filter({ hasText: "music.wav" })
    .waitFor();
  await page.getByTitle("Add red.mp4 to timeline", { exact: true }).click();
  await tab("Media");
  await page.getByTitle("Add blue.mp4 to timeline", { exact: true }).click();
  await page.getByLabel("Clip out", { exact: true }).fill("1.5");
  await page.getByLabel("Clip in", { exact: true }).fill("0.3");
  await page.getByLabel("Clip speed", { exact: true }).selectOption("2");
  await page.getByLabel("Clip fit", { exact: true }).selectOption("cover");
  await page.getByTitle("Move clip earlier", { exact: true }).click();
  assert.ok(
    (
      await page.locator(".ve-timeline-clip").first().getAttribute("aria-label")
    ).includes("blue.mp4"),
  );
  const playhead = page.getByLabel("Video playhead", { exact: true });
  await playhead.focus();
  await playhead.press("Home");
  for (let i = 0; i < 30; i++) await playhead.press("ArrowRight");
  await page
    .getByRole("button", { name: "Split at playhead", exact: true })
    .click();
  assert.equal(await page.locator(".ve-timeline-clip").count(), 3);
  await tab("Text");
  await page.getByRole("button", { name: "Add caption", exact: true }).click();
  await page
    .getByLabel("Caption 1 text", { exact: true })
    .fill("My free video montage");
  await page.getByLabel("Caption 1 end", { exact: true }).fill("2");
  await tab("Audio");
  await page
    .getByLabel("Soundtrack", { exact: true })
    .selectOption({ label: "music.wav" });
  await page.getByLabel("Music offset", { exact: true }).fill("0.1");
  await tab("Export");
  await page
    .getByLabel("Video format", { exact: true })
    .selectOption("640x360");
  await page.getByLabel("Frame rate", { exact: true }).selectOption("24");
  await page.getByTitle("Play video", { exact: true }).click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[aria-label="Video playhead"]').value) >
      0.7,
  );
  await page.getByTitle("Pause video", { exact: true }).click();
  await page
    .locator(".ve-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Video saved to your account" })
    .waitFor();
  await page.screenshot({ path: "test-results/video-editor.png" });
  await page
    .getByRole("button", { name: "Render MP4 — free", exact: true })
    .click();
  await page
    .getByText("Your video is ready.", { exact: true })
    .waitFor({ timeout: 60000 });
  const promise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download MP4", exact: true }).click();
  const downloaded = await promise;
  assert.equal(downloaded.suggestedFilename(), "My actual montage.mp4");
  assert.ok((await fs.stat(await downloaded.path())).size > 1000);
  await page.getByTitle("Back to video projects", { exact: true }).click();
  await page
    .getByRole("heading", { name: "My actual montage", exact: true })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Video studio", exact: true }).click();
  await page
    .getByRole("heading", { name: "My actual montage", exact: true })
    .click();
  await page.getByLabel("Video title", { exact: true }).waitFor();
  assert.equal(await page.locator(".ve-timeline-clip").count(), 3);
  await page.setViewportSize({ width: 390, height: 844 });
  await tab("Clip");
  await page.screenshot({ path: "test-results/video-mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser upload, trim, speed, fit, clip order, split, captions, soundtrack, save/reload, actual MP4 rendering/download and mobile video layout.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await backend.close();
  await fs.rm(dir, { recursive: true, force: true });
}
