import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import request from "supertest";
import { createApp } from "../server/app.mjs";
import { tools, inspectMedia } from "../server/media-process.mjs";
import { emptyVideo } from "../shared/video.mjs";
import { makeFixtures } from "./video-fixtures.mjs";
async function waitJob(agent, id) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const r = await agent.get("/api/video/jobs/" + id).expect(200);
    if (["completed", "failed", "cancelled"].includes(r.body.job.status))
      return r.body.job;
    await delay(50);
  }
  throw new Error("Render did not complete");
}
test("real FFmpeg montage: private uploads, trim, speed, silence, captions, music, rendering, ownership and cancellation", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-video-test-")),
    dataDir = path.join(dir, "data");
  const backend = createApp({ dataDir, serveFrontend: false });
  const a = request.agent(backend.app),
    b = request.agent(backend.app);
  let closed = false;
  try {
    assert.throws(
      () => createApp({ dataDir, serveFrontend: false }),
      /already locked/,
    );
    const fixtures = await makeFixtures(dir);
    await a
      .post("/api/auth/register")
      .send({
        name: "Video creator",
        email: "video@example.com",
        password: "secure-video-password",
      })
      .expect(201);
    await b
      .post("/api/auth/register")
      .send({
        name: "Other user",
        email: "other@example.com",
        password: "other-secure-password",
      })
      .expect(201);
    await request(backend.app).get("/api/video/projects").expect(401);
    await a
      .post("/api/video/media")
      .attach(
        "file",
        Buffer.from("#EXTM3U\nhttps://example.com/media"),
        "playlist.m3u8",
      )
      .expect(400);
    const red = (
      await a.post("/api/video/media").attach("file", fixtures.red).expect(201)
    ).body.media;
    const blue = (
      await a.post("/api/video/media").attach("file", fixtures.blue).expect(201)
    ).body.media;
    const music = (
      await a
        .post("/api/video/media")
        .attach("file", fixtures.music)
        .expect(201)
    ).body.media;
    assert.equal(red.hasAudio, true);
    assert.equal(blue.hasAudio, false);
    assert.equal(music.hasVideo, false);
    await a.get(red.url).set("Range", "bytes=0-99").expect(206);
    await b.get(red.url).expect(404);
    const document = {
      ...emptyVideo(),
      width: 320,
      height: 320,
      fps: 24,
      clips: [
        {
          id: randomUUID(),
          assetId: red.id,
          in: 0.2,
          out: 1.2,
          volume: 0.7,
          speed: 1,
          fit: "contain",
          fade: 0.1,
        },
        {
          id: randomUUID(),
          assetId: blue.id,
          in: 0.2,
          out: 1.8,
          volume: 1,
          speed: 2,
          fit: "cover",
          fade: 0,
        },
      ],
      captions: [
        {
          id: randomUUID(),
          text: "100% free: [hello] 'world'",
          start: 0.1,
          end: 1.7,
          size: 18,
          color: "#ffffff",
          position: "bottom",
        },
      ],
      soundtrack: { assetId: music.id, offset: 0.1, volume: 0.3 },
    };
    await b
      .post("/api/video/projects")
      .send({ title: "Stolen video", document })
      .expect(400);
    await a
      .post("/api/video/projects")
      .send({
        title: "Bad trim",
        document: { ...document, clips: [{ ...document.clips[0], out: 20 }] },
      })
      .expect(400);
    const p = (
      await a
        .post("/api/video/projects")
        .send({ title: "My montage", document })
        .expect(201)
    ).body.project;
    await b.get("/api/video/projects/" + p.id).expect(404);
    await b.post("/api/video/projects/" + p.id + "/render").expect(404);
    await a
      .put("/api/video/projects/" + p.id)
      .send({ title: p.title, document, revision: 1 })
      .expect(200);
    await a
      .put("/api/video/projects/" + p.id)
      .send({ title: p.title, document, revision: 1 })
      .expect(409);
    await a.delete("/api/video/media/" + red.id).expect(409);
    await a
      .post("/api/video/projects/" + p.id + "/render")
      .send({ revision: 1 })
      .expect(409);
    const job = (
      await a.post("/api/video/projects/" + p.id + "/render").expect(202)
    ).body.job;
    await a.post("/api/video/projects/" + p.id + "/render").expect(409);
    await b.get("/api/video/jobs/" + job.id).expect(404);
    await b.post("/api/video/jobs/" + job.id + "/cancel").expect(404);
    const finished = await waitJob(a, job.id);
    assert.equal(finished.status, "completed", finished.error);
    assert.equal(finished.progress, 100);
    const output = path.join(dataDir, "video", "exports", job.id + ".mp4");
    const meta = await inspectMedia(output);
    assert.equal(meta.width, 320);
    assert.equal(meta.height, 320);
    assert.equal(meta.hasAudio, true);
    assert.ok(Math.abs(meta.duration - 1.8) < 0.2);
    const pixel = (time) =>
      execFileSync(tools.ffmpeg, [
        "-v",
        "error",
        "-ss",
        String(time),
        "-i",
        output,
        "-vf",
        "crop=2:2:150:100,scale=1:1",
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "pipe:1",
      ]);
    const first = pixel(0.4),
      second = pixel(1.4);
    assert.ok(first[0] > first[2] + 100, "First clip must be red");
    assert.ok(second[2] > second[0] + 100, "Second clip must be blue");
    await a
      .get(finished.downloadUrl)
      .expect(200)
      .expect("Content-Type", /video\/mp4/);
    await b.get(finished.downloadUrl).expect(404);
    const cancel = (
      await a.post("/api/video/projects/" + p.id + "/render").expect(202)
    ).body.job;
    await a.post("/api/video/jobs/" + cancel.id + "/cancel").expect(200);
    assert.equal((await waitJob(a, cancel.id)).status, "cancelled");
    assert.deepEqual(fs.readdirSync(path.join(dataDir, "video", "work")), []);
    const shutdown = (
      await a.post("/api/video/projects/" + p.id + "/render").expect(202)
    ).body.job;
    await backend.close();
    closed = true;
    const reopened = createApp({ dataDir, serveFrontend: false });
    const fresh = request.agent(reopened.app);
    try {
      await fresh
        .post("/api/auth/login")
        .send({ email: "video@example.com", password: "secure-video-password" })
        .expect(200);
      assert.equal(
        (await fresh.get("/api/video/jobs/" + shutdown.id)).body.job.status,
        "cancelled",
      );
      assert.equal(
        (await fresh.get("/api/video/projects")).body.projects.length,
        1,
      );
    } finally {
      await reopened.close();
    }
  } finally {
    if (!closed) await backend.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
