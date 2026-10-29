"use client";

/**
 * ⌘K palette: one search across all 1,360 prompts.
 *
 * The compact index is fetched the first time the palette opens and then cached
 * for the session, so nothing is downloaded until someone actually searches.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientIndex, PromptSummary } from "@/lib/types";
import { EMPTY_QUERY, type Query } from "@/lib/types";
import { search } from "@/lib/search";
import { loadIndex, peekIndex } from "@/lib/index-client";
import { useFavouritesContext } from "./FavouritesProvider";
import { CardArt } from "./CardArt";
import { loadPromptText } from "./CopyPromptButton";

const MAX_RESULTS = 24;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  // Seed from the shared cache so a second open renders instantly.
  const [index, setIndex] = useState<ClientIndex | null>(peekIndex());
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { set: favourites, toggle } = useFavouritesContext();

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      void loadIndex().then(setIndex);
    };
    window.addEventListener("promptworld:open-palette", onOpen);
    return () => window.removeEventListener("promptworld:open-palette", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    setText("");
    setActive(0);
    setCopied(null);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const query: Query = useMemo(
    () => ({ ...EMPTY_QUERY, text, sort: "relevance" }),
    [text],
  );

  const results = useMemo<PromptSummary[]>(() => {
    if (!index) return [];
    const scored = search(index.prompts, query, favourites);
    return scored.slice(0, MAX_RESULTS).map((entry) => entry.prompt);
  }, [index, query, favourites]);

  const close = useCallback(() => setOpen(false), []);

  const copyResult = useCallback(
    async (prompt: PromptSummary) => {
      setLoading(true);
      try {
        const body = await loadPromptText(prompt.slug);
        await navigator.clipboard?.writeText(body);
        setCopied(prompt.slug);
        window.setTimeout(() => {
          setCopied(null);
          close();
        }, 900);
      } catch {
        setCopied(null);
      } finally {
        setLoading(false);
      }
    },
    [close],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((n) => Math.min(n + 1, results.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((n) => Math.max(n - 1, 0));
        return;
      }
      if (event.key === "Enter" && results[active]) {
        event.preventDefault();
        if (event.metaKey || event.ctrlKey) {
          void copyResult(results[active]);
        } else {
          close();
          router.push(`/p/${results[active].slug}`);
        }
      }
    },
    [results, active, close, router, copyResult],
  );

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const categories = index?.categories ?? [];
  const labelFor = (id: string) => categories.find((c) => c.id === id)?.label ?? id;

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search the prompt library"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={close}
        className="absolute inset-0 cursor-default bg-black/72 backdrop-blur-sm"
      />

      <div className="rise-in relative w-full max-w-2xl overflow-hidden rounded-lg border border-hairline bg-ground-2 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]">
        <div className="flex items-center gap-3 border-b border-hairline-soft px-4">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#7c7a74" strokeWidth="1.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.75" />
            <path d="m10.6 10.6 3.4 3.4" />
          </svg>
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            type="text"
            placeholder="Search templates, scenes, sections, copy, code…"
            autoComplete="off"
            spellCheck={false}
            className="h-14 flex-1 bg-transparent text-[0.9375rem] text-ink placeholder:text-ink-3 focus:outline-none"
            aria-controls="palette-results"
          />
          <kbd className="rounded-[3px] border border-hairline px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
            esc
          </kbd>
        </div>

        <div ref={listRef} id="palette-results" className="max-h-[52vh] overflow-y-auto overscroll-contain">
          {!index && (
            <p className="px-4 py-10 text-center text-[0.8125rem] text-ink-3">Loading the index…</p>
          )}

          {index && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-[0.875rem] text-ink-2">Nothing matches “{text}”.</p>
              <p className="mt-1.5 text-[0.75rem] text-ink-3">
                Try a mood (luxe, brutalist), a format (carousel, cold email) or a stack (Rust, Next.js).
              </p>
            </div>
          )}

          {index && text.trim() === "" && (
            <div className="px-4 py-6">
              <p className="label-mono mb-3">Jump to a category</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      close();
                      router.push(`/c/${category.id}`);
                    }}
                    className="flex items-center justify-between gap-2 rounded-sm border border-hairline-soft px-2.5 py-2 text-left text-[0.75rem] text-ink-2 transition-colors hover:border-hairline hover:text-ink"
                  >
                    <span className="truncate">{category.label}</span>
                    <span className="font-mono text-[0.625rem] text-ink-3">{category.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.map((prompt, position) => (
            <div
              key={prompt.slug}
              data-index={position}
              className={`group flex items-center gap-3 border-b border-hairline-soft/60 px-3 py-2.5 transition-colors ${
                position === active ? "bg-surface" : "hover:bg-surface/60"
              }`}
              onMouseEnter={() => setActive(position)}
            >
              <CardArt pattern={prompt.pattern} swatch={prompt.swatch} className="size-10 shrink-0 rounded-sm" />

              <button
                type="button"
                onClick={() => {
                  close();
                  router.push(`/p/${prompt.slug}`);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-[0.875rem] text-ink">{prompt.title}</span>
                <span className="block truncate text-[0.6875rem] text-ink-3">
                  {labelFor(prompt.category)} · {prompt.kind}
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggle(prompt.slug)}
                aria-pressed={favourites.has(prompt.slug)}
                aria-label={favourites.has(prompt.slug) ? "Remove from favourites" : "Save to favourites"}
                className="grid size-7 shrink-0 place-items-center rounded-sm text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-accent focus-visible:opacity-100"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill={favourites.has(prompt.slug) ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                >
                  <path d="M8 14s-5.2-3.1-5.2-6.6A2.9 2.9 0 0 1 8 5.3a2.9 2.9 0 0 1 5.2 2.1C13.2 10.9 8 14 8 14Z" />
                </svg>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => void copyResult(prompt)}
                className="shrink-0 rounded-sm border border-hairline px-2 py-1 font-mono text-[0.625rem] tracking-[0.1em] text-ink-3 uppercase transition-colors hover:border-ink-3 hover:text-ink disabled:cursor-wait"
              >
                {copied === prompt.slug ? "copied" : "copy"}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-hairline-soft bg-ground px-4 py-2.5">
          <p className="font-mono text-[0.625rem] text-ink-3">
            ↑↓ navigate · ↵ open · ⌘↵ copy
          </p>
          <p className="font-mono text-[0.625rem] text-ink-3">
            {index ? `${index.total.toLocaleString("en-US")} prompts indexed` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
