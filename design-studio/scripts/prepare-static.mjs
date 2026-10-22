import "./prepare-fonts.mjs";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
await fs.rm(path.join(root, "public/engine"), { recursive: true, force: true });
for (const [pkg, target] of [
  ["ffmpeg", "ffmpeg"],
  ["core", "core"],
]) {
  const source = path.join(root, "node_modules/@ffmpeg", pkg, "dist/esm");
  const dest = path.join(root, "public/engine", target);
  await fs.mkdir(dest, { recursive: true });
  for (const name of await fs.readdir(source)) {
    if (name.endsWith(".js") || name.endsWith(".wasm"))
      await fs.copyFile(path.join(source, name), path.join(dest, name));
  }
}
await fs.writeFile(
  path.join(root, "public/engine/NOTICE.txt"),
  `FFmpeg.wasm wrapper: MIT, https://github.com/ffmpegwasm/ffmpeg.wasm/tree/f78aed147c4185484da8eba1d97c51354a5e3352\nFFmpeg core 0.12.10: GPL-2.0-or-later (includes libx264).\nCorresponding source and build recipes: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/71aa99d37c02a7b4c435275ca9ef50e612f6efa1\nFFmpeg source: https://github.com/ffmpegwasm/FFmpeg/tree/n5.1.4\nThis application bundles the single-thread core. No CDN or remote rendering service is used.\n`,
);
console.log("Prepared same-origin FFmpeg single-thread worker and WASM.");

for (const name of await fs.readdir(path.join(root, "licenses")))
  await fs.copyFile(
    path.join(root, "licenses", name),
    path.join(root, "public/engine", name),
  );
