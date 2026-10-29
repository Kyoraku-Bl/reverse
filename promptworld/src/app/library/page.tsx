import type { Metadata } from "next";
import { getCategories, getDataset } from "@/lib/data";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const metadata: Metadata = {
  title: "Library",
  description:
    "Search and filter all 1,360 PromptWorld prompts: web templates, 3D scenes, sections, backgrounds, gradients, marketing, code, writing, image, business, agents, SEO, data and learning.",
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function LibraryPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const dataset = getDataset();
  const categories = getCategories();
  const initialText = typeof q === "string" ? q.slice(0, 120) : "";

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-32 pb-24 md:px-8">
      <header className="mb-10 border-b border-hairline-soft pb-8">
        <p className="label-mono mb-4">The whole library</p>
        <h1 className="max-w-[20ch] font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
          {dataset.total.toLocaleString("en-US")} prompts, one search
        </h1>
        <p className="mt-5 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-3">
          Design layers on one side — templates, 3D scenes, sections, backgrounds and
          gradients. Nine working categories on the other. Filter by type, tone or mood, or
          just type what you are trying to make.
        </p>
      </header>

      {/* The full index is fetched in the browser and cached across the session
          (shared with the ⌘K palette) rather than serialised into this page's
          HTML, which would make it an uncacheable ~101 KB gzipped document. */}
      <LibraryBrowser categories={categories} loadAll initialText={initialText} />
    </div>
  );
}
