/**
 * Server-side access to the generated dataset.
 *
 * `data/prompts.json` is read once and cached for the lifetime of the process.
 * It is deliberately not in `public/` — the browser gets the compact index at
 * `/data/index.json` and fetches individual prompt text from the API route, so
 * the full parameter set is never bundled into client JavaScript.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PromptEntry } from "./prompt-text";

export interface Category {
  id: string;
  group: "design" | "vault";
  label: string;
  blurb: string;
  order: number;
  count: number;
}

export interface Palette {
  name: string;
  tone: string;
  colors: string[];
}

export interface Dataset {
  version: number;
  generatedAt: string;
  total: number;
  categories: Category[];
  facets: {
    moods: string[];
    tones: string[];
    palettes: Palette[];
  };
  prompts: PromptEntry[];
}

let cache: Dataset | null = null;

export function getDataset(): Dataset {
  if (cache) return cache;
  const file = join(process.cwd(), "data", "prompts.json");
  cache = JSON.parse(readFileSync(file, "utf8")) as Dataset;
  return cache;
}

export function getCategories(): Category[] {
  return getDataset().categories;
}

export function getCategory(id: string): Category | undefined {
  return getDataset().categories.find((c) => c.id === id);
}

export function getPrompt(slug: string): PromptEntry | undefined {
  return getDataset().prompts.find((p) => p.slug === slug);
}

export function getPromptsByCategory(categoryId: string): PromptEntry[] {
  return getDataset().prompts.filter((p) => p.category === categoryId);
}

export function getSlugs(): string[] {
  return getDataset().prompts.map((p) => p.slug);
}

/** The cards shown on the home page for one category, most-copied first. */
export function getTopPrompts(categoryId: string, limit = 10): PromptEntry[] {
  return getPromptsByCategory(categoryId)
    .slice()
    .sort((a, b) => b.copies - a.copies)
    .slice(0, limit);
}

export function getFeatured(limit = 12): PromptEntry[] {
  return getDataset()
    .prompts.filter((p) => p.featured)
    .sort((a, b) => b.copies - a.copies)
    .slice(0, limit);
}

export function getRecent(limit = 8): PromptEntry[] {
  return getDataset()
    .prompts.slice()
    .sort((a, b) => (a.updated < b.updated ? 1 : -1))
    .slice(0, limit);
}

/** Distinct `kind` values inside a category, for the sub-filter chips. */
export function getKinds(categoryId: string): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of getPromptsByCategory(categoryId)) {
    counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function getMoods(categoryId?: string): Array<{ value: string; count: number }> {
  const source = categoryId ? getPromptsByCategory(categoryId) : getDataset().prompts;
  const counts = new Map<string, number>();
  for (const p of source) counts.set(p.mood, (counts.get(p.mood) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function totalCopies(): number {
  return getDataset().prompts.reduce((sum, p) => sum + p.copies, 0);
}
