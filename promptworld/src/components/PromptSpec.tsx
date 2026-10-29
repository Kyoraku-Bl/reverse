/**
 * The spec sheet beside a prompt: the concrete decisions the prompt carries.
 *
 * This is what makes two prompts in the same category visibly different before
 * you read either one — hex values, an easing curve, a particle budget, a
 * stated audience. Anything list-like is joined; booleans become yes/no.
 */

import type { PromptEntry } from "@/lib/prompt-text";

/** Keys that are already surfaced elsewhere on the page. */
const HIDDEN = new Set([
  "colors", "palette", "stops", "industry", "mood", "tone", "sections",
  "heroSpec", "motionSpec", "techniqueSpec", "typeSpec", "styleSpec", "typeSpec",
  "voiceSpec", "formatSpec", "styleSpec", "channelRule", "taskSpec", "taskExtra",
  "framework", "method", "loop", "guardrails", "rule", "spec", "goal",
  "displayFont", "bodyFont", "fontNote",
]);

const LABELS: Record<string, string> = {
  product: "Product",
  audience: "Audience",
  cta: "Primary CTA",
  proof: "Proof element",
  hero: "Hero",
  motion: "Motion system",
  radius: "Corner radius",
  density: "Density",
  easing: "Easing",
  grain: "Film grain",
  customCursor: "Custom cursor",
  stickyNav: "Sticky header",
  maxWidth: "Content width",
  scrollSpeed: "Scroll",
  subject: "Subject",
  technique: "Technique",
  particles: "Element budget",
  fpsTarget: "Frame target",
  autoRotate: "Auto-rotation",
  pointerReactive: "Pointer reactive",
  scrollLinked: "Scroll linked",
  bloom: "Bloom pass",
  reducedMotion: "Reduced motion",
  budget: "Payload budget",
  drawCalls: "Draw calls",
  type: "Section type",
  interaction: "Interaction",
  columns: "Columns",
  items: "Items",
  height: "Height",
  borderTop: "Top rule",
  style: "Style",
  medium: "Medium",
  speed: "Speed",
  loop: "Loop",
  vignette: "Vignette",
  mask: "Edge mask",
  cost: "Cost budget",
  angle: "Angle",
  duration: "Cycle",
  interactive: "Driven by",
  blend: "Blend mode",
  grainAmount: "Grain",
  channel: "Channel",
  format: "Format",
  length: "Length",
  voice: "Voice",
  angle2: "Angle",
  constraint: "Constraint",
  offer: "Offer",
  task: "Task",
  language: "Language",
  stack: "Stack",
  mode: "Approach",
  scale: "Scope",
  rigor: "Standard",
  topic: "Subject",
  reader: "Written for",
  stance: "Stance",
  structure: "Opening",
  forbidden: "Banned",
  lighting: "Lighting",
  aspect: "Aspect ratio",
  setting: "Setting",
  detail: "Focus detail",
  negative: "Exclude",
  scenario: "Scenario",
  deliverable: "Deliverable",
  stage: "Stage",
  horizon: "Horizon",
  risk: "Live risk",
  agent: "Agent",
  tools: "Tools",
  trigger: "Trigger",
  failure: "On failure",
  state: "State",
  intent: "Intent",
  pageType: "Page type",
  market: "Market",
  difficulty: "Starting position",
  dataset: "Dataset",
  tool: "Tooling",
  stakes: "Stakes",
  output: "Output",
  cadence: "Cadence",
  level: "Level",
  background: "Background",
  hours: "Hours / week",
};

function formatValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") {
    if (key === "particles") return value.toLocaleString("en-US");
    if (key === "fpsTarget") return `${value} fps`;
    if (key === "drawCalls") return `${value}`;
    if (key === "angle") return `${value}°`;
    if (key === "duration") return `${value}s`;
    if (key === "hours") return `${value}`;
    return String(value);
  }
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  return String(value);
}

export function PromptSpec({ entry }: { entry: PromptEntry }) {
  const rows = Object.entries(entry.params)
    .filter(([key, value]) => !HIDDEN.has(key) && value !== null && value !== undefined && value !== "")
    .slice(0, 16)
    .map(([key, value]) => ({
      key,
      label: LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      value: formatValue(key, value),
    }));

  const sections = Array.isArray(entry.params.sections) ? (entry.params.sections as string[]) : [];

  return (
    <div className="rounded-md border border-hairline-soft bg-surface/60 p-5">
      <h2 className="label-mono mb-4">Spec sheet</h2>

      <dl className="divide-y divide-hairline-soft/70">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5">
            <dt className="font-mono text-[0.625rem] tracking-[0.08em] text-ink-3 uppercase">
              {row.label}
            </dt>
            <dd className="text-[0.8125rem] leading-snug text-ink-2 [overflow-wrap:anywhere]">{row.value}</dd>
          </div>
        ))}
      </dl>

      {sections.length > 0 && (
        <div className="mt-5 border-t border-hairline-soft pt-4">
          <h3 className="label-mono mb-3">Sections in order</h3>
          <ol className="space-y-1.5">
            {sections.map((section, index) => (
              <li key={section} className="flex gap-2.5 text-[0.75rem] leading-snug text-ink-2">
                <span className="font-mono text-[0.625rem] text-ink-3">{String(index + 1).padStart(2, "0")}</span>
                {section}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
