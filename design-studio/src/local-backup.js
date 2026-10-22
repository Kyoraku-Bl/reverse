import { zip, unzipSync, strToU8, strFromU8 } from "fflate";
import { recordsSnapshot, replaceRecords, fail } from "./local-db";
import { validateImport } from "./design";
import { videoDocumentSchema } from "../shared/video.mjs";
const MAX = 128 * 1024 * 1024,
  uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
export async function exportBackup() {
  const snapshot = await recordsSnapshot(),
    group = (prefix) =>
      snapshot.filter((r) => r.key.startsWith(prefix)).map((r) => r.value);
  const media = group("media/"),
    projects = group("projects/"),
    videoProjects = group("videoProjects/"),
    assets = group("assets/"),
    versions = group("versions/"),
    preferences = snapshot.find((r) => r.key === "preferences")?.value;
  const manifest = {
    format: "open-studio-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    projects,
    videoProjects,
    assets,
    versions,
    preferences,
    media: [],
  };
  const files = {};
  let size = 0;
  for (const m of media) {
    size += m.blob.size;
    if (size > MAX)
      throw fail(
        "Backup is limited to 128 MB per archive. Download originals and free unused library media before backing up.",
      );
    const { blob, ...meta } = m,
      path = `media/${m.id}.bin`,
      bytes = new Uint8Array(await blob.arrayBuffer());
    files[path] = bytes;
    manifest.media.push({ ...meta, path, sha256: await hash(bytes) });
  }
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  if (size + files["manifest.json"].length > MAX)
    throw fail("Workspace backup exceeds the 128 MB safety limit.");
  const bytes = await new Promise((resolve, reject) =>
    zip(files, { level: 0 }, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
  return new Blob([bytes], { type: "application/zip" });
}
export async function importBackup(file) {
  if (file.size > MAX + 1024 * 1024)
    throw fail("Choose a backup ZIP under 129 MB.");
  let size = 0,
    count = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      size += entry.originalSize;
      count++;
      if (size > MAX || count > 2000 || !Number.isFinite(size))
        throw fail("Backup exceeds the uncompressed size or file count limit.");
      if (!/^(manifest\.json|media\/[0-9a-f-]+\.bin)$/.test(entry.name))
        throw fail("Unexpected file in backup.");
      return true;
    },
  });
  if (
    !files["manifest.json"] ||
    files["manifest.json"].length > 32 * 1024 * 1024
  )
    throw fail("Invalid workspace manifest.");
  const m = JSON.parse(strFromU8(files["manifest.json"]));
  if (m.format !== "open-studio-backup" || m.version !== 1)
    throw fail("Choose an Open Studio workspace backup ZIP.");
  for (const name of [
    "projects",
    "videoProjects",
    "assets",
    "versions",
    "media",
  ])
    if (!Array.isArray(m[name]) || m[name].length > 1000)
      throw fail("Invalid backup collection.");
  const records = [],
    keys = new Set(),
    mediaIds = new Set();
  const add = (key, value) => {
    if (keys.has(key)) throw fail("Duplicate backup record.");
    keys.add(key);
    records.push([key, value]);
  };
  for (const item of m.media) {
    if (
      !uuid.test(item.id) ||
      item.path !== `media/${item.id}.bin` ||
      !files[item.path] ||
      !Number.isFinite(item.duration) ||
      item.duration < 0.1 ||
      item.duration > 1800 ||
      !["image", "video", "audio"].includes(item.kind) ||
      typeof item.hasAudio !== "boolean" ||
      typeof item.hasVideo !== "boolean" ||
      typeof item.name !== "string" ||
      item.name.length > 180 ||
      !Number.isInteger(item.width) ||
      !Number.isInteger(item.height) ||
      item.width < 0 ||
      item.height < 0 ||
      item.width > 4096 ||
      item.height > 4096 ||
      !Number.isInteger(item.size) ||
      item.size !== files[item.path].length ||
      item.size > 100 * 1024 * 1024 ||
      typeof item.mime !== "string" ||
      !/^(image\/(png|jpeg|webp)|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|application\/octet-stream)$/.test(
        item.mime,
      )
    )
      throw fail("Invalid or missing media in backup.");
    if ((await hash(files[item.path])) !== item.sha256)
      throw fail(
        "A source file is damaged. Existing workspace has not changed.",
      );
    const { path, sha256, ...meta } = item;
    add("media/" + item.id, {
      ...meta,
      blob: new Blob([files[item.path]], { type: item.mime }),
    });
    mediaIds.add(item.id);
  }
  for (const [collection, prefix] of [
    ["projects", "projects"],
    ["videoProjects", "videoProjects"],
    ["versions", "versions"],
  ]) {
    for (const p of m[collection]) {
      if (
        (collection !== "versions" && !uuid.test(p.id)) ||
        typeof p.title !== "string" ||
        p.title.length > 150 ||
        !Number.isInteger(p.revision) ||
        p.revision < 1 ||
        !Number.isFinite(Date.parse(p.updatedAt))
      )
        throw fail("Invalid project metadata.");
      if (
        p.meta &&
        (typeof p.meta !== "object" ||
          Array.isArray(p.meta) ||
          (p.meta.thumbnail &&
            !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
              p.meta.thumbnail,
            )))
      )
        throw fail("Invalid project preview.");
      if (collection === "videoProjects") {
        p.document = videoDocumentSchema.parse(p.document);
        for (const c of [
          ...p.document.clips,
          ...p.document.overlays,
          ...p.document.audioTracks,
          ...(p.document.soundtrack ? [p.document.soundtrack] : []),
        ])
          if (!mediaIds.has(c.assetId))
            throw fail("A project source is missing from this backup.");
      } else validateImport(p.document);
      if (
        collection === "versions" &&
        (!uuid.test(p.projectId) || !/^\d+$/.test(p.id))
      )
        throw fail("Invalid design history.");
      add(
        collection === "versions"
          ? `versions/${p.projectId}/${p.id}`
          : `${prefix}/${p.id}`,
        p,
      );
    }
  }
  for (const a of m.assets) {
    if (
      !uuid.test(a.id) ||
      typeof a.name !== "string" ||
      typeof a.url !== "string" ||
      a.url.length > 15 * 1024 * 1024 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.url)
    )
      throw fail("Invalid image asset.");
    add("assets/" + a.id, a);
  }
  if (m.preferences) {
    const p = m.preferences;
    if (
      !Array.isArray(p.favorites) ||
      p.favorites.some((v) => typeof v !== "string") ||
      typeof p.workspace !== "string" ||
      p.workspace.length > 80
    )
      throw fail("Invalid workspace preferences.");
    if (
      p.brand &&
      (typeof p.brand.name !== "string" ||
        !Array.isArray(p.brand.colors) ||
        p.brand.colors.some((c) => !/^#[a-f0-9]{6}$/i.test(c)) ||
        !Array.isArray(p.brand.fonts) ||
        p.brand.fonts.some((f) => typeof f !== "string"))
    )
      throw fail("Invalid brand kit.");
    add("preferences", p);
  }
  // Nothing is touched until every entry is validated. This transaction rolls back on quota failure.
  await replaceRecords(records);
}
