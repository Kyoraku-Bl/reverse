/**
 * Vocabulary for the general-purpose half of the library: marketing, code,
 * writing, image generation, business, agents, SEO, data and learning prompts.
 */

export const AUDIENCES = [
  "time-poor founders", "enterprise procurement teams", "senior engineers", "first-time buyers",
  "design-literate operators", "small business owners", "indie hackers", "marketing managers",
  "parents", "students", "clinicians", "investors", "journalists", "recruiters",
  "non-technical executives", "developers evaluating a switch", "existing customers up for renewal",
  "cold outbound prospects", "community moderators", "agency owners",
];

export const VOICES = [
  { label: "Plain and direct", spec: "Short declarative sentences. No adjectives doing work a noun could do. Never open a sentence with 'In today's'." },
  { label: "Warm and conversational", spec: "Second person, contractions allowed, the occasional aside in brackets. Reads like a knowledgeable friend, not a brochure." },
  { label: "Precise and technical", spec: "Exact nouns, version numbers and units. Define a term on first use, then use it consistently. No metaphor where a measurement exists." },
  { label: "Editorial and confident", spec: "Longer sentences with a clear rhythm, strong verbs, and one contrarian claim per piece that the rest of the piece earns." },
  { label: "Dry and witty", spec: "Understatement, deadpan specifics, one joke per 200 words maximum. The joke must be about the subject, never about the reader." },
  { label: "Calm and reassuring", spec: "Name the reader's worry in their own words before answering it. No exclamation marks. No urgency mechanics." },
  { label: "Punchy and commercial", spec: "Fragments for effect. Numbers early. One clear ask repeated in different words. Built to be skimmed on a phone." },
  { label: "Academic but readable", spec: "Hedged claims with evidence attached, signposted structure, and a plain-language summary at the top for non-specialists." },
];

export const MARKETING_CHANNELS = [
  { label: "Cold email", format: "a 4-email outbound sequence", length: "90-140 words per email", rule: "One idea per email. The first line must reference something specific about the recipient. No 'I hope this finds you well'. Every email ends with a single low-friction ask." },
  { label: "Landing page", format: "full landing page copy", length: "600-900 words", rule: "Structure: headline, subhead, social proof, three benefit blocks, how-it-works, objection handling, pricing anchor, FAQ, final CTA. Headline under 11 words and containing the outcome, not the mechanism." },
  { label: "LinkedIn post", format: "a LinkedIn post", length: "130-220 words", rule: "First line must survive truncation at 210 characters. No hashtag wall — at most three, at the end. One concrete number or story beat per post." },
  { label: "X / Twitter thread", format: "a 6-9 tweet thread", length: "under 280 characters per tweet", rule: "Tweet 1 is the payoff. Each following tweet earns its place with a new fact. Final tweet is the ask. No '1/' style numbering." },
  { label: "Paid social ad", format: "5 ad variations with hooks", length: "primary text 60-120 words, headline under 40 characters", rule: "Each variation tests a different hook: pain, outcome, contrarian claim, social proof, specificity. Keep the CTA identical across all five so the test is clean." },
  { label: "Newsletter", format: "a newsletter issue", length: "450-700 words", rule: "One subject line plus two alternates for testing. Open with the most useful thing, not a preamble. One primary link, clearly marked." },
  { label: "Product launch", format: "a launch plan with assets", length: "a timeline plus every asset written out", rule: "Cover T-14 to T+7 days. Include the announcement post, the email to existing users, the changelog entry, the sales one-pager and the internal briefing." },
  { label: "Case study", format: "a customer case study", length: "700-1000 words", rule: "Structure as situation, complication, intervention, measurable result. The customer is the protagonist, the product is the tool. Every result needs a baseline and a timeframe." },
  { label: "Video script", format: "a 60-90 second video script", length: "150-230 spoken words", rule: "Two columns: visual and audio. Hook in the first 3 seconds. One message. Spoken language, not written language — no clause longer than a breath." },
  { label: "Webinar", format: "a webinar outline with slide notes", length: "45 minutes of content", rule: "Teach one complete thing. Give away the what and the why, sell the implementation. Include three audience polls and the exact transition into the offer." },
  { label: "Referral program", format: "a referral program with all messaging", length: "the mechanic plus 6 assets", rule: "Define the reward, the trigger and the cap. Then write the invite email, the in-app prompt, the share text, the reminder, the reward notification and the FAQ." },
  { label: "PR pitch", format: "a press pitch", length: "180-260 words", rule: "Lead with the news, not the company. Name the data or the angle that makes it relevant this week. Include one quotable line and the contact's availability." },
];

export const CODE_TASKS = [
  { label: "Refactor for clarity", task: "refactor a module for clarity without changing behaviour", extra: "Preserve every public signature. Explain each change as: what was wrong, what you did, why it is safe. Flag anything you could not verify." },
  { label: "Write tests", task: "write a test suite for existing code", extra: "Cover behaviour, not implementation. Include edge cases: empty input, single item, maximum size, malformed input, concurrent access. Name tests after the behaviour they assert." },
  { label: "Debug from a stack trace", task: "diagnose a bug from a stack trace and a description", extra: "List hypotheses ranked by likelihood, the one experiment that would discriminate between the top two, and the fix for each. Do not guess a single root cause." },
  { label: "Design a schema", task: "design a database schema for a described domain", extra: "Give tables, columns, types, constraints and indexes. Justify every index by the query it serves. Call out the queries this schema handles badly." },
  { label: "Implement an API", task: "implement a REST or RPC endpoint to spec", extra: "Specify request and response shapes, validation rules, status codes for every failure mode, idempotency behaviour and rate limiting." },
  { label: "Optimise performance", task: "profile and optimise a slow code path", extra: "Ask what has already been measured. Propose changes ordered by expected gain over effort. State the measurement that would confirm each one." },
  { label: "Migrate a dependency", task: "plan and execute a dependency or framework migration", extra: "Produce a phased plan with a rollback at each phase, the codemods or scripts you would write, and the tests that must pass before moving on." },
  { label: "Code review", task: "review a diff as a senior engineer", extra: "Separate blocking issues from suggestions from nits. For each: the line, the problem, the risk if ignored, and a concrete alternative. Never review style that a formatter owns." },
  { label: "Explain unfamiliar code", task: "explain what an unfamiliar codebase does", extra: "Start with the entry point and follow one real request end to end. Name the modules and their responsibilities. Mark every inference as an inference." },
  { label: "Write a CLI", task: "design and implement a command-line tool", extra: "Define the command grammar, flags, exit codes, stdout vs stderr discipline, and the --help text. Non-interactive by default; prompt only when a flag is missing." },
  { label: "Security hardening", task: "audit code for security issues", extra: "Check input validation, authentication, authorisation, secrets handling, injection surfaces, deserialisation and dependency exposure. Rate each finding by exploitability, not severity alone." },
  { label: "Build a script", task: "write a one-off data or file-processing script", extra: "Idempotent where possible, dry-run by default, progress output to stderr, and a summary at the end. Never delete anything without an explicit flag." },
  { label: "Architecture decision", task: "write an architecture decision record", extra: "Context, decision, alternatives considered with the reason each was rejected, consequences both good and bad, and the trigger that would reopen the decision." },
  { label: "Generate fixtures", task: "generate realistic test fixtures and seed data", extra: "Data must look real: plausible names, correctly formatted identifiers, varied distributions and deliberate edge cases. Deterministic seed so runs are reproducible." },
];

/**
 * Language → stacks that actually exist in that language.
 *
 * Drawing the language and the stack independently produced nonsense briefs
 * ("Zig · FastAPI + SQLAlchemy"), which is exactly the kind of plausible-but-
 * wrong detail that makes a generated prompt untrustworthy. The stack is now
 * always chosen from the language's own list.
 */
export const CODE_LANGUAGES = [
  "TypeScript", "Python", "Go", "Rust", "Java", "Kotlin", "Swift", "C#", "C++", "PHP",
  "Ruby", "Elixir", "SQL", "Bash", "Zig", "Scala",
];

export const CODE_STACKS_BY_LANGUAGE = {
  TypeScript: ["Next.js + Postgres", "Node + Express", "Remix + SQLite", "Astro + a headless CMS", "SvelteKit + Supabase", "tRPC + Prisma"],
  Python: ["FastAPI + SQLAlchemy", "Django + DRF", "Flask + SQLite", "pandas + DuckDB", "Typer CLI + httpx"],
  Go: ["Gin + GORM", "net/http + sqlc", "Cobra CLI + a REST backend"],
  Rust: ["Actix + Diesel", "Axum + SQLx", "Clap CLI + reqwest"],
  Java: ["Spring Boot + JPA", "Quarkus + Hibernate"],
  Kotlin: ["Ktor + Exposed", "Spring Boot + jOOQ"],
  Swift: ["Vapor + Fluent", "SwiftUI with a local store"],
  "C#": ["ASP.NET Core + EF Core", "Minimal API + Dapper"],
  "C++": ["CMake + Boost.Asio", "a single-binary tool with the standard library only"],
  PHP: ["Laravel + Eloquent", "Symfony + Doctrine"],
  Ruby: ["Rails + ActiveRecord", "Sinatra + Sequel"],
  Elixir: ["Phoenix + Ecto", "Oban + a GenServer pipeline"],
  SQL: ["Postgres 16", "DuckDB", "BigQuery", "SQLite"],
  Bash: ["a POSIX shell script", "a GNU make pipeline", "a deployment script over ssh"],
  Zig: ["a single-binary CLI with no libc", "a Zig build.zig project with cinterop"],
  Scala: ["Play + Slick", "Spark + Delta Lake"],
};

export const WRITING_FORMATS = [
  { label: "Blog article", spec: "1,200-1,800 words with an H1, a standfirst, H2 sections, and a closing section that is not a summary. Every claim either carries evidence or is marked as opinion." },
  { label: "Essay", spec: "900-1,400 words with a single argument that develops across the piece. No listicles, no subheads longer than four words, and a first line that would work as the last line of a different essay." },
  { label: "Documentation page", spec: "Task-oriented: what this does, when to use it, when not to, the shortest working example, then the options. Every code block must run as written." },
  { label: "README", spec: "Badges aside: one-paragraph description, a 30-second quickstart, an example with real output, configuration table, and links to deeper docs. Written for someone who has never seen the project." },
  { label: "Internal memo", spec: "One page. Recommendation in the first sentence, then context, then the decision you need, then risks. Written to be forwarded without editing." },
  { label: "Speech", spec: "Written for the ear: short clauses, deliberate repetition at the turns, and pauses marked. Include the timing — words per minute is roughly 140." },
  { label: "Interview transcript cleanup", spec: "Remove filler, repair false starts and merge split answers, without changing meaning or voice. Mark every elision with [ ] and every paraphrase." },
  { label: "Product description", spec: "40-80 words. Lead with the outcome, name the material or mechanism, then the specification. No superlatives the product cannot prove." },
  { label: "Email to a difficult recipient", spec: "Acknowledge their position accurately before stating yours. One clear ask. No passive aggression, no over-apologising, and an exit that leaves the relationship intact." },
  { label: "Report", spec: "Executive summary of 200 words that stands alone, then method, findings, limitations and recommendations. Numbers in tables, never in prose paragraphs of more than three figures." },
  { label: "Story", spec: "1,500-2,500 words of fiction. A character who wants something, an obstacle that is specific, and an ending that changes something irreversible. Show the setting through one telling detail, not a description." },
  { label: "Script / dialogue", spec: "Scene headings, action lines under three lines each, and dialogue where each character has a distinguishable voice and a want in the scene." },
];

export const IMAGE_STYLES = [
  { label: "Editorial photography", spec: "Shot on a 50mm f/1.8, natural window light from camera-left, shallow depth of field, muted contrast, subtle film grain, no retouching that removes skin texture." },
  { label: "Studio product shot", spec: "Seamless background, one large softbox overhead and a negative fill on the right, 100mm macro, focus-stacked for full sharpness, colour-accurate to the reference." },
  { label: "Cinematic still", spec: "Anamorphic 2.39:1, teal-and-orange grade lifted in the shadows, practical light sources visible in frame, atmospheric haze, 35mm grain." },
  { label: "Isometric 3D render", spec: "Orthographic camera, 30-degree isometric projection, soft ambient occlusion, matte plastic and brushed metal materials, three-colour palette, clean studio lighting." },
  { label: "Risograph print", spec: "Two or three spot colours with visible misregistration, halftone dot texture, uncoated paper grain showing through, flat graphic shapes, no gradients except from the dither." },
  { label: "Brutalist graphic", spec: "One typeface, maximum weight contrast, exposed grid, raw edges, high-contrast black on off-white, no decoration, elements allowed to collide." },
  { label: "Watercolour illustration", spec: "Wet-on-wet washes with visible bloom edges, granulating pigment in the shadows, white paper left as the highlight, loose ink line drawn after the paint dried." },
  { label: "Retro-futurism", spec: "1970s airbrush technique, chrome and glass, saturated sunset gradient sky, lens flare, retro sci-fi typography, slight VHS softness." },
  { label: "Macro nature", spec: "100mm macro at f/5.6, focus-stacked, dawn light, visible water droplets, background dissolved into a smooth bokeh wash, true-to-life colour." },
  { label: "Architectural photography", spec: "Tilt-shift corrected verticals, blue hour, interior lights on, long exposure for cloud movement, neutral white balance, no HDR halo." },
  { label: "Flat vector illustration", spec: "Geometric shapes, a four-colour palette, no outlines or consistent 2px outlines, flat fills with one shade for depth, balanced negative space." },
  { label: "Analogue documentary", spec: "35mm black-and-white, pushed two stops, available light, slight motion blur where it tells the truth, unposed subjects, visible frame edge." },
];

export const IMAGE_SUBJECTS = [
  "a solo founder working late", "an abstract architectural form", "a product floating in space",
  "a landscape at a specific hour", "a portrait with environmental context", "a food spread overhead",
  "an animal in an unexpected setting", "a city street in weather", "a workspace flat lay",
  "a scientific concept made visible", "a vehicle in motion", "an interior with one occupant",
  "a texture close-up", "a crowd from above", "a still life with artificial light",
  "a child's drawing reimagined professionally",
];

export const BUSINESS_SCENARIOS = [
  { label: "Market entry", deliverable: "a market entry assessment", framework: "size the market bottom-up from a named customer, map the incumbents and their actual weaknesses, identify the entry wedge, and state the three assumptions that would kill the plan." },
  { label: "Pricing", deliverable: "a pricing recommendation", framework: "derive willingness to pay from the value created rather than from cost, propose two or three tiers with a clear reason each exists, and model revenue at three adoption rates." },
  { label: "Fundraising", deliverable: "a fundraising narrative and deck outline", framework: "problem, why now, insight, product, traction with cohort context, market, business model, competition as a positioning map, team, ask and use of funds." },
  { label: "Hiring plan", deliverable: "a hiring plan for the next four quarters", framework: "name the bottleneck each hire removes, sequence hires by dependency, write the scorecard for the first three roles, and give the interview loop for each." },
  { label: "Cost reduction", deliverable: "a cost reduction plan that does not damage the product", framework: "categorise spend by whether the customer can perceive it, cut the imperceptible first, quantify the risk of each cut, and define the metric that would trigger a reversal." },
  { label: "Competitive response", deliverable: "a response to a competitor's move", framework: "state what they actually did, what it signals about their constraints, the three responses available with the cost of each, and the recommendation with a decision deadline." },
  { label: "Partnership", deliverable: "a partnership proposal and negotiation brief", framework: "what each side gets, what each side gives, the metrics both will report on, the exit clause, and the walk-away point stated before the first meeting." },
  { label: "Post-mortem", deliverable: "a blameless incident or project post-mortem", framework: "timeline with times and timezones, what was expected, what happened, contributing factors ranked, what went well, and action items with owners and dates." },
  { label: "OKR planning", deliverable: "a quarter of OKRs", framework: "two or three objectives that are qualitative and time-bound, each with three measurable key results that are outcomes rather than tasks. Include the list of things explicitly not being done." },
  { label: "Exit readiness", deliverable: "an acquisition or exit readiness review", framework: "what a buyer diligence-requests first, the gaps in the data room, the concentration risks, the metrics that need twelve clean months, and the valuation range with its drivers." },
  { label: "Retention", deliverable: "a retention diagnosis and plan", framework: "define activation, measure cohort curves, locate the drop-off step, propose three interventions ranked by evidence strength, and define the experiment for each." },
  { label: "Operations", deliverable: "an operating rhythm for a small company", framework: "which meetings exist, their cadence, their input artefact and their output decision. Cut every meeting that produces no decision." },
];

export const AGENT_TASKS = [
  { label: "Research agent", task: "research a topic and return a cited brief", tools: "web search, page fetch, note store", loop: "plan queries, read, extract claims with sources, identify contradictions, then synthesise", guardrails: "never state a fact without a source; mark single-source claims; stop after a fixed number of rounds and report coverage." },
  { label: "Support triage agent", task: "classify and route inbound support tickets", tools: "ticket API, knowledge base search, drafting", loop: "read, classify, retrieve relevant policy, draft a reply, escalate if confidence is low", guardrails: "never invent a policy; never promise a refund or a date; hand off to a human when the customer is upset or the issue is legal." },
  { label: "Code review agent", task: "review pull requests before a human does", tools: "git, diff, test runner, linter", loop: "read the diff, run the tests, check against the project's written conventions, comment inline", guardrails: "comment only on what it can justify; never approve its own changes; never modify files outside the diff." },
  { label: "Data pipeline agent", task: "ingest, clean and validate a dataset on a schedule", tools: "file storage, SQL, validation library", loop: "fetch, schema-check, transform, validate row counts and distributions, load, report", guardrails: "quarantine rather than drop bad rows; alert on distribution shift; never overwrite a previous partition." },
  { label: "Content agent", task: "produce a week of content from one source idea", tools: "CMS API, image generation, style guide", loop: "extract the core idea, adapt per channel, check against the style guide, schedule", guardrails: "every claim traceable to the source; nothing published without a human approval step; no channel-specific clichés." },
  { label: "Monitoring agent", task: "watch a system and explain anomalies", tools: "metrics API, log search, alerting", loop: "poll, compare to a learned baseline, correlate across signals, open an incident with a hypothesis", guardrails: "one alert per root cause; include the evidence in the alert; never take a remediation action without approval." },
  { label: "Sales research agent", task: "prepare a briefing before every outbound call", tools: "CRM, company data, news search", loop: "gather firmographic data, find three recent signals, map to the product's value, draft the opening line", guardrails: "cite the source and date of every signal; never fabricate a connection; flag when the account is a poor fit." },
  { label: "Migration agent", task: "move content or code from one system to another", tools: "source API, target API, diff tool", loop: "inventory, map fields, migrate a sample, verify, then batch", guardrails: "dry-run first, reversible writes only, checksum verification, and a full inventory of anything it skipped." },
];

export const SEO_INTENTS = [
  { label: "Informational", pageType: "a long-form guide", goal: "answer the query completely on the page so no click-through is needed, then offer the next step" },
  { label: "Commercial investigation", pageType: "a comparison or best-of page", goal: "give a genuine ranking with the trade-offs stated, so the reader trusts the recommendation" },
  { label: "Transactional", pageType: "a product or pricing page", goal: "remove every friction between intent and purchase, and answer the objection that stops the click" },
  { label: "Navigational", pageType: "a brand or product landing page", goal: "confirm the reader is in the right place within one second and route them" },
  { label: "Local", pageType: "a location page", goal: "prove relevance to a specific place with real local detail, not a template with the city name swapped in" },
];

/**
 * `label` is the short form used in titles and slugs; `full` is the sentence
 * that goes into the prompt body. Keeping them separate stops titles from
 * being truncated mid-word.
 */
export const SEO_DELIVERABLES = [
  { label: "Keyword map", full: "a keyword map clustering terms by intent and by the page that should rank" },
  { label: "Content brief", full: "a full content brief with heading structure, entities to cover and the questions to answer" },
  { label: "Title & meta set", full: "a title tag and meta description set for ten URLs, each within pixel limits" },
  { label: "Internal linking plan", full: "an internal linking plan with the exact anchor text for every link" },
  { label: "Technical audit", full: "a technical audit checklist ordered by impact, with how to verify each fix" },
  { label: "Schema markup", full: "a schema.org markup block for the page type with every required and recommended property" },
  { label: "Content refresh plan", full: "a content refresh plan identifying which existing URLs to update, merge or retire" },
  { label: "Competitor gap analysis", full: "a competitor gap analysis naming the topics they rank for and you do not" },
];

export const DATA_TASKS = [
  { label: "Exploratory analysis", method: "describe the shape, distributions, missingness and outliers before any modelling; end with the five questions the data raises", output: "a written summary with the supporting figures described in words" },
  { label: "Cohort analysis", method: "define the cohort by first action, align on weeks since, compute retention per cohort, and look for the flattening point", output: "a retention table and the interpretation of where the curve bends" },
  { label: "Experiment design", method: "state the hypothesis, the minimum detectable effect, the power, the sample size calculation, the assignment unit and the stopping rule", output: "a design document plus the analysis plan written before any data is seen" },
  { label: "Forecasting", method: "decompose trend and seasonality first, fit a simple baseline, then a model, and compare on a held-out period with a stated error metric", output: "point forecasts with intervals, and an honest statement of what would break the forecast" },
  { label: "Segmentation", method: "choose features that matter to the decision, standardise, cluster, then profile each cluster in plain language and check stability across runs", output: "named segments with size, behaviour and the action each implies" },
  { label: "Anomaly detection", method: "establish a baseline per metric with its own seasonality, define the deviation threshold, and require corroboration across at least two signals", output: "a ranked list of anomalies with the evidence for each" },
  { label: "Attribution", method: "state the model's assumptions, compare a simple last-touch against a data-driven view, and quantify how the budget would change under each", output: "channel contributions with the uncertainty range and the recommendation" },
  { label: "Data cleaning", method: "document every transformation with the reason, quarantine rows that fail validation rather than dropping them, and keep the raw data immutable", output: "a clean dataset plus a full transformation log" },
];

export const LEARNING_GOALS = [
  { label: "Learn from zero", format: "a structured curriculum", cadence: "a 12-week plan, 5 hours a week", rule: "Each week has one concept, one exercise that cannot be done without understanding it, and one thing to build. No week depends on material from more than three weeks back." },
  { label: "Pass an exam", format: "a revision plan", cadence: "countdown from the exam date", rule: "Diagnose first with a full past paper. Then allocate time by weakness, not by interest. Spaced repetition for facts, timed practice for technique." },
  { label: "Build a project", format: "a project-driven learning path", cadence: "six weeks to a working artefact", rule: "The project defines the syllabus. Learn each topic at the moment the project needs it. Ship something every week, however rough." },
  { label: "Explain to someone else", format: "a teaching script", cadence: "a 45-minute session", rule: "Build from what the learner already knows. One analogy per concept, and name where the analogy breaks. Check understanding with questions that require application, not recall." },
  { label: "Catch up on a field", format: "a literature map", cadence: "ten hours of reading", rule: "Identify the five papers everyone cites, the two current disagreements, and the one survey that orients a newcomer. Read in that order." },
  { label: "Master a tool", format: "a practical drill set", cadence: "twenty minutes a day for three weeks", rule: "Drills get progressively less scaffolded. The final drill has no instructions, only a goal and a definition of done." },
];

/**
 * Writing subjects. `label` is short enough for a title without truncation;
 * `full` is the sentence the writer actually receives.
 */
export const WRITING_TOPICS = [
  { label: "Why AI sites all look the same", full: "why most AI-generated sites look the same" },
  { label: "The cost of a premature abstraction", full: "the hidden cost of a premature abstraction" },
  { label: "Taste, after four years of client work", full: "what four years of client work taught us about taste" },
  { label: "Reading a retention curve honestly", full: "how to read a retention curve honestly" },
  { label: "The case for boring infrastructure", full: "the case for boring infrastructure" },
  { label: "Why design systems fail in small teams", full: "why design systems fail inside small teams" },
  { label: "What performance budgets change", full: "what performance budgets actually change" },
  { label: "The ethics of persuasive defaults", full: "the ethics of persuasive defaults" },
  { label: "Post-mortems people do not dread", full: "how to run a post-mortem people do not dread" },
  { label: "Writing things down beats meetings", full: "why writing things down beats meetings" },
  { label: "Simple is not the same as easy", full: "the difference between simple and easy" },
  { label: "Pricing a service you are still learning", full: "how to price a service you are still learning" },
  { label: "What onboarding really optimises for", full: "what a good onboarding really optimises for" },
  { label: "The slow craft of a readable API", full: "the slow craft of a readable API" },
  { label: "Your metrics dashboard is lying", full: "why your metrics dashboard is lying to you" },
  { label: "How to say no to a customer", full: "how to say no to a customer" },
];

export const SUBJECTS = [
  "machine learning", "distributed systems", "typography", "accounting", "organic chemistry",
  "negotiation", "statistics", "systems design", "colour theory", "macroeconomics",
  "databases", "computer graphics", "public speaking", "contract law", "cell biology",
  "information security", "linear algebra", "user research", "supply chains", "music theory",
];

export const LEVELS = ["complete beginner", "intermediate practitioner", "advanced specialist", "expert teaching a peer"];
