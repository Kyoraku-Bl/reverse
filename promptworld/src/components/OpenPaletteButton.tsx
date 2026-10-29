"use client";

/**
 * A button that opens the global ⌘K palette.
 *
 * Lives in its own client component so the pages around it can stay server
 * components — only the click handler needs to reach the browser.
 */

import { useCallback, type ReactNode } from "react";

interface OpenPaletteButtonProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function OpenPaletteButton({ children, className, label }: OpenPaletteButtonProps) {
  const open = useCallback(() => {
    window.dispatchEvent(new CustomEvent("promptworld:open-palette"));
  }, []);

  return (
    <button type="button" onClick={open} className={className} aria-label={label}>
      {children}
    </button>
  );
}
