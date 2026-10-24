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

Writing is **self-reviewed**, not automatically or professionally graded. The samples are deliberately short illustrations, not full model essays at every level. Speaking practice is reading aloud; the app does not record speech or assess pronunciation. Quiz completion records practice, not mastery or a qualification.

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

Pronunciation uses browser speech synthesis and available device voices. Playback is manually initiated. Some voices require a device/network speech service; audio availability and quality vary. The application itself makes no requests to Duolingo or paid learning APIs. All app styles, SVGs, and course data are served locally without external fonts or assets.

## Tests

Dependency-free curriculum and persistence tests:

```sh
node --test demos/duolingo/tests/course.test.js
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
