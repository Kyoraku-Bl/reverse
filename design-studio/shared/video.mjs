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
    fps: z.union([z.literal(24), z.literal(30)]),
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
              z.literal(0.5),
              z.literal(1),
              z.literal(1.5),
              z.literal(2),
            ]),
            fit: z.enum(["contain", "cover"]),
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
    soundtrack: z
      .object({
        assetId: z.uuid(),
        offset: seconds,
        volume: z.number().min(0).max(2),
      })
      .nullable(),
  })
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
