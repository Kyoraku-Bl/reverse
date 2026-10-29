/**
 * Vocabulary for the design half of the library (getlayers-style layers):
 * templates, 3D scenes, sections, backgrounds and gradients.
 *
 * Each pool entry carries more than a label — it carries the concrete
 * instruction text the prompt renderer embeds, so every generated prompt is a
 * real, buildable spec rather than a mad-lib.
 */

export const INDUSTRIES = [
  { label: "AI / Tech", product: "an applied AI platform", audience: "technical buyers and engineering leads", cta: "Book a demo", proof: "SOC 2 badge, model benchmarks and a live playground" },
  { label: "SaaS", product: "a B2B SaaS product", audience: "operators evaluating a new tool for their team", cta: "Start free trial", proof: "customer logos, G2 rating and a time-to-value figure" },
  { label: "Fintech", product: "a financial product", audience: "people who distrust flashy money apps", cta: "Open an account", proof: "regulatory disclosure, APR clarity and a security statement" },
  { label: "Agency / Studio", product: "a design and engineering studio", audience: "founders hiring a studio for a launch", cta: "Start a project", proof: "case-study outcomes, client roster and awards" },
  { label: "E-commerce", product: "a direct-to-consumer product line", audience: "shoppers comparing it against a cheaper alternative", cta: "Add to bag", proof: "review volume, shipping and returns policy, ingredient or material list" },
  { label: "Health / Science", product: "a health or research offering", audience: "sceptical, evidence-led readers", cta: "Read the research", proof: "citations, clinician credentials and trial data" },
  { label: "Portfolio", product: "an individual's body of work", audience: "recruiters and clients scanning in under a minute", cta: "Get in touch", proof: "selected projects, role clarity and measurable outcomes" },
  { label: "Crypto / Web3", product: "a protocol or on-chain product", audience: "developers who read docs before marketing", cta: "Read the docs", proof: "audit report, TVL, chain support and token disclosure" },
  { label: "Real Estate", product: "a property or development", audience: "buyers weighing a large, slow decision", cta: "Book a viewing", proof: "floor plans, location data and completion timeline" },
  { label: "Food & Drink", product: "a food or drink brand", audience: "hungry people on a phone", cta: "Order now", proof: "sourcing story, allergens and opening hours" },
  { label: "Travel", product: "a travel experience", audience: "dreamers not yet committed to dates", cta: "Check availability", proof: "itinerary detail, season guidance and traveller reviews" },
  { label: "Legal", product: "a legal service", audience: "people in a stressful situation who need certainty", cta: "Request a consultation", proof: "bar registration, fixed-fee clarity and response-time promise" },
  { label: "Education", product: "a course or learning platform", audience: "self-directed learners sceptical of hype", cta: "Enrol now", proof: "syllabus, instructor credentials and completion rates" },
  { label: "Music", product: "an artist, label or audio tool", audience: "fans and A&R scouts", cta: "Listen now", proof: "release dates, tour list and streaming numbers" },
  { label: "Gaming", product: "a game or gaming tool", audience: "players who judge on feel and frames", cta: "Wishlist now", proof: "platform list, genre tags and a trailer" },
  { label: "Fashion", product: "a fashion label", audience: "image-led shoppers", cta: "Shop the collection", proof: "material provenance, size guide and lookbook" },
  { label: "Non-profit", product: "a mission-driven organisation", audience: "donors who want proof of impact", cta: "Donate", proof: "impact numbers, transparency report and registration number" },
  { label: "Sports & Fitness", product: "a training product or club", audience: "people mid-resolution", cta: "Start training", proof: "programming detail, coach credentials and member results" },
  { label: "Automotive", product: "a vehicle or mobility service", audience: "buyers comparing spec sheets", cta: "Configure yours", proof: "range, warranty and safety rating" },
  { label: "Dev Tools", product: "a developer tool", audience: "engineers who will judge the code, not the copy", cta: "npm install", proof: "benchmark, changelog, repo stars and an honest limitations list" },
  { label: "Architecture", product: "an architecture practice", audience: "clients buying a long, expensive relationship", cta: "Request a site visit", proof: "built projects, materials palette and process diagram" },
  { label: "Interior", product: "an interior design studio", audience: "homeowners with a budget and a taste reference", cta: "Book a consultation", proof: "before/after, materials board and price bands" },
  { label: "Photography", product: "a photographer's service", audience: "couples and brands booking a shoot", cta: "Check dates", proof: "galleries, package tiers and turnaround time" },
  { label: "Podcast / Media", product: "a media publication", audience: "readers deciding whether to subscribe", cta: "Subscribe", proof: "archive depth, episode list and contributor bios" },
  { label: "Logistics", product: "a freight or fulfilment service", audience: "operations managers who need reliability numbers", cta: "Get a quote", proof: "coverage map, SLA and tracking screenshot" },
  { label: "Energy", product: "an energy or climate product", audience: "procurement teams with a decarbonisation target", cta: "Request a model", proof: "certifications, capacity data and an emissions methodology" },
  { label: "Recruiting", product: "a hiring or talent service", audience: "candidates and hiring managers on opposite sides", cta: "See open roles", proof: "time-to-hire, salary transparency and placement volume" },
  { label: "Hospitality", product: "a hotel or restaurant group", audience: "guests booking an experience, not a room", cta: "Reserve a table", proof: "menus, room categories and a cancellation policy" },
];

export const HERO_TECHNIQUES = [
  { id: "shader-field", label: "Animated shader field", spec: "A full-bleed WebGL fragment shader behind the headline: layered value noise advected by time, thresholded into soft bands, with a slow hue rotation of at most 8 degrees per minute. Keep it under 12 uniform updates per frame." },
  { id: "particle-vortex", label: "Particle vortex", spec: "A GPU particle field of 15,000-30,000 points orbiting a central attractor, drawn as 1.2px additive sprites. Particles respond to pointer position with a repulsion force that decays over 600ms." },
  { id: "scroll-pinned-3d", label: "Scroll-pinned 3D object", spec: "A single low-poly model pinned through a 200vh section. Scroll progress drives rotation (0 to 1.5 turns), a material roughness sweep (0.9 to 0.15) and a dolly from 6 to 2.4 units. Scrub, do not autoplay." },
  { id: "kinetic-type", label: "Kinetic type takeover", spec: "The headline is the hero: display type at 14-22vw, split per character, staggered in with a 3D rotateX(-80deg) to 0 and a 40px y-offset at 45ms per character. No image, no canvas — pure CSS transform." },
  { id: "split-screen-media", label: "Split-screen media wall", spec: "Two independently Ken-Burns-breathing media panes divided by a 1px rule that tracks the pointer vertically. Each pane scales 1 to 1.08 over 14s on an alternating ease-in-out loop." },
  { id: "marquee-collage", label: "Infinite marquee collage", spec: "Three counter-scrolling marquee rows at different speeds (28s, 44s, 62s) carrying cards, logos and typography fragments, each row masked with a 12% edge fade." },
  { id: "liquid-glass", label: "Liquid glass object", spec: "A single glass body rendered with MeshPhysicalMaterial: transmission 1, thickness 0.6, ior 1.52, roughness 0.08, backed by an environment map. Refraction must show the headline behind it, distorted." },
  { id: "ascii-render", label: "Live ASCII render", spec: "A 3D subject re-rendered every frame into a character grid (60x28) using a luminance-to-glyph ramp. The characters are real DOM text, selectable, and inherit the page's display font." },
  { id: "cursor-spotlight", label: "Cursor spotlight on matte", spec: "A near-black matte hero where a 420px radial spotlight follows the pointer and reveals a second, full-colour layer beneath via a CSS mask. Spotlight lag uses a 0.12 lerp factor." },
  { id: "video-matte", label: "Looping video matte", spec: "A muted, autoplaying, playsinline MP4 loop under 1.2MB with a poster frame, masked into a shape that matches the headline's negative space. Provide a reduced-motion static fallback." },
  { id: "isometric-explode", label: "Isometric exploded diagram", spec: "An isometric stack of 5-7 labelled planes that separate on scroll from 0 to 44px of vertical offset, each with its own caption leader line. SVG, not canvas, so it stays crisp and accessible." },
  { id: "grain-monolith", label: "Grain-lit monolith", spec: "One solid geometric volume lit by a single hard key light, wrapped in animated film grain (a 128px tiling noise texture offset randomly each frame at 24fps, not 60fps, to save fill rate)." },
  { id: "type-mask-reveal", label: "Type-masked image reveal", spec: "The headline text is a mask; the image scrolls horizontally inside the glyphs at 1.4x page speed using background-clip: text with a background-position driven by scroll." },
  { id: "physics-cards", label: "Physics-scattered cards", spec: "Six to ten cards dropped into a lightweight 2D physics world on load, settling against invisible walls. Each card can be flicked; collisions damp at 0.86 restitution." },
  { id: "wireframe-to-solid", label: "Wireframe-to-solid morph", spec: "A model rendered twice — wireframe and solid — cross-faded by scroll progress so the object appears to resolve from blueprint to product across one viewport of scrolling." },
  { id: "horizon-gradient", label: "Layered horizon gradient", spec: "Five stacked gradient bands with different blur radii (0, 12, 32, 64, 96px) drifting at different rates to fake atmospheric depth. No canvas; pure CSS filters and transforms." },
  { id: "data-live", label: "Live data hero", spec: "The hero shows real, changing numbers — a counter, a sparkline and a status pill — updating every 3s from a local array. Motion is a 180ms digit roll, never a layout shift." },
  { id: "stagger-grid", label: "Staggered tile grid", spec: "A 12-column asymmetric tile grid where each tile enters on intersection with a 60ms stagger, a 24px rise and a clip-path inset reveal from its own dominant edge." },
  { id: "ribbon-trail", label: "Ribbon trail", spec: "A parametric ribbon geometry following the pointer with a 22-frame trail history, rebuilt as a triangle strip each frame. Tension 0.4, width tapering from 0.9 to 0.05 units." },
  { id: "noise-terrain", label: "Procedural terrain flyover", spec: "A 128x128 plane displaced by 4 octaves of simplex noise, camera on a slow 40s looping dolly path, wireframe overlay at 0.12 opacity for a survey-map read." },
  { id: "chromatic-split", label: "Chromatic split headline", spec: "The headline is rendered three times offset by 1.5px in red and cyan channels, converging to a single crisp line on load over 900ms, then re-splitting on every hover." },
  { id: "stacked-cards", label: "Stacked card deck", spec: "A deck of five cards pinned through 300vh; each card scales 1 to 0.92 and rotates 0 to -2deg as the next one rises over it, with a shared drop shadow that deepens per layer." },
  { id: "orb-webgl", label: "Iridescent orb", spec: "A sphere with a thin-film interference shader: normal-driven hue cycling through a 40-degree band, fresnel rim at power 2.6, slow auto-rotation of 0.05 rad/s plus pointer parallax of 4 degrees." },
  { id: "column-ticker", label: "Editorial column ticker", spec: "A broadsheet layout where three text columns scroll vertically at independent speeds inside overflow masks, evoking a printed page feeding through a press." },
];

export const MOTION_SYSTEMS = [
  { id: "gsap-lenis", label: "GSAP + Lenis", spec: "Use GSAP with ScrollTrigger for pinned sequences and Lenis for smooth scrolling. Register the Lenis scroll event with ScrollTrigger.update(). Kill all tweens on route change." },
  { id: "framer", label: "Framer Motion", spec: "Use Framer Motion `whileInView` with `viewport={{ once: true, amount: 0.35 }}` for reveals and `useScroll` + `useTransform` for anything pinned. Never animate width, height, top or left." },
  { id: "css-only", label: "CSS only", spec: "No JavaScript animation library. Use @keyframes, scroll-driven animations (`animation-timeline: view()`), transitions and CSS custom properties. Every animation must have a prefers-reduced-motion override." },
  { id: "vanilla-io", label: "IntersectionObserver + WAAPI", spec: "Reveal with IntersectionObserver at threshold 0.2, animate with element.animate() and a shared 480ms cubic-bezier(0.16, 1, 0.3, 1) easing. Disconnect observers after they fire." },
  { id: "view-transitions", label: "View Transitions API", spec: "Use document.startViewTransition() for state changes and named view-transition-groups for elements that persist between states, with a 260ms cross-document fade fallback." },
  { id: "r15-three", label: "Three.js + custom RAF loop", spec: "One requestAnimationFrame loop drives the whole page: three.js render, scroll smoothing and DOM reveals. Use a clock delta so speed is framerate-independent, and pause the loop when the tab is hidden." },
];

export const FONT_PAIRINGS = [
  { display: "a tight grotesque (Neue Haas Grotesk, Inter Tight or Söhne)", body: "Inter", note: "Display at -0.03em tracking, body at 0em." },
  { display: "a high-contrast serif (Playfair Display or Canela)", body: "Inter", note: "Serif only above 40px; never use it for UI labels." },
  { display: "a variable mono (JetBrains Mono or Geist Mono)", body: "Geist", note: "Mono is used for labels, numbers and metadata, always uppercase at 0.12em tracking." },
  { display: "a condensed sans (Oswald or Archivo Narrow)", body: "Source Sans 3", note: "Condensed display lets headlines run to 9 words on one line." },
  { display: "a neo-grotesque (Space Grotesk)", body: "IBM Plex Sans", note: "Pair at a 1:0.62 size ratio; keep the body neutral so the display carries the character." },
  { display: "an editorial serif (Instrument Serif)", body: "Newsreader", note: "Both are optical-size aware — set font-optical-sizing: auto and use the text axis below 18px." },
  { display: "a brutalist slab (Roboto Slab Black or Alfa Slab One)", body: "IBM Plex Mono", note: "Slab at 900 weight, mono for everything secondary. No third family." },
  { display: "a geometric sans (Poppins or DM Sans)", body: "DM Sans", note: "One family, two weights (500 and 700), differentiated by size and tracking rather than by face." },
  { display: "a humanist serif (Lora or Spectral)", body: "Public Sans", note: "Serif for narrative paragraphs, humanist sans for every interactive element." },
  { display: "a display cut (Bebas Neue or Anton)", body: "Barlow", note: "Display is all-caps and never wraps to more than two lines; if it does, cut the copy instead of shrinking the type." },
];

/**
 * Page sections. `order` is the canonical position in a landing page, so a
 * generated template always reads nav → hero → proof → product → pricing →
 * FAQ → CTA → footer. Sampling picks *which* sections appear; the order is
 * fixed, because a random order produces an unusable page.
 */
export const SECTION_ARCHETYPES = [
  { label: "sticky nav that condenses on scroll", order: 0 },
  { label: "full-viewport hero", order: 10 },
  { label: "logo marquee with 8-12 client marks", order: 20 },
  { label: "stats band with count-up numbers", order: 30 },
  { label: "three-column feature grid with icons drawn as inline SVG", order: 40 },
  { label: "sticky two-column feature walkthrough (media left, copy right)", order: 45 },
  { label: "case-study cards with outcome metrics", order: 50 },
  { label: "numbered process rail with four steps", order: 55 },
  { label: "comparison table against a named alternative", order: 60 },
  { label: "integrations grid of 24 logos", order: 65 },
  { label: "testimonial wall in a masonry layout", order: 70 },
  { label: "team grid with duotone portraits", order: 75 },
  { label: "changelog / what's new feed", order: 80 },
  { label: "pricing table with a highlighted middle tier", order: 85 },
  { label: "FAQ accordion with schema.org markup", order: 90 },
  { label: "email capture with inline validation", order: 95 },
  { label: "final CTA on a full-bleed gradient", order: 98 },
  { label: "fat footer with sitemap columns and a legal row", order: 99 },
];

export const EASINGS = [
  "cubic-bezier(0.16, 1, 0.3, 1)",
  "cubic-bezier(0.65, 0, 0.35, 1)",
  "cubic-bezier(0.22, 1, 0.36, 1)",
  "cubic-bezier(0.87, 0, 0.13, 1)",
  "cubic-bezier(0.33, 1, 0.68, 1)",
];

/* ---------------------------------- 3D ---------------------------------- */

export const SCENE_SUBJECTS = [
  "a monolithic slab", "a torus knot", "an icosphere", "a twisted glass ribbon", "a particle galaxy",
  "a flowing cloth sheet", "a terrain mesh", "a tunnel of rings", "a floating mirror sphere",
  "a crystal cluster", "a liquid metal blob", "a wireframe city grid", "a stack of glass plates",
  "a helix of cubes", "a shattered plane", "a rotating dodecahedron", "a field of grass blades",
  "a volumetric cloud", "a chain of linked rings", "a carved stone gate", "a molten sphere",
  "a lattice cube", "a swarm of boids", "a folded paper crane", "an extruded logo mark",
  "a wave-deformed plane", "a cluster of capsules", "a pinwheel galaxy", "a frozen globe",
  "a suspended chandelier of shards",
];

export const SCENE_TECHNIQUES = [
  { label: "Instanced particles", spec: "InstancedBufferGeometry with 20,000-60,000 instances, positions computed in the vertex shader from a noise function seeded per instance. No per-frame CPU writes." },
  { label: "Raymarched SDF", spec: "A single full-screen quad raymarching a signed distance field, max 96 steps, with soft shadows from 5 secondary marches and ambient occlusion from the step history." },
  { label: "Physical glass", spec: "MeshPhysicalMaterial with transmission, thickness and dispersion, rendered against a PMREMGenerator environment built from a procedural gradient scene rather than an HDR file." },
  { label: "Displacement mapping", spec: "A high-subdivision plane displaced in the vertex shader by 5 octaves of simplex noise, with normals recomputed analytically from the noise derivative — do not use computeVertexNormals per frame." },
  { label: "Custom fragment shader", spec: "A hand-written fragment shader with no lighting model: colour comes from UV, view angle and time only. Expose 4-6 uniforms the page can drive." },
  { label: "Post-processing stack", spec: "EffectComposer with RenderPass, UnrealBloomPass (strength 0.42, radius 0.6, threshold 0.82) and a custom grain + chromatic aberration pass at 0.0015 offset." },
  { label: "Fluid advection", spec: "A ping-pong framebuffer pair advecting a velocity field, with dye injected on pointer movement and dissipation at 0.985 per frame." },
  { label: "GPGPU simulation", spec: "Positions live in a float texture updated by a simulation shader; the render pass reads that texture in the vertex shader. Nothing is stored in JavaScript arrays." },
  { label: "Procedural geometry", spec: "Geometry built once at load from a parametric function, then animated purely by vertex-shader displacement so the CPU never touches a position buffer again." },
  { label: "Spline-driven camera", spec: "A CatmullRomCurve3 camera path sampled by scroll progress, with lookAt aimed 0.08 ahead on the curve so turns feel banked rather than snapped." },
  { label: "Boolean-composed solids", spec: "Multiple primitives combined with CSG-style subtraction baked into a single BufferGeometry at load, so the draw call count stays at one." },
  { label: "Point-cloud capture look", spec: "A dense point cloud sampled from a surface, drawn with size attenuation and a per-point alpha ramp so distant points dissolve rather than shrink to nothing." },
];

export const SCENE_MOODS = [
  "Waves & Terrain", "Galaxy & Space", "Fluid & Iridescent", "Vortex & Tunnel", "3D Element",
  "Glass & Crystal", "Particle Field", "Architectural", "Organic & Growth", "Metal & Chrome",
];

/* -------------------------------- Sections ------------------------------- */

export const SECTION_TYPES = [
  { label: "Hero", spec: "A first-viewport hero with an eyebrow, a headline of 6-11 words, a subhead of 20-32 words, a primary and a ghost CTA, and one piece of proof." },
  { label: "Features", spec: "A feature block of 3 or 6 items, each with an inline SVG icon drawn on a 24px grid at 1.5px stroke, a 2-4 word title and a 12-18 word description." },
  { label: "Carousel", spec: "A horizontal carousel with drag, snap points, arrow keys, previous/next buttons and a progress bar. Scroll-snap-type: x mandatory, no autoplay." },
  { label: "Cards", spec: "A card grid where each card has a media area, a title, a body and a footer meta row, with a hover state that lifts 4px and brightens the border to the accent colour." },
  { label: "FAQ", spec: "An accordion FAQ using the native details/summary element, enhanced with a height animation and FAQPage JSON-LD generated from the same content array." },
  { label: "Pricing", spec: "A three-tier pricing block with a highlighted tier, a monthly/annual toggle that animates the numbers, and a feature matrix below." },
  { label: "Testimonials", spec: "A testimonial wall mixing quote lengths (short, medium, long) in a masonry layout, each with an avatar, name, role and company." },
  { label: "Showcase", spec: "A product showcase where a device frame holds a scrolling screenshot driven by the section's own scroll progress." },
  { label: "Process / Roadmap", spec: "A numbered timeline, horizontal on desktop and vertical on mobile, with a progress line that fills as the section is scrolled." },
  { label: "Comparison", spec: "A comparison table against two named alternatives with a sticky first column and check/cross marks drawn as inline SVG." },
  { label: "Stats", spec: "A stats band of three or four figures that count up on entry over 1200ms with an ease-out curve, and never re-run." },
  { label: "Gallery", spec: "A filterable gallery with a lightbox, arrow-key navigation, focus trapping and a caption region announced politely to screen readers." },
  { label: "Form", spec: "A contact or waitlist form with inline validation, a loading state on the submit button, an error summary and a success state that replaces the form." },
  { label: "Footer", spec: "A fat footer with 3-4 link columns, a newsletter field, social icons, a legal row and an oversized wordmark that bleeds off the bottom edge." },
  { label: "Nav / Header", spec: "A sticky header that shrinks from 88px to 60px on scroll, with a full-screen mobile menu that staggers its links in at 40ms intervals." },
  { label: "CTA band", spec: "A closing call-to-action on a full-bleed background with a single headline, one button and a reassurance line." },
  { label: "Logos / Social proof", spec: "A logo marquee, duplicated for a seamless loop, desaturated to 40% opacity and brightening to 100% on hover." },
  { label: "Blog / Resources", spec: "A latest-articles block with one large lead card and three smaller ones, each showing category, title, excerpt, author and read time." },
  { label: "Integrations", spec: "An integrations grid of small tiles with a tooltip on hover naming the integration and what it syncs." },
  { label: "Team", spec: "A team grid with duotone portraits that resolve to full colour on hover, plus name, role and a one-line bio." },
  { label: "Changelog", spec: "A changelog feed grouped by month with version pills, added/changed/fixed tags and an anchor-linked list." },
  { label: "Video", spec: "A video section with a custom poster, a play button that scales on hover, and an inline player that lazy-loads the source only on first play." },
  { label: "Map / Locations", spec: "A locations block pairing a stylised SVG map with a list that highlights the matching pin on hover." },
  { label: "Newsletter", spec: "A newsletter capture with a single input, a clear value promise above it and a privacy reassurance below — no modal, no popup." },
];

export const SECTION_INTERACTIONS = [
  "pointer-tracked parallax at 6px per 100px of travel",
  "a magnetic hover that pulls the element 8px toward the cursor",
  "a spotlight border that follows the pointer around the card edge",
  "scroll-linked scale from 0.96 to 1 across the section",
  "a 3D tilt on hover limited to 6 degrees with a specular sheen",
  "click-to-expand detail with a height and opacity transition",
  "drag-to-reorder with a placeholder gap and a drop animation",
  "a sticky media column that swaps frames as copy steps pass",
  "hover-revealed secondary actions that slide up from the card footer",
  "a cursor-following blur lens that magnifies the underlying content 1.4x",
];

/* ------------------------------- Backgrounds ----------------------------- */

export const BACKGROUND_STYLES = [
  { label: "Aurora ribbons", spec: "Three large, heavily blurred conic gradients drifting on independent 30-60s loops, blended with screen. Blur radius at least 120px so no banding shows." },
  { label: "Grain field", spec: "A tiling 200px SVG feTurbulence grain at 0.035 opacity, re-seeded at 12fps, over a flat base colour." },
  { label: "Grid perspective", spec: "A CSS background-image grid rotated in 3D with perspective 400px, scrolling toward the viewer on a 6s linear loop, fading out at the horizon with a mask." },
  { label: "Particle dust", spec: "A canvas of 80-140 slowly rising particles with parallax across three depth layers and a 0.4-1.4px size range." },
  { label: "Mesh gradient", spec: "Four to six radial gradients positioned off-centre, each animating its position over 40-80s with different delays." },
  { label: "Scanlines", spec: "A repeating-linear-gradient of 2px scanlines at 0.05 opacity, scrolling vertically at 8s per loop, over a subtle vignette." },
  { label: "Noise waves", spec: "Layered SVG paths with a turbulence displacement filter, animated by translating each layer horizontally at a different speed." },
  { label: "Starfield", spec: "A three-layer starfield of box-shadow points, each layer moving at a different rate, with a twinkle animation on 15% of stars." },
  { label: "Caustics", spec: "Two overlapping repeating-conic-gradients with a heavy blur and a hue-rotate animation, producing slow water-light patterns." },
  { label: "Halftone", spec: "A radial-gradient dot pattern whose dot size is modulated by a second gradient, giving a printed halftone ramp across the section." },
  { label: "Beam sweep", spec: "A single wide, low-opacity linear-gradient beam sweeping diagonally across the section every 9s with a long pause between sweeps." },
  { label: "Topographic lines", spec: "Concentric SVG contour paths with a dash-offset animation, drawn at 1px and 0.18 opacity to read as a survey map." },
  { label: "Silk folds", spec: "A repeating-conic-gradient with a 60% blur and a slow background-position drift, imitating folded fabric catching light." },
  { label: "Circuit traces", spec: "An SVG of orthogonal traces with rounded corners and animated dash offsets, plus small pads that pulse in sequence." },
  { label: "Bokeh lights", spec: "Twelve to twenty blurred circles of varying size and opacity drifting on randomised loops, blended with lighter." },
  { label: "Dithered gradient", spec: "A two-colour gradient dithered with a Bayer 4x4 matrix as a background-image so it never bands on wide displays." },
  { label: "Marble veins", spec: "An feTurbulence-based marble filter with fractalNoise, baseFrequency 0.008 and 4 octaves, lit by a soft directional gradient." },
  { label: "Pixel rain", spec: "A grid of small squares fading in and out on staggered delays, denser at the top, evoking falling code." },
  { label: "Horizon glow", spec: "A single soft radial glow anchored to the bottom edge, breathing between 0.5 and 0.75 opacity over 8s." },
  { label: "Woven texture", spec: "Two repeating-linear-gradients at 90 degrees to each other, imitating a textile weave, with a subtle sheen sweep every 12s." },
  { label: "Smoke plume", spec: "A heavily blurred radial gradient whose scale and skew animate slowly, with a second counter-moving layer for turbulence." },
  { label: "Ruled paper", spec: "A faint horizontal rule pattern at 32px intervals with a vertical margin line, for editorial and documentation sections." },
  { label: "Dot matrix", spec: "A radial-gradient dot grid at 24px spacing that fades toward the edges with a mask-image, brightening on pointer proximity." },
  { label: "Iridescent film", spec: "A conic-gradient cycling through a narrow hue band, animated by rotating the gradient angle over 24s at low opacity." },
];

/* -------------------------------- Gradients ------------------------------ */

export const GRADIENT_TYPES = [
  { label: "WebGL mesh gradient", spec: "A fragment shader blending 4-6 moving control points with a smooth-min distance field, so the transitions are organic rather than linear." },
  { label: "Animated conic sweep", spec: "A conic-gradient whose angle rotates continuously, with stops placed to produce one bright band and a long dark tail." },
  { label: "Aurora bands", spec: "Stacked linear gradients at slight angles, each with a different animation duration, composited with screen blending." },
  { label: "Iridescent thin-film", spec: "A hue ramp computed from the dot product of view direction and surface normal, cycling through a 60-degree band of the spectrum." },
  { label: "Dithered two-stop", spec: "A plain two-stop gradient with ordered dithering applied in the shader to eliminate banding on 10-bit and wide displays." },
  { label: "Pointer-reactive radial", spec: "A radial gradient whose centre and radius follow the pointer with a lerp factor of 0.08, plus a secondary ring that trails it." },
  { label: "Scroll-linked ramp", spec: "A gradient whose stop positions are driven by page scroll progress, so the section changes temperature as the reader moves down." },
  { label: "Noise-warped gradient", spec: "A base gradient whose UVs are displaced by a scrolling noise texture, giving the colour a liquid, marbled motion." },
  { label: "Grain-overlaid gradient", spec: "A smooth gradient with a fine monochrome grain composited on top at 3-5% opacity, which removes banding and adds a photographic feel." },
  { label: "Stepped posterised gradient", riser: true, label2: "", spec: "A gradient quantised into 8-14 hard steps with a slight offset between steps, producing a printed risograph ramp." },
  { label: "Duotone photo wash", spec: "A gradient applied over a desaturated image via blend modes, mapping shadows to one colour and highlights to another." },
  { label: "Spectral data ramp", spec: "A perceptually uniform multi-stop ramp built for data visualisation, with equal lightness steps and colourblind-safe hue spacing." },
];
