/**
 * Renders a stored prompt's parameters into the full prompt text.
 *
 * The dataset keeps *decisions* (palette hexes, motion system, scene technique,
 * audience, constraints) rather than finished prose. That keeps 1,360 prompts
 * small enough to ship and — more importantly — makes every prompt internally
 * consistent: the hex values in the design tokens are the same hexes the copy
 * guidance and the accessibility section refer to.
 *
 * This module runs on the server (for static pages) and in the browser (for the
 * copy button), so it must stay dependency-free and side-effect free.
 */

export type PromptParams = Record<string, unknown>;

export interface PromptEntry {
  id: string;
  slug: string;
  title: string;
  category: string;
  group: "design" | "vault";
  kind: string;
  mood: string;
  tone: string;
  tags: string[];
  summary: string;
  copies: number;
  updated: string;
  featured: boolean;
  swatch: string[];
  pattern: string;
  params: PromptParams;
}

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);
const bool = (v: unknown): boolean => v === true;
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

/**
 * Join lines into the prompt body.
 *
 * Empty strings are *kept* — they are the blank lines markdown needs before a
 * heading or a list. Only falsy non-strings are dropped, which is how optional
 * bullets (grain, cursor, bloom) disappear without leaving a gap.
 */
function block(...lines: Array<string | false | null | undefined>): string {
  return lines.filter((l): l is string => typeof l === "string").join("\n");
}

/** Sentence-case a label so it can start a list item. */
function sentence(value: string): string {
  return value.replace(/^\w/, (c) => c.toUpperCase());
}

function heading(text: string): string {
  return `## ${text}`;
}

function bullets(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

function numbered(items: string[]): string {
  return items.map((i, n) => `${n + 1}. ${i}`).join("\n");
}

const SHARED_OUTPUT_RULES = [
  "Return exactly one self-contained `.html` file. No build step, no bundler, no external JS.",
  "CDN links are allowed for fonts and, where the brief asks for it, a single library — nothing else.",
  "Write the code completely. Never leave `<!-- rest of section -->`, `...`, or `TODO` placeholders.",
  "Do not explain the code before or after it. The file is the whole answer.",
];

const SHARED_A11Y = [
  "Semantic landmarks: `header`, `nav`, `main`, `section` (each with an accessible name), `footer`.",
  "Body text at a minimum 4.5:1 contrast ratio against its background; large display type at 3:1.",
  "Every interactive element reachable and operable by keyboard, with a visible focus ring that is not the browser default.",
  "Skip link as the first focusable element in the document.",
  "All decorative graphics marked `aria-hidden=\"true\"`; all meaningful ones given text alternatives.",
  "Under `prefers-reduced-motion: reduce`, every non-essential animation is disabled and any autoplaying motion stops.",
];

const SHARED_PERF = [
  "No layout shift: reserve space for every image, canvas and font swap (`size-adjust` or explicit dimensions).",
  "Fonts loaded with `font-display: swap` and at most two families, three weights combined.",
  "Nothing above the fold waits on JavaScript to become visible.",
  "Images, if any, are lazy-loaded below the fold and carry explicit `width` and `height`.",
  "Target Lighthouse 95+ on Performance, and 100 on Accessibility, Best Practices and SEO.",
];

const SHARED_SEO = [
  "`<title>` under 60 characters, unique, and leading with the primary outcome rather than the brand.",
  "`meta name=\"description\"` of 140-158 characters written as a sentence a human would click.",
  "A `rel=\"canonical\"` pointing at the production URL.",
  "Open Graph and Twitter card tags with a 1200x630 image reference.",
  "One `h1` on the page. Headings descend without skipping levels.",
  "`lang` attribute on `<html>`, and JSON-LD (`Organization` plus the page-appropriate type) in the head.",
];

/* -------------------------------- templates ------------------------------- */

function renderTemplate(p: PromptParams, title: string): string {
  const colors = list(p.colors);
  const [bg, surface, accent, accentSoft, ink] = [
    colors[0] ?? "#08080a",
    colors[1] ?? "#141419",
    colors[2] ?? "#ff5a1f",
    colors[3] ?? "#ffb27a",
    colors[4] ?? "#f5f2ee",
  ];
  const sections = list(p.sections);
  const tone = str(p.tone, "dark");

  return block(
    `You are a senior product designer and front-end engineer at a studio known for award-winning marketing sites. You are building "${title}", a complete landing page.`,
    "",
    heading("Objective"),
    `Design and build a full landing page for ${str(p.product, "a product")} in the ${str(p.industry)} category. The reader: ${str(p.audience)}. The page must feel ${str(p.mood).toLowerCase()} and considered — the opposite of a default AI-generated template. It should be indistinguishable from work a well-regarded studio shipped for a paying client.`,
    "",
    heading("Output"),
    bullets(SHARED_OUTPUT_RULES),
    "",
    heading("Design tokens"),
    `Define these as CSS custom properties on :root and use them everywhere — no hard-coded colours in components.`,
    "```css",
    `--bg: ${bg};          /* page background */`,
    `--surface: ${surface};      /* cards, raised planes */`,
    `--accent: ${accent};       /* primary actions, key highlights */`,
    `--accent-soft: ${accentSoft};  /* secondary highlights, glows */`,
    `--ink: ${ink};          /* primary text on --bg */`,
    `--ink-muted: color-mix(in srgb, ${ink} 62%, ${bg});`,
    `--border: color-mix(in srgb, ${ink} 14%, transparent);`,
    `--radius: ${str(p.radius, "6px")};`,
    `--ease: ${str(p.easing, "cubic-bezier(0.16, 1, 0.3, 1)")};`,
    `--max-width: ${str(p.maxWidth, "1240px")};`,
    "```",
    `This is a ${tone} design. Keep the background near-flat and let ${accent} carry the page: it appears in no more than 15% of the visible surface at any moment.`,
    "",
    heading("Typography"),
    `- Display: ${str(p.displayFont)}. Used for the hero headline and section headings only.`,
    `- Body: ${str(p.bodyFont)}.`,
    `- ${str(p.fontNote)}`,
    `- Fluid type with clamp(): hero headline clamp(2.75rem, 8vw, 6.5rem), section headings clamp(1.9rem, 4vw, 3.25rem), body 1.0625rem at 1.62 line-height, small metadata 0.8125rem uppercase at 0.12em letter-spacing.`,
    `- Maximum line length of 68ch for body copy. Never let a headline orphan a single word on its last line — use text-wrap: balance.`,
    "",
    heading("Hero"),
    `${str(p.hero)}: ${str(p.heroSpec)}`,
    `The hero carries an eyebrow label, a headline of 6-11 words that states the outcome rather than the mechanism, a subhead of 20-32 words, a primary button reading "${str(p.cta, "Get started")}", a secondary ghost button, and one piece of proof (${str(p.proof)}).`,
    "",
    heading("Page structure"),
    "Build these sections in this order, each visually distinct from its neighbours:",
    numbered(sections.map(sentence)),
    "",
    `Overall rhythm is ${str(p.density)}. Alternate full-bleed and contained sections so the page never reads as a stack of identical bands. Content maxes out at ${str(p.maxWidth, "1240px")} with 24px gutters on mobile and 48px on desktop.`,
    "",
    heading("Motion"),
    `${str(p.motion)}: ${str(p.motionSpec)}`,
    `- Shared easing ${str(p.easing, "cubic-bezier(0.16, 1, 0.3, 1)")}; reveals run 480-720ms with a 24px rise.`,
    `- Stagger sibling items by 60ms, capped at 8 items so a long grid does not crawl.`,
    `- Scroll behaviour: ${str(p.scrollSpeed)}.`,
    bool(p.stickyNav) ? `- The header condenses on scroll past 80px: height 88px to 60px, background gains a 12px backdrop blur and the border fades in.` : `- The header is static and scrolls away; the primary CTA reappears as a fixed bottom bar on mobile after the hero.`,
    bool(p.customCursor) ? `- Add a custom cursor: a 28px ring trailing the pointer with a 0.14 lerp, scaling to 56px and inverting over interactive elements. Keep the native cursor visible on touch devices and disable the ring entirely under reduced motion.` : false,
    bool(p.grain) ? `- Overlay animated film grain across the whole page at 0.03 opacity, re-seeded at 12fps (not 60fps) from a tiling 128px noise data-URI, with pointer-events: none.` : false,
    "",
    heading("Copy"),
    `- Write real copy, not lorem ipsum. Every string must be plausible for ${str(p.product)} and specific enough that it could not be swapped into a competitor's page unchanged.`,
    `- Headlines state outcomes. Subheads carry the mechanism. Body copy carries the proof.`,
    `- Include at least six concrete numbers across the page (metrics, sizes, durations, counts) and make them mutually consistent.`,
    `- Address the two objections this reader actually has — they are ${str(p.audience)} — in their own words, before asking for the conversion.`,
    `- Avoid: "unleash", "elevate", "seamless", "in today's fast-paced world", "delve", "game-changing". Also avoid any sentence that would read identically on a competitor's site.`,
    "",
    heading("Responsive"),
    "- Three real layouts, not one squeezed: desktop (1280px+), tablet (768-1279px), mobile (under 768px).",
    "- At mobile the hero media scales down or is replaced by a simpler treatment rather than merely shrinking.",
    "- Grids collapse 3→2→1 with the gap stepping 48px→32px→20px.",
    "- Touch targets at least 44x44px; no hover-only affordances anywhere.",
    "- Test mentally at 320px width: nothing overflows horizontally, ever.",
    "",
    heading("Performance"),
    bullets(SHARED_PERF),
    "",
    heading("Accessibility"),
    bullets(SHARED_A11Y),
    "",
    heading("SEO"),
    bullets(SHARED_SEO),
    "",
    heading("Do not"),
    "- Do not use a centred hero with three equal feature cards below it and a purple-to-blue gradient. That is the default and it must not appear.",
    "- Do not use emoji as icons. Draw every icon as inline SVG on a 24px grid at 1.5px stroke.",
    "- Do not animate width, height, top, left, margin or box-shadow. Animate transform and opacity only.",
    "- Do not ship a carousel that autoplays.",
    "- Do not use a modal, popup or interstitial of any kind.",
  );
}

/* --------------------------------- scenes --------------------------------- */

function renderScene(p: PromptParams, title: string): string {
  const colors = list(p.colors);
  const [base, , accent, accentSoft] = [colors[0] ?? "#050505", colors[1], colors[2] ?? "#d4af37", colors[3] ?? "#f3e5ab"];

  return block(
    `You are a creative technologist who builds real-time WebGL for award-winning sites. You are building "${title}", a 3D scene intended to sit behind or beside a headline.`,
    "",
    heading("Objective"),
    `Build a real-time 3D scene of ${str(p.subject)}. It should read as a designed object with intent — lit, composed and colour-graded — not as a demo of a library. It must hold 60fps on a mid-range laptop and degrade gracefully on a phone.`,
    "",
    heading("Output"),
    bullets([
      "Return exactly one self-contained `.html` file.",
      "Load three.js from a pinned CDN version via an ES module import map. No other dependency.",
      "Write the complete scene: geometry, materials, lights, camera, loop, resize handling and cleanup. No placeholders.",
      "The scene fills its container, which defaults to 100vw x 100vh, and must survive being placed in a shorter container.",
    ]),
    "",
    heading("Technique"),
    `${str(p.technique)}: ${str(p.techniqueSpec)}`,
    "",
    heading("Look"),
    `- Base ${base}, key colour ${accent}, highlight ${accentSoft}. Keep the palette to these plus neutrals.`,
    `- Renderer: antialias true, alpha false, powerPreference "high-performance", outputColorSpace SRGB, toneMapping ACESFilmic at exposure 1.05.`,
    `- Pixel ratio clamped to Math.min(devicePixelRatio, 2). Drop to 1.5 if the measured frame time exceeds 20ms for 30 consecutive frames.`,
    bool(p.bloom) ? `- Post-processing: UnrealBloomPass at strength 0.42, radius 0.6, threshold 0.82. Keep bloom subtle — it should read as light spill, not as a glow filter.` : `- No post-processing pass. Get the look from materials and lighting alone so the draw cost stays at one pass.`,
    bool(p.grain) ? `- Add film grain in a final pass at 0.025 opacity, re-seeded every other frame.` : false,
    `- Lighting: one hard key, one soft fill at 20% intensity, and an environment map generated procedurally (PMREMGenerator over a gradient scene) so no HDR file is fetched.`,
    "",
    heading("Motion & interaction"),
    `- Use a THREE.Clock delta for every time-based value so speed is framerate-independent.`,
    bool(p.autoRotate) ? `- Auto-rotation at 0.05 rad/s, eased in over the first 1.2s rather than starting at full speed.` : `- No auto-rotation. The scene is still until the viewer moves or scrolls.`,
    bool(p.pointerReactive) ? `- Pointer parallax: the camera offsets by up to 4 degrees of yaw and 2.5 degrees of pitch toward the pointer, smoothed with a 0.08 lerp. On touch, drive the same offset from device orientation if available, otherwise disable it.` : false,
    bool(p.scrollLinked) ? `- Scroll drives one clearly defined parameter (rotation, camera distance or a material property) mapped across the scene's own section height. Scrub it — never autoplay it against the reader.` : false,
    `- Cap the simulation at ${num(p.particles, 20000).toLocaleString("en-US")} elements. Draw calls: ${num(p.drawCalls, 6)} or fewer.`,
    "",
    heading("Performance"),
    bullets([
      `- Target ${num(p.fpsTarget, 60)}fps at 1440x900 on an integrated GPU. Total payload ${str(p.budget, "under 1.2MB total")}.`,
      "Pause the requestAnimationFrame loop on `visibilitychange` and when the canvas leaves the viewport (IntersectionObserver at threshold 0).",
      "Never allocate inside the render loop. Preallocate vectors, matrices and any temporary objects.",
      "Dispose geometries, materials, textures and the renderer on teardown so a route change does not leak a WebGL context.",
      "Handle `webglcontextlost` by preventing default and attempting one restore.",
      "If WebGL is unavailable, render a static CSS gradient fallback in the same palette and carry on.",
    ]),
    "",
    heading("Accessibility & reduced motion"),
    "- The canvas is aria-hidden=\"true\" and never holds the only copy of any information.",
    `- Under prefers-reduced-motion: reduce, ${str(p.reducedMotion)}.`,
    "- The scene must never trap focus or intercept scroll on touch devices.",
    "",
    heading("Do not"),
    "- Do not use the three.js default grey material, default lighting or a visible ground grid.",
    "- Do not fetch an external HDR, GLTF or texture file. Everything is generated in code.",
    "- Do not compute per-frame positions in JavaScript when a vertex shader can do it.",
    "- Do not let the scene be the reason the page misses its performance budget.",
  );
}

/* -------------------------------- sections -------------------------------- */

function renderSection(p: PromptParams, title: string): string {
  const colors = list(p.colors);
  const [bg, surface, accent, , ink] = [colors[0] ?? "#0b0b0d", colors[1] ?? "#18181b", colors[2] ?? "#a1a1aa", colors[3], colors[4] ?? "#fafafa"];
  const tone = str(p.tone, "dark");

  return block(
    `You are a front-end engineer specialising in drop-in page sections. You are building "${title}".`,
    "",
    heading("Objective"),
    `${str(p.typeSpec)} Build it as a self-contained section that can be dropped into an existing page without breaking anything around it.`,
    "",
    heading("Output"),
    bullets([
      "Return exactly one self-contained `.html` file containing a single `<section>` plus its scoped styles and any script it needs.",
      "Everything is prefixed or scoped so nothing leaks: use a unique class prefix for this section and do not style bare element selectors.",
      "Include a small block of realistic placeholder content so the section renders correctly on its own.",
      "Write the code completely. No placeholders, no `...`.",
    ]),
    "",
    heading("Design tokens"),
    "```css",
    `--bg: ${bg};`,
    `--surface: ${surface};`,
    `--accent: ${accent};`,
    `--ink: ${ink};`,
    `--ink-muted: color-mix(in srgb, ${ink} 62%, ${bg});`,
    `--border: color-mix(in srgb, ${ink} 14%, transparent);`,
    `--ease: ${str(p.easing, "cubic-bezier(0.16, 1, 0.3, 1)")};`,
    "```",
    `A ${tone} section. Layout is ${num(p.columns, 3)} column(s) holding ${num(p.items, 6)} item(s), with a height of ${str(p.height, "auto")}.`,
    bool(p.borderTop) ? `- Separate it from the section above with a 1px --border rule that fades out 20% in from each edge.` : false,
    `- Typography: ${str(p.displayFont)} for headings, ${str(p.bodyFont)} for everything else.`,
    "",
    heading("Interaction"),
    `- Primary interaction: ${str(p.interaction)}.`,
    `- ${str(p.motion)}: ${str(p.motionSpec)}`,
    `- Entry reveal on intersection only, once, at threshold 0.2. Do not re-trigger on scroll back up.`,
    "- Hover states must also work as focus-visible states so keyboard users get the same feedback.",
    "- No interaction may block scrolling on touch devices.",
    "",
    heading("Responsive"),
    "- Desktop shows the full multi-column layout; tablet reduces columns by one; mobile stacks to a single column. Horizontal scroll is allowed only where the section is inherently horizontal, such as a carousel or a wide table.",
    "- On mobile, replace hover-only affordances with always-visible equivalents.",
    "- Touch targets at least 44x44px.",
    "",
    heading("Accessibility"),
    bullets([
      `- The section has an accessible name (aria-labelledby pointing at its heading).`,
      "If the section contains a carousel, gallery or accordion, implement full keyboard support: arrow keys, Home/End, Escape, and focus trapping where a modal surface opens.",
      "Live regions are used only for content a screen-reader user would otherwise miss, and only with `aria-live=\"polite\"`.",
      "Contrast at 4.5:1 minimum for body text.",
      "Under prefers-reduced-motion: reduce, disable the entry animation and any autoplaying motion.",
    ]),
    "",
    heading("Performance"),
    bullets(SHARED_PERF),
    "",
    heading("Do not"),
    "- Do not use emoji as icons — inline SVG on a 24px grid at 1.5px stroke.",
    "- Do not animate layout properties; transform and opacity only.",
    "- Do not introduce a framework, a CSS reset or a global style that would affect the host page.",
    "- Do not ship lorem ipsum. Write plausible copy for the section's purpose.",
  );
}

/* ------------------------------- backgrounds ------------------------------ */

function renderBackground(p: PromptParams, title: string): string {
  const colors = list(p.colors);
  const tone = str(p.tone, "dark");

  return block(
    `You are a front-end engineer who builds page atmospheres. You are building "${title}", an animated background.`,
    "",
    heading("Objective"),
    `${str(p.styleSpec)} The result sits behind real content and must never compete with it: it is atmosphere, not the subject.`,
    "",
    heading("Output"),
    bullets([
      "Return exactly one self-contained `.html` file.",
      `Implement it in ${str(p.medium)}.`,
      "Include a foreground layer of sample content (a headline, a paragraph, a button) so the background can be judged for legibility immediately.",
      "The background element is fixed or absolutely positioned, `pointer-events: none`, and `z-index: -1` relative to the content.",
    ]),
    "",
    heading("Palette"),
    `- Base ${colors[0] ?? "#08080a"}, mid ${colors[1] ?? "#141419"}, accent ${colors[2] ?? "#ff5a1f"}, highlight ${colors[3] ?? "#ffb27a"}.`,
    `- A ${tone} treatment. Motion is ${str(p.speed)}.`,
    `- Animation timing: ${str(p.loop)}.`,
    `- Layer density: ${num(p.density, 4)} distinct layers, each moving at a different rate so the result has parallax depth rather than a single sliding sheet.`,
    bool(p.vignette) ? `- Add a vignette: a radial gradient from transparent at 40% to rgba(0,0,0,0.55) at the edges, which keeps the eye on the centre of the page.` : false,
    `- Edge treatment: ${str(p.mask, "none")}.`,
    "",
    heading("Legibility"),
    "- Text over this background must hit 4.5:1 contrast at every frame of the animation, not just at rest. Where the background brightens, darken it locally behind the text with a scrim rather than reducing the type's opacity.",
    "- Cap the background's maximum luminance so white body text stays readable throughout the loop.",
    "- Test the loop's brightest frame specifically — that is where contrast fails.",
    "",
    heading("Performance"),
    bullets([
      `Cost budget: ${str(p.cost)}.`,
      "Animate transform, opacity, background-position and filter only. Never animate a property that triggers layout.",
      "If a canvas is used, size it to devicePixelRatio clamped at 2, and stop the loop when the tab is hidden or the element is off-screen.",
      "Prefer CSS animations over JavaScript for anything that can be expressed declaratively — the compositor runs them off the main thread.",
      "No banding: apply a fine grain overlay (2-4% opacity) or dither any large smooth gradient.",
    ]),
    "",
    heading("Reduced motion"),
    "- Under prefers-reduced-motion: reduce, freeze the animation at its most legible frame and keep the static gradient. The page must still look designed, not blank.",
    "",
    heading("Do not"),
    "- Do not make the background the loudest thing on the page.",
    "- Do not autoplay video as a background.",
    "- Do not use a stock gradient mesh at full saturation.",
    "- Do not let the animation cause any cumulative layout shift.",
  );
}

/* -------------------------------- gradients ------------------------------- */

function renderGradient(p: PromptParams, title: string): string {
  const stops = list(p.stops);

  return block(
    `You are building "${title}", an interactive gradient intended as a hero or full-section background.`,
    "",
    heading("Objective"),
    `${str(p.typeSpec)} It should look like a considered colour study — the kind a designer would put in a portfolio — not like a default linear-gradient.`,
    "",
    heading("Output"),
    bullets([
      "Return exactly one self-contained `.html` file.",
      "The gradient fills the viewport and resizes without a visible seam or a jump in speed.",
      "Overlay a small control strip in the corner with the palette swatches and a Copy CSS button, so the exact values can be lifted out.",
    ]),
    "",
    heading("Colour"),
    `- Stops, in order: ${stops.join(" → ")}.`,
    `- Full palette available: ${list(p.colors).join(", ")}.`,
    `- Base angle ${num(p.angle, 180)} degrees. Cycle duration ${num(p.duration, 24)}s.`,
    `- Blend mode: ${str(p.blend, "normal")}.`,
    `- Grain overlay at ${str(p.grainAmount, "3%")} to eliminate banding — this is mandatory on any smooth gradient wider than about 600px.`,
    "- Keep the transition between adjacent stops wide and soft. Hard colour boundaries read as a mistake.",
    "",
    heading("Interaction"),
    `- Driven by ${str(p.interactive, "none — ambient only")}.`,
    `- Whatever drives it, smooth the input: a lerp factor of 0.08 per frame for pointer values, and a normalised 0-1 progress value for scroll. Never bind a raw event value directly to a visual property.`,
    "- Provide a static fallback state that looks intentional on its own, for when the driver is unavailable (no pointer, no scroll, reduced motion).",
    "",
    heading("Implementation"),
    "- If the gradient is shader-based, write the fragment shader inline and expose its parameters as uniforms the page can set.",
    "- Clamp devicePixelRatio to 2. Pause when the tab is hidden or the element is off-screen.",
    "- Also emit the pure-CSS equivalent as a comment at the top of the file, so the gradient can be used without JavaScript.",
    "",
    heading("Legibility & accessibility"),
    "- Any text placed over the gradient must maintain 4.5:1 contrast at every point in the cycle. Add a scrim where needed and say so in a comment.",
    "- Under prefers-reduced-motion: reduce, hold the gradient at its most balanced frame with no animation.",
    "- The control strip is keyboard-operable and does not trap focus.",
  );
}

/* -------------------------------- marketing ------------------------------- */

function renderMarketing(p: PromptParams): string {
  return block(
    `You are a senior copywriter who has written for ${str(p.industry)} brands for fifteen years. You write specific, verifiable copy and you distrust adjectives.`,
    "",
    heading("Task"),
    `Write ${str(p.format)} for ${str(p.product)} in the ${str(p.industry)} category.`,
    `- Audience: ${str(p.audience)}.`,
    `- Length: ${str(p.length)}.`,
    `- Primary call to action: "${str(p.cta)}".`,
    `- The offer being made: ${str(p.offer)}.`,
    "",
    heading("Angle"),
    `Build the whole piece around this angle: ${str(p.angle)}. Every paragraph must serve it. If a paragraph does not, cut it rather than keeping it for balance.`,
    "",
    heading("Voice"),
    `${str(p.voice)}: ${str(p.voiceSpec)}`,
    "",
    heading("Channel rules"),
    str(p.channelRule),
    "",
    heading("Evidence"),
    `- Available proof to draw on: ${str(p.proof)}.`,
    `- Use at least three concrete specifics (a number, a named process, a real constraint). Do not invent a customer name, a testimonial, a statistic or a certification. Where a number is needed and none is supplied, write it as [METRIC: what to put here] so it is obvious to fill in.`,
    "",
    heading("Constraints"),
    `- ${str(p.constraint)}.`,
    "- No hype vocabulary: unleash, elevate, seamless, revolutionary, game-changing, dive deep, in today's fast-paced world.",
    "- Do not address the reader's intelligence ('as you know', 'you'll appreciate').",
    "- Nothing that would read identically if the competitor's name were swapped in.",
    "",
    heading("Output"),
    bullets([
      "Deliver the finished copy only, formatted for its channel.",
      "Then add a short section titled `Notes` with: the one thing this piece is optimising for, the assumption behind the chosen angle, and two A/B variants of the opening line.",
      "If any part of the brief is ambiguous, state your reading of it in Notes rather than asking first.",
    ]),
  );
}

/* ----------------------------------- code ---------------------------------- */

function renderCode(p: PromptParams): string {
  return block(
    `You are a principal ${str(p.language)} engineer. You are rigorous about correctness, you say when you are unsure, and you never invent an API.`,
    "",
    heading("Task"),
    `Your job is to ${str(p.taskSpec)}.`,
    `- Language: ${str(p.language)}. Stack: ${str(p.stack)}.`,
    `- Scope: ${str(p.scale)}.`,
    `- Standard: ${str(p.rigor)}.`,
    "",
    heading("Method"),
    str(p.taskExtra),
    "",
    heading("Working rules"),
    `- Approach: ${str(p.mode)}.`,
    `- Constraint: ${str(p.constraint)}.`,
    "- If the code or context you need is missing, list exactly what you would need and state the assumption you are proceeding under — then proceed. Do not stall.",
    "- Never invent a library function, a flag or a configuration key. If you are unsure one exists, say so explicitly and give the version where you are confident it does.",
    "- Distinguish clearly between what you verified, what you inferred and what you guessed.",
    "",
    heading("Output"),
    bullets([
      "Complete, runnable code — no elisions, no `# ... rest unchanged`, no pseudo-code inside a real implementation.",
      "Where you change existing code, show enough surrounding context that the change can be placed unambiguously.",
      "After the code: a short `Reasoning` section listing the decisions that were not obvious, the alternatives you rejected and why, and the tests you would add.",
      "Finish with `Risks`: what could break, what you could not verify, and the first thing to check if it misbehaves.",
    ]),
  );
}

/* --------------------------------- writing --------------------------------- */

function renderWriting(p: PromptParams): string {
  return block(
    `You are a working writer with a reputation for clarity. You cut without sentiment.`,
    "",
    heading("Task"),
    `Write ${str(p.formatSpec)}`,
    `- Subject: ${str(p.topic)}.`,
    `- Written for: ${str(p.reader)}.`,
    `- Stance: ${str(p.stance)}.`,
    "",
    heading("Voice"),
    `${str(p.voice)}: ${str(p.voiceSpec)}`,
    "",
    heading("Structure"),
    `- ${str(p.structure)}.`,
    "- Every paragraph must add a fact, an argument or a turn. If a paragraph only restates the previous one, delete it.",
    "- The piece must have at least one moment where the reader's expectation is contradicted and then resolved.",
    "- End on something concrete. Do not summarise what you just wrote.",
    "",
    heading("Constraints"),
    `- ${str(p.forbidden)}.`,
    "- No rhetorical questions used as transitions.",
    "- Prefer the specific noun over the general one, the active verb over the nominalisation, and the short word where both mean the same thing.",
    "- Do not address the reader directly unless the format calls for it.",
    "- Anything factual that you are not confident about must be marked [VERIFY] inline rather than stated smoothly.",
    "",
    heading("Output"),
    bullets([
      "The finished piece, with a title and, where the format uses them, headings.",
      "Then a `Notes` block: the one sentence the whole piece is arguing, what you cut and why, and two alternative titles.",
    ]),
  );
}

/* ---------------------------------- image ---------------------------------- */

function renderImage(p: PromptParams): string {
  return block(
    `You are writing an image-generation prompt for a professional model (Midjourney, DALL-E, Firefly, Flux or Imagen). Write the prompt, then the reasoning.`,
    "",
    heading("Subject"),
    `${str(p.subject).replace(/^\w/, (c) => c.toUpperCase())} in ${str(p.setting)}.`,
    `- One telling detail: ${str(p.detail)}.`,
    "",
    heading("Style"),
    `${str(p.style)}: ${str(p.styleSpec)}`,
    `- Lighting: ${str(p.lighting)}.`,
    `- Aspect ratio: ${str(p.aspect)}.`,
    "",
    heading("Deliverable"),
    bullets([
      "1. `Prompt` — a single paragraph of 40-90 words in the order: subject and action, setting and time of day, lighting, camera and lens, style and medium, colour palette, mood. Comma-separated descriptors are acceptable after the opening clause, but the first clause must be a real sentence fragment with a subject and a verb.",
      "2. `Negative prompt` — what to exclude. Start from: " + str(p.negative) + ", and add anything the style makes likely to go wrong.",
      "3. `Parameters` — aspect ratio, and the model-specific settings worth changing (stylisation, chaos, quality, seed handling) with a one-line reason for each.",
      "4. `Variations` — three alternative openings of the same scene that would each produce a materially different image: one shifting the time of day, one shifting the camera distance, one shifting the emotional register.",
    ]),
    "",
    heading("Rules"),
    "- Name real photographic and material vocabulary — focal length, aperture, light modifier, film stock, pigment, print process. Vague adjectives ('beautiful', 'stunning', 'high quality') waste tokens and change nothing.",
    "- Describe one subject doing one thing. Multiple competing subjects produce mush.",
    "- Do not ask for legible text in the image unless the format is explicitly a poster, and even then warn that it will probably need to be added afterwards.",
    "- State the colour palette with named colours or hex values, not with mood words alone.",
  );
}

/* --------------------------------- business -------------------------------- */

function renderBusiness(p: PromptParams): string {
  return block(
    `You are an operator who has run ${str(p.industry)} businesses and now advises them. You are blunt about trade-offs and you do not produce generic frameworks.`,
    "",
    heading("Situation"),
    `- Company: ${str(p.product)}, ${str(p.industry)}, serving ${str(p.audience)}.`,
    `- Stage: ${str(p.stage)}.`,
    `- Planning horizon: ${str(p.horizon)}.`,
    `- Hard constraint: ${str(p.constraint)}.`,
    `- Live risk: ${str(p.risk)}.`,
    "",
    heading("Task"),
    `Produce ${str(p.deliverable)}.`,
    str(p.framework),
    "",
    heading("How to work"),
    "- Reason from the constraint, not from the ideal. The recommended plan must be executable with the headcount, budget and time actually available.",
    "- Give one recommendation and defend it. Presenting three options with no view is a way of avoiding the work.",
    "- Every number you use must either come from the brief or be labelled as an assumption with the range it could plausibly take.",
    "- Name the second-order effects of your recommendation, including who inside the company will resist it and why.",
    "- Include what you would stop doing. A plan that only adds work is not a plan.",
    "",
    heading("Output"),
    bullets([
      "`Recommendation` — two or three sentences, first, before any context.",
      "`Analysis` — the reasoning, with the assumptions listed explicitly.",
      "`Plan` — sequenced actions over the horizon, each with an owner role, a dependency and a completion test.",
      "`Metrics` — the three numbers that would tell you it is working, and the one number that would tell you to stop.",
      "`Risks` — what would make this fail, with the early warning sign for each.",
    ]),
  );
}

/* ---------------------------------- agents --------------------------------- */

function renderAgents(p: PromptParams): string {
  return block(
    `You are designing an AI agent for production use. You care more about the failure modes than the happy path.`,
    "",
    heading("Task"),
    `Specify ${str(p.agent).toLowerCase()} that will ${str(p.task)}, for ${str(p.product)} in the ${str(p.industry)} category.`,
    `- Trigger: ${str(p.trigger)}.`,
    `- Runtime budget: ${str(p.budget)}.`,
    `- State: ${str(p.state)}.`,
    `- On failure: ${str(p.failure)}.`,
    "",
    heading("Control loop"),
    str(p.loop),
    "Describe the loop as an explicit state machine: the states, the transitions, the condition on each transition, and the terminal states. Say what happens when the budget is exhausted mid-loop.",
    "",
    heading("Tools"),
    `Available: ${str(p.tools)}.`,
    "- For each tool, define its signature, what a successful result looks like, what a failed result looks like, and whether the call is read-only or mutating.",
    "- Mutating calls must be idempotent or explicitly guarded. Say which.",
    "",
    heading("Guardrails"),
    str(p.guardrails),
    "Then add: what the agent must never do, what requires human approval before it happens, and what it must do when two of its instructions conflict.",
    "",
    heading("Observability"),
    "- Define what is logged per run, what the run record contains, and how a human reconstructs why the agent made a specific decision three days later.",
    "- Define the alert conditions and their thresholds. Distinguish 'this run failed' from 'this agent is degrading'.",
    "",
    heading("Evaluation"),
    "- Propose ten test cases: five straightforward, three edge cases, two adversarial inputs designed to make the agent overstep.",
    "- For each, state the expected behaviour, not just the expected output.",
    "- Define the metric that decides whether this agent is good enough to run unattended.",
    "",
    heading("Output"),
    bullets([
      "`Purpose` — one sentence.",
      "`State machine` — states, transitions, terminal conditions.",
      "`Tools` — table of signature, side effects, failure modes.",
      "`Guardrails` — hard limits and escalation rules.",
      "`Observability` — logs, alerts, reconstruction.",
      "`Evaluation` — the ten cases and the quality bar.",
      "`Open questions` — what you would need answered before building this.",
    ]),
  );
}

/* ------------------------------------ seo ---------------------------------- */

function renderSeo(p: PromptParams): string {
  return block(
    `You are a technical SEO consultant who has recovered sites from core updates and who does not sell rankings.`,
    "",
    heading("Context"),
    `- Site: ${str(p.product)} (${str(p.industry)}), serving ${str(p.audience)}.`,
    `- Query intent: ${str(p.intent)}. Target page type: ${str(p.pageType)}.`,
    `- Goal: ${str(p.goal)}.`,
    `- Market: ${str(p.market)}. Language(s): ${str(p.language)}.`,
    `- Starting position: ${str(p.difficulty)}.`,
    "",
    heading("Deliverable"),
    `Produce ${str(p.deliverable)}.`,
    "",
    heading("Rules"),
    "- Be concrete. Name real query patterns and real page structures, not 'high-quality content'.",
    "- Distinguish what is known from what is estimated. Search volume and difficulty figures you cannot verify must be labelled as estimates with a range.",
    "- Order everything by expected impact over effort. Say which items are worth doing only after the top three are done.",
    "- For every recommendation, give the verification step: the exact check that confirms it worked, and how long to wait before judging.",
    `- Account for the market: ${str(p.market)} search behaviour, localisation and any regulatory constraints on the claims the page can make.`,
    "- Do not recommend anything that depends on manipulating the searcher: hidden text, doorway pages, scaled content with no added value, or expired-domain redirects.",
    "",
    heading("Output"),
    bullets([
      "The deliverable itself, complete and usable without further editing.",
      "`Assumptions` — what you assumed about the site, the market and the competition.",
      "`Sequencing` — the order to execute in, with dependencies.",
      "`Measurement` — the metric per item, the baseline to capture first, and the review date.",
    ]),
  );
}

/* ----------------------------------- data ---------------------------------- */

function renderData(p: PromptParams): string {
  return block(
    `You are a data analyst who is more interested in whether a number can be trusted than in producing one.`,
    "",
    heading("Context"),
    `- Business: ${str(p.product)} (${str(p.industry)}).`,
    `- Dataset: ${str(p.dataset)}.`,
    `- Tools available: ${str(p.tool)}.`,
    `- Stakes: ${str(p.stakes)}.`,
    "",
    heading("Task"),
    `Perform ${str(p.task)}.`,
    str(p.method),
    `Expected output: ${str(p.output)}.`,
    "",
    heading("Rules"),
    "- Describe the data before you interpret it: row count, date range, granularity, missingness, duplicates and outliers. Any finding that depends on a data-quality problem must say so.",
    "- Separate observation from inference from speculation, explicitly, in that order.",
    "- Quantify uncertainty. A point estimate with no interval is not an answer where the stakes are this high.",
    "- State what would change your conclusion, and what additional data would settle it.",
    "- Do not present correlation as causation. If a causal claim is needed, say what design would support it.",
    "- Check the result against a naive baseline. If the sophisticated answer is close to the naive one, say that the naive one is sufficient.",
    "",
    heading("Output"),
    bullets([
      "`Summary` — three sentences a non-analyst could act on.",
      "`Data quality` — what you found and what you did about it.",
      "`Method` — what you did and why that method fits this data, with the code or queries.",
      "`Findings` — each with its supporting figure described in words, its confidence and its caveat.",
      "`Limitations` — what this analysis cannot tell you.",
      "`Next step` — the single most valuable follow-up.",
    ]),
  );
}

/* --------------------------------- learning -------------------------------- */

function renderLearning(p: PromptParams): string {
  return block(
    `You are a teacher who designs curricula that people actually finish. You are allergic to content that feels like progress without being progress.`,
    "",
    heading("Learner"),
    `- Subject: ${str(p.subject)}.`,
    `- Current level: ${str(p.level)}.`,
    `- Background: ${str(p.background)}.`,
    `- Time available: ${num(p.hours, 5)} hours a week.`,
    `- Target: ${str(p.output)}.`,
    "",
    heading("Deliverable"),
    `Produce ${str(p.format)}.`,
    `- Cadence: ${str(p.cadence)}.`,
    str(p.rule),
    "",
    heading("Design rules"),
    "- Every unit must contain something the learner has to produce, not just consume. Reading and watching are inputs; the exercise is the unit.",
    "- Sequence by dependency, not by tradition. If a topic can be learned at the moment it is needed, move it there.",
    "- Name the prerequisite for each unit explicitly, and provide a five-minute diagnostic the learner can use to skip it if they already have it.",
    "- Include the misconceptions a learner at this level typically forms in this subject, and the exercise that corrects each one.",
    "- Build in retrieval: each unit revisits something from at least two units back, without announcing that it is doing so.",
    "- Be honest about what this plan will not cover, and what to study next after it.",
    "",
    heading("Output"),
    bullets([
      "`Overview` — what the learner can do at the end that they cannot do now, stated as observable behaviours.",
      "`Plan` — unit by unit: the concept, the exercise, the thing to build, the estimated hours, and the check that proves it landed.",
      "`Resources` — specific and named (a book chapter, a paper, a documented API, a problem set), not 'find a tutorial'.",
      "`Misconceptions` — the five most likely, each with its correction.",
      "`If you fall behind` — the reduced version of this plan that still reaches the target.",
    ]),
  );
}

/* -------------------------------- dispatch --------------------------------- */

type Renderer = (params: PromptParams, title: string) => string;

const RENDERERS: Record<string, Renderer> = {
  templates: renderTemplate,
  scenes: renderScene,
  sections: renderSection,
  backgrounds: renderBackground,
  gradients: renderGradient,
  marketing: renderMarketing,
  code: renderCode,
  writing: renderWriting,
  image: renderImage,
  business: renderBusiness,
  agents: renderAgents,
  seo: renderSeo,
  data: renderData,
  learning: renderLearning,
};

const TITLES: Record<string, string> = {
  templates: "PromptWorld — design layer prompt",
  scenes: "PromptWorld — 3D scene prompt",
  sections: "PromptWorld — section prompt",
  backgrounds: "PromptWorld — background prompt",
  gradients: "PromptWorld — gradient prompt",
};

export function renderPromptText(entry: PromptEntry): string {
  const render = RENDERERS[entry.category];
  if (!render) return "";
  const body = render(entry.params, entry.title);
  const header = TITLES[entry.category];
  const prefix = header
    ? `${header}\n${entry.title} · ${entry.kind} · ${entry.mood}\n${"-".repeat(52)}\n\n`
    : "";
  return `${prefix}${body}\n`;
}

/** Rough spoken/read length, used for the "x min read" affordance on cards. */
export function promptReadTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
