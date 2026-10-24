# Bloom — free English & French practice

A responsive, independent language-learning app with a calmer, garden-inspired design. This replaces the earlier Duolingo-style demo without changing the reverse-engineering tools in this repository. It has no affiliation with Duolingo.

## Run

From the repository root:

```sh
python3 -m http.server 3000 --bind 0.0.0.0 --directory demos/duolingo
```

Open `http://localhost:3000` (or the Arena preview). **No install, build, account, paid API, or subscription is required.** The app uses browser-native ES modules; serve it over HTTP rather than opening `index.html` as a file.

## Courses

| Language | Levels             | Lessons per level | Total lessons |
| -------- | ------------------ | ----------------- | ------------- |
| English  | A1, A2, B1, B2, C1 | 5                 | 25            |
| French   | A1, A2, B1, B2, C1 | 5                 | 25            |

All **50 original lessons, 300 multiple-choice questions, and 50 writing invitations** are free and available immediately. There are no hearts, gems, ads, payments, locked levels, or premium tools.

Each lesson contains:

1. A grammar or communication explanation
2. Three vocabulary items with definitions and pronunciation playback
3. An original reading passage
4. Three vocabulary questions, two grammar/usage questions, and one reading question, all with explanations
5. A writing invitation, optional draft, short sample response, and self-review checklist
6. A completion summary and a place to save a personal note

A1 starts with introductions, routines, food, directions, and descriptions. A2 introduces past events, plans, comparisons, advice, and experiences/habits. B1 covers narrative, hypotheses, opinions, requests, and civic life. B2 develops argument, media literacy, unreal past situations, negotiation, and cohesion. C1 focuses on implication, formal argument, emphasis, diplomacy, and synthesis.

### Important learning boundaries

The labels are **CEFR-inspired intended difficulty**, not accreditation, a placement result, an exhaustive A1–C1 syllabus, or a guarantee of reaching C1. Five lessons at each level are curated practice, not a replacement for a complete language programme. Add substantial real-world reading, listening, conversation, and feedback from qualified teachers or fluent speakers. The support language is English; French examples, passages, and samples are in French.

Writing is **self-reviewed**, not automatically or professionally graded. The samples are deliberately short illustrations, not full model essays at every level. Speaking Studio adds optional local recording, browser dictation, and guided conversation. It does not assess pronunciation acoustically or provide a teacher’s evaluation. Quiz completion records practice, not mastery or a qualification.

## Learning tools

- Independent English/French progress, with every level freely selectable
- Searchable lesson library and bookmarks
- Word studio: recall flashcards from practised and saved lessons; first-lesson words are available immediately
- Simple spaced review: “Got it” schedules reviews after 1, 2, 4, 8, 16, then 30 days; “Again” leaves a card due today. Extra practice does not change scheduled dates.
- Persistent lesson position and writing drafts, including recovery after reload
- Notebook with add/edit/delete, saved lessons, and writing history (latest non-empty submission per lesson)
- Adjustable daily lesson goals, real local activity, streaks, completion counts, and quiz best scores
- A streak counts consecutive local calendar days with completed sessions. Yesterday’s streak remains visible until the end of today. Missing a full day starts a new streak without fees or penalties.
- Personal display name, pronunciation toggle, JSON export, and confirmed reset
- Responsive navigation, inline SVG artwork/icons, keyboard answers (1–3, Enter), focus-trapped dialogs, reduced-motion support

Everything is saved in this browser’s `localStorage` under `bloom-language-learning-v1`. No account or server database exists. Clearing browser data removes progress. Export creates a personal JSON record; in-app restore/import is not currently implemented. The previous demo’s `duo-demo-progress` key is untouched. If storage is blocked or full, a message explains that progress is temporary.

Pronunciation uses browser speech synthesis and available device voices. Playback is manually initiated. Some voices require a device/network speech service; audio availability and quality vary. Browser dictation in Speaking Studio may send audio to your browser provider. The application itself makes no requests to Duolingo or paid learning APIs. All app styles, SVGs, and course data are served locally without external fonts or assets.

## Tests

Dependency-free curriculum and persistence tests:

```sh
node --test demos/duolingo/tests/*.test.js
```

Optional real Chromium smoke test, with the server running and Playwright installed in your test environment:

```sh
node demos/duolingo/tests/browser.mjs
```

Use `BLOOM_URL` for a different server URL, `PLAYWRIGHT_MODULE` for an absolute path to a separate Playwright installation, and `CHROMIUM_PATH` for an existing Chromium executable. These are test-only dependencies, not application requirements.

The smoke test covers French C1 and English A1 lessons, correct/incorrect feedback, pause and reload, draft recovery, completion idempotency, independent course progress, goals, bookmarks, filtered search, notes CRUD and HTML escaping, review scheduling, settings, small-screen routes, and reset.

## Files

- `curriculum.js`: original course content and lesson catalog
- `state.js`: persisted-state validation, local calendar helpers, and completion accounting
- `app.js`: views, lesson flow, review interactions, and browser integration
- `styles.css`: responsive design and accessible focus/contrast rules
- `tests/`: curriculum/state regression tests and optional browser smoke test

## Speaking Studio — English & French, A1–C1

Open **Speaking** (the microphone icon) or use `/#speaking` directly. Both languages have five levels, each with a speaking goal, a conversation starter, four follow-up prompts, a longer speaking challenge, and three listen-and-repeat exercises: **30 distinct sound-focused practice phrases** in total.

### Three practice modes

- **Conversation bot:** Pip is a free **local, rule-based bot**, not a generative AI or a factual knowledge assistant. Pick one of seven topic areas or enter your own subject. It offers level-appropriate prepared questions, optional spoken replies, and a few explicit standard-grammar suggestions. No suggestion does **not** mean the response is error-free. There is no application quota on the number of messages, no account, no model download, and no API key. Each turn has a 1,200-character bound; the latest 25 turns per language/level are retained in local storage, with older turns rolling off.
- **Listen & repeat:** Listen at normal or slower speed, practise one of three phrases at each level, read a specific sound/phrasing tip, record a take for playback, or use browser dictation. An editable transcript is aligned against the expected words. Highlights show matched, substituted, missing, or extra **words**. This is text comparison, **not an acoustic pronunciation score**; recogniser errors, noise, or different wording can produce mismatches, and a match does not prove correct pronunciation. Self-reported practice checks are saved separately from course XP.
- **Speaking challenge:** Record an open response to a level-appropriate prompt and self-review its clarity, organisation, and delivery. No automatic grading or transcription of these recordings is performed. Recordings stop after 90 seconds; longer challenges can be practised in separate segments, listening before beginning a new take.

### Microphone and privacy

Record and Dictate buttons are clickable immediately. The first press opens a clear consent dialog; confirming enables voice controls and starts the browser microphone request in that same click. The disclosure checkbox remains an alternative opt-in, not a prerequisite hidden elsewhere on the page. Only an already-active capture temporarily disables other capture buttons. Browser/OS microphone permission is a separate requirement. The production Permissions-Policy allows the microphone on the app’s own origin, but never the camera or geolocation. Use the public HTTPS site directly; an embedded preview may not delegate microphone permission.

**Browser dictation** uses `SpeechRecognition`/`webkitSpeechRecognition` if available, with `en-GB` or `fr-FR`. It may send audio to the browser provider’s network service and may require internet or be subject to provider restrictions. It is not an app-hosted speech model and cannot be promised to work offline or without provider limits. Chrome/Edge are suggested, but support varies by device. Results are placed into a draft and are never automatically sent to the bot; review the text and press Send yourself. Typed chat and recording/self-review remain alternatives when dictation is unsupported or fails.

**Local recording** uses `getUserMedia` and `MediaRecorder`. Audio is not uploaded by Bloom or saved in local storage. Playback is available in the current tab until a new take, exercise/mode/language change, clearing consent, or navigation discards it. Leaving the section, cancelling a pending request, or withdrawing consent stops active capture; a late permission grant is released immediately. Temporary recording URLs are revoked. Closing/reloading the page loses the audio.

Chat drafts, recent messages, consent choice, and self-reported phrase practice are stored under `bloom-speaking-v1`. Course export includes these records. The Studio’s clear-history button resets only speaking data; the main Settings reset clears both speaking and course data. Browser microphone grants must be managed in browser settings separately.

### Speaking validation

```sh
node --test demos/duolingo/tests/speaking.test.js
node demos/duolingo/tests/speaking.browser.mjs
```

The optional browser test uses simulated speech-recognition results to test integration, language settings, transcript review, and fallback behavior. It tests real Chromium MediaRecorder with browser-generated fake microphone input, including blob playback, track release, cancellation, and URL revocation. **These tests do not establish real-device microphone quality, provider speech-recognition availability, human pronunciation accuracy, or comprehensive grammar correction.** Try the live site on your actual device to confirm its voice-service support.

Speaking implementation is isolated in `speaking-content.js` (authored prompts, explicit text rules, bounded word alignment), `speech-media.js` (capture resource lifecycle), and `speaking.js` (Studio UI and local history).

### Recording recovery

If recording fails, the Studio distinguishes an insecure page, an iframe/Permissions-Policy block, a denied permission, a missing microphone, and a busy/unreadable device. It shows site/OS permission instructions and a direct link to the public HTTPS site. Retry with Record after fixing the device or browser setting; no account, payment, or hidden checkbox is needed. The app cannot override browser or operating-system permission decisions.

Regression checks include first-click consent (including cancellation without capture), challenge-mode recording without ticking the checkbox, real Chromium MediaRecorder with fake input, actionable denial/retry, and simulated missing/busy devices and iframe/insecure contexts. Physical microphones on the user’s device are not verified by these automated tests.
