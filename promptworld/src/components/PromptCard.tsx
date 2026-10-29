"use client";

/**
 * A library card: CSS-drawn artwork, the layer name, its kind, and the two
 * actions that matter (save, copy). The whole card is a link to the prompt's
 * own page; the buttons stop propagation so they never navigate.
 */

import Link from "next/link";
import type { PromptSummary } from "@/lib/types";
import { CardArt } from "./CardArt";
import { CopyPromptButton } from "./CopyPromptButton";
import { FavouriteButton } from "./FavouriteButton";

interface PromptCardProps {
  prompt: PromptSummary;
  /** Highlight these terms inside the title and summary (search results). */
  query?: string;
  size?: "default" | "wide";
}

export function PromptCard({ prompt, query = "", size = "default" }: PromptCardProps) {
  const href = `/p/${prompt.slug}`;

  return (
    <article className="group relative">
      <Link
        href={href}
        className="block overflow-hidden rounded-md border border-hairline-soft bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-hairline hover:shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]"
      >
        <div className="relative">
          <CardArt
            pattern={prompt.pattern}
            swatch={prompt.swatch}
            className={size === "wide" ? "aspect-[21/9] w-full" : "aspect-[4/3] w-full"}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            {prompt.featured && (
              <span className="rounded-sm bg-accent px-1.5 py-1 font-mono text-[0.5625rem] tracking-[0.14em] text-black uppercase">
                New
              </span>
            )}
            <span className="rounded-sm bg-black/55 px-1.5 py-1 font-mono text-[0.5625rem] tracking-[0.14em] text-ink-2 uppercase backdrop-blur-sm">
              {prompt.tone === "image" ? "image" : prompt.tone}
            </span>
          </div>

          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <span className="rounded-sm bg-black/55 px-1.5 py-1 font-mono text-[0.5625rem] tracking-[0.1em] text-ink-3 backdrop-blur-sm">
              {prompt.copies}
            </span>
            <FavouriteButton slug={prompt.slug} title={prompt.title} />
          </div>
        </div>

        <div className="space-y-1.5 p-3.5">
          <h3 className="truncate text-[0.9375rem] font-medium text-ink">
            <Highlighted text={prompt.title} query={query} />
          </h3>
          <p className="label-mono truncate">{prompt.kind}</p>
          {size === "wide" && (
            <p className="line-clamp-2 pt-1 text-[0.8125rem] leading-relaxed text-ink-3">
              <Highlighted text={prompt.summary} query={query} />
            </p>
          )}
        </div>
      </Link>

      <div
        className="absolute right-3 bottom-3 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100"
        onClick={(event) => event.preventDefault()}
      >
        <CopyPromptButton slug={prompt.slug} variant="icon" label={prompt.title} />
      </div>
    </article>
  );
}

/** Marks each search term in a string without dangerouslySetInnerHTML. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        pattern.test(part) && index % 2 === 1 ? (
          <mark key={`${part}-${index}`} className="bg-accent/25 text-accent-soft">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
