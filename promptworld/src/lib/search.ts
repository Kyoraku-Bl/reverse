/**
 * Client-side search over the compact index.
 *
 * 1,360 entries is small enough to score in the browser on every keystroke, so
 * there is no server round-trip and no index-building dependency. Scoring is
 * deliberately simple and explainable: field-weighted substring and token
 * matches, with a prefix bonus so typing "tem" surfaces Templates first.
 */

import type { PromptSummary, Query } from "./types";

const FIELD_WEIGHTS = {
  title: 12,
  kind: 6,
  category: 5,
  tags: 4,
  mood: 3,
  summary: 2,
} as const;

export interface Scored {
  prompt: PromptSummary;
  score: number;
}

function scoreField(haystack: string, needle: string, weight: number): number {
  if (!haystack || !needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  const exact = h.indexOf(n);
  if (exact === -1) return 0;
  // A match at the start of a field is worth considerably more than one buried
  // in the middle — that is what makes typing feel predictive.
  const positionBonus = exact === 0 ? 1.6 : h.includes(` ${n}`) ? 1.25 : 1;
  return weight * positionBonus;
}

export function scorePrompt(prompt: PromptSummary, text: string): number {
  const query = text.trim();
  if (!query) return 0;

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let total = 0;
  let matchedEveryTerm = true;

  for (const term of terms) {
    let termScore = 0;
    termScore += scoreField(prompt.title, term, FIELD_WEIGHTS.title);
    termScore += scoreField(prompt.kind, term, FIELD_WEIGHTS.kind);
    termScore += scoreField(prompt.category, term, FIELD_WEIGHTS.category);
    termScore += scoreField(prompt.mood, term, FIELD_WEIGHTS.mood);
    termScore += scoreField(prompt.summary, term, FIELD_WEIGHTS.summary);
    for (const tag of prompt.tags) termScore += scoreField(tag, term, FIELD_WEIGHTS.tags);
    if (termScore === 0) matchedEveryTerm = false;
    total += termScore;
  }

  // Require every term to land somewhere, otherwise "dark hero" would return
  // every dark layer even when none of them mention a hero.
  if (!matchedEveryTerm) return 0;

  // Slight popularity tie-break so equally relevant results are stable.
  return total + prompt.copies / 10000;
}

export function applyFilters(prompts: PromptSummary[], query: Query): PromptSummary[] {
  return prompts.filter((p) => {
    if (query.category && p.category !== query.category) return false;
    if (query.group !== "all" && p.group !== query.group) return false;
    if (query.tone && p.tone !== query.tone) return false;
    if (query.mood && p.mood !== query.mood) return false;
    if (query.kind && p.kind !== query.kind) return false;
    return true;
  });
}

export function search(
  prompts: PromptSummary[],
  query: Query,
  favourites: ReadonlySet<string>,
): Scored[] {
  const filtered = applyFilters(
    prompts,
    query.favouritesOnly ? { ...query } : query,
  ).filter((p) => !query.favouritesOnly || favourites.has(p.slug));

  const text = query.text.trim();
  const scored: Scored[] = text
    ? filtered
        .map((prompt) => ({ prompt, score: scorePrompt(prompt, text) }))
        .filter((entry) => entry.score > 0)
    : filtered.map((prompt) => ({ prompt, score: 0 }));

  scored.sort((a, b) => {
    if (text || query.sort === "relevance") {
      if (b.score !== a.score) return b.score - a.score;
    }
    switch (query.sort) {
      case "copies":
        return b.prompt.copies - a.prompt.copies;
      case "recent":
        return a.prompt.updated < b.prompt.updated ? 1 : -1;
      case "title":
        return a.prompt.title.localeCompare(b.prompt.title);
      default:
        return b.prompt.copies - a.prompt.copies;
    }
  });

  return scored;
}

/** Highlight helper: splits a string around the first match of each term. */
export function highlightParts(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [{ text, hit: false }];

  const lower = text.toLowerCase();
  const marks: boolean[] = new Array(text.length).fill(false);
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(term, from);
      if (at === -1) break;
      for (let i = at; i < at + term.length; i += 1) marks[i] = true;
      from = at + term.length;
    }
  }

  const parts: Array<{ text: string; hit: boolean }> = [];
  let buffer = "";
  let current = marks[0] ?? false;
  for (let i = 0; i < text.length; i += 1) {
    if (marks[i] !== current) {
      parts.push({ text: buffer, hit: current });
      buffer = "";
      current = marks[i];
    }
    buffer += text[i];
  }
  if (buffer) parts.push({ text: buffer, hit: current });
  return parts;
}
