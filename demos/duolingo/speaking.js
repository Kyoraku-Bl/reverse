import { LEVELS, LANGUAGES } from "./curriculum.js";
import {
  SPEAKING_COURSES,
  TOPICS,
  SPEAKING_KEY,
  freshSpeakingData,
  normalizeSpeakingData,
  conversationReply,
  compareTranscript,
} from "./speaking-content.js";
import { SpeechCapture } from "./speech-media.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const mic =
  '<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
const audio =
  '<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
export class SpeakingStudio {
  constructor({
    preferences,
    changePreferences,
    speak,
    notify,
    requestVoiceConsent,
  }) {
    Object.assign(this, {
      preferences,
      changePreferences,
      speak,
      notify,
      requestVoiceConsent,
    });
    try {
      this.data = normalizeSpeakingData(
        JSON.parse(localStorage.getItem(SPEAKING_KEY) || "null"),
      );
    } catch {
      this.data = freshSpeakingData();
    }
    this.root = null;
    this.mode = "chat";
    this.drill = 0;
    this.heard = "";
    this.recordingURL = null;
    this.error = "";
    this.captureTarget = "chat";
    this.autoSpeak = false;
    this.capture = new SpeechCapture({
      onChange: () => this.renderIfMounted(),
      onTranscript: (text) => {
        if (!this.root?.isConnected) return;
        if (this.captureTarget === "chat") {
          this.thread().draft = text;
          this.persist();
        } else this.heard = text;
        this.renderIfMounted();
      },
      onRecording: (blob) => {
        if (!this.root?.isConnected) return;
        this.clearAudio();
        this.recordingURL = URL.createObjectURL(blob);
        this.render();
      },
      onError: (message) => {
        this.error = message;
        this.renderIfMounted();
        this.notify(message);
      },
    });
    this.onPageHide = () => this.leave();
    window.addEventListener("pagehide", this.onPageHide);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        this.root = document.getElementById("speaking-studio");
        this.renderIfMounted();
      }
    });
  }
  persist() {
    try {
      localStorage.setItem(SPEAKING_KEY, JSON.stringify(this.data));
    } catch {
      this.notify(
        "Speaking history could not be saved. You can keep practising in this tab.",
      );
    }
  }
  exportData() {
    return this.data;
  }
  reset() {
    this.leave();
    this.data = freshSpeakingData();
    this.persist();
    this.drill = 0;
    this.heard = "";
    this.error = "";
    this.mode = "chat";
    this.autoSpeak = false;
  }
  thread() {
    const { language, level } = this.preferences(),
      key = `${language}-${level}`;
    if (!this.data.threads[key])
      this.data.threads[key] = {
        topic: "daily",
        customTopic: "",
        draft: "",
        turn: 0,
        messages: [],
      };
    return this.data.threads[key];
  }
  stopPlayback() {
    this.root?.querySelectorAll("audio").forEach((player) => {
      player.pause();
      player.removeAttribute("src");
      player.load();
    });
  }
  clearAudio() {
    this.stopPlayback();
    if (this.recordingURL) URL.revokeObjectURL(this.recordingURL);
    this.recordingURL = null;
  }
  leave() {
    this.stopPlayback();
    this.root = null;
    this.capture.cancel();
    this.clearAudio();
    window.speechSynthesis?.cancel();
  }
  mount(root) {
    this.leave();
    this.root = root;
    root.addEventListener("click", (e) => this.handleClick(e));
    root.addEventListener("submit", (e) => this.handleSubmit(e));
    root.addEventListener("change", (e) => this.handleChange(e));
    root.addEventListener("input", (e) => this.handleInput(e));
    this.render();
  }
  renderIfMounted() {
    if (this.root?.isConnected) this.render();
  }
  render() {
    if (!this.root?.isConnected) return;
    const { language, level } = this.preferences(),
      course = SPEAKING_COURSES[language][level],
      thread = this.thread();
    this.stopPlayback();
    this.root.innerHTML = `<section class="speaking-banner"><div class="speaking-emblem">${mic}</div><div><span class="eyebrow">YOUR VOICE BELONGS HERE</span><h2>Small conversations.<br>Growing confidence.</h2><p>Listen. Speak. Try again. English & French, A1–C1.<br>Free practice with no account or app-imposed chat limit.</p></div><span class="speaking-free">ALWAYS FREE</span></section><div class="speaking-toolbar"><div class="speaking-languages" role="group" aria-label="Speaking language">${Object.entries(
      LANGUAGES,
    )
      .map(
        ([k, l]) =>
          `<button class="${language === k ? "active" : ""}" data-studio-language="${k}" aria-pressed="${language === k}">${l.name}</button>`,
      )
      .join(
        "",
      )}</div><div class="speaking-levels" role="group" aria-label="Speaking level">${LEVELS.map((l) => `<button class="${level === l.id ? "active" : ""}" data-studio-level="${l.id}" aria-pressed="${level === l.id}">${l.id}</button>`).join("")}</div></div><p class="speaking-goal"><strong>${level} · ${LANGUAGES[language].name}</strong> ${esc(course.goal)}</p><div class="speaking-modes" role="group" aria-label="Practice mode">${[
      ["chat", "Conversation bot"],
      ["repeat", "Listen & repeat"],
      ["challenge", "Speaking challenge"],
    ]
      .map(
        ([key, label]) =>
          `<button class="${this.mode === key ? "active" : ""}" data-studio-mode="${key}" aria-pressed="${this.mode === key}">${key === "chat" ? mic : key === "repeat" ? audio : "✦"} ${label}</button>`,
      )
      .join(
        "",
      )}</div><div class="speaking-disclosure"><strong>A free practice bot, not a full AI tutor.</strong> Pip uses prepared prompts and a few grammar rules on your device. Choose any topic, but it cannot answer arbitrary factual questions or fully correct your language. Speech-to-text compares words, <strong>not pronunciation quality</strong>. It can mishear clear speech or accept unclear speech. No accent score or CEFR certification is given.</div><div class="speaking-consent-bar"><label class="speaking-consent"><input type="checkbox" id="speaking-consent" ${this.data.consent ? "checked" : ""}> Enable voice controls. You can also press Record or Dictate to enable them. Dictation may send audio to my browser provider; local recordings stay in this tab.</label><a href="#speaking-privacy">Microphone & privacy details ↓</a></div>${this.mode === "chat" ? this.chatView(course, thread) : this.mode === "repeat" ? this.repeatView(course) : this.challengeView(course)}<section class="speaking-privacy" id="speaking-privacy"><h2>Microphone, on your terms.</h2><p>Only turn it on when you’re ready. <strong>Dictation may send audio to your browser provider’s speech service</strong> and may need internet; availability and provider limits vary. Local recording stays in this tab, is never uploaded by Bloom, and is discarded when you leave this section or change practice. Typed bot chat has no service quota. Recent 25 conversation turns per language/level are saved in this browser; older turns roll off. Do not share sensitive personal information.</p><p class="speaking-consent-reminder">Voice permission can be enabled or withdrawn in the checkbox above. Your browser may also ask for permission.</p><button class="text-btn" data-studio-action="forget">Clear all speaking history & permission choice</button></section>`;
    const log = this.root.querySelector(".speaking-messages");
    if (log) log.scrollTop = log.scrollHeight;
  }
  chatView(course, thread) {
    const messages = thread.messages.length
      ? thread.messages
      : [{ role: "bot", text: course.starter, suggestions: [] }];
    const active = this.capture.kind !== "idle";
    return `<div class="speaking-chat-grid"><section class="panel speaking-chat"><div class="speaking-chat-header"><span class="pip-avatar">✿</span><div><h2>Pip, your conversation companion</h2><p>Local, rule-based bot · never a paywall</p></div><button class="text-btn" data-studio-action="clear-chat">New chat</button></div><div class="speaking-topic"><label for="speaking-topic">Let’s talk about</label><select id="speaking-topic">${TOPICS.map((t) => `<option value="${t.id}" ${thread.topic === t.id ? "selected" : ""}>${t[this.preferences().language]}</option>`).join("")}<option value="custom" ${thread.topic === "custom" ? "selected" : ""}>Your own subject…</option></select>${thread.topic === "custom" ? `<label class="sr-only" for="speaking-custom-topic">Your subject</label><input id="speaking-custom-topic" maxlength="80" value="${esc(thread.customTopic)}" placeholder="Space, football, philosophy…"><button class="btn light" data-studio-action="custom-topic">Set topic</button>` : ""}</div><div class="speaking-messages" role="log" aria-label="Your conversation with Pip" aria-live="polite" aria-relevant="additions text">${messages.map((m, i) => `<article class="speaking-message ${m.role}"><div class="message-meta">${m.role === "bot" ? "Pip · prepared response" : "You"}${m.role === "bot" ? `<button class="audio-btn" data-studio-listen="${thread.messages.length ? i : -1}" aria-label="Listen to this bot message">${audio}</button>` : ""}</div><p lang="${this.preferences().language}">${esc(m.text)}</p>${m.suggestions?.length ? `<div class="speaking-correction"><strong>Standard-usage suggestion</strong>${m.suggestions.map((s) => `<p><span>${esc(s.original)}</span> → <b>${esc(s.suggestion)}</b><small>${esc(s.explanation)}</small></p>`).join("")}<small>This is a text rule, not a pronunciation judgment. Check the transcript first.</small></div>` : ""}</article>`).join("")}</div><form id="speaking-chat-form"><label for="speaking-chat-input">Your turn — type, or dictate and check the transcript (up to 1,200 characters)</label><textarea id="speaking-chat-input" maxlength="1200" rows="3" placeholder="${this.preferences().language === "fr" ? "Écrivez votre réponse ici…" : "Try a few words. They don’t have to be perfect…"}" ${active ? "disabled" : ""}>${esc(thread.draft)}</textarea><div class="speaking-compose-actions"><button class="btn light" type="button" data-studio-action="dictate-chat" ${this.captureDisabledAttribute()}>${mic} Dictate</button><button class="btn" type="submit" ${active ? "disabled" : ""}>Send message →</button></div></form>${this.captureStatus()}${this.microphoneHelp()}<label class="speaking-auto"><input type="checkbox" id="speaking-auto" ${this.autoSpeak ? "checked" : ""}> Read Pip’s replies aloud after I send a message</label></section><aside class="speaking-tips"><section class="panel"><div class="speaking-tip-icon">✦</div><h2>A little help getting started</h2><p>${esc(course.challenge)}</p><h3>When words get stuck</h3><p lang="${this.preferences().language}">${this.preferences().language === "fr" ? "« Laissez-moi réfléchir. »<br>« Je voudrais dire que… »<br>« Pouvez-vous reformuler ? »" : "“Let me think for a moment.”<br>“What I mean is…”<br>“Could you rephrase that?”"}</p><p class="info-copy">A useful reply can be one sentence. At higher levels, add a reason, example, or counterargument.</p></section><section class="speaking-tip-note"><strong>What can Pip correct?</strong><p>A small set of common grammar patterns, such as ${this.preferences().language === "fr" ? "“je suis 25 ans” → “j’ai 25 ans”." : "“I am agree” → “I agree”."} No suggestion does <em>not</em> mean your sentence is error-free. Listen, self-review, and seek fluent-speaker feedback for detailed pronunciation.</p></section></aside></div>`;
  }
  captureDisabledAttribute() {
    return this.capture.kind !== "idle" ? "disabled" : "";
  }
  captureStatus() {
    const active = this.capture.kind !== "idle";
    return `<div class="speaking-capture-status" role="status" aria-live="polite">${active ? `<span class="speaking-live-dot"></span>${this.capture.kind === "requesting" ? "Waiting for microphone permission…" : this.capture.kind === "recording" ? "Recording locally. Stops after 90 seconds." : "Listening through your browser. Check the text before sending."}<button class="text-btn" data-studio-action="stop">${this.capture.kind === "requesting" ? "Cancel request" : "Stop"}</button>` : this.error ? `<span>${esc(this.error)}</span>` : `<span>${this.data.consent ? "Microphone is off. You can always type instead." : "Ready to record? Press Record or Dictate to enable your microphone. You can always type instead."}</span>`}</div>`;
  }
  repeatView(course) {
    const d = course.drills[this.drill],
      { language, level } = this.preferences(),
      comparison = this.heard.trim()
        ? compareTranscript(d.text, this.heard)
        : null;
    return `<section class="panel speaking-repeat"><div class="speaking-repeat-head"><h2>A little clearer, one phrase at a time.</h2><span>${this.drill + 1} / 3 · ${level}</span></div><div class="speaking-drill-tabs" role="group" aria-label="Choose a speaking exercise">${course.drills.map((d, i) => `<button data-studio-drill="${i}" class="${i === this.drill ? "active" : ""}" aria-pressed="${i === this.drill}">${this.data.practice[`${language}-${level}-${i}`] ? "✓ " : ""}Phrase ${i + 1}</button>`).join("")}</div><div class="speaking-target"><span class="eyebrow">1. LISTEN, THEN REPEAT</span><p lang="${language}">${esc(d.text)}</p><div><button class="btn light" data-studio-action="model">${audio} Listen to the model</button><button class="text-btn" data-studio-action="slow-model">Listen slowly</button></div></div><div class="speaking-sound-tip"><strong>${esc(d.focus)}</strong><p>${esc(d.tip)}</p></div><h3>2. Say it your way</h3><p class="info-copy">Record locally and compare your own voice, or ask your browser to transcribe your attempt. These are separate options; they do not run together.</p><div class="speaking-voice-actions"><button class="btn light" data-studio-action="record" ${this.captureDisabledAttribute()}>${mic} Record & listen back</button><button class="btn light" data-studio-action="dictate-repeat" ${this.captureDisabledAttribute()}>${mic} Transcribe my attempt</button></div>${this.captureStatus()}${this.microphoneHelp()}${this.recordingURL ? `<div class="speaking-recording"><label for="speaking-playback">Your recording · only in this tab</label><audio id="speaking-playback" controls src="${esc(this.recordingURL)}"></audio><button class="text-btn" data-studio-action="discard-audio">Discard recording</button></div>` : ""}<label class="speaking-field-label" for="speaking-heard">3. Review the transcript (editable, not a pronunciation score)</label><textarea id="speaking-heard" rows="3" maxlength="1200" placeholder="Transcribed words appear here. You can also type to explore the word comparison.">${esc(this.heard)}</textarea><button class="btn light" data-studio-action="compare">Compare the words</button>${comparison ? `<div class="speaking-comparison"><strong>Transcript word comparison</strong><p>${comparison.matches} of ${comparison.total} target words matched the transcript. This is <b>not</b> an acoustic accuracy score.</p><div class="speaking-word-chips">${comparison.alignment.map((w) => `<span class="word-${w.kind}">${w.kind === "match" ? esc(w.expected) : w.kind === "missing" ? `${esc(w.expected)} · not transcribed` : w.kind === "extra" ? `Extra: ${esc(w.heard)}` : `${esc(w.expected)} → ${esc(w.heard)}`}</span>`).join("")}</div><p>If a word differs, listen to it again and try another take. A mismatch may come from the recogniser, noise, wording, or pronunciation. A match does not prove the sound was correct.</p></div>` : ""}<div class="speaking-self-review"><h3>4. A gentle self-check</h3><ul><li>Can I hear the important words clearly?</li><li>Did I use the pauses and sound focus above?</li><li>Can another person understand the message?</li></ul><button class="btn" data-studio-action="mark-practised">I practised this phrase ✓</button><p>Self-reported practice only. No level or certificate is awarded.</p></div></section>`;
  }
  challengeView(course) {
    return `<section class="panel speaking-challenge"><span class="speaking-challenge-flower">✿</span><div class="eyebrow">A1 TO C1 · A LITTLE MORE OF YOUR OWN VOICE</div><h2>A speaking invitation, just for you.</h2><p class="speaking-challenge-prompt" lang="${this.preferences().language}">${esc(course.challenge)}</p><ol><li>Think of two or three ideas. Don’t write a full script.</li><li>Record a short answer, then listen for clarity and phrasing.</li><li>Try again with one small improvement. For a two-minute challenge, make two short recordings; each recording is limited to 90 seconds.</li></ol><button class="btn" data-studio-action="record" ${this.captureDisabledAttribute()}>${mic} Record my response</button>${this.captureStatus()}${this.microphoneHelp()}${this.recordingURL ? `<div class="speaking-recording"><label for="speaking-playback">Your response · only in this tab</label><audio id="speaking-playback" controls src="${esc(this.recordingURL)}"></audio><button class="text-btn" data-studio-action="discard-audio">Discard recording</button></div>` : ""}<div class="speaking-sound-tip"><strong>Aim for understanding, not a “perfect” accent.</strong><p>Review your message, organisation, word choices, pauses, and clarity. Bloom does not analyse this recording. Feedback from a teacher or fluent speaker will help with details a transcript cannot reveal.</p></div></section>`;
  }
  handleInput(event) {
    if (event.target.id === "speaking-chat-input") {
      this.thread().draft = event.target.value;
      this.persist();
    }
    if (event.target.id === "speaking-custom-topic") {
      this.thread().customTopic = event.target.value;
      this.persist();
    }
    if (event.target.id === "speaking-heard") this.heard = event.target.value;
  }
  handleChange(event) {
    if (event.target.id === "speaking-consent") {
      this.data.consent = event.target.checked;
      if (!this.data.consent) this.capture.cancel();
      this.persist();
      this.render();
    }
    if (event.target.id === "speaking-auto")
      this.autoSpeak = event.target.checked;
    if (event.target.id === "speaking-topic") {
      this.capture.cancel();
      this.thread().topic = event.target.value;
      this.persist();
      this.render();
    }
  }
  handleSubmit(event) {
    if (event.target.id !== "speaking-chat-form") return;
    event.preventDefault();
    if (this.capture.kind !== "idle") return;
    const t = this.thread(),
      text = t.draft.trim();
    if (!text) return this.notify("Try a few words first.");
    const { language, level } = this.preferences();
    const reply = conversationReply({
      language,
      level,
      topic: t.topic,
      customTopic: t.customTopic,
      text,
      turn: t.turn || 0,
    });
    t.messages.push(
      { role: "user", text, source: "" },
      {
        role: "bot",
        text: reply.text,
        suggestions: reply.suggestions,
        source: text,
      },
    );
    t.messages = t.messages.slice(-50);
    t.turn = (t.turn || 0) + 1;
    t.draft = "";
    this.persist();
    this.render();
    if (this.autoSpeak) this.speak(reply.text, language);
    this.root
      .querySelector("#speaking-chat-input")
      ?.focus({ preventScroll: true });
  }
  resetAttempt() {
    this.capture.cancel();
    this.clearAudio();
    this.heard = "";
    this.error = "";
  }
  microphoneHelp() {
    return this.error
      ? `<div class="speaking-mic-help"><strong>If your browser blocked the microphone</strong><ol><li>Open the site controls beside the address bar and set Microphone to Allow.</li><li>Check microphone access in your device’s privacy settings.</li><li>Close other apps using the microphone, then press Record again.</li></ol><a href="https://bloom-languages.vercel.app/#speaking" target="_blank" rel="noopener noreferrer">Open the public site in a new tab ↗</a><p>Microphones may be blocked in an embedded preview or an in-app browser. Try the direct site in Safari, Chrome, or Edge.</p></div>`
      : "";
  }
  startVoice(action) {
    if (!this.root?.isConnected || this.capture.kind !== "idle") return;
    if (!this.data.consent) {
      const root = this.root;
      return this.requestVoiceConsent(action, () => {
        // A pending prompt must not start capture after the view was replaced.
        if (this.root !== root || !root.isConnected) return;
        this.data.consent = true;
        this.persist();
        this.startVoice(action);
      });
    }
    this.error = "";
    window.speechSynthesis?.cancel();
    if (action === "record") {
      this.clearAudio();
      return this.capture.record();
    }
    this.captureTarget = action === "dictate-chat" ? "chat" : "repeat";
    return this.capture.recognize(
      LANGUAGES[this.preferences().language].locale,
    );
  }
  handleClick(event) {
    const b = event.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.studioLanguage || b.dataset.studioLevel) {
      this.resetAttempt();
      const p = this.preferences();
      this.changePreferences(
        b.dataset.studioLanguage || p.language,
        b.dataset.studioLevel || p.level,
      );
      this.render();
      return;
    }
    if (b.dataset.studioMode) {
      this.resetAttempt();
      this.mode = b.dataset.studioMode;
      this.render();
      return;
    }
    if (b.dataset.studioDrill !== undefined) {
      this.resetAttempt();
      this.drill = Number(b.dataset.studioDrill);
      this.render();
      return;
    }
    if (b.dataset.studioListen !== undefined) {
      const i = Number(b.dataset.studioListen),
        { language, level } = this.preferences();
      this.speak(
        i === -1
          ? SPEAKING_COURSES[language][level].starter
          : this.thread().messages[i]?.text || "",
        language,
      );
      return;
    }
    const action = b.dataset.studioAction;
    if (!action) return;
    const { language, level } = this.preferences(),
      course = SPEAKING_COURSES[language][level];
    if (action === "model" || action === "slow-model")
      return this.speak(
        course.drills[this.drill].text,
        language,
        action === "slow-model" ? 0.65 : 0.85,
      );
    if (action === "stop") return this.capture.finish();
    if (action === "discard-audio") {
      this.clearAudio();
      this.render();
      return;
    }
    if (action === "compare") {
      this.render();
      return;
    }
    if (action === "mark-practised") {
      this.data.practice[`${language}-${level}-${this.drill}`] = true;
      this.persist();
      this.render();
      this.notify("A little speaking practice, recorded as self-reported.");
      return;
    }
    if (action === "clear-chat") {
      if (
        !confirm(
          "Start a new chat? This clears the conversation at this language and level.",
        )
      )
        return;
      this.capture.cancel();
      this.thread().messages = [];
      this.thread().draft = "";
      this.thread().turn = 0;
      this.persist();
      this.render();
      return;
    }
    if (action === "forget") {
      if (
        !confirm(
          "Clear all speaking conversations, practice checks, and microphone consent? Your course progress and notes will stay.",
        )
      )
        return;
      this.reset();
      this.root = document.getElementById("speaking-studio");
      this.render();
      return;
    }
    if (action === "custom-topic") {
      this.persist();
      this.notify("Your subject is set. Send a message to begin exploring it.");
      return;
    }
    if (["record", "dictate-chat", "dictate-repeat"].includes(action)) {
      return this.startVoice(action);
    }
  }
}
