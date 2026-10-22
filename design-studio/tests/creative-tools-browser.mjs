import { createServer } from "vite";
import { chromium } from "@playwright/test";
import Chromium, { inflate } from "@sparticuz/chromium";
import { createRequire } from "node:module";
import { makeFixtures } from "./video-fixtures.mjs";
import { runMedia, tools } from "../server/media-process.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const packageRoot = path.resolve(
  path.dirname(createRequire(import.meta.url).resolve("@sparticuz/chromium")),
  "..",
);
const libs = await inflate(path.join(packageRoot, "bin/al2023.tar.br"));
const server = await createServer({ server: { host: "0.0.0.0", port: 0 } });
await server.listen();
const browser = await chromium.launch({
  executablePath: await Chromium.executablePath(),
  args: Chromium.args.filter(
    (a) =>
      ![
        "--single-process",
        "--disable-web-security",
        "--enable-features=SharedArrayBuffer",
      ].includes(a),
  ),
  env: {
    ...process.env,
    LD_LIBRARY_PATH: libs + "/lib:" + (process.env.LD_LIBRARY_PATH || ""),
  },
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("PAGE ERROR:", e.stack);
});
page.on("console", (m) => {
  if (m.type() === "error") console.log("BROWSER:", m.text());
});
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "creative-tools-"));
const fixtures = await makeFixtures(dir);
fixtures.image = path.join(dir, "photo.png");
const base = "http://127.0.0.1:" + server.httpServer.address().port;
const focusCanvas = () =>
  page
    .locator(".re-toolbar")
    .getByRole("button", { name: "Edit selection", exact: true })
    .focus();
async function rail(name) {
  await page
    .locator(".re-rail")
    .getByRole("button", { name, exact: true })
    .click();
}
async function json() {
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  await page.getByLabel("Export format", { exact: true }).selectOption("json");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download JSON", exact: true })
    .click();
  const d = await download;
  assert.equal(await d.failure(), null);
  return JSON.parse(await fs.readFile(await d.path(), "utf8"));
}
async function close() {
  await page.getByTitle("Back to workspace").click();
  if (await page.locator(".re-header").count())
    throw Error("Did not close canvas");
}
page.on("dialog", (d) => d.accept());
try {
  await page.goto(base);
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 240;
    const x = c.getContext("2d");
    x.fillStyle = "red";
    x.fillRect(0, 0, 320, 240);
    x.fillStyle = "blue";
    x.fillRect(160, 0, 160, 240);
    return c.toDataURL().split(",")[1];
  });
  await fs.writeFile(fixtures.image, Buffer.from(png, "base64"));
  await page
    .getByRole("heading", { name: "What will you create today?" })
    .waitFor();
  assert.equal(await page.locator(".model-categories button").count(), 12);
  await page
    .locator(".model-categories")
    .getByRole("button", { name: /^CV / })
    .click();
  assert.equal(await page.locator(".template-card").count(), 3);
  await page
    .getByRole("button", { name: "Customize CV · Moderne bleu", exact: true })
    .click();
  await page.locator(".re-loading").waitFor({ state: "hidden" });
  let d = await json();
  assert.equal(d.width, 794);
  assert.equal(d.height, 1123);
  assert.ok(d.pages[0].canvas.objects.some((o) => o.text === "SACHA DUBOIS"));
  await rail("Text");
  await page
    .getByRole("button", { name: "Add a text box", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit selection", exact: true })
    .click();
  await page
    .getByLabel("Selected text", { exact: true })
    .fill("مرحبا · Texte entièrement modifiable");
  await focusCanvas();
  await page.keyboard.press("Control+x");
  await page.keyboard.press("Control+d"); // No selection must not duplicate the old clipboard.
  d = await json();
  assert.ok(
    !d.pages[0].canvas.objects.some((o) => o.text?.startsWith("مرحبا")),
  );
  await page.locator(".re-toolbar").getByTitle("Paste (Ctrl V)").focus();
  await page.keyboard.press("Control+v");
  await page
    .getByRole("button", { name: "Edit selection", exact: true })
    .click();
  await page.getByLabel("Selected text", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Selected text", { exact: true }).inputValue(),
    "مرحبا · Texte entièrement modifiable",
  );
  const before = +(await page
    .getByLabel("Object X", { exact: true })
    .inputValue());
  await focusCanvas();
  await page.keyboard.press("Shift+ArrowRight");
  assert.equal(
    +(await page.getByLabel("Object X", { exact: true }).inputValue()),
    before + 10,
  );
  await page.keyboard.press("Control+Shift+Z"); // normalized capital Z must not open browser action
  await page.keyboard.press("Control+z");
  d = await json();
  assert.equal(
    Math.round(
      d.pages[0].canvas.objects.find((o) => o.text?.startsWith("مرحبا")).left,
    ),
    before,
  );
  await rail("Layers");
  await page
    .locator(".re-layers")
    .getByRole("button", { name: /^مرحبا/ })
    .click();
  await page
    .getByRole("button", { name: "Edit selection", exact: true })
    .click();
  // Typing fields keep cut/copy/select-all and arrows; no object mutation.
  await page.getByLabel("Selected text", { exact: true }).focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Edited in a text field");
  d = await json();
  assert.ok(
    d.pages[0].canvas.objects.some((o) => o.text === "Edited in a text field"),
  );
  await page.getByRole("button", { name: "Shortcuts", exact: true }).click();
  await page.getByRole("dialog", { name: "Keyboard shortcuts" }).waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Keyboard shortcuts" })
    .waitFor({ state: "hidden" });
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByText("All changes saved", { exact: true }).waitFor();
  await close();
  // Standalone photo mode has the photo itself, not a poster with stock text.
  await page
    .locator(".model-browser")
    .getByRole("button", { name: "Photo editor", exact: true })
    .click();
  await page.locator("input[type=file]").first().setInputFiles(fixtures.image);
  await page.getByRole("button", { name: "Edit photo", exact: true }).click();
  await page.locator(".re-loading").waitFor({ state: "hidden" });
  await page.getByLabel("Photo look", { exact: true }).waitFor();
  await page.getByLabel("Photo look", { exact: true }).selectOption("vivid");
  await page.getByLabel("Photo brightness", { exact: true }).fill("0.2");
  await page.getByLabel("Photo hue", { exact: true }).fill("0.1");
  await page.getByLabel("Crop left", { exact: true }).fill("10");
  await page.getByLabel("Crop right", { exact: true }).fill("15");
  await page.getByLabel("Object shadow", { exact: true }).selectOption("soft");
  const croppedDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download edited photo PNG", exact: true })
    .click();
  const cropped = await croppedDownload;
  const croppedBytes = await fs.readFile(await cropped.path());
  assert.equal(croppedBytes.toString("ascii", 1, 4), "PNG");
  assert.ok(
    croppedBytes.readUInt32BE(16) < 320,
    "Cropped photo download omits page margins",
  );
  d = await json();
  let image = d.pages[0].canvas.objects[0];
  assert.equal(d.pages[0].canvas.objects.length, 1);
  assert.equal(image.type, "Image");
  assert.deepEqual(
    image.filters.map((f) => f.type),
    ["Saturation", "Contrast", "Brightness", "HueRotation"],
  );
  assert.equal(image.cropX, 32);
  assert.equal(image.width, 240);
  assert.ok(image.shadow);
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByText("All changes saved", { exact: true }).waitFor();
  const savedPhoto = await page.evaluate(async () => {
    const { api } = await import("/src/api.js");
    const { projects } = await api("/projects");
    return projects.find((p) => p.title === "photo");
  });
  assert.equal(savedPhoto.document.pages[0].canvas.objects[0].cropX, 32);
  assert.ok(
    savedPhoto.document.pages[0].canvas.objects[0].filters.some(
      (f) => f.type === "HueRotation",
    ),
  );
  await rail("Edit");
  await page.screenshot({ path: "test-results/photo-inspector.png" });
  // Every recipe and native image filter must round-trip through the same boundary.
  const catalog = await page.evaluate(async () => {
    const { originalTemplates } = await import("/src/template-catalog.js");
    const { documentFromTemplate, validateImport } = await import(
      "/src/design.js"
    );
    const { FabricImage, StaticCanvas } = await import(
      "/node_modules/.vite/deps/fabric.js"
    );
    const { imagePresets, applyImagePreset } = await import(
      "/src/image-editing.js"
    );
    const all = [];
    for (const t of originalTemplates) {
      const d = await documentFromTemplate(t);
      validateImport(d);
      const c = new StaticCanvas(null);
      await c.loadFromJSON(d.pages[0].canvas);
      all.push({ id: t.id, objects: c.size() });
      await c.dispose();
    }
    const source = document.createElement("canvas");
    source.width = 80;
    source.height = 80;
    const ctx = source.getContext("2d");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 80, 80);
    ctx.fillStyle = "blue";
    ctx.fillRect(40, 0, 40, 80);
    const img = await FabricImage.fromURL(source.toDataURL("image/png"));
    for (const preset of imagePresets) {
      applyImagePreset(img, preset);
      const d = {
        version: 1,
        width: 80,
        height: 80,
        pages: [
          { id: crypto.randomUUID(), canvas: { objects: [img.toObject()] } },
        ],
      };
      validateImport(d);
      const c = new StaticCanvas(null, { width: 80, height: 80 });
      await c.loadFromJSON(d.pages[0].canvas);
      c.renderAll();
      if (!c.toDataURL().startsWith("data:image/png"))
        throw Error("Image export failed");
      await c.dispose();
    }
    return all;
  });
  assert.equal(catalog.length, 29);
  assert.ok(catalog.every((t) => t.objects >= 4));
  await close();
  // Video clipboard, uppercase redo, split/seek and effects UI.
  await page.getByRole("button", { name: "Video studio", exact: true }).click();
  await page.getByRole("button", { name: "New video", exact: true }).click();
  await page
    .locator(".video-editor input[type=file]")
    .setInputFiles(fixtures.red);
  await page.getByTitle("Add red.mp4 to timeline", { exact: true }).click();
  await page.locator(".ve-timeline-clip").first().click();
  const unfocus = () =>
    page
      .locator(".ve-header")
      .getByRole("button", { name: "Shortcuts", exact: true })
      .focus();
  await unfocus();
  await page.keyboard.press("Control+x");
  assert.equal(await page.locator(".ve-timeline-clip").count(), 0);
  await page.keyboard.press("Control+v");
  assert.equal(await page.locator(".ve-timeline-clip").count(), 1);
  await page.keyboard.press("Control+d");
  assert.equal(await page.locator(".ve-timeline-clip").count(), 2);
  await page.keyboard.press("Control+z");
  assert.equal(await page.locator(".ve-timeline-clip").count(), 1);
  await page.keyboard.press("Control+Shift+Z");
  assert.equal(await page.locator(".ve-timeline-clip").count(), 2);
  await page
    .locator(".video-editor")
    .getByRole("button", { name: "Effects", exact: true })
    .click();
  assert.equal(
    await page
      .getByLabel("Clip filter", { exact: true })
      .locator("option")
      .count(),
    20,
  );
  assert.equal(
    await page
      .getByLabel("Clip effect", { exact: true })
      .locator("option")
      .count(),
    11,
  );
  await page.getByLabel("Clip effect", { exact: true }).selectOption("rgb");
  await page.getByLabel("Clip filter", { exact: true }).selectOption("cinema");
  await page.screenshot({ path: "test-results/creative-effects.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Creative UI: categories, editable CV, cut/copy/paste, nudge, field isolation, photo controls, all templates/filters, video shortcuts PASS",
  );
  // Real WASM export exercises every enumerated look and effect, not just CSS.
  const input = (await fs.readFile(fixtures.red)).toString("base64");
  const result = await page.evaluate(async (input) => {
    const { probeMedia, renderVideo } = await import("/src/browser-media.js");
    const { emptyVideo } = await import("/shared/video.mjs");
    const { videoLooks, videoEffects } = await import(
      "/shared/effect-catalog.mjs"
    );
    const file = new File(
      [Uint8Array.from(atob(input), (c) => c.charCodeAt(0))],
      "red.mp4",
      { type: "video/mp4" },
    );
    const media = {
      ...(await probeMedia(file)),
      id: crypto.randomUUID(),
      blob: file,
      name: "red.mp4",
    };
    const entries = [
      ...videoLooks.map((v) => ({ filter: v.id })),
      ...videoEffects
        .filter((v) => v.id !== "none")
        .map((v) => ({ effect: v.id })),
    ];
    const clips = entries.map((p) => ({
      id: crypto.randomUUID(),
      assetId: media.id,
      in: 0,
      out: 0.2,
      volume: 0,
      speed: 1,
      fit: "contain",
      fade: 0,
      ...p,
    }));
    const blob = await renderVideo(
      { ...emptyVideo(), width: 320, height: 320, clips },
      [media],
    );
    return {
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      count: clips.length,
    };
  }, input);
  assert.equal(result.count, 30);
  const output = path.join(dir, "all-effects.mp4");
  await fs.writeFile(output, Buffer.from(result.bytes));
  const probe = JSON.parse(
    (
      await runMedia(tools.ffprobe, [
        "-v",
        "error",
        "-show_streams",
        "-of",
        "json",
        output,
      ])
    ).stdout,
  );
  assert.equal(probe.streams[0].codec_name, "h264");
  assert.ok(+probe.streams[0].duration >= 5.5);
  const colors = [];
  for (const time of [0.1, 0.3, 4.7]) {
    const pixel = path.join(dir, "pixel-" + time);
    await runMedia(tools.ffmpeg, [
      "-y",
      "-ss",
      String(time),
      "-i",
      output,
      "-frames:v",
      "1",
      "-vf",
      "crop=40:40:140:140,scale=1:1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      pixel,
    ]);
    colors.push([...(await fs.readFile(pixel))]);
  }
  assert.ok(
    colors[0][0] > 200 && colors[0][1] < 40,
    "Original segment stays red",
  );
  assert.ok(
    Math.abs(colors[1][0] - colors[1][1]) < 10 &&
      Math.abs(colors[1][1] - colors[1][2]) < 10,
    "Mono changes exported pixels",
  );
  assert.ok(
    colors[2][0] < 40 && colors[2][1] > 200 && colors[2][2] > 200,
    "Negative segment becomes cyan",
  );
  console.log("All 20 looks / 10 effects: real FFmpeg.wasm H.264 render PASS");
} finally {
  await page
    .screenshot({ path: "test-results/creative-last.png" })
    .catch(() => {});
  await browser.close();
  await server.close();
  await fs.rm(dir, { recursive: true, force: true });
}
