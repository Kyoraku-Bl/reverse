"use client";

/**
 * Favourites live only in localStorage, so this page has to be resolved in the
 * browser. It fetches the compact index once, intersects it with the saved
 * slugs, and then hands the result to the same browser used everywhere else.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CategoryMeta, ClientIndex, PromptSummary } from "@/lib/types";
import { LibraryBrowser } from "./LibraryBrowser";
import { useFavouritesContext } from "./FavouritesProvider";

export function FavouritesBrowser({ categories }: { categories: CategoryMeta[] }) {
  const { slugs, ready, clear } = useFavouritesContext();
  const [index, setIndex] = useState<ClientIndex | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/data/index.json")
      .then((response) => (response.ok ? (response.json() as Promise<ClientIndex>) : Promise.reject()))
      .then((data) => {
        if (!cancelled) setIndex(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const saved: PromptSummary[] =
    index?.prompts.filter((prompt) => slugs.includes(prompt.slug)) ?? [];

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-32 pb-24 md:px-8">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-hairline-soft pb-8">
        <div>
          <p className="label-mono mb-4">Saved in this browser</p>
          <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
            Your favourites
          </h1>
          <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-3">
            Nothing is uploaded and there is no account. Clearing your browser data clears
            this list, so copy out anything you want to keep.
          </p>
        </div>

        {saved.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="rounded-sm border border-hairline px-4 py-2.5 text-[0.8125rem] text-ink-3 transition-colors duration-200 hover:border-accent/50 hover:text-accent-soft"
          >
            Clear all {saved.length}
          </button>
        )}
      </header>

      {!ready || (!index && !failed) ? (
        <p className="py-24 text-center text-[0.875rem] text-ink-3">Loading your saved prompts…</p>
      ) : failed ? (
        <p className="py-24 text-center text-[0.875rem] text-ink-3">
          Could not load the index.{" "}
          <Link href="/library" className="text-accent underline underline-offset-4">
            Browse the library instead
          </Link>
          .
        </p>
      ) : saved.length === 0 ? (
        <div className="rounded-md border border-hairline-soft bg-surface/40 px-6 py-24 text-center">
          <p className="text-[0.9375rem] text-ink-2">Nothing saved yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-[0.8125rem] leading-relaxed text-ink-3">
            Tap the heart on any card and it lands here. Or press ⌘K to search all{" "}
            {index?.total.toLocaleString("en-US")} prompts without leaving the page you are on.
          </p>
          <Link
            href="/library"
            className="mt-7 inline-block rounded-sm bg-accent px-5 py-3 text-[0.8125rem] font-medium text-black transition-colors hover:bg-accent-soft"
          >
            Browse the library
          </Link>
        </div>
      ) : (
        <LibraryBrowser prompts={saved} categories={categories} lockCategory />
      )}
    </div>
  );
}
