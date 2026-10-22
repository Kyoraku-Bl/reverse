import { z } from "zod";
const seconds = z.number().finite().min(0).max(1800);
export const videoDocumentSchema = z
  .object({
    version: z.literal(1),
    width: z
      .number()
      .int()
      .min(320)
      .max(1920)
      .refine((v) => v % 2 === 0, "Use an even width"),
    height: z
      .number()
      .int()
      .min(320)
      .max(1920)
      .refine((v) => v % 2 === 0, "Use an even height"),
    fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]),
    quality: z.enum(["draft", "balanced", "high"]).default("balanced"),
    clips: z
      .array(
        z
          .object({
            id: z.uuid(),
            assetId: z.uuid(),
            in: seconds,
            out: seconds,
            volume: z.number().min(0).max(2),
            speed: z.union([
              z.literal(0.25),
              z.literal(0.5),
              z.literal(0.75),
              z.literal(1),
              z.literal(1.25),
              z.literal(1.5),
              z.literal(2),
              z.literal(3),
              z.literal(4),
            ]),
            fit: z.enum(["contain", "cover"]),
            flipX: z.boolean().default(false),
            flipY: z.boolean().default(false),
            rotation: z
              .union([
                z.literal(0),
                z.literal(90),
                z.literal(180),
                z.literal(270),
              ])
              .default(0),
            filter: z
              .enum(["none", "mono", "warm", "cool", "vintage"])
              .default("none"),
            brightness: z.number().min(-0.5).max(0.5).default(0),
            contrast: z.number().min(0.5).max(2).default(1),
            saturation: z.number().min(0).max(2).default(1),
            blur: z.number().int().min(0).max(10).default(0),
            zoomStart: z.number().min(1).max(2).default(1),
            zoomEnd: z.number().min(1).max(2).default(1),
            panX: z.number().min(0).max(100).default(50),
            panY: z.number().min(0).max(100).default(50),
            panEndX: z.number().min(0).max(100).default(50),
            panEndY: z.number().min(0).max(100).default(50),
            fade: z.number().min(0).max(1),
          })
          .refine(
            (c) => c.out - c.in >= 0.1,
            "A clip must be at least 0.1 seconds long",
          ),
      )
      .max(30),
    captions: z
      .array(
        z
          .object({
            id: z.uuid(),
            text: z.string().trim().min(1).max(200),
            start: z.number().min(0).max(600),
            end: z.number().min(0).max(600),
            size: z.number().int().min(16).max(120),
            color: z.string().regex(/^#[a-f0-9]{6}$/i),
            position: z.enum(["top", "center", "bottom"]),
          })
          .refine(
            (c) => c.end > c.start,
            "Caption end must be after its start",
          ),
      )
      .max(20),
    overlays: z
      .array(
        z
          .object({
            id: z.uuid(),
            assetId: z.uuid(),
            start: z.number().min(0).max(600),
            end: z.number().min(0).max(600),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            width: z.number().min(5).max(100),
            opacity: z.number().min(0).max(1),
          })
          .refine(
            (o) => o.end > o.start,
            "Overlay end must be after its start",
          ),
      )
      .max(10)
      .default([]),
    audioTracks: z
      .array(
        z
          .object({
            id: z.uuid(),
            assetId: z.uuid(),
            start: z.number().min(0).max(600),
            in: seconds,
            out: seconds,
            volume: z.number().min(0).max(2),
            fadeIn: z.number().min(0).max(3).default(0),
            fadeOut: z.number().min(0).max(3).default(0),
          })
          .refine(
            (a) => a.out - a.in >= 0.1,
            "An audio track needs at least 0.1 seconds",
          ),
      )
      .max(5)
      .default([]),
    soundtrack: z
      .object({
        assetId: z.uuid(),
        offset: seconds,
        volume: z.number().min(0).max(2),
      })
      .nullable(),
  })
  .refine(
    (d) =>
      [d.clips, d.captions, d.overlays, d.audioTracks].every(
        (items) => new Set(items.map((v) => v.id)).size === items.length,
      ),
    "Each layer needs a unique ID",
  )
  .refine((d) => d.width * d.height <= 2073600, "Output supports up to 1080p")
  .refine((d) => duration(d) <= 600, "A montage supports up to 10 minutes");
export const videoProjectSchema = z.object({
  title: z.string().trim().min(1).max(150),
  document: videoDocumentSchema,
  revision: z.number().int().min(1).optional(),
});
export const clipDuration = (c) => (c.out - c.in) / c.speed;
export function duration(document) {
  return document.clips.reduce((sum, c) => sum + clipDuration(c), 0);
}
export function timeline(document) {
  let start = 0;
  return document.clips.map((clip) => {
    const item = { ...clip, start, end: start + clipDuration(clip) };
    start = item.end;
    return item;
  });
}
export function locate(document, time) {
  const clips = timeline(document);
  return (
    clips.find(
      (c, i) => time >= c.start && (time < c.end || i === clips.length - 1),
    ) ||
    clips[0] ||
    null
  );
}
export function timecode(value) {
  const s = Math.max(0, Number(value) || 0);
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}
export const emptyVideo = () => ({
  version: 1,
  width: 1280,
  height: 720,
  fps: 30,
  clips: [],
  captions: [],
  soundtrack: null,
});
