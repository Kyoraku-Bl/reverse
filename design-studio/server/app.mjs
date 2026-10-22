import express from "express";
import helmet from "helmet";
import multer from "multer";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { imageSize } from "image-size";
import { validateCanvasTree } from "../shared/design-validation.mjs";
import { installVideo } from "./video.mjs";

const scrypt = promisify(scryptCallback);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const accountSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10).max(128),
  name: z.string().trim().min(1).max(60).optional(),
});
const dimensions = z.number().int().min(64).max(4096);
const pageSchema = z.object({
  id: z.string().min(1).max(100),
  canvas: z
    .object({ objects: z.array(z.record(z.string(), z.unknown())).max(300) })
    .passthrough(),
});
const documentSchema = z.object({
  version: z.literal(1),
  width: dimensions,
  height: dimensions,
  pages: z.array(pageSchema).min(1).max(50),
});
const projectSchema = z.object({
  title: z.string().trim().min(1).max(150),
  document: documentSchema,
  meta: z
    .object({
      style: z.string().max(20).optional(),
      text: z.string().max(2000).optional(),
      sub: z.string().max(2000).optional(),
      color: z.string().max(30).optional(),
      thumbnail: z
        .string()
        .max(300000)
        .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
        .optional(),
      type: z.string().max(60).optional(),
      detail: z.string().max(100).optional(),
    })
    .default({}),
  revision: z.number().int().min(1).optional(),
});
const brandSchema = z.object({
  name: z.string().trim().min(1).max(80),
  colors: z
    .array(z.string().regex(/^#[0-9a-f]{6}$/i))
    .min(1)
    .max(12),
  fonts: z
    .array(z.enum(["DM Sans", "Manrope", "Georgia", "Arial", "monospace"]))
    .max(5),
});
export function createApp({
  dataDir = process.env.DATA_DIR || path.resolve("data"),
  secureCookies = process.env.COOKIE_SECURE === "true",
  serveFrontend = true,
  arenaPreview = process.env.ARENA_PREVIEW === "true",
  publicOrigin = process.env.PUBLIC_ORIGIN || "",
} = {}) {
  fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, "studio.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,document TEXT NOT NULL,meta TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS projects_owner ON projects(user_id,updated);
 CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,revision INTEGER NOT NULL,document TEXT NOT NULL,title TEXT NOT NULL,meta TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS shares(token TEXT PRIMARY KEY,project_id TEXT UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS preferences(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,favorites TEXT NOT NULL DEFAULT '[]',workspace TEXT NOT NULL DEFAULT 'Personal',brand TEXT);
 `);
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
  app.use(
    helmet({
      xFrameOptions: arenaPreview ? false : { action: "sameorigin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          frameAncestors: arenaPreview
            ? [
                "'self'",
                "https://arena.ai",
                "https://*.arena.ai",
                "https://*.e2b.app",
              ]
            : ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          mediaSrc: ["'self'", "blob:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginResourcePolicy: { policy: "same-origin" },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if (origin) {
        try {
          if (
            new URL(origin).host !== req.get("host") &&
            origin !== publicOrigin
          )
            return res
              .status(403)
              .json({ error: "Cross-origin requests are not allowed" });
        } catch {
          return res.status(403).json({ error: "Invalid origin" });
        }
      }
      if (req.get("sec-fetch-site") === "cross-site")
        return res
          .status(403)
          .json({ error: "Cross-site requests are not allowed" });
    }
    next();
  });
  app.use(express.json({ limit: "5mb", type: "application/json" }));
  const getCookie = (req) => {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("studio_session="));
    return cookie?.slice("studio_session=".length);
  };
  app.use("/api", (req, res, next) => {
    const token = getCookie(req);
    if (token && /^[a-f0-9]{64}$/.test(token))
      req.user = db
        .prepare(
          "SELECT users.id,users.email,users.name FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?",
        )
        .get(hash(token), Date.now());
    next();
  });
  const auth = (req, res, next) =>
    req.user ? next() : res.status(401).json({ error: "Sign in to continue" });
  const owned = (req, res, next) => {
    req.project = db
      .prepare("SELECT * FROM projects WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (!req.project)
      return res.status(404).json({ error: "Project not found" });
    next();
  };
  const publicUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  });
  const serialize = (p) => ({
    id: p.id,
    title: p.title,
    document: JSON.parse(p.document),
    meta: JSON.parse(p.meta),
    revision: p.revision,
    updatedAt: p.updated,
  });
  const sessionCookie = {
    httpOnly: true,
    sameSite: arenaPreview ? "none" : "strict",
    secure: arenaPreview || secureCookies,
    ...(arenaPreview ? { partitioned: true } : {}),
    path: "/",
  };
  const setSession = (res, userId) => {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(token),
      userId,
      Date.now() + 30 * 24 * 3600 * 1000,
    );
    res.cookie("studio_session", token, {
      ...sessionCookie,
      maxAge: 30 * 24 * 3600 * 1000,
    });
  };
  const rates = new Map();
  const rate = (req, res, next) => {
    const now = Date.now();
    for (const [k, v] of rates) if (v.until < now) rates.delete(k);
    const key = req.ip;
    const entry = rates.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    entry.count++;
    rates.set(key, entry);
    if (entry.count > 30)
      return res
        .status(429)
        .json({ error: "Too many attempts. Try again in 15 minutes." });
    next();
  };
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.post("/api/auth/register", rate, async (req, res) => {
    const input = accountSchema
      .extend({ name: z.string().trim().min(1).max(60) })
      .parse(req.body);
    if (db.prepare("SELECT id FROM users WHERE email=?").get(input.email))
      return res
        .status(409)
        .json({ error: "This email is already registered" });
    const salt = randomBytes(16).toString("hex");
    const password = Buffer.from(
      await scrypt(input.password, salt, 64),
    ).toString("hex");
    // A second registration can finish hashing first. The unique constraint remains authoritative.
    const user = { id: randomUUID(), email: input.email, name: input.name };
    try {
      db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(
        user.id,
        user.email,
        user.name,
        password,
        salt,
        new Date().toISOString(),
      );
    } catch (error) {
      if (error.code?.includes("CONSTRAINT") || error.errcode === 2067)
        return res
          .status(409)
          .json({ error: "This email is already registered" });
      throw error;
    }
    db.prepare("INSERT INTO preferences(user_id) VALUES(?)").run(user.id);
    setSession(res, user.id);
    res.status(201).json({ user });
  });
  app.post("/api/auth/login", rate, async (req, res) => {
    const input = accountSchema.parse(req.body);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(input.email);
    const derived = await scrypt(
      input.password,
      user?.salt || "invalid-account-salt",
      64,
    );
    if (!user || !timingSafeEqual(Buffer.from(user.password, "hex"), derived))
      return res.status(401).json({ error: "Email or password is incorrect" });
    setSession(res, user.id);
    res.json({ user: publicUser(user) });
  });
  app.get("/api/auth/me", auth, (req, res) =>
    res.json({ user: publicUser(req.user) }),
  );
  app.post("/api/auth/logout", (req, res) => {
    const token = getCookie(req);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token=?").run(hash(token));
    res.clearCookie("studio_session", sessionCookie);
    res.status(204).end();
  });
  app.get("/api/projects", auth, (req, res) =>
    res.json({
      projects: db
        .prepare("SELECT * FROM projects WHERE user_id=? ORDER BY updated DESC")
        .all(req.user.id)
        .map(serialize),
    }),
  );
  const validateDocument = (document, userId) => {
    validateCanvasTree(document);
    const ids = new Set(
      [
        ...JSON.stringify(document).matchAll(
          /\/api\/assets\/([a-f0-9-]+)\/file/g,
        ),
      ].map((m) => m[1]),
    );
    for (const id of ids)
      if (
        !db
          .prepare("SELECT id FROM assets WHERE id=? AND user_id=?")
          .get(id, userId)
      )
        throw Object.assign(
          new Error("An image in this design is not owned by this account"),
          { status: 400 },
        );
  };
  app.post("/api/projects", auth, (req, res) => {
    const input = projectSchema.parse(req.body);
    validateDocument(input.document, req.user.id);
    const id = randomUUID();
    db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?,?)").run(
      id,
      req.user.id,
      input.title,
      JSON.stringify(input.document),
      JSON.stringify(input.meta),
      1,
      new Date().toISOString(),
    );
    res.status(201).json({
      project: serialize(
        db.prepare("SELECT * FROM projects WHERE id=?").get(id),
      ),
    });
  });
  app.get("/api/projects/:id", auth, owned, (req, res) =>
    res.json({ project: serialize(req.project) }),
  );
  app.put("/api/projects/:id", auth, owned, (req, res) => {
    const input = projectSchema
      .extend({ revision: z.number().int().min(1) })
      .parse(req.body);
    validateDocument(input.document, req.user.id);
    if (input.revision !== req.project.revision)
      return res.status(409).json({
        error:
          "This design was changed in another tab. Reopen it before saving.",
      });
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("INSERT INTO versions VALUES(?,?,?,?,?,?,?)").run(
        randomUUID(),
        req.project.id,
        req.project.revision,
        req.project.document,
        req.project.title,
        req.project.meta,
        req.project.updated,
      );
      db.prepare(
        "UPDATE projects SET title=?,document=?,meta=?,revision=revision+1,updated=? WHERE id=? AND user_id=?",
      ).run(
        input.title,
        JSON.stringify(input.document),
        JSON.stringify(input.meta),
        new Date().toISOString(),
        req.project.id,
        req.user.id,
      );
      db.prepare(
        "DELETE FROM versions WHERE project_id=? AND id NOT IN(SELECT id FROM versions WHERE project_id=? ORDER BY revision DESC LIMIT 30)",
      ).run(req.project.id, req.project.id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    res.json({
      project: serialize(
        db.prepare("SELECT * FROM projects WHERE id=?").get(req.project.id),
      ),
    });
  });
  app.delete("/api/projects/:id", auth, owned, (req, res) => {
    db.prepare("DELETE FROM projects WHERE id=? AND user_id=?").run(
      req.project.id,
      req.user.id,
    );
    res.status(204).end();
  });
  app.get("/api/projects/:id/versions", auth, owned, (req, res) =>
    res.json({
      versions: db
        .prepare(
          "SELECT id,revision,title,created FROM versions WHERE project_id=? ORDER BY revision DESC",
        )
        .all(req.project.id),
    }),
  );
  app.get("/api/projects/:id/versions/:version", auth, owned, (req, res) => {
    const v = db
      .prepare("SELECT * FROM versions WHERE id=? AND project_id=?")
      .get(req.params.version, req.project.id);
    if (!v) return res.status(404).json({ error: "Version not found" });
    res.json({
      document: JSON.parse(v.document),
      title: v.title,
      meta: JSON.parse(v.meta),
    });
  });
  app.post("/api/projects/:id/share", auth, owned, (req, res) => {
    let share = db
      .prepare("SELECT token FROM shares WHERE project_id=?")
      .get(req.project.id);
    if (!share) {
      share = { token: randomBytes(24).toString("hex") };
      db.prepare("INSERT INTO shares VALUES(?,?,?)").run(
        share.token,
        req.project.id,
        new Date().toISOString(),
      );
    }
    res.json({ token: share.token });
  });
  app.delete("/api/projects/:id/share", auth, owned, (req, res) => {
    db.prepare("DELETE FROM shares WHERE project_id=?").run(req.project.id);
    res.status(204).end();
  });
  app.get("/api/shared/:token", (req, res) => {
    const p = db
      .prepare(
        "SELECT projects.* FROM shares JOIN projects ON projects.id=shares.project_id WHERE shares.token=?",
      )
      .get(req.params.token);
    if (!p)
      return res
        .status(404)
        .json({ error: "This shared link is no longer available" });
    const project = serialize(p);
    const encoded = JSON.stringify(project.document).replace(
      /\/api\/assets\/([a-f0-9-]+)\/file/g,
      `/api/assets/$1/file?share=${encodeURIComponent(req.params.token)}`,
    );
    res.json({
      project: { title: project.title, document: JSON.parse(encoded) },
    });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  app.post("/api/assets", auth, upload.single("file"), (req, res) => {
    if (!req.file)
      return res.status(400).json({ error: "Choose an image to upload" });
    const b = req.file.buffer;
    let mime;
    if (
      b.length > 8 &&
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      mime = "image/png";
    else if (b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
      mime = "image/jpeg";
    else if (
      b.length > 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP"
    )
      mime = "image/webp";
    else
      return res
        .status(400)
        .json({ error: "Only PNG, JPEG, and WebP images are supported" });
    const id = randomUUID();
    let size;
    try {
      size = imageSize(b);
    } catch {
      return res
        .status(400)
        .json({ error: "This image is damaged or unsupported" });
    }
    if (
      !size.width ||
      !size.height ||
      size.width * size.height > 40000000 ||
      size.width > 16000 ||
      size.height > 16000
    )
      return res.status(400).json({
        error: "Choose an image under 40 megapixels and 16,000 px per side",
      });
    const name = path.basename(req.file.originalname).slice(0, 180);
    const created = new Date().toISOString();
    fs.writeFileSync(path.join(dataDir, "uploads", id), b, { mode: 0o600 });
    try {
      db.prepare("INSERT INTO assets VALUES(?,?,?,?,?,?)").run(
        id,
        req.user.id,
        name,
        mime,
        b.length,
        created,
      );
    } catch (error) {
      fs.unlinkSync(path.join(dataDir, "uploads", id));
      throw error;
    }
    res.status(201).json({
      asset: {
        id,
        name,
        mime,
        size: b.length,
        url: `/api/assets/${id}/file`,
        created,
      },
    });
  });
  app.get("/api/assets", auth, (req, res) =>
    res.json({
      assets: db
        .prepare(
          "SELECT id,name,mime,size,created FROM assets WHERE user_id=? ORDER BY created DESC",
        )
        .all(req.user.id)
        .map((a) => ({ ...a, url: `/api/assets/${a.id}/file` })),
    }),
  );
  app.get("/api/assets/:id/file", (req, res) => {
    const asset = db
      .prepare("SELECT * FROM assets WHERE id=?")
      .get(req.params.id);
    if (!asset) return res.status(404).end();
    let allowed = req.user?.id === asset.user_id;
    if (!allowed && typeof req.query.share === "string") {
      const p = db
        .prepare(
          "SELECT projects.document FROM shares JOIN projects ON projects.id=shares.project_id WHERE token=?",
        )
        .get(req.query.share);
      allowed = p?.document.includes(`/api/assets/${asset.id}/file`);
    }
    if (!allowed) return res.status(404).end();
    res.type(asset.mime);
    res.set("X-Content-Type-Options", "nosniff");
    res.sendFile(path.resolve(dataDir, "uploads", asset.id));
  });
  app.get("/api/preferences", auth, (req, res) => {
    const p = db
      .prepare("SELECT * FROM preferences WHERE user_id=?")
      .get(req.user.id);
    res.json({
      favorites: JSON.parse(p.favorites),
      workspace: p.workspace,
      brand: p.brand ? JSON.parse(p.brand) : null,
    });
  });
  app.put("/api/preferences", auth, (req, res) => {
    const input = z
      .object({
        favorites: z.array(z.string().max(100)).max(1000).optional(),
        workspace: z.string().trim().min(1).max(60).optional(),
        brand: brandSchema.nullable().optional(),
      })
      .parse(req.body);
    const p = db
      .prepare("SELECT * FROM preferences WHERE user_id=?")
      .get(req.user.id);
    db.prepare(
      "UPDATE preferences SET favorites=?,workspace=?,brand=? WHERE user_id=?",
    ).run(
      input.favorites ? JSON.stringify(input.favorites) : p.favorites,
      input.workspace || p.workspace,
      input.brand === undefined ? p.brand : JSON.stringify(input.brand),
      req.user.id,
    );
    res.json({ ok: true });
  });
  let video;
  try {
    video = installVideo({ app, db, auth, dataDir });
  } catch (error) {
    db.close();
    throw error;
  }
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  if (serveFrontend) {
    const dist = path.resolve("dist");
    app.use(express.static(dist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (error instanceof multer.MulterError)
      return res.status(400).json({
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? "Image must be under 10 MB"
            : error.message,
      });
    const status = error.status || 500;
    if (status === 500) console.error(error);
    res.status(status).json({
      error:
        status === 500 ? "An unexpected server error occurred" : error.message,
    });
  });
  let shutdownPromise;
  return {
    app,
    db,
    close: () =>
      (shutdownPromise ??= (async () => {
        await video.close();
        db.close();
      })()),
  };
}
