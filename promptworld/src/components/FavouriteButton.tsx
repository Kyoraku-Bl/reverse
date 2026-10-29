"use client";

import { useFavouritesContext } from "./FavouritesProvider";

interface FavouriteButtonProps {
  slug: string;
  title: string;
  variant?: "card" | "page";
}

export function FavouriteButton({ slug, title, variant = "card" }: FavouriteButtonProps) {
  const { has, toggle, ready } = useFavouritesContext();
  const saved = ready && has(slug);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(slug);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from favourites` : `Save ${title} to favourites`}
      title={saved ? "Saved" : "Save to favourites"}
      className={
        variant === "page"
          ? `inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[0.8125rem] transition-colors duration-200 ${
              saved
                ? "border-accent/50 bg-accent/10 text-accent-soft"
                : "border-hairline text-ink-2 hover:border-ink-3 hover:text-ink"
            }`
          : `grid size-8 place-items-center rounded-full transition-all duration-200 ${
              saved
                ? "bg-accent/15 text-accent"
                : "bg-black/45 text-ink-3 opacity-0 backdrop-blur-sm group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"
            }`
      }
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden="true"
      >
        <path d="M8 14s-5.2-3.1-5.2-6.6A2.9 2.9 0 0 1 8 5.3a2.9 2.9 0 0 1 5.2 2.1C13.2 10.9 8 14 8 14Z" />
      </svg>
    </button>
  );
}
