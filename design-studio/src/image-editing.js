import { filters } from "fabric";
// Filter state lives in Fabric's serializable native filters, not a second,
// unsaved React-only representation. Edits preserve other active adjustments.
export const imagePresets = [
  "original",
  "mono",
  "sepia",
  "warm",
  "cool",
  "vivid",
  "faded",
  "noir",
  "negative",
  "soft",
  "sharp",
  "pixel",
];
export function imageSettings(o) {
  const f = (name, prop, fallback = 0) =>
    o.filters?.find((x) => x.type === name)?.[prop] ?? fallback;
  return {
    brightness: f("Brightness", "brightness"),
    contrast: f("Contrast", "contrast"),
    saturation: f("Saturation", "saturation"),
    hue: f("HueRotation", "rotation"),
    blur: f("Blur", "blur"),
    pixelate: f("Pixelate", "blocksize", 1),
    grayscale: !!o.filters?.some((x) => x.type === "Grayscale"),
    sepia: !!o.filters?.some((x) => x.type === "Sepia"),
    invert: !!o.filters?.some((x) => x.type === "Invert"),
  };
}
export function setImageAdjustment(o, key, value) {
  const map = {
    brightness: ["Brightness", "brightness"],
    contrast: ["Contrast", "contrast"],
    saturation: ["Saturation", "saturation"],
    hue: ["HueRotation", "rotation"],
    blur: ["Blur", "blur"],
    pixelate: ["Pixelate", "blocksize"],
    grayscale: ["Grayscale"],
    sepia: ["Sepia"],
    invert: ["Invert"],
  };
  const [name, prop] = map[key];
  o.filters = (o.filters || []).filter((x) => x.type !== name);
  if (prop ? value !== (key === "pixelate" ? 1 : 0) : value)
    o.filters.push(new filters[name](prop ? { [prop]: value } : {}));
  o.applyFilters();
  o.dirty = true;
}
export function applyImagePreset(o, name) {
  o.filters = [];
  const recipes = {
    original: [],
    mono: [["grayscale", true]],
    sepia: [["sepia", true]],
    warm: [
      ["sepia", true],
      ["saturation", 0.15],
    ],
    cool: [
      ["hue", 0.12],
      ["saturation", -0.1],
    ],
    vivid: [
      ["saturation", 0.4],
      ["contrast", 0.15],
    ],
    faded: [
      ["contrast", -0.2],
      ["brightness", 0.07],
      ["saturation", -0.25],
    ],
    noir: [
      ["grayscale", true],
      ["contrast", 0.35],
    ],
    negative: [["invert", true]],
    soft: [["blur", 0.12]],
    pixel: [["pixelate", 12]],
    sharp: [],
  };
  for (const [key, value] of recipes[name] || [])
    setImageAdjustment(o, key, value);
  if (name === "sharp")
    o.filters.push(
      new filters.Convolute({ matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0] }),
    );
  o.applyFilters();
  o.dirty = true;
}
export function cropSettings(o) {
  const { width: w, height: h } = o.getOriginalSize();
  return {
    left: Math.round((o.cropX / w) * 100),
    top: Math.round((o.cropY / h) * 100),
    right: Math.round(((w - o.cropX - o.width) / w) * 100),
    bottom: Math.round(((h - o.cropY - o.height) / h) * 100),
  };
}
export function setImageCrop(o, patch) {
  const c = { ...cropSettings(o), ...patch };
  if (
    Object.values(c).some((v) => !Number.isFinite(v) || v < 0 || v > 95) ||
    c.left + c.right > 95 ||
    c.top + c.bottom > 95
  )
    throw new Error("Keep at least 5% of the original image visible.");
  const { width: w, height: h } = o.getOriginalSize();
  o.set({
    cropX: (w * c.left) / 100,
    cropY: (h * c.top) / 100,
    width: w * (1 - (c.left + c.right) / 100),
    height: h * (1 - (c.top + c.bottom) / 100),
  });
  o.setCoords();
}
