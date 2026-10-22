import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, ".."),
  source = path.join(
    root,
    "node_modules/@fontsource-variable/noto-sans-arabic",
  ),
  dest = path.join(root, "public/fonts/generated");
await fs.mkdir(dest, { recursive: true });
const css = (await fs.readFile(path.join(source, "wght.css"), "utf8"))
  .replaceAll("Noto Sans Arabic Variable", "Noto Sans Arabic")
  .replaceAll("./files/", "./");
for (const [, file] of css.matchAll(/url\(\.\/([^\)]+)\)/g))
  await fs.copyFile(path.join(source, "files", file), path.join(dest, file));
await fs.writeFile(path.join(dest, "noto.css"), css);
await fs.copyFile(path.join(source, "LICENSE"), path.join(dest, "OFL.txt"));
