"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useFavouritesContext } from "./FavouritesProvider";

const NAV = [
  { href: "/library", label: "Library" },
  { href: "/c/templates", label: "Templates" },
  { href: "/c/scenes", label: "3D Scenes" },
  { href: "/c/sections", label: "Sections" },
  { href: "/c/backgrounds", label: "Backgrounds" },
  { href: "/c/gradients", label: "Gradients" },
  { href: "/vault", label: "Prompt Vault" },
];

export function SiteHeader({ total }: { total: number }) {
  const pathname = usePathname();
  const [condensed, setCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { slugs } = useFavouritesContext();

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Global ⌘K / "/" opens the palette; the header button is only a hint.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("promptworld:open-palette"));
      } else if (event.key === "/" && !isTyping(event.target)) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("promptworld:open-palette"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[100] transition-all duration-300 ${
        condensed
          ? "border-b border-hairline-soft bg-ground/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-[1440px] items-center gap-6 px-5 transition-all duration-300 md:px-8 ${
          condensed ? "h-[60px]" : "h-[84px]"
        }`}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="PromptWorld home">
          <Wordmark />
          <span className="font-display text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink">
            prompt<span className="text-accent">world</span>
          </span>
        </Link>

        <nav aria-label="Library" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-sm px-2.5 py-1.5 text-[0.8125rem] transition-colors duration-200 ${
                  active ? "text-ink" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("promptworld:open-palette"))}
            className="hidden items-center gap-3 rounded-sm border border-hairline bg-surface/60 px-3 py-1.5 text-[0.8125rem] text-ink-3 transition-colors duration-200 hover:border-ink-3 hover:text-ink-2 sm:flex"
            aria-label="Search the library"
          >
            <SearchIcon />
            <span className="pr-6">Search {total.toLocaleString("en-US")} prompts</span>
            <kbd className="rounded-[3px] border border-hairline bg-ground px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
              ⌘K
            </kbd>
          </button>

          <Link
            href="/favourites"
            className="relative grid size-9 place-items-center rounded-sm border border-hairline text-ink-3 transition-colors duration-200 hover:border-ink-3 hover:text-ink"
            aria-label={`Favourites${slugs.length > 0 ? `, ${slugs.length} saved` : ""}`}
          >
            <HeartIcon filled={slugs.length > 0} />
            {slugs.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid min-w-[17px] place-items-center rounded-full bg-accent px-1 font-mono text-[0.5625rem] text-black">
                {slugs.length}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-9 place-items-center rounded-sm border border-hairline text-ink-2 lg:hidden"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-hairline-soft bg-ground/97 backdrop-blur-xl lg:hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-[1440px] px-5 py-3 md:px-8">
            {NAV.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ animationDelay: `${index * 34}ms` }}
                className="rise-in block border-b border-hairline-soft py-3 text-[0.9375rem] text-ink-2 last:border-0"
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                window.dispatchEvent(new CustomEvent("promptworld:open-palette"));
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-sm border border-hairline py-3 text-[0.875rem] text-ink"
            >
              <SearchIcon /> Search the library
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function Wordmark({ className = "size-7" }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" className="size-full">
        <rect width="32" height="32" rx="8" fill="#101013" />
        <circle cx="16" cy="16" r="9.5" stroke="#ff6a2b" strokeWidth="1.6" />
        <circle cx="16" cy="16" r="3.4" fill="#ff6a2b" />
        <path d="M16 1.5v5M16 25.5v5M1.5 16h5M25.5 16h5" stroke="#ff6a2b" strokeWidth="1.2" opacity="0.5" />
      </svg>
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="7" cy="7" r="4.75" />
      <path d="m10.6 10.6 3.4 3.4" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
      className={filled ? "text-accent" : ""}
    >
      <path d="M8 14s-5.2-3.1-5.2-6.6A2.9 2.9 0 0 1 8 5.3a2.9 2.9 0 0 1 5.2 2.1C13.2 10.9 8 14 8 14Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2.5 5h11M2.5 11h11" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  );
}
