import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../server/app.mjs";
const document = {
  version: 1,
  width: 800,
  height: 600,
  pages: [
    {
      id: "page-1",
      canvas: {
        background: "#ffffff",
        objects: [
          { type: "Textbox", text: "Hello", left: 20, top: 30, fontSize: 40 },
        ],
      },
    },
  ],
};
const payload = {
  title: "My real project",
  document,
  meta: { style: "ideas", color: "#eee8dd" },
};

test("authenticated storage, ownership, validation, revisions, private assets, shares and session revocation", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "open-studio-test-"));
  const { app, close } = createApp({ dataDir: dir, serveFrontend: false });
  const alice = request.agent(app),
    bob = request.agent(app);
  try {
    await request(app).get("/api/projects").expect(401);
    await alice
      .post("/api/auth/register")
      .send({
        name: "Alice",
        email: "alice@example.com",
        password: "a-long-secret-password",
      })
      .expect(201);
    const login = await alice.get("/api/auth/me").expect(200);
    assert.equal(login.body.user.name, "Alice");
    assert.ok(!login.body.user.password);
    await bob
      .post("/api/auth/register")
      .send({
        name: "Bob",
        email: "bob@example.com",
        password: "another-long-password",
      })
      .expect(201);
    await alice
      .post("/api/projects")
      .set("Origin", "https://evil.example")
      .send(payload)
      .expect(403);
    await alice
      .post("/api/projects")
      .send({ ...payload, document: { ...document, width: 9000 } })
      .expect(400);
    await alice
      .post("/api/projects")
      .send({
        ...payload,
        document: {
          ...document,
          pages: [
            {
              id: "x",
              canvas: {
                objects: [
                  { type: "Image", src: "https://attacker.example/image" },
                ],
              },
            },
          ],
        },
      })
      .expect(400);
    const created = await alice.post("/api/projects").send(payload).expect(201);
    const id = created.body.project.id;
    await bob.get("/api/projects/" + id).expect(404);
    await bob
      .put("/api/projects/" + id)
      .send({ ...payload, revision: 1 })
      .expect(404);
    await bob.delete("/api/projects/" + id).expect(404);
    const updated = await alice
      .put("/api/projects/" + id)
      .send({ ...payload, title: "Updated title", revision: 1 })
      .expect(200);
    assert.equal(updated.body.project.revision, 2);
    await alice
      .put("/api/projects/" + id)
      .send({ ...payload, revision: 1 })
      .expect(409);
    const versions = await alice
      .get("/api/projects/" + id + "/versions")
      .expect(200);
    assert.equal(versions.body.versions.length, 1);
    const version = await alice
      .get(`/api/projects/${id}/versions/${versions.body.versions[0].id}`)
      .expect(200);
    assert.equal(version.body.title, payload.title);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=",
      "base64",
    );
    const upload = await alice
      .post("/api/assets")
      .attach("file", png, "photo.png")
      .expect(201);
    const asset = upload.body.asset;
    await alice
      .get(asset.url)
      .expect(200)
      .expect("Content-Type", /image\/png/);
    await request(app).get(asset.url).expect(404);
    await bob.get(asset.url).expect(404);
    await alice
      .post("/api/assets")
      .attach("file", Buffer.from('<svg onload="alert(1)"/>'), "unsafe.svg")
      .expect(400);
    const withImage = structuredClone(document);
    withImage.pages[0].canvas.objects.push({ type: "Image", src: asset.url });
    await bob
      .post("/api/projects")
      .send({ ...payload, document: withImage })
      .expect(400);
    await alice
      .put("/api/projects/" + id)
      .send({ ...payload, document: withImage, revision: 2 })
      .expect(200);
    const share = await alice
      .post("/api/projects/" + id + "/share")
      .expect(200);
    const token = share.body.token;
    const shared = await request(app)
      .get("/api/shared/" + token)
      .expect(200);
    assert.equal(
      shared.body.project.document.pages[0].canvas.objects[1].src,
      asset.url + "?share=" + token,
    );
    await request(app)
      .get(asset.url + "?share=" + token)
      .expect(200);
    await bob.delete("/api/projects/" + id + "/share").expect(404);
    await alice.delete("/api/projects/" + id + "/share").expect(204);
    await request(app)
      .get("/api/shared/" + token)
      .expect(404);
    await request(app)
      .get(asset.url + "?share=" + token)
      .expect(404);
    await alice
      .put("/api/preferences")
      .send({
        workspace: "My studio",
        favorites: [id],
        brand: { name: "My brand", colors: ["#abcdef"], fonts: ["Manrope"] },
      })
      .expect(200);
    const prefs = await alice.get("/api/preferences").expect(200);
    assert.equal(prefs.body.workspace, "My studio");
    assert.deepEqual(prefs.body.favorites, [id]);
    const bobPrefs = await bob.get("/api/preferences").expect(200);
    assert.deepEqual(bobPrefs.body.favorites, []);
    await alice.post("/api/auth/logout").expect(204);
    await alice.get("/api/projects").expect(401);
    await alice
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "incorrect-password-long" })
      .expect(401);
    await alice
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "a-long-secret-password" })
      .expect(200);
    assert.equal(
      (await alice.get("/api/projects")).body.projects[0].revision,
      3,
    );
    await alice.delete("/api/projects/" + id).expect(204);
    await alice.get("/api/projects/" + id + "/versions").expect(404);
    assert.equal((await alice.get("/api/projects")).body.projects.length, 0);
  } finally {
    await close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("SQLite projects survive closing and reopening the server", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "open-studio-durable-"));
  let server = createApp({ dataDir: dir, serveFrontend: false });
  try {
    const agent = request.agent(server.app);
    await agent
      .post("/api/auth/register")
      .send({
        name: "Durable",
        email: "persist@example.com",
        password: "my-durable-password",
      })
      .expect(201);
    await agent.post("/api/projects").send(payload).expect(201);
    await server.close();
    server = createApp({ dataDir: dir, serveFrontend: false });
    const newAgent = request.agent(server.app);
    await newAgent
      .post("/api/auth/login")
      .send({ email: "persist@example.com", password: "my-durable-password" })
      .expect(200);
    const projects = await newAgent.get("/api/projects").expect(200);
    assert.equal(projects.body.projects[0].title, payload.title);
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Arena embedding is explicitly enabled, with secure partitioned sessions and exact proxy origin", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-preview-"));
  const server = createApp({
    dataDir: dir,
    serveFrontend: false,
    arenaPreview: true,
    publicOrigin: "https://3001-test.e2b.app",
  });
  try {
    const health = await request(server.app).get("/api/health").expect(200);
    assert.equal(health.headers["x-frame-options"], undefined);
    assert.match(
      health.headers["content-security-policy"],
      /frame-ancestors 'self' https:\/\/arena.ai https:\/\/\*.arena.ai/,
    );
    const registration = await request(server.app)
      .post("/api/auth/register")
      .set("Origin", "https://3001-test.e2b.app")
      .send({
        name: "Preview user",
        email: "preview@example.com",
        password: "preview-secure-password",
      })
      .expect(201);
    const cookie = registration.headers["set-cookie"][0];
    for (const flag of ["HttpOnly", "Secure", "SameSite=None", "Partitioned"])
      assert.ok(cookie.includes(flag));
    await request(server.app)
      .post("/api/auth/logout")
      .set("Origin", "https://evil.example")
      .expect(403);
    const logout = await request(server.app)
      .post("/api/auth/logout")
      .expect(204);
    assert.ok(logout.headers["set-cookie"][0].includes("Partitioned"));
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const normal = createApp({ dataDir: dir, serveFrontend: false });
  try {
    const health = await request(normal.app).get("/api/health").expect(200);
    assert.equal(health.headers["x-frame-options"], "SAMEORIGIN");
    assert.match(
      health.headers["content-security-policy"],
      /frame-ancestors 'self';/,
    );
  } finally {
    await normal.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
