/**
 * Types shared by the server dataset and the compact client index.
 *
 * The client index (`public/data/index.json`) carries everything needed to
 * search, filter and draw a card, but omits `params` — the parameters that
 * render into the full prompt text stay server-side.
 */

export type Group = "design" | "vault";

export interface CategoryMeta {
  id: string;
  group: Group;
  label: string;
  blurb: string;
  order: number;
  count: number;
}

export interface PromptSummary {
  id: string;
  slug: string;
  title: string;
  category: string;
  group: Group;
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
}

export interface ClientIndex {
  version: number;
  generatedAt: string;
  total: number;
  categories: CategoryMeta[];
  facets: {
    moods: string[];
    tones: string[];
    palettes: Array<{ name: string; tone: string; colors: string[] }>;
  };
  prompts: PromptSummary[];
}

/** Search/filter state shared by the library page and the command palette. */
export interface Query {
  text: string;
  category: string | null;
  group: Group | "all";
  tone: string | null;
  mood: string | null;
  kind: string | null;
  favouritesOnly: boolean;
  sort: "relevance" | "copies" | "recent" | "title";
}

export const EMPTY_QUERY: Query = {
  text: "",
  category: null,
  group: "all",
  tone: null,
  mood: null,
  kind: null,
  favouritesOnly: false,
  sort: "relevance",
};
