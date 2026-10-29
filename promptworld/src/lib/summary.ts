/**
 * Strips the `params` payload from full prompt entries.
 *
 * Server components read the complete dataset, but only the compact shape needs
 * to reach the browser. This is the single place that decides what crosses that
 * boundary, so a future field cannot leak into a client payload by accident.
 */

import type { PromptEntry } from "./prompt-text";
import type { PromptSummary } from "./types";

export function toSummary(entry: PromptEntry): PromptSummary {
  const { params: _params, ...rest } = entry;
  return rest;
}

export function toSummaryList(entries: PromptEntry[]): PromptSummary[] {
  return entries.map(toSummary);
}
