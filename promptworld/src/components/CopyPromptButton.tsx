"use client";

/**
 * Copy-to-clipboard for a prompt.
 *
 * On a prompt's own page the rendered text is passed in directly. On cards and
 * in the palette the text is fetched from /api/prompt/[slug] on first click and
 * cached in memory, so the 1,360 prompt bodies never ship in the page payload.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const cache = new Map<string, string>();

async function loadPromptText(slug: string): Promise<string> {
  const hit = cache.get(slug);
  if (hit) return hit;
  const response = await fetch(`/api/prompt/${encodeURIComponent(slug)}`);
  if (!response.ok) throw new Error(`Could not load prompt (${response.status})`);
  const data = (await response.json()) as { text?: string };
  if (typeof data.text !== "string" || data.text.length === 0) {
    throw new Error("Prompt came back empty");
  }
  cache.set(slug, data.text);
  return data.text;
}

/** clipboard-write needs a secure context; fall back to a hidden textarea. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

type State = "idle" | "loading" | "copied" | "error";

interface CopyPromptButtonProps {
  slug: string;
  /** Already-rendered text; omit to fetch on demand. */
  text?: string;
  variant?: "primary" | "ghost" | "icon";
  label?: string;
  className?: string;
  onCopied?: (slug: string) => void;
}

export function CopyPromptButton({
  slug,
  text,
  variant = "primary",
  label = "Copy prompt",
  className = "",
  onCopied,
}: CopyPromptButtonProps) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback(async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      const body = text ?? (await loadPromptText(slug));
      const ok = await writeClipboard(body);
      setState(ok ? "copied" : "error");
      if (ok) onCopied?.(slug);
    } catch {
      setState("error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  }, [slug, text, state, onCopied]);

  const base =
    "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-all duration-200 disabled:cursor-wait";
  const styles = {
    primary:
      "bg-accent px-4 py-2.5 text-[0.8125rem] text-black hover:bg-accent-soft active:scale-[0.98]",
    ghost:
      "border border-hairline px-3 py-2 text-[0.8125rem] text-ink-2 hover:border-ink-3 hover:text-ink active:scale-[0.98]",
    icon: "p-2 text-ink-3 hover:bg-surface-2 hover:text-ink",
  }[variant];

  const message =
    state === "copied" ? "Copied" : state === "error" ? "Press ⌘C" : state === "loading" ? "Loading" : label;

  return (
    <button
      type="button"
      onClick={copy}
      disabled={state === "loading"}
      aria-label={variant === "icon" ? `Copy the ${label} prompt` : undefined}
      className={`${base} ${styles} ${className}`}
    >
      {variant !== "icon" && (
        <span aria-hidden="true" className="grid size-4 place-items-center">
          {state === "copied" ? <CheckIcon /> : state === "error" ? <AlertIcon /> : <CopyIcon />}
        </span>
      )}
      {variant === "icon" ? (state === "copied" ? <CheckIcon /> : <CopyIcon />) : <span>{message}</span>}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 3v6M8 12h.01" />
      <circle cx="8" cy="8" r="6.25" />
    </svg>
  );
}

export { loadPromptText };
