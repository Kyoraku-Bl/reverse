import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSrt,
  captionsToSrt,
  tempoFilter,
  visualFilters,
} from "../shared/video-effects.mjs";
import { emptyVideo, videoDocumentSchema, duration } from "../shared/video.mjs";
import { validateCanvasTree } from "../shared/design-validation.mjs";
test("SRT preserves Unicode/plain text and validates timing and limits", () => {
  const parsed = parseSrt(
    "1\r\n00:00:00,125 --> 00:00:03,500\r\nمرحبا <b>plain text</b> 100%\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nTwo lines\r\nsecond",
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].start, 0.125);
  assert.ok(captionsToSrt(parsed).includes("مرحبا <b>plain text</b> 100%"));
  assert.equal(parseSrt(captionsToSrt(parsed))[1].text, "Two lines\nsecond");
  for (const bad of [
    "wrong",
    "1\n00:00:03,000 --> 00:00:01,000\nBad",
    "1\n00:61:00,000 --> 00:62:00,000\nBad",
    "1\n00:00:00,000 --> 00:11:00,000\nToo late",
  ])
    assert.throws(() => parseSrt(bad));
});
test("video validation covers effects, motion, unique IDs and backward-compatible defaults", () => {
  const clip = {
    id: crypto.randomUUID(),
    assetId: crypto.randomUUID(),
    in: 0,
    out: 2,
    speed: 0.25,
    volume: 1,
    fit: "contain",
    fade: 0,
  };
  const doc = videoDocumentSchema.parse({ ...emptyVideo(), clips: [clip] });
  assert.equal(duration(doc), 8);
  assert.equal(doc.clips[0].zoomStart, 1);
  assert.equal(doc.clips[0].filter, "none");
  assert.deepEqual(doc.overlays, []);
  assert.deepEqual(doc.audioTracks, []);
  assert.equal(tempoFilter(0.25), "atempo=0.5,atempo=0.5");
  assert.equal(tempoFilter(4), "atempo=2,atempo=2");
  assert.deepEqual(
    visualFilters({ flipX: true, rotation: 90, filter: "mono" }),
    ["hflip", "transpose=1", "hue=s=0"],
  );
  for (const patch of [
    { blur: 11 },
    { zoomStart: 0 },
    { zoomEnd: 3 },
    { filter: "movie=file:///secret" },
    { rotation: 45 },
  ])
    assert.equal(
      videoDocumentSchema.safeParse({ ...doc, clips: [{ ...clip, ...patch }] })
        .success,
      false,
    );
  assert.equal(
    videoDocumentSchema.safeParse({ ...doc, clips: [clip, clip] }).success,
    false,
  );
});
test("server and local design image policies stay distinct; external URLs and SVG data are rejected", () => {
  const node = (src) => ({ type: "Image", src });
  assert.doesNotThrow(() => validateCanvasTree(node("/api/assets/aa-bb/file")));
  assert.throws(() => validateCanvasTree(node("data:image/png;base64,YWJj")));
  assert.doesNotThrow(() =>
    validateCanvasTree(node("data:image/png;base64,YWJj"), { local: true }),
  );
  assert.throws(() =>
    validateCanvasTree(node("/api/assets/aa-bb/file"), { local: true }),
  );
  assert.throws(() =>
    validateCanvasTree(node("https://evil.example/pixel.png"), { local: true }),
  );
  assert.throws(() =>
    validateCanvasTree(node("data:image/svg+xml;base64,YWJj"), { local: true }),
  );
  assert.doesNotThrow(() =>
    validateCanvasTree(node("/reverse/images/ocean.jpg"), {
      local: true,
      base: "/reverse/",
    }),
  );
});
