import { createServer } from "vite";
import { chromium } from "@playwright/test";
import Chromium, { inflate } from "@sparticuz/chromium";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { makeFixtures } from "./video-fixtures.mjs";
import { tools, runMedia } from "../server/media-process.mjs";
import assert from "node:assert/strict";
const root = path.resolve(
    path.dirname(createRequire(import.meta.url).resolve("@sparticuz/chromium")),
    "..",
  ),
  libs = await inflate(path.join(root, "bin/al2023.tar.br"));
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "static-engine-")),
  fixtures = await makeFixtures(dir);
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
try {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log("BROWSER:", m.text());
  });
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  await page.goto("http://127.0.0.1:" + server.httpServer.address().port);
  const inputs = {};
  for (const [key, file] of Object.entries(fixtures))
    inputs[key] = (await fs.readFile(file)).toString("base64");
  const result = await page.evaluate(async (inputs) => {
    const { probeMedia, renderVideo, reverseSource, extractAudio } =
      await import("/src/browser-media.js");
    const { emptyVideo } = await import("/shared/video.mjs");
    const media = [];
    for (const [key, base64] of Object.entries(inputs)) {
      const blob = new File(
        [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
        key + (key === "music" ? ".wav" : ".mp4"),
        { type: key === "music" ? "audio/wav" : "video/mp4" },
      );
      media.push({
        ...(await probeMedia(blob)),
        id: crypto.randomUUID(),
        name: key,
        blob,
      });
    }
    const image = document.createElement("canvas");
    image.width = 64;
    image.height = 64;
    image.getContext("2d").fillStyle = "#00ff00";
    image.getContext("2d").fillRect(0, 0, 64, 64);
    const imageBlob = await new Promise((r) => image.toBlob(r, "image/png"));
    media.push({
      ...(await probeMedia(imageBlob)),
      id: crypto.randomUUID(),
      name: "green.png",
      blob: imageBlob,
    });
    const d = {
      ...emptyVideo(),
      width: 640,
      height: 360,
      clips: media.slice(0, 2).map((m) => ({
        id: crypto.randomUUID(),
        assetId: m.id,
        in: 0.1,
        out: 1,
        volume: 1,
        speed: 1,
        fit: "contain",
        fade: 0.1,
        filter: "mono",
        zoomStart: 1,
        zoomEnd: 1.4,
        panEndX: 80,
      })),
      captions: [
        {
          id: crypto.randomUUID(),
          text: "Hello مرحبا 100% : test",
          start: 0,
          end: 1,
          size: 30,
          color: "#ffffff",
          position: "bottom",
        },
      ],
      soundtrack: { assetId: media[2].id, offset: 0, volume: 0.5 },
    };
    d.clips.push({
      id: crypto.randomUUID(),
      assetId: media[3].id,
      in: 0,
      out: 0.5,
      volume: 0,
      speed: 1,
      fit: "cover",
      fade: 0,
    });
    d.overlays = [
      {
        id: crypto.randomUUID(),
        assetId: media[3].id,
        start: 1,
        end: 1.7,
        x: 60,
        y: 5,
        width: 15,
        opacity: 1,
      },
    ];
    d.audioTracks = [
      {
        id: crypto.randomUUID(),
        assetId: media[2].id,
        start: 0.2,
        in: 0,
        out: 1,
        volume: 0.5,
        fadeIn: 0.1,
        fadeOut: 0.1,
      },
    ];
    const output = await renderVideo(d, media, { progress: () => {} });
    const reversed = await reverseSource(
      { ...(await probeMedia(output)), blob: output },
      0,
      2.2,
    );
    const audio = await extractAudio(media[0], 0.1, 0.6);
    const controller = new AbortController();
    let cancelled = false;
    try {
      await renderVideo(d, media, {
        signal: controller.signal,
        progress: () => controller.abort(),
      });
    } catch (e) {
      cancelled = e.name === "AbortError";
    }
    if (!cancelled) throw new Error("Cancel did not stop the worker.");
    await probeMedia(media[0].blob); // A fresh worker still works after cancellation.
    const encode = (blob) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });
    return {
      output: await encode(output),
      reversed: await encode(reversed),
      audio: await encode(audio),
    };
  }, inputs);
  const output = path.join(dir, "out.mp4");
  await fs.writeFile(output, Buffer.from(result.output, "base64"));
  const info = await runMedia(tools.ffprobe, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    output,
  ]);
  const parsed = JSON.parse(info.stdout);
  assert.ok(parsed.streams.some((s) => s.codec_type === "audio"));
  assert.equal(parsed.streams.find((s) => s.codec_type === "video").width, 640);
  assert.ok(+parsed.format.duration > 2.2);
  await fs.writeFile(
    path.join(dir, "audio.wav"),
    Buffer.from(result.audio, "base64"),
  );
  assert.equal(
    (await fs.readFile(path.join(dir, "audio.wav"))).subarray(0, 4).toString(),
    "RIFF",
  );
  await fs.writeFile(
    path.join(dir, "reversed.mp4"),
    Buffer.from(result.reversed, "base64"),
  );
  const reverseInfo = JSON.parse(
    (
      await runMedia(tools.ffprobe, [
        "-v",
        "error",
        "-show_format",
        "-of",
        "json",
        path.join(dir, "reversed.mp4"),
      ])
    ).stdout,
  );
  assert.ok(+reverseInfo.format.duration > 2);
  const pixel = path.join(dir, "pixel");
  await runMedia(tools.ffmpeg, [
    "-y",
    "-ss",
    "2",
    "-i",
    output,
    "-frames:v",
    "1",
    "-vf",
    "scale=1:1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    pixel,
  ]);
  const color = await fs.readFile(pixel);
  assert.ok(
    color[1] > 200 && color[0] < 50 && color[2] < 50,
    "A still image must render green at the end of the timeline.",
  );
  await runMedia(tools.ffmpeg, [
    "-y",
    "-ss",
    "0.1",
    "-i",
    path.join(dir, "reversed.mp4"),
    "-frames:v",
    "1",
    "-vf",
    "scale=1:1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    pixel,
  ]);
  const reversedColor = await fs.readFile(pixel);
  assert.ok(
    reversedColor[1] > 200 && reversedColor[0] < 50 && reversedColor[2] < 50,
    "Reversal must begin with the final green image.",
  );
  console.log(
    "PASS actual single-thread browser FFmpeg: probe, image/video clips, silence, filters, two-point motion, Unicode captions, image overlays, timed audio layers, WAV extraction, reverse copies, cancellation/recovery and MP4.",
    parsed.format.duration,
  );
} finally {
  await browser.close();
  await server.close();
  await fs.rm(dir, { recursive: true, force: true });
}
