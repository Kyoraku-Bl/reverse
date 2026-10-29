import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CommandPalette } from "@/components/CommandPalette";
import { FavouritesProvider } from "@/components/FavouritesProvider";
import { getDataset } from "@/lib/data";

const dataset = getDataset();

export const metadata: Metadata = {
  metadataBase: new URL("https://promptworld.dev"),
  title: {
    default: `PromptWorld — ${dataset.total.toLocaleString("en-US")} cinematic AI prompts`,
    template: "%s — PromptWorld",
  },
  description:
    "A library of 1,360 copy-paste AI prompts: cinematic web templates, 3D scenes, sections, backgrounds and gradients, plus marketing, code, writing, image, business and agent prompts. Copy one, paste it into your AI, ship it.",
  keywords: [
    "AI prompts",
    "prompt library",
    "web design prompts",
    "3D scene prompts",
    "WebGL prompts",
    "landing page prompt",
    "Claude Code",
    "Cursor prompts",
    "marketing prompts",
  ],
  openGraph: {
    type: "website",
    siteName: "PromptWorld",
    title: "PromptWorld — 1,360 cinematic AI prompts",
    description:
      "Copy a prompt, paste it into your AI, and ship something that does not look AI-made.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PromptWorld — 1,360 cinematic AI prompts",
    description:
      "Templates, 3D scenes, sections, backgrounds, gradients — plus a vault of marketing, code and agent prompts.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#060607",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Loaded at runtime rather than through next/font so the build never
            needs network access; the stacks fall back cleanly if it fails. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23060607'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23ff6a2b' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='3' fill='%23ff6a2b'/%3E%3C/svg%3E"
        />
      </head>
      <body>
        <FavouritesProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[10000] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
          >
            Skip to content
          </a>
          <SiteHeader total={dataset.total} />
          <main id="main">{children}</main>
          <SiteFooter categories={dataset.categories} total={dataset.total} />
          <CommandPalette />
        </FavouritesProvider>
      </body>
    </html>
  );
}
