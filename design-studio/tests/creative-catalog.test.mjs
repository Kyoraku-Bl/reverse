import test from "node:test";
import assert from "node:assert/strict";
import {
  originalTemplates,
  templateRecipe,
  templateCategories,
} from "../src/template-catalog.js";
import {
  videoLooks,
  videoEffects,
  lookIds,
  effectIds,
} from "../shared/effect-catalog.mjs";
import { visualFilters, previewFilter } from "../shared/video-effects.mjs";
import { videoDocumentSchema, emptyVideo } from "../shared/video.mjs";
test("every advertised category has original editable, finite recipe primitives", () => {
  assert.equal(originalTemplates.length, 29);
  assert.equal(new Set(originalTemplates.map((t) => t.id)).size, 29);
  for (const [type] of templateCategories)
    assert.ok(
      originalTemplates.some((t) => t.type === type),
      type,
    );
  for (const t of originalTemplates) {
    assert.ok(
      t.width >= 64 && t.width <= 4096 && t.height >= 64 && t.height <= 4096,
    );
    const nodes = templateRecipe(t);
    assert.ok(nodes.length >= 4 && nodes.length < 300, t.title);
    for (const n of nodes) {
      assert.ok(["text", "rect", "circle"].includes(n.kind));
      assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
      if (n.kind === "text") {
        assert.equal(typeof n.text, "string", t.id);
        assert.ok(n.text.length > 0);
        assert.ok(n.w > 0 && n.size > 0);
      }
      if (n.kind === "rect") assert.ok(n.w > 0 && n.h > 0);
      if (n.kind === "circle") assert.ok(n.r > 0);
    }
  }
});
test("one finite effect catalogue owns UI, validator and render expressions", () => {
  const c = {
    id: crypto.randomUUID(),
    assetId: crypto.randomUUID(),
    in: 0,
    out: 1,
    speed: 1,
    volume: 1,
    fit: "cover",
    fade: 0,
  };
  assert.equal(new Set(lookIds).size, 20);
  assert.equal(new Set(effectIds).size, 11);
  for (const look of videoLooks)
    for (const effect of videoEffects) {
      const clip = { ...c, filter: look.id, effect: effect.id, hue: 25 };
      assert.equal(
        videoDocumentSchema.parse({ ...emptyVideo(), clips: [clip] }).clips[0]
          .effect,
        effect.id,
      );
      const ff = visualFilters(clip);
      for (const expression of [...look.ff, ...effect.ff])
        assert.ok(ff.includes(expression));
      assert.ok(previewFilter(clip).includes("hue-rotate(25deg)"));
    }
  for (const patch of [
    { effect: "movie=evil" },
    { hue: 181 },
    { hue: -181 },
    { filter: "unknown" },
  ])
    assert.equal(
      videoDocumentSchema.safeParse({
        ...emptyVideo(),
        clips: [{ ...c, ...patch }],
      }).success,
      false,
    );
});

test("native photo filter persistence accepts bounded adjustments and rejects hostile kernels", async () => {
  const { validateCanvasTree } = await import(
    "../shared/design-validation.mjs"
  );
  for (const obj of [
    { type: "HueRotation", rotation: 0.5 },
    { type: "Sepia" },
    { type: "shadow", blur: 18 },
    { type: "Convolute", matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0] },
  ])
    assert.doesNotThrow(() => validateCanvasTree(obj, { local: true }));
  for (const obj of [
    { type: "Blur", blur: 1000 },
    { type: "Pixelate", blocksize: 0 },
    { type: "HueRotation", rotation: Infinity },
    { type: "Convolute", matrix: new Array(1000).fill(1) },
    { type: "Convolute", matrix: [0, 0, 0, 0, 10000, 0, 0, 0, 0] },
  ])
    assert.throws(() => validateCanvasTree(obj, { local: true }));
});
