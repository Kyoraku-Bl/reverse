#!/usr/bin/env node
/**
 * Generates the PromptWorld dataset into public/data/prompts.json.
 *
 * The library holds 1,300+ prompts. They are generated from structured
 * parameters rather than listed by hand: each entry stores the *decisions* that
 * make it specific (palette hexes, motion system, scene technique, audience,
 * constraints) and src/lib/prompt-text.ts renders those decisions into the full
 * prompt text at build time and in the browser. That keeps the dataset small
 * enough to ship to the client while every prompt stays genuinely distinct.
 *
 * Deterministic: the same commit always produces the same dataset.
 *
 *   node scripts/generate-prompts.mjs [--check]
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Random, slugify } from "./lib/rng.mjs";
import { PALETTES, MOODS, NAME_HEADS, NAME_TAILS, STANDALONE_NAMES } from "./lib/palettes.mjs";
import {
  INDUSTRIES, HERO_TECHNIQUES, MOTION_SYSTEMS, FONT_PAIRINGS, SECTION_ARCHETYPES,
  EASINGS, SCENE_SUBJECTS, SCENE_TECHNIQUES, SCENE_MOODS, SECTION_TYPES,
  SECTION_INTERACTIONS, BACKGROUND_STYLES, GRADIENT_TYPES,
} from "./lib/pools-design.mjs";
import {
  AUDIENCES, VOICES, MARKETING_CHANNELS, CODE_TASKS, CODE_LANGUAGES, CODE_STACKS_BY_LANGUAGE,
  WRITING_FORMATS, WRITING_TOPICS, IMAGE_STYLES, IMAGE_SUBJECTS, BUSINESS_SCENARIOS,
  AGENT_TASKS, SEO_INTENTS, SEO_DELIVERABLES, DATA_TASKS, LEARNING_GOALS, SUBJECTS, LEVELS,
} from "./lib/pools-vault.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Full dataset. Read from disk by server components and the prompt-text API. */
const OUT = join(ROOT, "data", "prompts.json");
/** Compact index (no prompt parameters) served to the browser for search. */
const OUT_INDEX = join(ROOT, "public", "data", "index.json");

/**
 * Card thumbnails are rendered with CSS rather than images, so the index only
 * needs a few colours and a pattern id per prompt. Twelve patterns keep 1,360
 * cards from looking identical while costing nothing to ship.
 */
const PATTERNS = [
  "aurora", "rings", "mesh", "grid", "beams", "orb",
  "waves", "dots", "shards", "horizon", "noise", "column",
];

const CATEGORIES = [
  { id: "templates", group: "design", label: "Templates", blurb: "Full cinematic pages and heroes, ready to ship as one self-contained file.", order: 1 },
  { id: "scenes", group: "design", label: "3D Scenes", blurb: "Real-time WebGL scenes — particles, fluid, terrain, glass and shader fields.", order: 2 },
  { id: "sections", group: "design", label: "Sections", blurb: "Drop-in page blocks, each with its own motion and interaction.", order: 3 },
  { id: "backgrounds", group: "design", label: "Backgrounds", blurb: "Animated backdrops in CSS, SVG and canvas — light enough to keep 100 performance.", order: 4 },
  { id: "gradients", group: "design", label: "Gradients", blurb: "Interactive gradients, from dithered two-stops to raymarched mesh fields.", order: 5 },
  { id: "marketing", group: "vault", label: "Marketing & Copy", blurb: "Email sequences, landing pages, launches, case studies and paid social.", order: 6 },
  { id: "code", group: "vault", label: "Code & Engineering", blurb: "Refactors, tests, debugging, schemas, reviews and architecture decisions.", order: 7 },
  { id: "writing", group: "vault", label: "Writing & Content", blurb: "Articles, essays, docs, memos, speeches and fiction with a defined voice.", order: 8 },
  { id: "image", group: "vault", label: "Image Generation", blurb: "Photoreal, illustrative and graphic prompts with real camera and material language.", order: 9 },
  { id: "business", group: "vault", label: "Business & Strategy", blurb: "Pricing, market entry, OKRs, post-mortems and fundraising narratives.", order: 10 },
  { id: "agents", group: "vault", label: "Agents & Automation", blurb: "Agent specifications with tools, control loops and hard guardrails.", order: 11 },
  { id: "seo", group: "vault", label: "SEO & Growth", blurb: "Keyword maps, briefs, metadata, internal linking and technical audits.", order: 12 },
  { id: "data", group: "vault", label: "Data & Research", blurb: "Analysis, experiment design, forecasting, segmentation and attribution.", order: 13 },
  { id: "learning", group: "vault", label: "Learning & Teaching", blurb: "Curricula, revision plans, drill sets and explanations that hold up.", order: 14 },
];

const TARGETS = {
  templates: 150,
  scenes: 170,
  sections: 170,
  backgrounds: 130,
  gradients: 110,
  marketing: 100,
  code: 100,
  writing: 80,
  image: 90,
  business: 60,
  agents: 60,
  seo: 50,
  data: 50,
  learning: 40,
};

const rand = new Random(0x5eed1a7);

/* ------------------------------- utilities ------------------------------- */

const usedSlugs = new Set();
const usedTitles = new Set();

function uniqueSlug(base) {
  let slug = slugify(base);
  if (!slug) slug = "layer";
  // Keep URLs readable and shareable; the counter below preserves uniqueness.
  if (slug.length > 56) {
    slug = slug.slice(0, 56).replace(/-+$/, "");
  }
  let candidate = slug;
  let n = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${slug}-${n}`;
    n += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

/**
 * Names for design layers.
 *
 * Draws until it finds a name nothing else in the library uses. Previously each
 * category sampled independently from the same 50 standalone names, so roughly
 * one layer in seven ended up numbered ("Keel 04") — weak for a library where
 * the name is the identity. Head+tail gives 3,400 pairings against ~710 design
 * layers, so an unused name is always available without a suffix.
 */
const usedNames = new Set();

function drawName(i) {
  if (i < STANDALONE_NAMES.length && rand.chance(0.4)) return rand.pick(STANDALONE_NAMES);
  return rand.chance(0.92)
    ? `${rand.pick(NAME_HEADS)} ${rand.pick(NAME_TAILS)}`
    : rand.pick(NAME_HEADS);
}

function designName(i) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const name = drawName(i);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // Effectively unreachable, but never emit a duplicate.
  const base = drawName(i);
  let n = 2;
  while (usedNames.has(`${base} ${String(n).padStart(2, "0")}`)) n += 1;
  const fallback = `${base} ${String(n).padStart(2, "0")}`;
  usedNames.add(fallback);
  return fallback;
}

/**
 * Build a title from segments, dropping trailing ones until it fits.
 *
 * Truncating mid-word with an ellipsis made titles unreadable in cards, in the
 * palette and in search results — a dropped qualifier is always better.
 */
function vaultTitle(segments, max = 68) {
  const parts = segments.filter(Boolean);
  while (parts.length > 1 && parts.join(" — ").length > max) parts.pop();
  let title = parts.join(" — ");
  if (title.length > max) title = title.slice(0, max).replace(/[\s—·,-]+$/, "");
  return title;
}

function copiesFor(category) {
  const base = { templates: 240, scenes: 150, sections: 130, backgrounds: 95, gradients: 85 }[category] ?? 70;
  return rand.int(Math.round(base * 0.15), base);
}

function updatedOn() {
  // Spread across the ten months before the build date so the library looks
  // maintained without inventing future releases.
  const end = new Date("2026-10-20T00:00:00Z").getTime();
  const start = new Date("2025-12-01T00:00:00Z").getTime();
  return new Date(start + rand.float() * (end - start)).toISOString().slice(0, 10);
}

function pushEntry(entry) {
  // Loop rather than append a single suffix: one fixed suffix can itself collide
  // with a name the generator already used (two titles ended up duplicated).
  // The slug follows the title so the two never disagree.
  const base = entry.title;
  let n = 2;
  // " (2)" rather than " 02": a bare number appended to a title that already
  // ends in a number ("Postgres 16 02") reads like a typo, not a variant.
  while (usedTitles.has(entry.title)) {
    entry.title = `${base} (${n})`;
    entry.slug = uniqueSlug(entry.title);
    n += 1;
  }
  usedTitles.add(entry.title);
  return entry;
}

/* ------------------------------ design layers ---------------------------- */

function buildTemplates() {
  const out = [];
  for (let i = 0; i < TARGETS.templates; i += 1) {
    const industry = rand.pick(INDUSTRIES);
    const palette = rand.pick(PALETTES);
    const hero = rand.pick(HERO_TECHNIQUES);
    const motion = rand.pick(MOTION_SYSTEMS);
    const fonts = rand.pick(FONT_PAIRINGS);
    const mood = rand.pick(MOODS);
    // Sampling chooses *which* sections appear; `order` fixes their sequence, so
    // a generated page always reads nav → hero → proof → product → pricing →
    // FAQ → CTA → footer instead of a shuffled, unusable layout.
    const sections = rand
      .sample(SECTION_ARCHETYPES, rand.int(6, 9))
      .sort((a, b) => a.order - b.order)
      .map((section) => section.label);
    const entry = rand.unique(
      (c) => `${industry.label}|${hero.id}|${palette.name}|${mood}`,
      () => ({
        title: designName(i),
        industry, palette, hero, motion, fonts, sections, mood,
        radius: rand.pick(["0px", "2px", "6px", "12px", "20px"]),
        density: rand.pick(["spacious editorial", "tight and information-dense", "balanced"]),
        easing: rand.pick(EASINGS),
        grain: rand.chance(0.6),
        customCursor: rand.chance(0.3),
        stickyNav: rand.chance(0.85),
        maxWidth: rand.pick(["1120px", "1240px", "1440px", "1680px"]),
        scrollSpeed: rand.pick(["native", "smoothed with a 0.1 lerp", "smoothed with a 0.16 lerp"]),
      }),
    );

    out.push(pushEntry({
      id: `tpl-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(entry.title),
      title: entry.title,
      seq: i + 1,
      category: "templates",
      group: "design",
      kind: industry.label,
      mood,
      tone: palette.tone,
      palette: palette.name,
      tags: [industry.label.toLowerCase(), mood.toLowerCase(), palette.tone, hero.id, "landing page"],
      summary: `${industry.label} landing page — ${mood.toLowerCase()}, ${palette.name.toLowerCase()} palette, ${hero.label.toLowerCase()} hero.`,
      copies: copiesFor("templates"),
      updated: updatedOn(),
      featured: i < 6,
      params: {
        industry: industry.label,
        product: industry.product,
        audience: industry.audience,
        cta: industry.cta,
        proof: industry.proof,
        mood,
        tone: palette.tone,
        palette: palette.name,
        colors: palette.colors,
        hero: hero.label,
        heroSpec: hero.spec,
        motion: motion.label,
        motionSpec: motion.spec,
        displayFont: fonts.display,
        bodyFont: fonts.body,
        fontNote: fonts.note,
        sections: entry.sections,
        radius: entry.radius,
        density: entry.density,
        easing: entry.easing,
        grain: entry.grain,
        customCursor: entry.customCursor,
        stickyNav: entry.stickyNav,
        maxWidth: entry.maxWidth,
        scrollSpeed: entry.scrollSpeed,
      },
    }));
  }
  return out;
}

function buildScenes() {
  const out = [];
  for (let i = 0; i < TARGETS.scenes; i += 1) {
    const subject = rand.pick(SCENE_SUBJECTS);
    const technique = rand.pick(SCENE_TECHNIQUES);
    const palette = PALETTES.filter((p) => p.tone === "dark")[rand.int(0, 24)] ?? rand.pick(PALETTES);
    const entry = rand.unique(
      (c) => `${subject}|${technique.label}|${c.kind}|${palette.name}`,
      () => ({
        title: designName(i),
        kind: rand.pick(SCENE_MOODS),
        subject, technique, palette,
        particles: rand.int(8, 90) * 1000,
        fpsTarget: rand.pick([60, 60, 30]),
        autoRotate: rand.chance(0.8),
        pointerReactive: rand.chance(0.85),
        scrollLinked: rand.chance(0.55),
        bloom: rand.chance(0.7),
        grain: rand.chance(0.5),
        reducedMotion: rand.pick([
          "freeze the simulation and render a single representative frame",
          "drop to a static orthographic view with no animation",
          "keep motion but halve the speed and disable pointer response",
        ]),
        budget: rand.pick(["under 1.2MB total", "under 800KB total", "under 2MB total"]),
        drawCalls: rand.int(1, 14),
      }),
    );

    out.push(pushEntry({
      id: `scn-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(entry.title),
      title: entry.title,
      seq: i + 1,
      category: "scenes",
      group: "design",
      kind: entry.kind,
      mood: rand.pick(["Cinematic", "Technical", "Dreamlike", "Minimal", "Noir"]),
      tone: "dark",
      palette: entry.palette.name,
      tags: [entry.kind.toLowerCase(), "webgl", "three.js", technique.label.toLowerCase(), "3d"],
      summary: `${subject.replace(/^a /, "").replace(/^\w/, (c) => c.toUpperCase())} — ${technique.label.toLowerCase()} in the ${entry.palette.name} palette.`,
      copies: copiesFor("scenes"),
      updated: updatedOn(),
      featured: i < 6,
      params: {
        subject,
        technique: technique.label,
        techniqueSpec: technique.spec,
        palette: entry.palette.name,
        colors: entry.palette.colors,
        particles: entry.particles,
        fpsTarget: entry.fpsTarget,
        autoRotate: entry.autoRotate,
        pointerReactive: entry.pointerReactive,
        scrollLinked: entry.scrollLinked,
        bloom: entry.bloom,
        grain: entry.grain,
        reducedMotion: entry.reducedMotion,
        budget: entry.budget,
        drawCalls: entry.drawCalls,
      },
    }));
  }
  return out;
}

function buildSections() {
  const out = [];
  for (let i = 0; i < TARGETS.sections; i += 1) {
    const type = rand.pick(SECTION_TYPES);
    const palette = rand.pick(PALETTES);
    const interaction = rand.pick(SECTION_INTERACTIONS);
    const entry = rand.unique(
      (c) => `${type.label}|${palette.name}|${interaction}|${c.motion}`,
      () => ({
        title: designName(i),
        type, palette, interaction,
        motion: rand.pick(MOTION_SYSTEMS),
        fonts: rand.pick(FONT_PAIRINGS),
        easing: rand.pick(EASINGS),
        columns: rand.int(1, 4),
        items: rand.int(3, 12),
        height: rand.pick(["auto", "min 70vh", "min 90vh", "full viewport"]),
        borderTop: rand.chance(0.4),
      }),
    );

    out.push(pushEntry({
      id: `sec-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(entry.title),
      title: entry.title,
      seq: i + 1,
      category: "sections",
      group: "design",
      kind: type.label,
      mood: rand.pick(MOODS),
      tone: palette.tone,
      palette: palette.name,
      tags: [type.label.toLowerCase(), "section", palette.tone, interaction.split(" ")[0]],
      summary: `${type.label} section — ${entry.palette.name}, ${entry.interaction}.`,
      copies: copiesFor("sections"),
      updated: updatedOn(),
      featured: i < 6,
      params: {
        type: type.label,
        typeSpec: type.spec,
        palette: palette.name,
        colors: palette.colors,
        tone: palette.tone,
        interaction: entry.interaction,
        motion: entry.motion.label,
        motionSpec: entry.motion.spec,
        displayFont: entry.fonts.display,
        bodyFont: entry.fonts.body,
        easing: entry.easing,
        columns: entry.columns,
        items: entry.items,
        height: entry.height,
        borderTop: entry.borderTop,
      },
    }));
  }
  return out;
}

function buildBackgrounds() {
  const out = [];
  for (let i = 0; i < TARGETS.backgrounds; i += 1) {
    const style = rand.pick(BACKGROUND_STYLES);
    const palette = rand.pick(PALETTES);
    const entry = rand.unique(
      (c) => `${style.label}|${palette.name}|${c.medium}`,
      () => ({
        title: designName(i),
        style, palette,
        medium: rand.pick(["pure CSS", "inline SVG", "2D canvas", "WebGL shader"]),
        speed: rand.pick(["barely perceptible", "slow", "medium", "lively"]),
        loop: rand.pick([`${rand.int(6, 60)}s linear infinite`, "seamless and non-repeating within 60s", "paused until pointer enters"]),
        density: rand.int(2, 8),
        vignette: rand.chance(0.6),
        mask: rand.pick(["none", "radial fade at the edges", "linear fade to the section below", "text-shaped mask"]),
        cost: rand.pick(["under 4% of main-thread time", "zero JavaScript", "one canvas, no library"]),
      }),
    );

    out.push(pushEntry({
      id: `bkg-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(entry.title),
      title: entry.title,
      seq: i + 1,
      category: "backgrounds",
      group: "design",
      kind: entry.medium,
      mood: rand.pick(MOODS),
      tone: palette.tone,
      palette: palette.name,
      tags: [style.label.toLowerCase(), "background", entry.medium.toLowerCase(), palette.tone],
      summary: `${style.label} background in ${entry.medium} — ${palette.name}, ${entry.speed} motion.`,
      copies: copiesFor("backgrounds"),
      updated: updatedOn(),
      featured: i < 6,
      params: {
        style: style.label,
        styleSpec: style.spec,
        palette: palette.name,
        colors: palette.colors,
        tone: palette.tone,
        medium: entry.medium,
        speed: entry.speed,
        loop: entry.loop,
        density: entry.density,
        vignette: entry.vignette,
        mask: entry.mask,
        cost: entry.cost,
      },
    }));
  }
  return out;
}

function buildGradients() {
  const out = [];
  for (let i = 0; i < TARGETS.gradients; i += 1) {
    const type = rand.pick(GRADIENT_TYPES);
    const palette = rand.pick(PALETTES);
    const stops = rand.sample(palette.colors, rand.int(3, 5));
    const entry = rand.unique(
      (c) => `${type.label}|${stops.join(",")}|${c.angle}`,
      () => ({
        title: designName(i),
        type, palette, stops,
        angle: rand.int(0, 359),
        duration: rand.int(8, 60),
        interactive: rand.pick(["pointer position", "scroll progress", "device tilt", "none — ambient only"]),
        blend: rand.pick(["normal", "screen", "overlay", "soft-light", "color-dodge"]),
        grainAmount: rand.pick(["0%", "2%", "3.5%", "5%"]),
      }),
    );

    out.push(pushEntry({
      id: `grd-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(entry.title),
      title: entry.title,
      seq: i + 1,
      category: "gradients",
      group: "design",
      kind: type.label,
      mood: rand.pick(["Calm", "Cinematic", "Playful", "Minimal", "Dreamlike", "Luxe"]),
      tone: palette.tone,
      palette: palette.name,
      tags: [type.label.toLowerCase(), "gradient", palette.tone, stops[stops.length - 1].slice(1)],
      summary: `${type.label}: ${stops.join(" → ")}.`,
      copies: copiesFor("gradients"),
      updated: updatedOn(),
      featured: i < 6,
      params: {
        type: type.label,
        typeSpec: type.spec,
        palette: palette.name,
        colors: palette.colors,
        stops: entry.stops,
        tone: palette.tone,
        angle: entry.angle,
        duration: entry.duration,
        interactive: entry.interactive,
        blend: entry.blend,
        grainAmount: entry.grainAmount,
      },
    }));
  }
  return out;
}

/* -------------------------------- vault ---------------------------------- */

function buildMarketing() {
  const out = [];
  for (let i = 0; i < TARGETS.marketing; i += 1) {
    const channel = rand.pick(MARKETING_CHANNELS);
    const industry = rand.pick(INDUSTRIES);
    const entry = rand.unique(
      (c) => `${channel.label}|${industry.label}|${c.audience}|${c.voice}`,
      () => ({
        audience: rand.pick(AUDIENCES),
        voice: rand.pick(VOICES),
        angle: rand.pick([
          "the cost of doing nothing", "a contrarian take on the category", "an unusually specific customer story",
          "the mechanism nobody else explains", "before and after numbers", "the objection the buyer actually has",
          "what the category gets wrong", "a hard-won lesson from operating",
        ]),
        constraint: rand.pick([
          "no superlatives unless backed by a number", "no question-shaped subject lines",
          "every claim must be verifiable from the brief", "no mention of competitors by name",
          "written at a reading age of 12", "one idea per paragraph, no exceptions",
        ]),
        offer: rand.pick([
          "a 14-day trial with no card", "a fixed-price pilot", "a free audit", "a demo with an engineer",
          "a template pack", "annual pricing at two months free", "a public benchmark report",
        ]),
      }),
    );

    out.push(pushEntry({
      id: `mkt-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(`${channel.label} ${industry.label} ${entry.audience}`),
      title: vaultTitle([channel.label, `${industry.label} for ${entry.audience}`]),
      seq: i + 1,
      category: "marketing",
      group: "vault",
      kind: channel.label,
      mood: entry.voice.label,
      tone: "text",
      tags: [channel.label.toLowerCase(), industry.label.toLowerCase(), "copywriting", entry.audience.split(" ")[0]],
      summary: `${channel.format} for ${industry.product}, aimed at ${entry.audience}, in a ${entry.voice.label.toLowerCase()} voice.`,
      copies: copiesFor("marketing"),
      updated: updatedOn(),
      featured: i < 4,
      params: {
        channel: channel.label,
        format: channel.format,
        length: channel.length,
        channelRule: channel.rule,
        industry: industry.label,
        product: industry.product,
        cta: industry.cta,
        proof: industry.proof,
        audience: entry.audience,
        voice: entry.voice.label,
        voiceSpec: entry.voice.spec,
        angle: entry.angle,
        constraint: entry.constraint,
        offer: entry.offer,
      },
    }));
  }
  return out;
}

function buildCode() {
  const out = [];
  for (let i = 0; i < TARGETS.code; i += 1) {
    const task = rand.pick(CODE_TASKS);
    const language = rand.pick(CODE_LANGUAGES);
    const entry = rand.unique(
      (c) => `${task.label}|${language}|${c.stack}|${c.mode}`,
      () => ({
        // The stack must exist in the chosen language — see CODE_STACKS_BY_LANGUAGE.
        stack: rand.pick(CODE_STACKS_BY_LANGUAGE[language]),
        mode: rand.pick([
          "explain before changing", "change first, justify after", "produce options with trade-offs",
          "write it as a review comment", "produce a patch-ready diff",
        ]),
        scale: rand.pick(["a single function", "one module of a few hundred lines", "a service with several modules", "a monorepo touching many packages"]),
        rigor: rand.pick([
          "production-grade: error handling, logging and tests",
          "prototype-grade: shortest path that demonstrates the idea",
          "library-grade: public API stability, docs and semver notes",
        ]),
        constraint: rand.pick([
          "no new dependencies", "must run on the current LTS runtime only",
          "must stay backwards compatible with the previous release", "no framework-specific magic",
          "must be understandable to a new joiner in one sitting", "memory-bounded: no unbounded caches",
        ]),
      }),
    );

    out.push(pushEntry({
      id: `cod-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(`${task.label} ${language} ${entry.stack}`),
      title: vaultTitle([task.label, `${language} · ${entry.stack}`]),
      seq: i + 1,
      category: "code",
      group: "vault",
      kind: task.label,
      mood: entry.rigor.split(":")[0],
      tone: "text",
      tags: [task.label.toLowerCase(), language.toLowerCase(), entry.stack.toLowerCase().split(" ")[0], "engineering"],
      summary: `Ask an assistant to ${task.task} in ${language} (${entry.stack}) at the scale of ${entry.scale}.`,
      copies: copiesFor("code"),
      updated: updatedOn(),
      featured: i < 4,
      params: {
        task: task.label,
        taskSpec: task.task,
        taskExtra: task.extra,
        language,
        stack: entry.stack,
        mode: entry.mode,
        scale: entry.scale,
        rigor: entry.rigor,
        constraint: entry.constraint,
      },
    }));
  }
  return out;
}

function buildWriting() {
  const out = [];
  for (let i = 0; i < TARGETS.writing; i += 1) {
    const format = rand.pick(WRITING_FORMATS);
    const voice = rand.pick(VOICES);
    const entry = rand.unique(
      (c) => `${format.label}|${voice.label}|${c.topic.label}|${c.reader}`,
      () => ({
        topic: rand.pick(WRITING_TOPICS),
        reader: rand.pick(AUDIENCES),
        stance: rand.pick([
          "argue for it", "argue against it", "take no side but expose the trade-off",
          "report what the evidence says", "tell it as a story and let the reader conclude",
        ]),
        structure: rand.pick([
          "open with a scene, then widen to the argument", "open with the conclusion, then defend it",
          "open with a question the reader has already failed to answer", "open with a number that contradicts intuition",
        ]),
        forbidden: rand.pick([
          "no 'in today's fast-paced world', no 'delve', no 'unlock', no 'game-changer'",
          "no rhetorical questions in the first paragraph",
          "no list of three adjectives where one precise noun would do",
          "no summarising the piece in its own conclusion",
        ]),
      }),
    );

    out.push(pushEntry({
      id: `wri-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(`${format.label} ${entry.topic.label} ${voice.label}`),
      title: vaultTitle([format.label, entry.topic.label]),
      seq: i + 1,
      category: "writing",
      group: "vault",
      kind: format.label,
      mood: voice.label,
      tone: "text",
      tags: [format.label.toLowerCase(), "writing", voice.label.toLowerCase(), entry.reader.split(" ")[0]],
      summary: `${format.label} on ${entry.topic.full}, for ${entry.reader} — ${voice.label.toLowerCase()}, ${entry.stance}.`,
      copies: copiesFor("writing"),
      updated: updatedOn(),
      featured: i < 4,
      params: {
        format: format.label,
        formatSpec: format.spec,
        topic: entry.topic.full,
        reader: entry.reader,
        voice: voice.label,
        voiceSpec: voice.spec,
        stance: entry.stance,
        structure: entry.structure,
        forbidden: entry.forbidden,
      },
    }));
  }
  return out;
}

function buildImage() {
  const out = [];
  for (let i = 0; i < TARGETS.image; i += 1) {
    const style = rand.pick(IMAGE_STYLES);
    const subject = rand.pick(IMAGE_SUBJECTS);
    const entry = rand.unique(
      (c) => `${subject}|${style.label}|${c.lighting}|${c.aspect}`,
      () => ({
        lighting: rand.pick([
          "single hard key with a deep shadow", "overcast soft light, no shadows",
          "golden hour, long shadows", "practical lights only, interior at night",
          "backlit with a rim and a blown highlight", "studio three-point, neutral",
          "blue hour with warm interiors", "harsh noon sun, high contrast",
        ]),
        aspect: rand.pick(["16:9", "3:2", "1:1", "4:5", "2.39:1", "9:16"]),
        setting: rand.pick([
          "a coastal town in winter", "a brutalist office block", "a desert highway at dusk",
          "a small apartment kitchen", "a greenhouse", "a train platform", "a rooftop above the fog line",
          "a workshop with dust in the light", "a supermarket aisle at closing time", "a forest track after rain",
        ]),
        detail: rand.pick([
          "one telling detail in sharp focus, everything else soft",
          "everything sharp from foreground to horizon",
          "motion blur on the subject, frozen background",
          "a reflection that adds a second reading of the scene",
        ]),
        negative: rand.pick([
          "no text, no watermark, no logo", "no extra limbs, no warped hands, no duplicated objects",
          "no stock-photo smile, no staged posing", "no oversaturated colours, no HDR halo",
        ]),
      }),
    );

    out.push(pushEntry({
      id: `img-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(`${subject} ${style.label} ${entry.setting}`),
      title: vaultTitle([subject.replace(/^\w/, (c) => c.toUpperCase()), style.label]),
      seq: i + 1,
      category: "image",
      group: "vault",
      kind: style.label,
      mood: rand.pick(["Cinematic", "Calm", "Editorial", "Playful", "Noir"]),
      tone: "image",
      tags: [style.label.toLowerCase(), subject.split(" ")[1] ?? subject.split(" ")[0], entry.aspect, "image generation"],
      summary: `${subject.replace(/^\w/, (c) => c.toUpperCase())} in ${entry.setting}, ${style.label.toLowerCase()}, ${entry.lighting.toLowerCase()}.`,
      copies: copiesFor("image"),
      updated: updatedOn(),
      featured: i < 4,
      params: {
        subject,
        style: style.label,
        styleSpec: style.spec,
        lighting: entry.lighting,
        aspect: entry.aspect,
        setting: entry.setting,
        detail: entry.detail,
        negative: entry.negative,
      },
    }));
  }
  return out;
}

function buildBusiness() {
  const out = [];
  for (let i = 0; i < TARGETS.business; i += 1) {
    const scenario = rand.pick(BUSINESS_SCENARIOS);
    const industry = rand.pick(INDUSTRIES);
    const entry = rand.unique(
      (c) => `${scenario.label}|${industry.label}|${c.stage}|${c.horizon}`,
      () => ({
        stage: rand.pick(["pre-seed", "seed", "series A", "bootstrapped and profitable", "turnaround", "scaling past 50 people"]),
        horizon: rand.pick(["the next 30 days", "this quarter", "the next four quarters", "the next three years"]),
        constraint: rand.pick([
          "no additional headcount", "a fixed budget that cannot grow", "the founder is the only seller",
          "the product cannot change this quarter", "one geography only",
        ]),
        risk: rand.pick([
          "a well-funded competitor entering the segment", "a platform dependency changing its terms",
          "churn rising above sustainable levels", "a key hire not landing", "a regulatory change",
        ]),
      }),
    );

    out.push(pushEntry({
      id: `biz-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(`${scenario.label} ${industry.label} ${entry.stage}`),
      title: vaultTitle([scenario.label, `${industry.label} at ${entry.stage}`]),
      seq: i + 1,
      category: "business",
      group: "vault",
      kind: scenario.label,
      mood: "Strategic",
      tone: "text",
      tags: [scenario.label.toLowerCase(), industry.label.toLowerCase(), entry.stage.replace(/\s+/g, "-"), "strategy"],
      summary: `${scenario.deliverable.replace(/^a /, "").replace(/^\w/, (c) => c.toUpperCase())} for ${industry.product} at ${entry.stage}, over ${entry.horizon}.`,
      copies: copiesFor("business"),
      updated: updatedOn(),
      featured: i < 3,
      params: {
        scenario: scenario.label,
        deliverable: scenario.deliverable,
        framework: scenario.framework,
        industry: industry.label,
        product: industry.product,
        audience: industry.audience,
        stage: entry.stage,
        horizon: entry.horizon,
        constraint: entry.constraint,
        risk: entry.risk,
      },
    }));
  }
  return out;
}

function buildAgents() {
  const out = [];
  for (let i = 0; i < TARGETS.agents; i += 1) {
    const agent = rand.pick(AGENT_TASKS);
    const industry = rand.pick(INDUSTRIES);
    const entry = rand.unique(
      (c) => `${agent.label}|${industry.label}|${c.trigger}|${c.failure}`,
      () => ({
        trigger: rand.pick([
          "on a schedule, every hour", "on a webhook from the source system", "on a user request in chat",
          "when a metric crosses a threshold", "on every pull request", "at 06:00 local time daily",
        ]),
        failure: rand.pick([
          "retry with backoff, then park and notify a human",
          "stop immediately and leave the work in a reviewable state",
          "degrade to a lower-confidence output and label it clearly",
          "hand the whole context to a human with a summary of what was tried",
        ]),
        state: rand.pick([
          "stateless: every run starts from the source of truth",
          "a checkpointed run log so work can resume",
          "a small memory of previous decisions per entity",
        ]),
        budget: rand.pick([
          "at most 8 tool calls per run", "at most 25 tool calls per run",
          "a wall-clock limit of 60 seconds", "a token budget with an explicit stop",
        ]),
      }),
    );

    out.push(pushEntry({
      id: `agt-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(`${agent.label} ${industry.label} ${entry.trigger}`),
      title: vaultTitle([agent.label, `${industry.label} · ${entry.trigger}`]),
      seq: i + 1,
      category: "agents",
      group: "vault",
      kind: agent.label,
      mood: "Systematic",
      tone: "text",
      tags: [agent.label.toLowerCase(), "agent", industry.label.toLowerCase(), "automation"],
      summary: `Specify ${agent.label.toLowerCase()} that will ${agent.task}, with tools, loop, guardrails and a failure path.`,
      copies: copiesFor("agents"),
      updated: updatedOn(),
      featured: i < 3,
      params: {
        agent: agent.label,
        task: agent.task,
        tools: agent.tools,
        loop: agent.loop,
        guardrails: agent.guardrails,
        industry: industry.label,
        product: industry.product,
        trigger: entry.trigger,
        failure: entry.failure,
        state: entry.state,
        budget: entry.budget,
      },
    }));
  }
  return out;
}

function buildSeo() {
  const out = [];
  for (let i = 0; i < TARGETS.seo; i += 1) {
    const intent = rand.pick(SEO_INTENTS);
    const industry = rand.pick(INDUSTRIES);
    const deliverable = rand.pick(SEO_DELIVERABLES);
    const entry = rand.unique(
      (c) => `${intent.label}|${industry.label}|${deliverable.label}|${c.market}`,
      () => ({
        market: rand.pick([
          "United Kingdom", "United States", "Morocco and North Africa", "DACH", "France",
          "the Nordics", "Southeast Asia", "Canada", "Australia", "the Gulf states", "India", "Brazil",
        ]),
        difficulty: rand.pick(["a new domain with no authority", "an established domain with thin content", "a crowded category with strong incumbents", "a niche with few serious competitors"]),
        language: rand.pick(["English", "English and French", "English and German", "English and Arabic", "English and Spanish"]),
      }),
    );

    out.push(pushEntry({
      id: `seo-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(`${deliverable.label} ${intent.label} ${industry.label} ${entry.market}`),
      title: vaultTitle([deliverable.label, `${intent.label} · ${industry.label} · ${entry.market}`]),
      seq: i + 1,
      category: "seo",
      group: "vault",
      kind: intent.label,
      mood: "Analytical",
      tone: "text",
      tags: ["seo", intent.label.toLowerCase(), industry.label.toLowerCase(), entry.market.toLowerCase().split(" ")[0]],
      summary: `Produce ${deliverable.full} for ${intent.pageType}, where the goal is ${intent.goal}.`,
      copies: copiesFor("seo"),
      updated: updatedOn(),
      featured: i < 3,
      params: {
        intent: intent.label,
        pageType: intent.pageType,
        goal: intent.goal,
        industry: industry.label,
        product: industry.product,
        audience: industry.audience,
        deliverable: deliverable.full,
        market: entry.market,
        difficulty: entry.difficulty,
        language: entry.language,
      },
    }));
  }
  return out;
}

function buildData() {
  const out = [];
  for (let i = 0; i < TARGETS.data; i += 1) {
    const task = rand.pick(DATA_TASKS);
    const industry = rand.pick(INDUSTRIES);
    const entry = rand.unique(
      (c) => `${task.label}|${industry.label}|${c.dataset}|${c.tool}`,
      () => ({
        dataset: rand.pick([
          "18 months of product events", "a CRM export with 40,000 rows", "server logs for one quarter",
          "a survey with 1,200 responses", "transaction records across three regions", "web analytics with heavy bot traffic",
          "a time series sampled every five minutes", "support tickets with free-text bodies",
        ]),
        tool: rand.pick(["Python and pandas", "SQL only", "R", "a notebook with DuckDB", "plain spreadsheets", "dbt and a warehouse"]),
        stakes: rand.pick([
          "the answer decides a budget allocation", "the answer goes to the board", "the answer is published externally",
          "the answer feeds an automated decision", "the answer only informs an internal debate",
        ]),
      }),
    );

    out.push(pushEntry({
      id: `dat-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(`${task.label} ${industry.label} ${entry.tool}`),
      title: vaultTitle([task.label, `${industry.label} · ${entry.tool}`]),
      seq: i + 1,
      category: "data",
      group: "vault",
      kind: task.label,
      mood: "Analytical",
      tone: "text",
      tags: [task.label.toLowerCase(), "data", entry.tool.toLowerCase().split(" ")[0], industry.label.toLowerCase()],
      summary: `${task.label} on ${entry.dataset} for ${industry.product}, using ${entry.tool}.`,
      copies: copiesFor("data"),
      updated: updatedOn(),
      featured: i < 3,
      params: {
        task: task.label,
        method: task.method,
        output: task.output,
        industry: industry.label,
        product: industry.product,
        dataset: entry.dataset,
        tool: entry.tool,
        stakes: entry.stakes,
      },
    }));
  }
  return out;
}

function buildLearning() {
  const out = [];
  for (let i = 0; i < TARGETS.learning; i += 1) {
    const goal = rand.pick(LEARNING_GOALS);
    const subject = rand.pick(SUBJECTS);
    const entry = rand.unique(
      (c) => `${goal.label}|${subject}|${c.level}|${c.output}`,
      () => ({
        level: rand.pick(LEVELS),
        output: rand.pick([
          "a working artefact that proves the skill", "a written explanation good enough to teach from",
          "a portfolio piece", "a passing grade on a recognised exam", "the ability to review someone else's work",
        ]),
        background: rand.pick([
          "no prior exposure", "some self-taught experience with gaps", "strong adjacent skills, new domain",
          "rusty after years away", "coming from a completely different discipline",
        ]),
        hours: rand.int(2, 12),
      }),
    );

    out.push(pushEntry({
      id: `lrn-${String(i + 1).padStart(4, "0")}`,
      slug: uniqueSlug(`${goal.label} ${subject} ${entry.level}`),
      title: vaultTitle([goal.label, `${subject} · ${entry.level}`]),
      seq: i + 1,
      category: "learning",
      group: "vault",
      kind: goal.label,
      mood: "Structured",
      tone: "text",
      tags: [goal.label.toLowerCase(), subject.replace(/\s+/g, "-"), entry.level.split(" ")[0], "learning"],
      summary: `${goal.format} for ${subject} at ${entry.level} level, ${entry.hours} hours a week, ending in ${entry.output}.`,
      copies: copiesFor("learning"),
      updated: updatedOn(),
      featured: i < 3,
      params: {
        goal: goal.label,
        format: goal.format,
        cadence: goal.cadence,
        rule: goal.rule,
        subject,
        level: entry.level,
        output: entry.output,
        background: entry.background,
        hours: entry.hours,
      },
    }));
  }
  return out;
}

/* --------------------------------- output -------------------------------- */

/**
 * Vault prompts have no palette of their own, so they get a deterministic one
 * derived from a hash of the slug. Same slug always means same colours.
 */
function hashSwatch(slug) {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = Math.abs(h) % 360;
  const c = (dh, l) => `hsl(${(hue + dh) % 360} 62% ${l}%)`;
  return [c(0, 12), c(28, 46), c(200, 72)];
}

function decorate(prompts) {
  return prompts.map((p) => {
    const colors = p.params.colors ?? hashSwatch(p.slug);
    return {
      ...p,
      swatch: [colors[0], colors[Math.min(2, colors.length - 1)], colors[colors.length - 1]],
      pattern: PATTERNS[p.seq % PATTERNS.length],
    };
  });
}

function build() {
  const prompts = decorate([
    ...buildTemplates(),
    ...buildScenes(),
    ...buildSections(),
    ...buildBackgrounds(),
    ...buildGradients(),
    ...buildMarketing(),
    ...buildCode(),
    ...buildWriting(),
    ...buildImage(),
    ...buildBusiness(),
    ...buildAgents(),
    ...buildSeo(),
    ...buildData(),
    ...buildLearning(),
  ]);

  const counts = {};
  for (const p of prompts) counts[p.category] = (counts[p.category] ?? 0) + 1;

  const categories = CATEGORIES.map((c) => ({ ...c, count: counts[c.id] ?? 0 }));

  const full = {
    version: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    total: prompts.length,
    categories,
    facets: {
      moods: MOODS,
      tones: ["dark", "light"],
      palettes: PALETTES.map((p) => ({ name: p.name, tone: p.tone, colors: p.colors })),
    },
    prompts,
  };

  // The browser only needs enough to search, filter and draw a card.
  const index = {
    version: 1,
    generatedAt: full.generatedAt,
    total: prompts.length,
    categories,
    facets: full.facets,
    prompts: prompts.map(({ params: _params, ...rest }) => rest),
  };

  return { full, index };
}

const { full, index } = build();
mkdirSync(dirname(OUT), { recursive: true });
mkdirSync(dirname(OUT_INDEX), { recursive: true });

function stable(value) {
  return JSON.stringify({ ...value, generatedAt: null });
}

const check = process.argv.includes("--check");
if (check) {
  for (const [file, value] of [[OUT, full], [OUT_INDEX, index]]) {
    if (!existsSync(file)) {
      console.error(`${file} is missing — run \`npm run generate\`.`);
      process.exit(1);
    }
    if (stable(JSON.parse(readFileSync(file, "utf8"))) !== stable(value)) {
      console.error(`${file} is out of date with the generator.`);
      process.exit(1);
    }
  }
  console.log(`Dataset is current (${full.total} prompts).`);
} else {
  writeFileSync(OUT, `${JSON.stringify(full)}\n`);
  writeFileSync(OUT_INDEX, `${JSON.stringify(index)}\n`);
}

const slugs = new Set(full.prompts.map((p) => p.slug));
const ids = new Set(full.prompts.map((p) => p.id));
if (slugs.size !== full.total || ids.size !== full.total) {
  console.error("Duplicate slug or id in the dataset.");
  process.exit(1);
}
if (full.total <= 1000) {
  console.error(`Expected more than 1000 prompts, got ${full.total}.`);
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(
  `Generated ${full.total} prompts across ${full.categories.length} categories ` +
    `(full ${kb(readFileSync(OUT).length)}, index ${kb(readFileSync(OUT_INDEX).length)}).`,
);
for (const c of full.categories) console.log(`  ${String(c.count).padStart(4)}  ${c.label}`);
