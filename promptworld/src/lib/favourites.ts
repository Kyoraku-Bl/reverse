"use client";

/**
 * Favourites live in localStorage. There is no account system, so the store is
 * intentionally defensive: a corrupted or unavailable store must never break
 * the page, and reads are skipped during SSR.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "promptworld:favourites:v1";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function write(slugs: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(slugs.slice(0, 2000)));
    window.dispatchEvent(new CustomEvent<string[]>("promptworld:favourites", { detail: slugs }));
  } catch {
    // Private browsing or a full quota: keep the in-memory state, drop the write.
  }
}

export interface Favourites {
  slugs: string[];
  set: ReadonlySet<string>;
  has: (slug: string) => boolean;
  toggle: (slug: string) => void;
  clear: () => void;
  ready: boolean;
}

export function useFavourites(): Favourites {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSlugs(read());
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) setSlugs(read());
    };
    const onLocal = () => setSlugs(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("promptworld:favourites", onLocal as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("promptworld:favourites", onLocal as EventListener);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    setSlugs((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSlugs([]);
    write([]);
  }, []);

  return {
    slugs,
    set: new Set(slugs),
    has: (slug) => slugs.includes(slug),
    toggle,
    clear,
    ready,
  };
}
