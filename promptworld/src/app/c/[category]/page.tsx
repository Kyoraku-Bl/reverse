import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getCategory, getPromptsByCategory } from "@/lib/data";
import { toSummaryList } from "@/lib/summary";
import { LibraryBrowser } from "@/components/LibraryBrowser";

interface PageProps {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return getCategories().map((category) => ({ category: category.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const meta = getCategory(category);
  if (!meta) return { title: "Category not found" };

  return {
    title: `${meta.label} prompts`,
    description: `${meta.blurb} ${meta.count} ${meta.label.toLowerCase()} prompts, each copyable as one complete brief for your AI.`,
    alternates: { canonical: `/c/${meta.id}` },
  };
}

const GROUP_COPY: Record<string, string> = {
  design:
    "Each layer ships as a complete build spec: design tokens with real hex values, a motion system with named easings, three genuine responsive layouts, a performance budget, an accessibility checklist and an explicit do-not list.",
  vault:
    "Each prompt fixes a role, a deliverable, the constraints that make the output good, and the format of the answer — so you get work you can use rather than a plausible-sounding draft.",
};

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  const meta = getCategory(category);
  if (!meta) notFound();

  const prompts = getPromptsByCategory(meta.id);
  const categories = getCategories();
  const siblings = categories.filter((c) => c.id !== meta.id);

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-32 pb-24 md:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-3 uppercase">
        <Link href="/library" className="transition-colors hover:text-ink-2">Library</Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink-2">{meta.label}</span>
      </nav>

      <header className="mb-10 border-b border-hairline-soft pb-8">
        <p className="label-mono mb-4">
          {meta.count} prompts · {meta.group === "design" ? "design layer" : "prompt vault"}
        </p>
        <h1 className="max-w-[22ch] font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
          {meta.label} prompts
        </h1>
        <p className="mt-5 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-2">{meta.blurb}</p>
        <p className="mt-3 max-w-2xl text-[0.875rem] leading-relaxed text-ink-3">{GROUP_COPY[meta.group]}</p>
      </header>

      <LibraryBrowser
        prompts={toSummaryList(prompts)}
        categories={categories}
        initialCategory={meta.id}
        lockCategory
        emptyHref="/library"
        emptyLabel="Browse the full library"
      />

      <section className="mt-24 border-t border-hairline-soft pt-10">
        <h2 className="label-mono mb-5">The rest of the library</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {siblings.map((sibling) => (
            <Link
              key={sibling.id}
              href={`/c/${sibling.id}`}
              className="group flex items-center justify-between gap-3 rounded-sm border border-hairline-soft bg-surface px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-hairline"
            >
              <span className="truncate text-[0.8125rem] text-ink-2 transition-colors group-hover:text-ink">
                {sibling.label}
              </span>
              <span className="shrink-0 font-mono text-[0.625rem] text-ink-3">{sibling.count}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
