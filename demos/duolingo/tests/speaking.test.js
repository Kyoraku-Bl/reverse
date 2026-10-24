import test from "node:test";
import assert from "node:assert/strict";
import {
  SPEAKING_COURSES,
  SPEAKING_LEVELS,
  TOPICS,
  standardSuggestions,
  conversationReply,
  compareTranscript,
  normalizeSpeakingData,
  freshSpeakingData,
} from "../speaking-content.js";
import { SpeechCapture } from "../speech-media.js";

test("English and French each provide A1–C1 speaking goals, prompts, and three unique sound exercises", () => {
  const phrases = [];
  for (const language of ["en", "fr"])
    for (const level of SPEAKING_LEVELS) {
      const c = SPEAKING_COURSES[language][level];
      assert.ok(c.goal && c.challenge && c.starter);
      assert.equal(c.drills.length, 3);
      assert.equal(c.questions.length, 4);
      for (const d of c.drills) {
        assert.ok(d.text.length > 20 && d.tip.length > 50 && d.focus);
        phrases.push(d.text);
      }
      for (const topic of TOPICS) {
        const r = conversationReply({
          language,
          level,
          topic: topic.id,
          text: "hello",
          turn: 3,
        });
        assert.ok(r.text.length > 30);
      }
    }
  assert.equal(phrases.length, 30);
  assert.equal(new Set(phrases).size, 30);
});
test("standard-usage suggestions do not claim pronunciation or general correctness", () => {
  assert.equal(
    standardSuggestions("I am agree with this idea.", "en")[0].suggestion,
    "I agree.",
  );
  assert.equal(
    standardSuggestions("I have 25 years.", "en")[0].suggestion,
    "I am 25 years old.",
  );
  assert.equal(
    standardSuggestions("Je suis 25 ans.", "fr")[0].suggestion,
    "J’ai 25 ans.",
  );
  assert.equal(
    standardSuggestions("Je suis faim.", "fr")[0].suggestion,
    "J’ai faim.",
  );
  assert.deepEqual(standardSuggestions("Je suis étudiant.", "fr"), []);
  assert.deepEqual(
    standardSuggestions("I have 25 years of experience.", "en"),
    [],
  );
});
test("custom subject and difficulty change prepared prompts without asserting external facts", () => {
  const a = conversationReply({
    language: "en",
    level: "A1",
    topic: "custom",
    customTopic: "astronomy",
    text: "I like stars",
    turn: 0,
  });
  const c = conversationReply({
    language: "en",
    level: "C1",
    topic: "custom",
    customTopic: "astronomy",
    text: "I like stars",
    turn: 0,
  });
  assert.match(a.text, /astronomy/);
  assert.match(a.text, /What do you like/);
  assert.match(c.text, /assumptions/);
  const fr = conversationReply({
    language: "fr",
    level: "C1",
    topic: "custom",
    customTopic: "le cinéma",
    turn: 0,
  });
  assert.match(fr.text, /hypothèses/);
});
test("transcript alignment accounts for substitutions, additions, missing words and apostrophes", () => {
  const exact = compareTranscript("Hello, my friend!", "hello my friend");
  assert.equal(exact.matches, 3);
  assert.equal(exact.total, 3);
  const changed = compareTranscript("I would like tea", "I would like coffee");
  assert.deepEqual(changed.alignment.at(-1), {
    expected: "tea",
    heard: "coffee",
    kind: "different",
  });
  assert.ok(
    compareTranscript("I like tea", "I really like tea").alignment.some(
      (w) => w.kind === "extra",
    ),
  );
  assert.ok(
    compareTranscript("I would like tea", "I like tea").alignment.some(
      (w) => w.kind === "missing",
    ),
  );
  assert.equal(
    compareTranscript("J’habite à Salé.", "j'habite à salé").matches,
    4,
  );
  assert.equal(compareTranscript("Say hello", "").hasSpeech, false);
  assert.equal(
    compareTranscript("x ".repeat(500), "x ".repeat(500)).total,
    120,
  );
});
test("speaking history validation isolates language/level, bounds saved turns, and rejects unknown keys", () => {
  const s = normalizeSpeakingData({
    threads: {
      "en-A1": {
        topic: "custom",
        customTopic: "music",
        turn: 100,
        draft: "Hi",
        messages: Array.from({ length: 80 }, () => ({
          role: "user",
          text: "Hello",
        })),
      },
      "fr-C1": {
        topic: "food",
        messages: [{ role: "bot", text: "Bonjour", source: "je suis 25 ans" }],
      },
      __proto__: {},
      "es-A1": {},
    },
    practice: { "en-A1-0": true, "en-A1-99": true },
    consent: true,
  });
  assert.equal(s.threads["en-A1"].messages.length, 50);
  assert.equal(s.threads["en-A1"].turn, 100);
  assert.equal(s.threads["fr-C1"].messages[0].suggestions.length, 1);
  assert.equal(s.threads["es-A1"], undefined);
  assert.deepEqual(s.practice, { "en-A1-0": true });
  assert.equal(s.consent, true);
  assert.deepEqual(normalizeSpeakingData(null), freshSpeakingData());
});
function fakeEnv({ getUserMedia } = {}) {
  const errors = [],
    recordings = [],
    transcripts = [],
    changes = [];
  let stopCount = 0;
  const timers = new Map();
  let next = 0;
  const stream = { getTracks: () => [{ stop: () => stopCount++ }] };
  class Recorder {
    constructor() {
      this.state = "inactive";
      this.mimeType = "audio/webm";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({
        data: new Blob(["audio"], { type: "audio/webm" }),
      });
      this.onstop?.();
    }
  }
  class Recognition {
    start() {
      this.started = true;
    }
    stop() {
      this.onend?.();
    }
    abort() {
      this.aborted = true;
    }
  }
  const env = {
    navigator: {
      mediaDevices: {
        getUserMedia: getUserMedia || (() => Promise.resolve(stream)),
      },
    },
    MediaRecorder: Recorder,
    SpeechRecognition: Recognition,
    Blob,
    setTimeout: (cb) => {
      timers.set(++next, cb);
      return next;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const capture = new SpeechCapture({
    env,
    onError: (e) => errors.push(e),
    onRecording: (b) => recordings.push(b),
    onTranscript: (t) => transcripts.push(t),
    onChange: (k) => changes.push(k),
  });
  return {
    capture,
    env,
    errors,
    recordings,
    transcripts,
    changes,
    stream,
    timers,
    stops: () => stopCount,
  };
}
test("a late microphone permission grant after leaving is released without recording", async () => {
  let resolve;
  const f = fakeEnv({ getUserMedia: () => new Promise((r) => (resolve = r)) });
  const pending = f.capture.record();
  assert.equal(f.capture.kind, "requesting");
  f.capture.cancel();
  resolve(f.stream);
  await pending;
  assert.equal(f.stops(), 1);
  assert.equal(f.capture.kind, "idle");
  assert.equal(f.recordings.length, 0);
});
test("recording completion releases tracks and publishes a blob, cancellation discards it", async () => {
  const f = fakeEnv();
  await f.capture.record();
  assert.equal(f.capture.kind, "recording");
  f.capture.finish();
  assert.equal(f.capture.kind, "idle");
  assert.equal(f.recordings.length, 1);
  assert.ok(f.recordings[0].size > 0);
  assert.equal(f.stops(), 1);
  assert.equal(f.timers.size, 0);
  await f.capture.record();
  f.capture.cancel();
  assert.equal(f.recordings.length, 1);
  assert.equal(f.stops(), 2);
});
test("denied permission and recorder startup failure do not retain the stream", async () => {
  const denied = fakeEnv({
    getUserMedia: () => Promise.reject({ name: "NotAllowedError" }),
  });
  await denied.capture.record();
  assert.equal(denied.capture.kind, "idle");
  assert.match(denied.errors[0], /denied/);
  const broken = fakeEnv();
  broken.env.MediaRecorder = class {
    constructor() {
      throw Error("unsupported");
    }
  };
  await broken.capture.record();
  assert.equal(broken.stops(), 1);
  assert.equal(broken.capture.kind, "idle");
  assert.equal(broken.errors.length, 1);
});
test("recognition uses the selected locale and ignores late transcripts after cancellation", () => {
  const f = fakeEnv();
  f.capture.recognize("fr-FR");
  const service = f.capture.recognition;
  assert.equal(service.lang, "fr-FR");
  service.onresult({ results: [[{ transcript: "Bonjour" }]] });
  assert.deepEqual(f.transcripts, ["Bonjour"]);
  f.capture.cancel();
  service.onresult({ results: [[{ transcript: "Late words" }]] });
  assert.deepEqual(f.transcripts, ["Bonjour"]);
  assert.equal(service.aborted, true);
  assert.equal(f.timers.size, 0);
});
test("recognition errors, unsupported environments and timeout leave no active session", () => {
  const f = fakeEnv();
  f.capture.recognize("en-GB");
  const service = f.capture.recognition;
  service.onerror({ error: "network" });
  assert.match(f.errors[0], /could not connect/);
  assert.equal(f.capture.kind, "idle");
  assert.equal(service.aborted, true);
  f.capture.recognize("en-GB");
  [...f.timers.values()][0]();
  assert.equal(f.capture.kind, "idle");
  assert.match(f.errors.at(-1), /timed out/);
  f.env.SpeechRecognition = undefined;
  f.capture.recognize("en-GB");
  assert.match(f.errors.at(-1), /unavailable/);
});
