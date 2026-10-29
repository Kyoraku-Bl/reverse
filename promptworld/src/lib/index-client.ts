/**
 * One cached loader for the compact client index.
 *
 * The command palette and the full-library page both need all 1,360 summaries.
 * Sharing this module means the 84 KB (gzipped) index is fetched once per
 * session instead of being inlined into the library page's HTML, and the
 * browser can cache it as a normal static asset across navigations.
 */

import type { ClientIndex } from "./types";

let cache: ClientIndex | null = null;
let inFlight: Promise<ClientIndex | null> | null = null;

export function loadIndex(): Promise<ClientIndex | null> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = fetch("/data/index.json")
      .then((response) => (response.ok ? (response.json() as Promise<ClientIndex>) : null))
      .then((data) => {
        cache = data;
        return data;
      })
      .catch(() => {
        // Allow a later attempt rather than caching the failure permanently.
        inFlight = null;
        return null;
      });
  }
  return inFlight;
}

export function peekIndex(): ClientIndex | null {
  return cache;
}
