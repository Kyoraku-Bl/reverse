import { videoLooks, videoEffects } from "./effect-catalog.mjs";
// Shared numeric/enumerated filters only. User text is written to files, not filter expressions.
export function visualFilters(c) {
  const filters = [];
  if (c.flipX) filters.push("hflip");
  if (c.flipY) filters.push("vflip");
  if (c.rotation === 90) filters.push("transpose=1");
  if (c.rotation === 180) filters.push("hflip", "vflip");
  if (c.rotation === 270) filters.push("transpose=2");
  if (c.brightness || c.contrast !== undefined || c.saturation !== undefined)
    filters.push(
      `eq=brightness=${c.brightness || 0}:contrast=${c.contrast ?? 1}:saturation=${c.saturation ?? 1}`,
    );
  filters.push(...(videoLooks.find((v) => v.id === c.filter)?.ff || []));
  filters.push(...(videoEffects.find((v) => v.id === c.effect)?.ff || []));
  if (c.hue) filters.push(`hue=h=${c.hue}`);
  if (c.blur) filters.push(`boxblur=${c.blur}:1`);
  return filters;
}
export function previewFilter(c = {}) {
  return `brightness(${1 + (c.brightness || 0)}) contrast(${c.contrast ?? 1}) saturate(${c.saturation ?? 1}) ${videoLooks.find((v) => v.id === c.filter)?.css || ""} ${videoEffects.find((v) => v.id === c.effect)?.css || ""} hue-rotate(${c.hue || 0}deg) blur(${c.blur || 0}px)`;
}
export function tempoFilter(speed) {
  const values = [];
  while (speed < 0.5) {
    values.push(0.5);
    speed /= 0.5;
  }
  while (speed > 2) {
    values.push(2);
    speed /= 2;
  }
  values.push(speed);
  return values.map((s) => "atempo=" + s).join(",");
}
const stamp = (s) => {
  const ms = Math.round(s * 1000),
    hours = Math.floor(ms / 3600000),
    mins = Math.floor(ms / 60000) % 60,
    sec = Math.floor(ms / 1000) % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
export const captionsToSrt = (captions) =>
  [...captions]
    .sort((a, b) => a.start - b.start)
    .map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}`)
    .join("\n\n") + "\n";
export function parseSrt(text) {
  if (text.length > 100000) throw new Error("Choose an SRT file under 100 KB.");
  const parse = (s) => {
    const m = s.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/);
    if (!m || +m[2] > 59 || +m[3] > 59)
      throw new Error("Invalid SRT timestamp.");
    return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
  };
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      if (/^\d+$/.test(lines[0])) lines.shift();
      const times = lines.shift()?.split(/\s+-->\s+/);
      if (times?.length !== 2) throw new Error("Invalid SRT block.");
      const start = parse(times[0]),
        end = parse(times[1]),
        value = lines.join("\n").trim();
      if (end <= start || end > 600 || !value || value.length > 200)
        throw new Error(
          "Captions need 1–200 characters, valid timing and an end within 10 minutes.",
        );
      return {
        id: crypto.randomUUID(),
        start,
        end,
        text: value,
        size: 48,
        color: "#ffffff",
        position: "bottom",
      };
    });
}
