import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, getDataset, getPrompt, getPromptsByCategory } from "@/lib/data";
import { renderPromptText, wordCount } from "@/lib/prompt-text";
import { toSummaryList } from "@/lib/summary";
import { CardArt } from "@/components/CardArt";
import { CopyPromptButton } from "@/components/CopyPromptButton";
import { FavouriteButton } from "@/components/FavouriteButton";
import { PromptCard } from "@/components/PromptCard";
import { PromptSpec } from "@/components/PromptSpec";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getDataset().prompts.map((prompt) => ({ slug: prompt.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getPrompt(slug);
  if (!entry) return { title: "Prompt not found", robots: { index: false } };

  const category = getCategory(entry.category);

  return {
    title: `${entry.title} — ${category?.label ?? "Prompt"} prompt`,
    description: entry.summary,
    alternates: { canonical: `/p/${entry.slug}` },
    openGraph: {
      type: "article",
      title: `${entry.title} — PromptWorld`,
      description: entry.summary,
    },
  };
}

export default async function PromptPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getPrompt(slug);
  if (!entry) notFound();

  const category = getCategory(entry.category);
  const text = renderPromptText(entry);
  const words = wordCount(text);

  // Related: same category first, then same kind, most-copied first.
  const related = getPromptsByCategory(entry.category)
    .filter((candidate) => candidate.slug !== entry.slug)
    .sort((a, b) => {
      const kindBonus = (x: typeof a) => (x.kind === entry.kind ? 1 : 0);
      return kindBonus(b) - kindBonus(a) || b.copies - a.copies;
    })
    .slice(0, 8);

  return (
    <article className="pt-28 pb-24">
      {/* ------------------------------- hero strip ------------------------------- */}
      <header className="relative overflow-hidden border-b border-hairline-soft">
        <CardArt
          pattern={entry.pattern}
          swatch={entry.swatch}
          className="absolute inset-0 size-full opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ground/72 via-ground/88 to-ground" />

        <div className="relative mx-auto max-w-[1440px] px-5 pt-10 pb-14 md:px-8">
          <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-3 uppercase">
            <Link href="/library" className="transition-colors hover:text-ink-2">Library</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/c/${entry.category}`} className="transition-colors hover:text-ink-2">
              {category?.label}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink-2">{entry.title}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-end">
            <div>
              <p className="label-mono mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span>{entry.kind}</span>
                <span aria-hidden="true" className="text-hairline">·</span>
                <span>{entry.mood}</span>
                {entry.tone !== "text" && (
                  <>
                    <span aria-hidden="true" className="text-hairline">·</span>
                    <span>{entry.tone}</span>
                  </>
                )}
              </p>

              <h1 className="font-display text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
                {entry.title}
              </h1>

              <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-2">{entry.summary}</p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <CopyPromptButton slug={entry.slug} text={text} />
                <FavouriteButton slug={entry.slug} title={entry.title} variant="page" />
                <span className="font-mono text-[0.6875rem] text-ink-3">
                  {words.toLocaleString("en-US")} words · {entry.copies.toLocaleString("en-US")} copies ·
                  updated {entry.updated}
                </span>
              </div>
            </div>

            <div className="lg:pb-2">
              <Swatches entry={entry} />
              <TagRow tags={entry.tags} />
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------- the prompt -------------------------------- */}
      <div className="mx-auto max-w-[1440px] px-5 md:px-8">
        <div className="grid gap-10 pt-12 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-hairline-soft pb-4">
              <h2 className="label-mono">The prompt</h2>
              <CopyPromptButton slug={entry.slug} text={text} variant="ghost" label="Copy again" />
            </div>

            <p className="mb-6 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-3">
              Copy the whole thing and paste it into whatever writes your code or your copy.
              Add one line naming your stack if you are not building a plain HTML file.
            </p>

            <pre className="prompt-body overflow-x-auto rounded-md border border-hairline-soft bg-surface/60 p-5 sm:p-7">
              {text}
            </pre>
          </div>

          <aside className="space-y-8 lg:pt-14">
            <PromptSpec entry={entry} />

            <div className="rounded-md border border-hairline-soft bg-surface/60 p-5">
              <h2 className="label-mono mb-4">Works with</h2>
              <ul className="space-y-2.5 text-[0.8125rem] text-ink-2">
                {(entry.group === "design"
                  ? ["Claude and Claude Code", "ChatGPT", "Cursor", "GitHub Copilot", "Lovable, Bolt, v0", "Any model that writes front-end code"]
                  : ["Claude", "ChatGPT", "Gemini", "Grok", "Any current instruction-following model"]
                ).map((tool) => (
                  <li key={tool} className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                    {tool}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-hairline-soft pt-4 text-[0.75rem] leading-relaxed text-ink-3">
                Prompts are written for current frontier models. A small or old model will
                usually keep the structure and lose the detail — paste the whole thing
                unedited for the best result.
              </p>
            </div>
          </aside>
        </div>

        {/* --------------------------------- related --------------------------------- */}
        {related.length > 0 && (
          <section className="mt-24 border-t border-hairline-soft pt-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="label-mono mb-3">More {category?.label.toLowerCase()}</h2>
                <p className="font-display text-[1.5rem] font-semibold tracking-[-0.03em]">
                  Keep going in this direction
                </p>
              </div>
              <Link
                href={`/c/${entry.category}`}
                className="group inline-flex items-center gap-2 font-mono text-[0.6875rem] tracking-[0.12em] text-ink-2 uppercase transition-colors hover:text-accent"
              >
                All {category?.count} {category?.label}
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {toSummaryList(related).map((prompt) => (
                <PromptCard key={prompt.slug} prompt={prompt} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}

function Swatches({ entry }: { entry: NonNullable<ReturnType<typeof getPrompt>> }) {
  const colors = Array.isArray(entry.params.colors) ? (entry.params.colors as string[]) : entry.swatch;
  if (colors.length === 0) return null;

  return (
    <div>
      <h2 className="label-mono mb-3">
        {typeof entry.params.palette === "string" ? entry.params.palette : "Palette"}
      </h2>
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-sm border border-hairline">
          {colors.map((color) => (
            <span key={color} className="h-9 w-11" style={{ backgroundColor: color }} title={color} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {colors.map((color) => (
            <li key={color} className="font-mono text-[0.625rem] text-ink-3">
              {color}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={`/library?q=${encodeURIComponent(tag)}`}
            className="inline-block rounded-sm border border-hairline-soft bg-surface/70 px-2 py-1 font-mono text-[0.625rem] text-ink-3 transition-colors hover:border-hairline hover:text-ink-2"
          >
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
