import { chromium } from "@playwright/test";
import Chromium, { inflate } from "@sparticuz/chromium";
import { createRequire } from "node:module";
import { staticServer } from "./static-server.mjs";
import { execFileSync } from "node:child_process";
import { makeFixtures } from "./video-fixtures.mjs";
import { tools, runMedia } from "../server/media-process.mjs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const packageRoot = path.resolve(
  path.dirname(require.resolve("@sparticuz/chromium")),
  "..",
);
const libs = await inflate(path.join(packageRoot, "bin/al2023.tar.br"));
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-browser-"));
execFileSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build"],
  { stdio: "inherit", env: { ...process.env, STUDIO_BASE: "/reverse/" } },
);
const host = await staticServer("dist");
const base = host.url;
const fixtures = await makeFixtures(dir);
const browser = await chromium.launch({
  executablePath: await Chromium.executablePath(),
  args: [
    ...Chromium.args.filter(
      (a) =>
        ![
          "--single-process",
          "--disable-web-security",
          "--enable-features=SharedArrayBuffer",
        ].includes(a),
    ),
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
  env: {
    ...process.env,
    LD_LIBRARY_PATH: `${libs}/lib:${process.env.LD_LIBRARY_PATH || ""}`,
  },
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  remote = [];
page.on("request", (r) => {
  if (
    !r.url().startsWith(new URL(base).origin) &&
    !r.url().startsWith("blob:") &&
    !r.url().startsWith("data:")
  )
    remote.push(r.url());
});
page.on("pageerror", (e) => errors.push(e.message));
await fs.mkdir("test-results", { recursive: true });
async function rail(name) {
  await page
    .locator(".re-rail")
    .getByRole("button", { name, exact: true })
    .click();
}
async function exported(format) {
  console.log("Testing export", format);
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  await page.getByLabel("Export format", { exact: true }).selectOption(format);
  const promise = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Download " + format.toUpperCase(),
      exact: true,
    })
    .click();
  let download;
  try {
    download = await promise;
  } catch (e) {
    console.log("EXPORT ERROR", await page.locator(".re-bottom").textContent());
    throw e;
  }
  assert.ok(!(await download.failure()));
  return await fs.readFile(await download.path());
}
async function ready() {
  await page.locator(".re-loading").waitFor({ state: "hidden" });
  await page.locator(".re-body[inert]").waitFor({ state: "detached" });
}
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "What will you create today?" })
    .waitFor();
  await page.screenshot({
    path: "test-results/static-workspace.png",
    fullPage: true,
  });
  await page.getByRole("textbox", { name: "Search templates" }).fill("summer");
  assert.equal(await page.locator(".template-card").count(), 1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByRole("button", { name: "Customize The next big idea" })
    .click();
  await ready();
  await page
    .getByRole("textbox", { name: "Design title" })
    .fill("A real editable design");
  await rail("Elements");
  await page.getByRole("button", { name: "rectangle", exact: true }).click();
  const box = await page.locator(".upper-canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4, {
    steps: 12,
  });
  await page.mouse.up();
  let json = JSON.parse((await exported("json")).toString());
  const rect = json.pages[0].canvas.objects.find((o) => o.type === "Rect");
  assert.ok(rect.left > 300, "Drag must change the object position");
  await page.getByTitle("Undo (Ctrl Z)", { exact: true }).click();
  json = JSON.parse((await exported("json")).toString());
  assert.equal(
    Math.round(
      json.pages[0].canvas.objects.find((o) => o.type === "Rect").left,
    ),
    240,
  );
  await page.getByTitle("Redo (Ctrl Shift Z)", { exact: true }).click();
  await rail("Text");
  await page
    .getByRole("button", { name: "Add a text box", exact: true })
    .click();
  await page
    .locator(".upper-canvas")
    .dblclick({ position: { x: box.width * 0.25, y: box.height * 0.24 } });
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Hello real editor");
  await page.keyboard.press("Escape");
  json = JSON.parse((await exported("json")).toString());
  assert.ok(
    json.pages[0].canvas.objects.some((o) => o.text === "Hello real editor"),
    "Text must be directly editable",
  );
  await rail("Uploads");
  await page
    .locator('input[accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles("public/images/ocean.jpg");
  await page.locator(".re-assets img").first().waitFor();
  await ready();
  json = JSON.parse((await exported("json")).toString());
  assert.ok(
    json.pages[0].canvas.objects.some(
      (o) => o.type === "Image" && o.src.startsWith("data:image/jpeg;base64,"),
    ),
  );
  await page.keyboard.press("Control+a");
  await page.getByTitle("Group or ungroup", { exact: true }).click();
  json = JSON.parse((await exported("json")).toString());
  assert.equal(json.pages[0].canvas.objects.length, 1);
  assert.equal(json.pages[0].canvas.objects[0].type, "Group");
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByText("Saved on this device", { exact: true }).waitFor();
  await ready();
  await page.getByTitle("Group or ungroup", { exact: true }).click();
  await rail("Color");
  await page.getByTitle("Background #e6c4ff", { exact: true }).click();
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByText("Saved on this device", { exact: true }).waitFor();
  await ready();
  await page.getByTitle("Duplicate page", { exact: true }).click();
  await ready();
  assert.equal(
    await page
      .locator(".re-pages button")
      .filter({ hasText: /^Page / })
      .count(),
    2,
  );
  for (const format of ["png", "jpg", "svg", "pdf"]) {
    const data = await exported(format);
    if (format === "png") assert.equal(data.subarray(1, 4).toString(), "PNG");
    if (format === "jpg") assert.equal(data[0], 255);
    if (format === "pdf") {
      assert.equal(data.subarray(0, 4).toString(), "%PDF");
      assert.ok(data.toString().includes("/Count 2"));
    }
    if (format === "svg") {
      assert.ok(data.toString().includes("<svg"));
      assert.ok(!data.toString().includes("foreignObject"));
      assert.equal(
        await page.evaluate(
          (svg) =>
            new DOMParser()
              .parseFromString(svg, "image/svg+xml")
              .querySelector("parsererror")?.textContent || "",
          data.toString(),
        ),
        "",
      );
    }
  }
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await ready();
  await rail("History");
  await page.locator(".re-version").first().waitFor();
  assert.ok((await page.locator(".re-version").count()) >= 1);
  const fileDownload = page.waitForEvent("download");
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Design file", exact: true })
    .click();
  assert.ok((await fileDownload).suggestedFilename().endsWith(".json"));
  await page.screenshot({ path: "test-results/static-editor.png" });
  await page.getByTitle("Back to workspace", { exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .getByRole("heading", { name: "A real editable design", exact: true })
    .waitFor();
  assert.equal(await page.locator(".recent-card").count(), 1);
  await page.getByRole("button", { name: "Brand", exact: true }).click();
  await page.getByLabel("Brand name", { exact: true }).fill("Studio Sam");
  await page.getByRole("button", { name: "Save brand kit — free" }).click();
  await page.getByText("Your brand kit is saved.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a design", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Custom size", exact: true })
    .click();
  await page.getByLabel("Width", { exact: true }).fill("1080");
  await page.getByLabel("Height", { exact: true }).fill("1350");
  await page.getByRole("button", { name: "Create new design" }).click();
  await ready();
  json = JSON.parse((await exported("json")).toString());
  assert.equal(json.width, 1080);
  assert.equal(json.height, 1350);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTitle("Back to workspace", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/static-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "Customize Slow summer stories" })
    .click();
  await ready();
  await page.screenshot({ path: "test-results/static-mobile-editor.png" });
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByText("Saved on this device", { exact: true }).waitFor();
  await ready();
  const svg = await exported("svg");
  assert.ok(
    svg.toString().includes("data:image/jpeg;base64,"),
    "SVG must embed ocean photography",
  );
  assert.deepEqual(errors, []);
  await page.getByTitle("Back to workspace", { exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log(
    "PASS static canvas: uploads, data-URL persistence, templates, real editing, history, PNG/JPG/SVG/PDF/JSON, brand kit and mobile.",
  );
  // A production static server is the only server in this test: no API routes.
  assert.equal(await page.evaluate(() => crossOriginIsolated), false);
  assert.ok(!host.requests.some((p) => p.includes("/api/")));
  await videoAndBackup();
  assert.ok(!host.requests.some((p) => p.includes("/api/")));
  assert.deepEqual(errors, []);
  console.log(
    "PASS production static site under /reverse/: no backend, no cross-origin isolation, local persistence and complete backup restore.",
  );
} finally {
  await browser.close();
  await host.close();
  await fs.rm(dir, { recursive: true, force: true });
}

async function videoAndBackup() {
  const tab = async (name) =>
    page.locator(".ve-nav").getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Video studio", exact: true }).click();
  await page.getByRole("button", { name: "New video", exact: true }).click();
  await page.getByLabel("Video title", { exact: true }).fill("Local film");
  await page
    .locator(".video-editor input[type=file]")
    .first()
    .setInputFiles([
      fixtures.red,
      fixtures.blue,
      fixtures.music,
      "public/images/ocean.jpg",
    ]);
  await page
    .locator(".ve-media-list>div")
    .filter({ hasText: "ocean.jpg" })
    .waitFor({ timeout: 60000 });
  await page.getByTitle("Add red.mp4 to timeline", { exact: true }).click();
  await tab("Media");
  await page.getByTitle("Add blue.mp4 to timeline", { exact: true }).click();
  await page.getByLabel("Clip out", { exact: true }).fill("1.5");
  await page.getByLabel("Clip in", { exact: true }).fill("0.3");
  await page.getByLabel("Clip speed", { exact: true }).selectOption("2");
  await page.getByTitle("Move clip earlier", { exact: true }).click();
  const playhead = page.getByLabel("Video playhead", { exact: true });
  await playhead.focus();
  await playhead.press("Home");
  for (let i = 0; i < 30; i++) await playhead.press("ArrowRight");
  await page
    .getByRole("button", { name: "Split at playhead", exact: true })
    .click();
  assert.equal(await page.locator(".ve-timeline-clip").count(), 3);
  await tab("Media");
  await page.getByTitle("Add ocean.jpg to timeline", { exact: true }).click();
  assert.equal(await page.locator(".ve-timeline-clip").count(), 4);
  await page.getByTitle("Undo video edit", { exact: true }).click();
  assert.equal(await page.locator(".ve-timeline-clip").count(), 3);
  await page.getByTitle("Redo video edit", { exact: true }).click();
  assert.equal(await page.locator(".ve-timeline-clip").count(), 4);
  await page.getByTitle("Undo video edit", { exact: true }).click();
  await page.getByRole("button", { name: /Select clip 3: red.mp4/ }).click();
  await page.waitForFunction(
    () => document.querySelector(".ve-preview-frame video")?.readyState >= 2,
  );
  const frameDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Source frame PNG", exact: true })
    .click();
  assert.equal(
    (await fs.readFile(await (await frameDownload).path()))
      .subarray(1, 4)
      .toString(),
    "PNG",
  );
  const audioDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Extract audio WAV", exact: true })
    .click();
  assert.equal(
    (await fs.readFile(await (await audioDownload).path()))
      .subarray(0, 4)
      .toString(),
    "RIFF",
  );
  await page
    .getByRole("button", { name: "Add freeze frame", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".ve-timeline-clip").length === 4,
  );
  await page.getByTitle("Undo video edit", { exact: true }).click();
  assert.equal(await page.locator(".ve-timeline-clip").count(), 3);
  await page
    .getByRole("button", { name: "Create reversed copy", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".ve-timeline-clip").length === 4,
    {},
    { timeout: 30000 },
  );
  await page.getByTitle("Undo video edit", { exact: true }).click();
  assert.equal(await page.locator(".ve-timeline-clip").count(), 3);
  await tab("Effects");
  await page.getByLabel("Clip filter", { exact: true }).selectOption("mono");
  await page.getByLabel("Clip rotation", { exact: true }).selectOption("90");
  await page.getByLabel("Clip zoomEnd", { exact: true }).fill("1.4");
  await page.getByLabel("Clip panEndX", { exact: true }).fill("80");
  await page
    .getByRole("button", { name: "Flip horizontal", exact: true })
    .click();
  await tab("Layers");
  await page
    .getByLabel("Add image overlay", { exact: true })
    .selectOption({ label: "ocean.jpg" });
  await page.getByLabel("Image layer 1 start", { exact: true }).fill("0");
  await page.getByLabel("Image layer 1 end", { exact: true }).fill("2");
  const layer = page.getByRole("button", {
    name: "Image layer 1: ocean.jpg",
    exact: true,
  });
  await layer.focus();
  await layer.press("ArrowRight");
  assert.equal(
    await page.getByLabel("Image layer 1 start", { exact: true }).inputValue(),
    "0.1",
  );
  await layer.press("ArrowLeft");
  await tab("Text");
  await page.getByRole("button", { name: "Add caption", exact: true }).click();
  await page
    .getByLabel("Caption 1 text", { exact: true })
    .fill("Hello مرحبا 100% : free");
  await page.getByLabel("Caption 1 start", { exact: true }).fill("0");
  await page.getByLabel("Caption 1 end", { exact: true }).fill("2");
  await page
    .locator(".ve-panel input[type=file]")
    .setInputFiles({
      name: "subtitles.srt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "1\n00:00:00,100 --> 00:00:01,200\nImported subtitle\n",
      ),
    });
  await page.getByLabel("Caption 2 text", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Caption 2 text", { exact: true }).inputValue(),
    "Imported subtitle",
  );
  await page
    .getByLabel("Caption 2 position", { exact: true })
    .selectOption("top");
  const subtitleDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SRT", exact: true }).click();
  assert.ok(
    (await fs.readFile(await (await subtitleDownload).path(), "utf8")).includes(
      "Imported subtitle",
    ),
  );
  await tab("Audio");
  await page
    .getByLabel("Soundtrack", { exact: true })
    .selectOption({ label: "music.wav" });
  await page
    .getByLabel("Add audio layer", { exact: true })
    .selectOption({ label: "music.wav" });
  await page.getByLabel("Audio layer 1 start", { exact: true }).fill("0.2");
  await page.getByLabel("Audio layer 1 out", { exact: true }).fill("1.5");
  await page.getByLabel("Audio layer 1 fadeIn", { exact: true }).fill("0.1");
  await page
    .context()
    .grantPermissions(["microphone"], { origin: new URL(base).origin });
  await page
    .getByRole("button", { name: "Record voiceover", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .waitFor();
  await page.waitForTimeout(1200);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await page
    .getByLabel("Audio layer 2 start", { exact: true })
    .waitFor({ timeout: 30000 });
  console.log(
    "Actual MediaRecorder voiceover saved and added as an audio layer.",
  );
  await tab("Export");
  await page
    .getByLabel("Video format", { exact: true })
    .selectOption("640x360");
  await page.getByLabel("Frame rate", { exact: true }).selectOption("24");
  await page
    .getByLabel("Encoding quality", { exact: true })
    .selectOption("high");
  await playhead.focus();
  await playhead.press("Home");
  await page.getByTitle("Play video", { exact: true }).click();
  await page.waitForFunction(
    () => +document.querySelector('[aria-label="Video playhead"]').value > 0.7,
  );
  await page.getByTitle("Pause video", { exact: true }).click();
  await page
    .locator(".ve-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Video saved on this device" })
    .waitFor();
  await page.screenshot({ path: "test-results/static-video.png" });
  await page
    .getByRole("button", { name: "Render MP4 — free", exact: true })
    .click();
  await page
    .getByText("Your video is ready.", { exact: true })
    .waitFor({ timeout: 90000 });
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download MP4", exact: true }).click();
  const movie = await downloading;
  assert.equal(movie.suggestedFilename(), "Local film.mp4");
  const output = path.join(dir, "rendered.mp4");
  await movie.saveAs(output);
  console.log("Browser MP4 rendered and downloaded.");
  const probed = JSON.parse(
    (
      await runMedia(tools.ffprobe, [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        output,
      ])
    ).stdout,
  );
  assert.equal(probed.streams.find((s) => s.codec_type === "video").width, 640);
  assert.ok(probed.streams.some((s) => s.codec_type === "audio"));
  assert.ok(+probed.format.duration > 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await tab("Effects");
  await page.screenshot({ path: "test-results/static-video-mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByTitle("Back to video projects", { exact: true }).click();
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Video studio", exact: true }).click();
  await page.getByRole("heading", { name: "Local film", exact: true }).click();
  assert.equal(await page.locator(".ve-timeline-clip").count(), 3);
  await tab("Layers");
  assert.equal(
    await page.getByLabel("Image layer 1 start", { exact: true }).inputValue(),
    "0",
  );
  await page.getByTitle("Back to video projects", { exact: true }).click();
  await page.locator(".local-workspace-pill").click();
  const saving = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download workspace backup", exact: true })
    .click();
  const archive = await saving;
  const backup = path.join(dir, "backup.zip");
  await archive.saveAs(backup);
  assert.ok((await fs.stat(backup)).size > 1000000);
  await page
    .getByLabel("Close local workspace storage", { exact: true })
    .click();
  console.log("Workspace backup downloaded.");
  const context = await browser.newContext();
  const fresh = await context.newPage();
  fresh.on("pageerror", (e) => errors.push(e.message));
  try {
    await fresh.goto(base);
    await fresh.getByRole("button", { name: "Projects", exact: true }).click();
    assert.equal(await fresh.locator(".recent-card").count(), 0);
    await fresh.locator(".local-workspace-pill").click();
    fresh.once("dialog", (d) => d.accept());
    await fresh.locator(".local-dialog input[type=file]").setInputFiles(backup);
    await fresh
      .getByRole("button", { name: "Projects", exact: true })
      .waitFor();
    await fresh.getByRole("button", { name: "Projects", exact: true }).click();
    await fresh
      .getByRole("heading", { name: "A real editable design", exact: true })
      .waitFor();
    console.log("Clean browser restored design.");
    await fresh.getByRole("button", { name: "Brand", exact: true }).click();
    assert.equal(
      await fresh.getByLabel("Brand name", { exact: true }).inputValue(),
      "Studio Sam",
    );
    await fresh
      .getByRole("button", { name: "Video studio", exact: true })
      .click();
    await fresh
      .getByRole("heading", { name: "Local film", exact: true })
      .click();
    assert.equal(await fresh.locator(".ve-timeline-clip").count(), 3);
    await fresh
      .locator(".ve-nav")
      .getByRole("button", { name: "Audio", exact: true })
      .click();
    await fresh.getByLabel("Audio layer 1 start", { exact: true }).waitFor();
    assert.equal(
      await fresh
        .getByLabel("Audio layer 1 start", { exact: true })
        .inputValue(),
      "0.2",
    );
    await fresh
      .getByRole("button", { name: "Render MP4 — free", exact: true })
      .count();
    await fresh
      .locator(".ve-header")
      .getByRole("button", { name: "Export MP4", exact: true })
      .click();
    await fresh
      .getByText("Your video is ready.", { exact: true })
      .waitFor({ timeout: 90000 });
    await fresh.getByTitle("Back to video projects", { exact: true }).click();
    await fresh.locator(".local-workspace-pill").click();
    fresh.once("dialog", (d) => d.accept());
    await fresh
      .locator(".local-dialog input[type=file]")
      .setInputFiles({
        name: "bad.zip",
        mimeType: "application/zip",
        buffer: Buffer.from("not a zip"),
      });
    await fresh
      .getByRole("status")
      .filter({ hasText: /invalid|unexpected/i })
      .waitFor();
    await fresh
      .getByLabel("Close local workspace storage", { exact: true })
      .click();
    await fresh
      .getByRole("button", { name: "Video studio", exact: true })
      .click();
    await fresh
      .getByRole("heading", { name: "Local film", exact: true })
      .waitFor();
  } finally {
    await context.close().catch(() => {});
  }
  assert.deepEqual(remote, []);
  console.log(
    "PASS static montage: real browser export, trim, split/reorder, undo/redo, image imports/overlays, filters/rotation/flip, SRT, timed audio, save/reload, isolated visitor storage, ZIP restore into a clean browser, re-export with restored media and malformed ZIP rejection.",
  );
}
