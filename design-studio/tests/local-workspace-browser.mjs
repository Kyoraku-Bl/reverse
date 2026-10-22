import { createServer } from "vite";
import { chromium } from "@playwright/test";
import Chromium, { inflate } from "@sparticuz/chromium";
import { createRequire } from "node:module";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(
    path.dirname(createRequire(import.meta.url).resolve("@sparticuz/chromium")),
    "..",
  ),
  libs = await inflate(path.join(root, "bin/al2023.tar.br"));
const server = await createServer({ server: { host: "0.0.0.0", port: 0 } });
await server.listen();
const origin = "http://127.0.0.1:" + server.httpServer.address().port;
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
try {
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const { localApi: api } = await import("/src/local-api.js"),
      { writeMany, read } = await import("/src/local-db.js"),
      { exportBackup, importBackup } = await import("/src/local-backup.js"),
      { zipSync, strToU8 } = await import("/node_modules/.vite/deps/fflate.js");
    const assert = (yes, message) => {
      if (!yes) throw new Error(message);
    };
    const rejects = async (fn, expected) => {
      try {
        await fn();
        throw new Error("Expected rejection");
      } catch (e) {
        assert(
          e.status === expected ||
            (typeof expected === "string" && e.message.includes(expected)),
          "Unexpected error: " + e.message,
        );
      }
    };
    const doc = {
      version: 1,
      width: 640,
      height: 360,
      pages: [
        {
          id: crypto.randomUUID(),
          canvas: { objects: [], background: "#ffffff" },
        },
      ],
    };
    let { project } = await api("/projects", {
      method: "POST",
      body: JSON.stringify({ title: "Transactional design", document: doc }),
    });
    const writes = await Promise.allSettled(
      [1, 2].map((n) =>
        api("/projects/" + project.id, {
          method: "PUT",
          body: JSON.stringify({ ...project, title: "Writer " + n }),
        }),
      ),
    );
    assert(
      writes.filter((w) => w.status === "fulfilled").length === 1,
      "Only one concurrent revision may win.",
    );
    assert(
      writes.find((w) => w.status === "rejected").reason.status === 409,
      "Stale saves must fail with a conflict.",
    );
    const saved = (await api("/projects/" + project.id)).project;
    assert(saved.revision === 2, "Revision should increment exactly once.");
    assert(
      (await api("/projects/" + project.id + "/versions")).versions.length ===
        1,
      "Old version should be kept.",
    );
    const bad = structuredClone(doc);
    bad.pages[0].canvas.objects.push({
      type: "Image",
      src: "https://example.invalid/track.png",
    });
    await rejects(
      () =>
        api("/projects", {
          method: "POST",
          body: JSON.stringify({ title: "External", document: bad }),
        }),
      "uploaded",
    );
    const image = document.createElement("canvas");
    image.width = 32;
    image.height = 32;
    image.getContext("2d").fillRect(0, 0, 32, 32);
    const blob = await new Promise((r) => image.toBlob(r, "image/png")),
      file = new File([blob], "image.png", { type: "image/png" }),
      form = new FormData();
    form.append("file", file);
    const { media } = await api("/video/media", { method: "POST", body: form });
    const videoDoc = {
      version: 1,
      width: 320,
      height: 320,
      fps: 24,
      clips: [
        {
          id: crypto.randomUUID(),
          assetId: media.id,
          in: 0,
          out: 0.5,
          speed: 1,
          volume: 1,
          fit: "contain",
          fade: 0,
        },
      ],
      captions: [],
      soundtrack: null,
    };
    const { project: video } = await api("/video/projects", {
      method: "POST",
      body: JSON.stringify({ title: "Cancel test", document: videoDoc }),
    });
    await rejects(
      () => api("/video/media/" + media.id, { method: "DELETE" }),
      409,
    );
    await rejects(
      () =>
        api("/video/projects/" + video.id + "/render", {
          method: "POST",
          body: JSON.stringify({ revision: 999 }),
        }),
      409,
    );
    const { job } = await api("/video/projects/" + video.id + "/render", {
      method: "POST",
      body: JSON.stringify({ revision: video.revision }),
    });
    await api("/video/jobs/" + job.id + "/cancel", { method: "POST" });
    await new Promise((resolve, reject) => {
      const start = performance.now();
      const timer = setInterval(async () => {
        try {
          const { job: j } = await api("/video/jobs/" + job.id);
          if (j.status === "cancelled") {
            clearInterval(timer);
            resolve();
          } else if (performance.now() - start > 10000) {
            clearInterval(timer);
            reject(new Error("Cancellation timed out"));
          }
        } catch (e) {
          clearInterval(timer);
          reject(e);
        }
      }, 30);
    });
    await api("/video/projects/" + video.id, { method: "DELETE" });
    await api("/video/media/" + media.id, { method: "DELETE" });
    assert(
      !(await read("media/" + media.id)),
      "Unused sources should be removed.",
    );
    // All manifest validation must happen before the replacement transaction.
    const archive = await exportBackup();
    const malformed = {
      format: "open-studio-backup",
      version: 1,
      projects: [
        { ...saved, meta: { thumbnail: "https://example.invalid/pixel.png" } },
      ],
      videoProjects: [],
      versions: [],
      assets: [],
      media: [],
    };
    await rejects(
      () =>
        importBackup(
          new File(
            [zipSync({ "manifest.json": strToU8(JSON.stringify(malformed)) })],
            "bad-preview.zip",
          ),
        ),
      "preview",
    );
    assert(
      (await api("/projects/" + project.id)).project.revision === 2,
      "Bad restore must leave existing work untouched.",
    );
    const bomb = zipSync({ "manifest.json": strToU8("{}") });
    const view = new DataView(bomb.buffer);
    for (let i = 0; i < bomb.length - 28; i++) {
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 129 * 1024 * 1024, true);
        break;
      }
    }
    await rejects(
      () => importBackup(new File([bomb], "bomb.zip")),
      "uncompressed",
    );
    await importBackup(new File([archive], "valid.zip"));
    assert(
      (await api("/projects/" + project.id)).project.title === saved.title,
      "Good restore should preserve the saved design.",
    );
    window.__testProject = project.id;
    return { concurrency: true, cancel: true, backupValidation: true };
  });
  assert.deepEqual(result, {
    concurrency: true,
    cancel: true,
    backupValidation: true,
  });
  const rollback = await page.evaluate(async () => {
    const { writeMany, read } = await import("/src/local-db.js");
    let failed = false;
    try {
      await writeMany([
        ["sentinel-sync", { ok: true }],
        ["bad-clone", { fn: () => {} }],
      ]);
    } catch (e) {
      failed = e.name === "DataCloneError";
    }
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value) {
      const req = original.call(this, value);
      if (value.key === "abort-trigger") {
        const tx = this.transaction;
        queueMicrotask(() => tx.abort());
      }
      return req;
    };
    let aborted = false;
    try {
      await writeMany([
        ["sentinel-async", { ok: true }],
        ["abort-trigger", { ok: true }],
      ]);
    } catch {
      aborted = true;
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    return {
      failed,
      aborted,
      sync: (await read("sentinel-sync")) || null,
      async: (await read("sentinel-async")) || null,
      project: !!(await read("projects/" + window.__testProject)),
    };
  });
  assert.deepEqual(rollback, {
    failed: true,
    aborted: true,
    sync: null,
    async: null,
    project: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS local workspace: atomic revision conflicts, history, source references, render cancellation, malformed/oversized ZIP rejection, validated restores, and synchronous cloning errors and asynchronous transaction aborts roll back partial writes without losing saved projects.",
  );
} finally {
  await browser.close();
  await server.close();
}
