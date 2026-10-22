import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import {
  videoProjectSchema,
  duration,
  clipDuration,
} from "../shared/video.mjs";
import {
  tools,
  runMedia,
  inspectMedia,
  allowedFormats,
} from "./media-process.mjs";

const error = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const filterPath = (value) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "'\\''");
export function installVideo({ app, db, auth, dataDir }) {
  const root = path.resolve(dataDir, "video");
  for (const dir of ["media", "incoming", "work", "exports"])
    fs.mkdirSync(path.join(root, dir), { recursive: true, mode: 0o700 });
  db.exec(`CREATE TABLE IF NOT EXISTS video_media(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,metadata TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS video_projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,document TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS video_jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,project_id TEXT NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,title TEXT NOT NULL,document TEXT NOT NULL,status TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,error TEXT,created TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS video_projects_owner ON video_projects(user_id,updated);`);
  // Exclusive storage ownership: never reap another live server's work directory.
  // A stale marker requires operator recovery; PID reuse is not proof of ownership.
  const lockFile = path.join(root, "server.lock"),
    identity = JSON.stringify({
      instance: randomUUID(),
      pid: process.pid,
      started: new Date().toISOString(),
    });
  let lock;
  try {
    lock = fs.openSync(lockFile, "wx", 0o600);
    fs.writeFileSync(lock, identity);
  } catch (e) {
    if (e.code === "EEXIST")
      throw new Error(
        "Video storage is already locked. Run only one server per DATA_DIR. After an unclean stop, verify the old server and its media processes are stopped before removing " +
          lockFile,
      );
    throw e;
  }
  // Never silently resume a half-written encode after a process restart.
  db.prepare(
    "UPDATE video_jobs SET status='failed',error='Server restarted before this render completed' WHERE status IN('queued','rendering')",
  ).run();
  for (const name of fs.readdirSync(path.join(root, "work")))
    fs.rmSync(path.join(root, "work", name), { recursive: true, force: true });
  for (const name of fs.readdirSync(path.join(root, "incoming")))
    fs.rmSync(path.join(root, "incoming", name), { force: true });
  let closing = false,
    active = null;
  const queue = [],
    uploads = new Set(),
    incoming = new Map();
  const mediaFile = (id) => path.join(root, "media", id);
  const getMedia = (id, user) =>
    db
      .prepare("SELECT * FROM video_media WHERE id=? AND user_id=?")
      .get(id, user);
  const serializeMedia = (m) => ({
    id: m.id,
    name: m.name,
    mime: m.mime,
    size: m.size,
    ...JSON.parse(m.metadata),
    url: `/api/video/media/${m.id}/file`,
    created: m.created,
  });
  const serializeProject = (p) => ({
    id: p.id,
    title: p.title,
    document: JSON.parse(p.document),
    revision: p.revision,
    updatedAt: p.updated,
  });
  const serializeJob = (j) => ({
    id: j.id,
    projectId: j.project_id,
    title: j.title,
    status: j.status,
    progress: j.progress,
    error: j.error,
    created: j.created,
    downloadUrl:
      j.status === "completed" ? `/api/video/jobs/${j.id}/download` : null,
  });
  const ownProject = (req, res, next) => {
    req.videoProject = db
      .prepare("SELECT * FROM video_projects WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (!req.videoProject)
      return res.status(404).json({ error: "Video project not found" });
    next();
  };
  const ensureMedia = (document, user) => {
    for (const clip of document.clips) {
      const media = getMedia(clip.assetId, user);
      if (!media) throw error("A clip is missing from your media library");
      const info = JSON.parse(media.metadata);
      if (!info.hasVideo) throw error("Timeline clips must contain video");
      if (clip.out > info.duration + 0.02)
        throw error("Clip trim exceeds the original video duration");
    }
    if (document.soundtrack) {
      const m = getMedia(document.soundtrack.assetId, user);
      if (!m) throw error("Soundtrack is missing from your library");
      const info = JSON.parse(m.metadata);
      if (!info.hasAudio) throw error("This file does not have an audio track");
      if (document.soundtrack.offset >= info.duration)
        throw error("Soundtrack offset exceeds its duration");
    }
  };
  const updateJob = (id, status, progress, message = null) =>
    db
      .prepare("UPDATE video_jobs SET status=?,progress=?,error=? WHERE id=?")
      .run(status, Math.round(progress), message, id);
  const ffargs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-threads",
    "2",
    "-filter_complex_threads",
    "1",
  ];
  const inputArgs = [
    "-protocol_whitelist",
    "file,pipe",
    "-format_whitelist",
    allowedFormats,
  ];
  const encoding = [
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-maxrate",
    "6M",
    "-bufsize",
    "12M",
    "-threads",
    "2",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
  ];
  async function render(job, signal) {
    const document = JSON.parse(job.document),
      total = duration(document),
      work = path.join(root, "work", job.id);
    fs.mkdirSync(work, { mode: 0o700 });
    const run = (args, base, span, length) =>
      runMedia(
        tools.ffmpeg,
        [...ffargs, ...args, "-progress", "pipe:1", "-nostats"],
        {
          signal,
          duration: length,
          onProgress: (progress) =>
            updateJob(job.id, "rendering", base + progress * span),
        },
      );
    const check = () => {
      if (signal.aborted)
        throw Object.assign(new Error("Render cancelled"), {
          name: "AbortError",
        });
    };
    try {
      const segments = [];
      let elapsed = 0;
      for (let i = 0; i < document.clips.length; i++) {
        check();
        const clip = document.clips[i],
          info = JSON.parse(getMedia(clip.assetId, job.user_id).metadata),
          length = clipDuration(clip),
          fade = Math.min(clip.fade, length / 2),
          output = path.join(work, `segment-${i}.mp4`);
        const scale =
          clip.fit === "cover"
            ? `scale=${document.width}:${document.height}:force_original_aspect_ratio=increase,crop=${document.width}:${document.height}`
            : `scale=${document.width}:${document.height}:force_original_aspect_ratio=decrease,pad=${document.width}:${document.height}:(ow-iw)/2:(oh-ih)/2:black`;
        const video = `[0:v:0]setpts=(PTS-STARTPTS)/${clip.speed},${scale},setsar=1,fps=${document.fps},format=yuv420p${fade ? `,fade=t=in:st=0:d=${fade},fade=t=out:st=${Math.max(0, length - fade)}:d=${fade}` : ""}[v]`;
        const audio = `[${info.hasAudio ? "0" : "1"}:a:0]asetpts=PTS-STARTPTS,atempo=${clip.speed},aresample=48000,aformat=channel_layouts=stereo,volume=${clip.volume}${fade ? `,afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, length - fade)}:d=${fade}` : ""}[a]`;
        const args = [
          ...inputArgs,
          "-ss",
          String(clip.in),
          "-t",
          String(clip.out - clip.in),
          "-i",
          mediaFile(clip.assetId),
          ...(!info.hasAudio
            ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
            : []),
          "-filter_complex",
          video + ";" + audio,
          "-map",
          "[v]",
          "-map",
          "[a]",
          "-t",
          String(length),
          ...encoding,
          output,
        ];
        await run(args, (elapsed / total) * 65, (length / total) * 65, length);
        segments.push(output);
        elapsed += length;
      }
      check();
      const list = path.join(work, "segments.txt");
      fs.writeFileSync(
        list,
        segments
          .map((file) => `file '${file.replaceAll("'", "'\\''")}'`)
          .join("\n"),
      );
      const combined = path.join(work, "combined.mp4");
      await run(
        ["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", combined],
        65,
        5,
        total,
      );
      check();
      const filters = [],
        captions = document.captions.filter((c) => c.start < total);
      for (let i = 0; i < captions.length; i++) {
        const c = captions[i],
          file = path.join(work, `caption-${i}.txt`);
        fs.writeFileSync(file, c.text, "utf8");
        const y =
          c.position === "top"
            ? "h*0.08"
            : c.position === "center"
              ? "(h-text_h)/2"
              : "h-text_h-h*0.08";
        filters.push(
          `drawtext=fontfile='${filterPath(path.resolve(fs.existsSync("public/fonts/DMSans.ttf") ? "public/fonts/DMSans.ttf" : "dist/fonts/DMSans.ttf"))}':textfile='${filterPath(file)}':expansion=none:fontsize=${c.size}:fontcolor=${c.color.replace("#", "0x")}:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.35:boxborderw=10:enable='between(t,${c.start},${Math.min(c.end, total)})'`,
        );
      }
      const output = path.join(work, "output.mp4"),
        sound = document.soundtrack;
      const audio = sound
        ? `[0:a:0]volume=1[original];[1:a:0]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${sound.volume},afade=t=out:st=${Math.max(0, total - 0.5)}:d=0.5[music];[original][music]amix=inputs=2:duration=first:dropout_transition=0[a]`
        : "";
      const video = filters.length ? `[0:v:0]${filters.join(",")}[v]` : "";
      await run(
        [
          "-i",
          combined,
          ...(sound
            ? [
                ...inputArgs,
                "-stream_loop",
                "-1",
                "-ss",
                String(sound.offset),
                "-i",
                mediaFile(sound.assetId),
              ]
            : []),
          ...(video || audio
            ? ["-filter_complex", [video, audio].filter(Boolean).join(";")]
            : []),
          "-map",
          video ? "[v]" : "0:v:0",
          "-map",
          sound ? "[a]" : "0:a:0",
          "-t",
          String(total),
          ...encoding,
          output,
        ],
        70,
        29,
        total,
      );
      check();
      const result = await inspectMedia(output, { signal });
      if (
        Math.abs(result.duration - total) > 0.5 ||
        !result.hasVideo ||
        !result.hasAudio
      )
        throw new Error(
          "Output validation failed. Please retry with different clips.",
        );
      fs.renameSync(output, path.join(root, "exports", job.id + ".mp4"));
      updateJob(job.id, "completed", 100);
      // Retain a bounded set of ready exports; source projects and media are untouched.
      const old = db
        .prepare(
          "SELECT id FROM video_jobs WHERE user_id=? AND status='completed' ORDER BY created DESC LIMIT -1 OFFSET 5",
        )
        .all(job.user_id);
      for (const j of old) {
        fs.rmSync(path.join(root, "exports", j.id + ".mp4"), { force: true });
        db.prepare("DELETE FROM video_jobs WHERE id=?").run(j.id);
      }
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
  function pump() {
    if (active || closing || !queue.length) return;
    const item = queue.shift();
    const job = db.prepare("SELECT * FROM video_jobs WHERE id=?").get(item.id);
    if (!job || job.status !== "queued") {
      pump();
      return;
    }
    updateJob(job.id, "rendering", 0);
    const controller = new AbortController();
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 600000);
    deadline.unref();
    const promise = render(job, controller.signal)
      .catch((e) => {
        updateJob(
          job.id,
          e.name === "AbortError" && !timedOut ? "cancelled" : "failed",
          0,
          timedOut
            ? "Render exceeded 10 minutes. Try a shorter or lower-resolution montage."
            : e.name === "AbortError"
              ? "Render cancelled"
              : e.message,
        );
      })
      .finally(() => {
        clearTimeout(deadline);
        active = null;
        pump();
      });
    active = { id: job.id, controller, promise };
  }
  const fileUpload = multer({
    storage: multer.diskStorage({
      destination: path.join(root, "incoming"),
      filename: (req, file, cb) => cb(null, randomUUID()),
    }),
    limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  }).single("file");
  app.post(
    "/api/video/media",
    auth,
    (req, res, next) => {
      if (closing)
        return res.status(503).json({ error: "Server is shutting down" });
      const pending = [...incoming.values()];
      if (
        pending.length >= 4 ||
        pending.filter((user) => user === req.user.id).length >= 2
      )
        return res.status(429).json({
          error:
            "Too many uploads in progress. Wait for the current files to finish.",
        });
      const reservation = randomUUID();
      incoming.set(reservation, req.user.id);
      const release = () => incoming.delete(reservation);
      res.once("finish", release);
      res.once("close", release);
      fileUpload(req, res, (error) => {
        if (error)
          return next(
            Object.assign(
              new Error(
                error.code === "LIMIT_FILE_SIZE"
                  ? "Media files must be under 100 MB"
                  : error.message,
              ),
              { status: 400 },
            ),
          );
        next();
      });
    },
    async (req, res) => {
      if (!req.file) throw error("Choose a video or audio file");
      if (closing || uploads.size >= 4) {
        fs.rmSync(req.file.path, { force: true });
        throw error(
          closing
            ? "Server is shutting down"
            : "Media analysis is busy. Retry shortly.",
          503,
        );
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      req.once("aborted", abort);
      const disconnected = () => {
        if (!res.writableFinished) controller.abort();
      };
      res.once("close", disconnected);
      let task;
      task = (async () => {
        try {
          const used = db
            .prepare(
              "SELECT COALESCE(SUM(size),0) AS bytes FROM video_media WHERE user_id=?",
            )
            .get(req.user.id).bytes;
          if (used + req.file.size > 1024 * 1024 * 1024)
            throw error(
              "Your media library has reached its 1 GB safety limit. Delete unused media first.",
              413,
            );
          let metadata;
          try {
            metadata = await inspectMedia(req.file.path, {
              signal: controller.signal,
            });
          } catch (e) {
            throw error(e.message);
          }
          // Recheck after async probing so concurrent uploads cannot bypass the quota.
          const latestBytes = db
            .prepare(
              "SELECT COALESCE(SUM(size),0) AS bytes FROM video_media WHERE user_id=?",
            )
            .get(req.user.id).bytes;
          if (latestBytes + req.file.size > 1024 * 1024 * 1024)
            throw error(
              "Your media library has reached its 1 GB safety limit. Delete unused media first.",
              413,
            );
          if (controller.signal.aborted) throw error("Upload cancelled");
          const id = randomUUID(),
            mime = metadata.hasVideo
              ? metadata.format.includes("matroska") ||
                metadata.format.includes("webm")
                ? "video/webm"
                : "video/mp4"
              : metadata.format.includes("wav")
                ? "audio/wav"
                : metadata.format.includes("ogg")
                  ? "audio/ogg"
                  : metadata.format.includes("flac")
                    ? "audio/flac"
                    : metadata.format.includes("aac")
                      ? "audio/aac"
                      : metadata.format.includes("mov")
                        ? "audio/mp4"
                        : "audio/mpeg";
          fs.renameSync(req.file.path, mediaFile(id));
          try {
            db.prepare("INSERT INTO video_media VALUES(?,?,?,?,?,?,?)").run(
              id,
              req.user.id,
              path.basename(req.file.originalname).slice(0, 180),
              mime,
              req.file.size,
              JSON.stringify(metadata),
              new Date().toISOString(),
            );
          } catch (e) {
            fs.rmSync(mediaFile(id), { force: true });
            throw e;
          }
          res
            .status(201)
            .json({ media: serializeMedia(getMedia(id, req.user.id)) });
        } finally {
          req.removeListener("aborted", abort);
          res.removeListener("close", disconnected);
          fs.rmSync(req.file.path, { force: true });
        }
      })();
      uploads.add({ controller, task });
      try {
        await task;
      } finally {
        for (const u of uploads) if (u.task === task) uploads.delete(u);
      }
    },
  );
  app.get("/api/video/media", auth, (req, res) =>
    res.json({
      media: db
        .prepare(
          "SELECT * FROM video_media WHERE user_id=? ORDER BY created DESC",
        )
        .all(req.user.id)
        .map(serializeMedia),
    }),
  );
  app.get("/api/video/media/:id/file", auth, (req, res) => {
    const m = getMedia(req.params.id, req.user.id);
    if (!m) return res.status(404).json({ error: "Media not found" });
    res.type(m.mime);
    res.sendFile(mediaFile(m.id));
  });
  app.delete("/api/video/media/:id", auth, (req, res) => {
    const m = getMedia(req.params.id, req.user.id);
    if (!m) return res.status(404).json({ error: "Media not found" });
    const documents = db
      .prepare(
        "SELECT document FROM video_projects WHERE user_id=? UNION ALL SELECT document FROM video_jobs WHERE user_id=? AND status IN('queued','rendering')",
      )
      .all(req.user.id, req.user.id);
    if (documents.some((p) => p.document.includes(m.id)))
      return res.status(409).json({
        error: "Remove this media from saved projects and active renders first",
      });
    fs.rmSync(mediaFile(m.id), { force: true });
    db.prepare("DELETE FROM video_media WHERE id=?").run(m.id);
    res.status(204).end();
  });
  app.get("/api/video/projects", auth, (req, res) =>
    res.json({
      projects: db
        .prepare(
          "SELECT * FROM video_projects WHERE user_id=? ORDER BY updated DESC",
        )
        .all(req.user.id)
        .map(serializeProject),
    }),
  );
  app.post("/api/video/projects", auth, (req, res) => {
    const input = videoProjectSchema.parse(req.body);
    ensureMedia(input.document, req.user.id);
    const id = randomUUID();
    db.prepare("INSERT INTO video_projects VALUES(?,?,?,?,?,?)").run(
      id,
      req.user.id,
      input.title,
      JSON.stringify(input.document),
      1,
      new Date().toISOString(),
    );
    res.status(201).json({
      project: serializeProject(
        db.prepare("SELECT * FROM video_projects WHERE id=?").get(id),
      ),
    });
  });
  app.get("/api/video/projects/:id", auth, ownProject, (req, res) =>
    res.json({ project: serializeProject(req.videoProject) }),
  );
  app.put("/api/video/projects/:id", auth, ownProject, (req, res) => {
    const input = videoProjectSchema
      .extend({ revision: z.number().int().min(1) })
      .parse(req.body);
    ensureMedia(input.document, req.user.id);
    if (req.videoProject.revision !== input.revision)
      return res.status(409).json({
        error: "This video was edited in another tab. Reopen it before saving.",
      });
    db.prepare(
      "UPDATE video_projects SET title=?,document=?,revision=revision+1,updated=? WHERE id=? AND user_id=?",
    ).run(
      input.title,
      JSON.stringify(input.document),
      new Date().toISOString(),
      req.videoProject.id,
      req.user.id,
    );
    res.json({
      project: serializeProject(
        db
          .prepare("SELECT * FROM video_projects WHERE id=?")
          .get(req.videoProject.id),
      ),
    });
  });
  app.delete("/api/video/projects/:id", auth, ownProject, (req, res) => {
    const jobs = db
      .prepare("SELECT * FROM video_jobs WHERE project_id=?")
      .all(req.videoProject.id);
    if (jobs.some((j) => ["queued", "rendering"].includes(j.status)))
      return res.status(409).json({
        error: "Cancel the active render before deleting this project",
      });
    for (const j of jobs)
      fs.rmSync(path.join(root, "exports", j.id + ".mp4"), { force: true });
    db.prepare("DELETE FROM video_projects WHERE id=? AND user_id=?").run(
      req.videoProject.id,
      req.user.id,
    );
    res.status(204).end();
  });
  app.get("/api/video/jobs", auth, (req, res) =>
    res.json({
      jobs: db
        .prepare(
          "SELECT * FROM video_jobs WHERE user_id=? ORDER BY created DESC LIMIT 20",
        )
        .all(req.user.id)
        .map(serializeJob),
    }),
  );
  app.post("/api/video/projects/:id/render", auth, ownProject, (req, res) => {
    if (closing)
      return res.status(503).json({ error: "Server is shutting down" });
    const input = z
      .object({ revision: z.number().int().min(1).optional() })
      .parse(req.body || {});
    if (
      input.revision !== undefined &&
      input.revision !== req.videoProject.revision
    )
      return res.status(409).json({
        error:
          "The saved video changed before rendering. Save your edits and retry.",
      });
    const doc = videoProjectSchema.shape.document.parse(
      JSON.parse(req.videoProject.document),
    );
    ensureMedia(doc, req.user.id);
    if (!doc.clips.length)
      throw error("Add at least one video clip to your timeline");
    if (
      db
        .prepare(
          "SELECT id FROM video_jobs WHERE user_id=? AND status IN('queued','rendering')",
        )
        .get(req.user.id)
    )
      return res.status(409).json({
        error: "You already have a render running. Wait for it or cancel it.",
      });
    if (queue.length >= 10)
      throw error("Render queue is busy. Please retry shortly.", 503);
    const id = randomUUID();
    db.prepare("INSERT INTO video_jobs VALUES(?,?,?,?,?,?,?,?,?)").run(
      id,
      req.user.id,
      req.videoProject.id,
      req.videoProject.title,
      req.videoProject.document,
      "queued",
      0,
      null,
      new Date().toISOString(),
    );
    queue.push({ id });
    const job = serializeJob(
      db.prepare("SELECT * FROM video_jobs WHERE id=?").get(id),
    );
    res.status(202).json({ job });
    pump();
  });
  app.get("/api/video/jobs/:id", auth, (req, res) => {
    const job = db
      .prepare("SELECT * FROM video_jobs WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (!job) return res.status(404).json({ error: "Render not found" });
    res.json({ job: serializeJob(job) });
  });
  app.post("/api/video/jobs/:id/cancel", auth, (req, res) => {
    const job = db
      .prepare("SELECT * FROM video_jobs WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (!job) return res.status(404).json({ error: "Render not found" });
    if (job.status === "queued") {
      updateJob(job.id, "cancelled", 0, "Render cancelled");
      const index = queue.findIndex((item) => item.id === job.id);
      if (index >= 0) queue.splice(index, 1);
    } else if (job.status === "rendering" && active?.id === job.id)
      active.controller.abort();
    res.json({ ok: true });
  });
  app.get("/api/video/jobs/:id/download", auth, (req, res) => {
    const job = db
      .prepare("SELECT * FROM video_jobs WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (!job) return res.status(404).json({ error: "Render not found" });
    if (job.status !== "completed")
      return res.status(409).json({ error: "This render is not ready" });
    const file = path.join(root, "exports", job.id + ".mp4");
    if (!fs.existsSync(file))
      return res.status(410).json({
        error: "Export file is no longer available. Render the project again.",
      });
    res.download(file, job.title.replace(/[\\/:*?"<>|\r\n]/g, "-") + ".mp4");
  });
  return {
    close: async () => {
      closing = true;
      for (const item of queue)
        updateJob(item.id, "cancelled", 0, "Server stopped");
      queue.length = 0;
      active?.controller.abort();
      for (const u of uploads) u.controller.abort();
      await Promise.allSettled([
        ...(active ? [active.promise] : []),
        ...[...uploads].map((u) => u.task),
      ]);
      fs.closeSync(lock);
      if (
        fs.existsSync(lockFile) &&
        fs.readFileSync(lockFile, "utf8") === identity
      )
        fs.unlinkSync(lockFile);
    },
  };
}
