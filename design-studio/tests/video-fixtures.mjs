import path from "node:path";
import { tools, runMedia } from "../server/media-process.mjs";
export async function makeFixtures(dir) {
  const red = path.join(dir, "red.mp4"),
    blue = path.join(dir, "blue.mp4"),
    music = path.join(dir, "music.wav");
  await runMedia(tools.ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=320x240:r=24:d=2",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=2",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    red,
  ]);
  await runMedia(tools.ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=320x240:r=24:d=2",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    blue,
  ]);
  await runMedia(tools.ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=880:duration=3",
    music,
  ]);
  return { red, blue, music };
}
