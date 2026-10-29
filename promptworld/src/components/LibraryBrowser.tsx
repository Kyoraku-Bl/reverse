"use client";

/**
 * The browse experience: search, facet filters, sort and a paginated grid.
 *
 * The page's server component hands this a pre-filtered slice of the index, so
 * a category page only ships its own 170 entries rather than all 1,360.
 */

import { useEffect, useMemo, useState } from "react";
import type { CategoryMeta, PromptSummary } from "@/lib/types";
import { EMPTY_QUERY, type Query } from "@/lib/types";
import { search } from "@/lib/search";
import { loadIndex, peekIndex } from "@/lib/index-client";
import { useFavouritesContext } from "./FavouritesProvider";
import { PromptCard } from "./PromptCard";

const PAGE_SIZE = 48;

interface LibraryBrowserProps {
  /** Server-provided slice of the index (used by category pages). */
  prompts?: PromptSummary[];
  categories: CategoryMeta[];
  /**
   * Fetch the whole index in the browser instead of inlining it. Used by
   * /library, where 1,360 summaries would otherwise be serialised into the
   * page's HTML as an uncacheable 101 KB payload.
   */
  loadAll?: boolean;
  initialCategory?: string | null;
  /** Pre-fill the search box, e.g. from `/library?q=<tag>`. */
  initialText?: string;
  /** Hide the category rail — used on single-category pages. */
  lockCategory?: boolean;
  emptyHref?: string;
  emptyLabel?: string;
}

export function LibraryBrowser({
  prompts: promptsProp,
  categories,
  loadAll = false,
  initialCategory = null,
  initialText = "",
  lockCategory = false,
  emptyHref = "/library",
  emptyLabel = "Browse the full library",
}: LibraryBrowserProps) {
  const [query, setQuery] = useState<Query>({
    ...EMPTY_QUERY,
    category: initialCategory,
    text: initialText,
    sort: initialText ? "relevance" : EMPTY_QUERY.sort,
  });
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [fetched, setFetched] = useState<PromptSummary[] | null>(peekIndex()?.prompts ?? null);
  const { set: favourites, ready } = useFavouritesContext();

  useEffect(() => {
    if (!loadAll || fetched) return;
    let cancelled = false;
    void loadIndex().then((index) => {
      if (!cancelled && index) setFetched(index.prompts);
    });
    return () => {
      cancelled = true;
    };
  }, [loadAll, fetched]);

  const prompts = loadAll ? (fetched ?? []) : (promptsProp ?? []);

  const patch = (next: Partial<Query>) => {
    setQuery((prev) => ({ ...prev, ...next }));
    setVisible(PAGE_SIZE);
  };

  const results = useMemo(() => search(prompts, query, favourites), [prompts, query, favourites]);
  const shown = results.slice(0, visible);

  // Facets are computed from the *unfiltered-by-that-facet* set so a chip never
  // disappears once you click it.
  const tones = useMemo(() => facetsOf(prompts, (p) => p.tone), [prompts]);
  const moods = useMemo(() => facetsOf(prompts, (p) => p.mood), [prompts]);
  const kinds = useMemo(
    () =>
      facetsOf(
        query.category ? prompts.filter((p) => p.category === query.category) : prompts,
        (p) => p.kind,
      ),
    [prompts, query.category],
  );

  useEffect(() => {
    // A filter combination can legitimately return nothing; reset the page
    // window so a later widening does not start mid-list.
    if (visible > results.length) setVisible(PAGE_SIZE);
  }, [results.length, visible]);

  const activeFilters = [
    query.group !== "all" ? { key: "group", label: query.group === "design" ? "Design" : "Vault" } : null,
    query.category ? { key: "category", label: categories.find((c) => c.id === query.category)?.label ?? query.category } : null,
    query.tone ? { key: "tone", label: query.tone } : null,
    query.mood ? { key: "mood", label: query.mood } : null,
    query.kind ? { key: "kind", label: query.kind } : null,
    query.favouritesOnly ? { key: "favouritesOnly", label: "Favourites" } : null,
  ].filter((x): x is { key: string; label: string } => x !== null);

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search prompts</span>
            <svg
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3"
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.75" />
              <path d="m10.6 10.6 3.4 3.4" />
            </svg>
            <input
              type="search"
              value={query.text}
              onChange={(event) => patch({ text: event.target.value, sort: "relevance" })}
              placeholder="Search by name, mood, technique, tag…"
              className="h-11 w-full rounded-sm border border-hairline bg-surface pl-10 text-[0.875rem] text-ink placeholder:text-ink-3 focus:border-ink-3 focus:outline-none"
            />
          </label>

          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="sort">Sort results</label>
            <select
              id="sort"
              value={query.sort}
              onChange={(event) => patch({ sort: event.target.value as Query["sort"] })}
              className="h-11 rounded-sm border border-hairline bg-surface px-3 text-[0.8125rem] text-ink-2 focus:border-ink-3 focus:outline-none"
            >
              <option value="relevance">Most relevant</option>
              <option value="copies">Most copied</option>
              <option value="recent">Recently updated</option>
              <option value="title">A–Z</option>
            </select>

            <button
              type="button"
              onClick={() => patch({ favouritesOnly: !query.favouritesOnly })}
              aria-pressed={query.favouritesOnly}
              className={`h-11 shrink-0 rounded-sm border px-3 text-[0.8125rem] transition-colors duration-200 ${
                query.favouritesOnly
                  ? "border-accent/50 bg-accent/10 text-accent-soft"
                  : "border-hairline bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
              }`}
            >
              Saved{ready && favourites.size > 0 ? ` (${favourites.size})` : ""}
            </button>
          </div>
        </div>

        {!lockCategory && (
          <ChipRow
            label="Category"
            options={categories.map((c) => ({ value: c.id, label: c.label, count: c.count }))}
            active={query.category}
            onSelect={(value) => patch({ category: value, kind: null })}
          />
        )}

        {kinds.length > 1 && (
          <ChipRow
            label="Type"
            options={kinds}
            active={query.kind}
            onSelect={(value) => patch({ kind: value })}
          />
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {tones.length > 1 && (
            <ChipRow
              label="Tone"
              options={tones}
              active={query.tone}
              onSelect={(value) => patch({ tone: value })}
              inline
            />
          )}
          {moods.length > 1 && (
            <ChipRow
              label="Mood"
              options={moods.slice(0, 12)}
              active={query.mood}
              onSelect={(value) => patch({ mood: value })}
              inline
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline-soft pt-4">
          <p className="font-mono text-[0.6875rem] tracking-[0.08em] text-ink-3 uppercase">
            {results.length.toLocaleString("en-US")} {results.length === 1 ? "prompt" : "prompts"}
            {query.text.trim() && ` for “${query.text.trim()}”`}
          </p>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => patch(clearFilter(filter.key))}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-surface px-2 py-1 text-[0.6875rem] text-ink-2 transition-colors hover:border-accent/50 hover:text-accent-soft"
                >
                  {filter.label}
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">Remove filter</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setQuery({ ...EMPTY_QUERY, category: lockCategory ? initialCategory : null });
                  setVisible(PAGE_SIZE);
                }}
                className="px-2 py-1 text-[0.6875rem] text-ink-3 underline decoration-hairline underline-offset-4 transition-colors hover:text-ink"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {loadAll && !fetched ? (
        <LoadingGrid />
      ) : results.length === 0 ? (
        <EmptyState query={query} emptyHref={emptyHref} emptyLabel={emptyLabel} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map(({ prompt }) => (
              <PromptCard key={prompt.slug} prompt={prompt} query={query.text} />
            ))}
          </div>

          {visible < results.length && (
            <div className="flex flex-col items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => setVisible((n) => n + PAGE_SIZE)}
                className="rounded-sm border border-hairline bg-surface px-6 py-3 text-[0.8125rem] text-ink transition-colors duration-200 hover:border-ink-3"
              >
                Load {Math.min(PAGE_SIZE, results.length - visible)} more
              </button>
              <p className="font-mono text-[0.6875rem] text-ink-3">
                showing {shown.length.toLocaleString("en-US")} of {results.length.toLocaleString("en-US")}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function clearFilter(key: string): Partial<Query> {
  switch (key) {
    case "group":
      return { group: "all" };
    case "category":
      return { category: null, kind: null };
    case "tone":
      return { tone: null };
    case "mood":
      return { mood: null };
    case "kind":
      return { kind: null };
    case "favouritesOnly":
      return { favouritesOnly: false };
    default:
      return {};
  }
}

function facetsOf(
  prompts: PromptSummary[],
  pick: (prompt: PromptSummary) => string,
): Array<{ value: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const prompt of prompts) {
    const value = pick(prompt);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function ChipRow({
  label,
  options,
  active,
  onSelect,
  inline = false,
}: {
  label: string;
  options: Array<{ value: string; label: string; count: number }>;
  active: string | null;
  onSelect: (value: string | null) => void;
  inline?: boolean;
}) {
  if (options.length === 0) return null;

  return (
    <div className={inline ? "flex items-start gap-3" : "flex flex-wrap items-center gap-1.5"}>
      <span className="label-mono shrink-0 pt-1.5">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={active === null} onClick={() => onSelect(null)}>
          All
        </Chip>
        {options.map((option) => (
          <Chip
            key={option.value}
            active={active === option.value}
            onClick={() => onSelect(active === option.value ? null : option.value)}
          >
            {option.label}
            <span className="ml-1.5 font-mono text-[0.5625rem] text-ink-3">{option.count}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-sm border px-2.5 py-1.5 text-[0.75rem] transition-colors duration-200 ${
        active
          ? "border-accent/50 bg-accent/10 text-accent-soft"
          : "border-hairline-soft bg-surface/60 text-ink-3 hover:border-hairline hover:text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

/** Skeleton grid shown while the full index is being fetched. */
function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-md border border-hairline-soft bg-surface">
          <div className="aspect-[4/3] w-full animate-pulse bg-surface-2" />
          <div className="space-y-2 p-3.5">
            <div className="h-3.5 w-2/3 animate-pulse rounded-sm bg-surface-2" />
            <div className="h-2.5 w-1/3 animate-pulse rounded-sm bg-surface-2" />
          </div>
        </div>
      ))}
      <p className="sr-only" role="status">
        Loading the prompt library
      </p>
    </div>
  );
}

function EmptyState({
  query,
  emptyHref,
  emptyLabel,
}: {
  query: Query;
  emptyHref: string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-md border border-hairline-soft bg-surface/40 px-6 py-20 text-center">
      <p className="text-[0.9375rem] text-ink-2">
        {query.favouritesOnly && query.text.trim() === ""
          ? "Nothing saved yet."
          : "No prompts match those filters."}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-[0.8125rem] leading-relaxed text-ink-3">
        {query.favouritesOnly
          ? "Tap the heart on any card and it lands here, stored in your browser only."
          : "Try removing a filter, or search by mood (luxe, brutalist), technique (shader, carousel) or subject."}
      </p>
      <a
        href={emptyHref}
        className="mt-6 inline-block rounded-sm border border-hairline px-4 py-2.5 text-[0.8125rem] text-ink transition-colors hover:border-ink-3"
      >
        {emptyLabel}
      </a>
    </div>
  );
}
