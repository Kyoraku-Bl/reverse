import { chromium } from "@playwright/test";
import Chromium, { inflate } from "@sparticuz/chromium";
import { createRequire } from "node:module";
import { createApp } from "../server/app.mjs";
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
const backend = createApp({ dataDir: dir });
const server = backend.app.listen(0, "0.0.0.0");
await new Promise((resolve) => server.once("listening", resolve));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({
  executablePath: await Chromium.executablePath(),
  args: Chromium.args,
  env: {
    ...process.env,
    LD_LIBRARY_PATH: `${libs}/lib:${process.env.LD_LIBRARY_PATH || ""}`,
  },
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
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
    .getByRole("button", { name: "New here? Create a free account" })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Sam");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("sam@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a-long-test-password");
  await page
    .getByRole("button", { name: "Create free account", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "What will you create today?" })
    .waitFor();
  await page.screenshot({ path: "test-results/workspace.png", fullPage: true });
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
    .getByLabel("Upload design image", { exact: true })
    .setInputFiles("public/images/ocean.jpg");
  await page.locator(".re-assets img").first().waitFor();
  await ready();
  json = JSON.parse((await exported("json")).toString());
  assert.ok(
    json.pages[0].canvas.objects.some(
      (o) => o.type === "Image" && o.src.startsWith("/api/assets/"),
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
  await page.getByText("Saved to your account", { exact: true }).waitFor();
  await ready();
  await page.getByTitle("Group or ungroup", { exact: true }).click();
  await rail("Color");
  await page.getByTitle("Background #e6c4ff", { exact: true }).click();
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByText("Saved to your account", { exact: true }).waitFor();
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
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Share", exact: true })
    .click();
  await page.getByLabel("Share link", { exact: true }).waitFor();
  const url = await page.getByLabel("Share link", { exact: true }).inputValue();
  const guest = await browser.newPage();
  await guest.goto(url);
  await guest.locator(".re-loading").waitFor({ state: "hidden" });
  assert.equal(await guest.locator(".re-rail").count(), 0);
  await page
    .getByRole("button", { name: "Disable sharing", exact: true })
    .click();
  await page.locator(".re-share-overlay").waitFor({ state: "detached" });
  await page.screenshot({ path: "test-results/editor.png" });
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
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "Customize Slow summer stories" })
    .click();
  await ready();
  await page.screenshot({ path: "test-results/mobile-editor.png" });
  await page
    .locator(".re-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByText("Saved to your account", { exact: true }).waitFor();
  await ready();
  const svg = await exported("svg");
  assert.ok(
    svg.toString().includes("data:image/jpeg;base64,"),
    "SVG must embed ocean photography",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real registration, template search, canvas drag, undo/redo, direct text editing, persisted saves, multiple pages, PNG/JPG/vector SVG/multipage PDF/JSON export, version history, read-only public sharing, brand-kit storage, custom dimensions, mobile layout.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await backend.close();
  await fs.rm(dir, { recursive: true, force: true });
}
