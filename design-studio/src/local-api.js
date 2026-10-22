import {
  read,
  list,
  writeMany,
  saveRecord,
  deleteMedia,
  deleteProject,
  fail,
  dataURL,
} from "./local-db";
import { validateImport } from "./design";
import { videoDocumentSchema } from "../shared/video.mjs";
const jobs = new Map(),
  urls = new Map();
const id = () => crypto.randomUUID();
const active = () =>
  [...jobs.values()].some((j) => ["queued", "rendering"].includes(j.status));
window.addEventListener("beforeunload", (e) => {
  if (active()) {
    e.preventDefault();
    e.returnValue = "";
  }
});
const viewJob = (j) => {
  const { controller, document, ...safe } = j;
  return { ...safe };
};
const mediaView = async (m) => {
  if (!urls.has(m.id))
    urls.set(m.id, URL.createObjectURL(new Blob([m.blob], { type: m.mime })));
  const { blob, ...meta } = m;
  return { ...meta, url: urls.get(m.id) };
};
async function need(key) {
  const v = await read(key);
  if (!v) throw fail("Item not found on this device.", 404);
  return v;
}
async function validateSources(doc) {
  for (const c of [
    ...doc.clips,
    ...(doc.overlays || []),
    ...(doc.audioTracks || []),
    ...(doc.soundtrack ? [doc.soundtrack] : []),
  ])
    await need("media/" + c.assetId);
}
export async function localApi(path, options = {}) {
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const method = options.method || "GET",
    parts = path.split("/").filter(Boolean),
    [root, key, third, fourth] = parts;
  const input =
    typeof options.body === "string" ? JSON.parse(options.body) : options.body;
  if (root === "auth") {
    if (key === "me")
      return { user: { id: "local", name: "Local", email: "On this device" } };
    throw fail(
      "Static workspaces have no online accounts. Your work stays in this browser.",
    );
  }
  if (root === "preferences") {
    const prefs = (await read("preferences")) || {
      favorites: [],
      workspace: "On this device",
      brand: null,
    };
    if (method === "PUT") {
      const next = { ...prefs, ...input };
      await writeMany([["preferences", next]]);
      return next;
    }
    return prefs;
  }
  if (root === "projects") {
    if (third === "share")
      throw fail(
        "Public project sharing needs a server. Download a design file or workspace backup instead.",
      );
    if (third === "versions") {
      if (fourth) return need(`versions/${key}/${fourth}`);
      return {
        versions: (await list(`versions/${key}/`)).sort(
          (a, b) => b.revision - a.revision,
        ),
      };
    }
    if (method === "GET")
      return key
        ? { project: await need("projects/" + key) }
        : {
            projects: (await list("projects/")).sort((a, b) =>
              b.updatedAt.localeCompare(a.updatedAt),
            ),
          };
    if (method === "POST" || method === "PUT") {
      if (method === "PUT") await need("projects/" + key);
      if (
        typeof input?.title !== "string" ||
        !input.title.trim() ||
        input.title.length > 150
      )
        throw fail("Use a project title between 1 and 150 characters.");
      validateImport(input.document);
      return { project: await saveRecord("projects", key || id(), input) };
    }
    if (method === "DELETE") {
      await deleteProject("projects", key);
      return null;
    }
  }
  if (root === "assets") {
    if (method === "GET") return { assets: await list("assets/") };
    if (method === "POST") {
      const file = input.get("file");
      if (
        !file ||
        file.size > 10 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      )
        throw fail("Choose a PNG, JPEG or WebP under 10 MB.");
      const bitmap = await createImageBitmap(file),
        width = bitmap.width,
        height = bitmap.height;
      bitmap.close();
      if (width * height > 40000000)
        throw fail("Image dimensions are too large.");
      const asset = {
        id: id(),
        name: file.name.slice(0, 180),
        url: await dataURL(file),
        width,
        height,
        mime: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
      };
      await writeMany([["assets/" + asset.id, asset]]);
      return { asset };
    }
  }
  if (root === "video") {
    if (key === "media") {
      if (method === "GET")
        return {
          media: await Promise.all((await list("media/")).map(mediaView)),
        };
      if (method === "POST") {
        if (active())
          throw fail(
            "Wait for the current browser render or cancel it before importing more media.",
            409,
          );
        const file = input.get("file");
        if (!file || file.size > 100 * 1024 * 1024 || !file.size)
          throw fail("Choose a non-empty file under 100 MB.");
        const existing = await list("media/");
        if (existing.reduce((n, m) => n + m.size, 0) + file.size > 1024 ** 3)
          throw fail(
            "The local library safety limit is 1 GB. Back up and remove unused sources.",
          );
        const { probeMedia } = await import("./browser-media");
        const metadata = await probeMedia(file);
        const media = {
          ...metadata,
          id: id(),
          name: (file.name || "Voice recording").slice(0, 180),
          mime: metadata.mime,
          sourceMime: file.type,
          size: file.size,
          blob: file,
          createdAt: new Date().toISOString(),
        };
        await writeMany([["media/" + media.id, media]]);
        return { media: await mediaView(media) };
      }
      if (method === "DELETE") {
        if (active())
          throw fail("Wait for the render before deleting sources.", 409);
        await deleteMedia(third);
        if (urls.has(third)) {
          URL.revokeObjectURL(urls.get(third));
          urls.delete(third);
        }
        return null;
      }
    }
    if (key === "projects") {
      if (fourth === "render" && method === "POST") {
        if (active())
          throw fail(
            "One browser render at a time. Wait or cancel the current export.",
            409,
          );
        const project = await need("videoProjects/" + third);
        if (project.revision !== input.revision)
          throw fail("The saved project changed. Save and retry.", 409);
        const media = await list("media/"),
          { renderVideo, validateRender } = await import("./browser-media");
        const document = validateRender(project.document, media);
        const job = {
          id: id(),
          projectId: third,
          title: project.title,
          status: "queued",
          progress: 0,
          createdAt: new Date().toISOString(),
          controller: new AbortController(),
          document,
        };
        jobs.set(job.id, job);
        const timeout = setTimeout(() => job.controller.abort(), 600000);
        Promise.resolve()
          .then(async () => {
            job.status = "rendering";
            job.progress = 1;
            const blob = await renderVideo(document, media, {
              signal: job.controller.signal,
              progress: (p) => {
                job.progress = Math.max(job.progress, p);
              },
            });
            if (job.controller.signal.aborted)
              throw new DOMException("Cancelled", "AbortError");
            job.downloadUrl = URL.createObjectURL(blob);
            job.size = blob.size;
            job.status = "completed";
            job.progress = 100;
            const finished = [...jobs.values()].filter(
              (j) => j.status === "completed",
            );
            let retained = finished.reduce((n, j) => n + j.size, 0);
            while (
              finished.length > 1 &&
              (finished.length > 5 || retained > 128 * 1024 * 1024)
            ) {
              const old = finished.shift();
              retained -= old.size;
              URL.revokeObjectURL(old.downloadUrl);
              jobs.delete(old.id);
            }
          })
          .catch((e) => {
            job.status = e.name === "AbortError" ? "cancelled" : "failed";
            job.error =
              e.name === "AbortError"
                ? "Export cancelled or reached its 10-minute time budget."
                : e.message;
          })
          .finally(() => clearTimeout(timeout));
        return { job: viewJob(job) };
      }
      if (method === "GET")
        return third
          ? { project: await need("videoProjects/" + third) }
          : {
              projects: (await list("videoProjects/")).sort((a, b) =>
                b.updatedAt.localeCompare(a.updatedAt),
              ),
            };
      if (method === "POST" || method === "PUT") {
        if (
          typeof input?.title !== "string" ||
          !input.title.trim() ||
          input.title.length > 150
        )
          throw fail("Use a project title between 1 and 150 characters.");
        const document = videoDocumentSchema.parse(input.document);
        await validateSources(document);
        if (method === "PUT") await need("videoProjects/" + third);
        return {
          project: await saveRecord("videoProjects", third || id(), {
            ...input,
            document,
          }),
        };
      }
      if (method === "DELETE") {
        if (
          [...jobs.values()].some(
            (j) =>
              j.projectId === third &&
              ["queued", "rendering"].includes(j.status),
          )
        )
          throw fail("Cancel the active export first.", 409);
        await deleteProject("videoProjects", third);
        return null;
      }
    }
    if (key === "jobs") {
      if (third) {
        const job = jobs.get(third);
        if (!job)
          throw fail(
            "Exports only last for this tab session. Render again.",
            404,
          );
        if (fourth === "cancel" && method === "POST") {
          job.controller.abort();
          return { job: viewJob(job) };
        }
        return { job: viewJob(job) };
      }
      return { jobs: [...jobs.values()].reverse().map(viewJob) };
    }
  }
  throw fail(
    "This action needs a server and is not available in the local edition.",
    400,
  );
}
