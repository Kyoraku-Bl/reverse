import Link from "next/link";
import type { Metadata } from "next";
import { getCategories, getDataset, getTopPrompts, totalCopies } from "@/lib/data";
import { PromptCard } from "@/components/PromptCard";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { OpenPaletteButton } from "@/components/OpenPaletteButton";

export const metadata: Metadata = {
  title: { absolute: `PromptWorld — ${getDataset().total.toLocaleString("en-US")} cinematic AI prompts` },
  description:
    "Copy a prompt, paste it into your AI, and ship something that does not look AI-made. 1,360 prompts across web templates, 3D scenes, sections, backgrounds, gradients and a vault of marketing, code and agent prompts.",
};

export default function HomePage() {
  const dataset = getDataset();
  const categories = getCategories();
  const design = categories.filter((c) => c.group === "design");
  const vault = categories.filter((c) => c.group === "vault");
  const copies = totalCopies();

  return (
    <>
      {/* ---------------------------------- hero --------------------------------- */}
      <section className="relative flex min-h-[92svh] items-center overflow-hidden pt-28 pb-20">
        <HeroBackdrop />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 md:px-8">
          <p className="label-mono rise-in mb-7 flex items-center gap-3">
            <span className="inline-block size-1.5 rounded-full bg-accent" />
            {dataset.total.toLocaleString("en-US")} prompts · {copies.toLocaleString("en-US")} copies ·
            updated {dataset.generatedAt}
          </p>

          <h1
            className="rise-in max-w-[15ch] font-display text-[clamp(2.9rem,9.2vw,7.25rem)] leading-[0.92] font-semibold tracking-[-0.045em]"
            style={{ animationDelay: "60ms" }}
          >
            Prompts that build
            <span className="block text-ink-3">things worth</span>
            <span className="block text-accent">looking at.</span>
          </h1>

          <p
            className="rise-in mt-8 max-w-xl text-[1.0625rem] leading-relaxed text-ink-2"
            style={{ animationDelay: "140ms" }}
          >
            Copy a prompt, paste it into your AI, and get a site, a scene or a piece of copy
            that does not look AI-made. Every one carries real decisions — hex values, easing
            curves, camera language, guardrails — instead of a vague instruction.
          </p>

          <div className="rise-in mt-10 flex flex-wrap items-center gap-3" style={{ animationDelay: "200ms" }}>
            <Link
              href="/library"
              className="rounded-sm bg-accent px-6 py-3.5 text-[0.875rem] font-medium text-black transition-all duration-200 hover:bg-accent-soft active:scale-[0.98]"
            >
              Browse all {dataset.total.toLocaleString("en-US")} prompts
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-sm border border-hairline px-6 py-3.5 text-[0.875rem] text-ink transition-colors duration-200 hover:border-ink-3"
            >
              How it works
            </Link>
            <OpenPaletteButton
              label="Search the prompt library"
              className="inline-flex items-center gap-2 px-3 py-3.5 text-[0.8125rem] text-ink-3 transition-colors hover:text-ink"
            >
              or press
              <kbd className="rounded-[3px] border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[0.625rem]">
                ⌘K
              </kbd>
            </OpenPaletteButton>
          </div>

          <dl
            className="rise-in mt-16 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 border-t border-hairline-soft pt-8 sm:grid-cols-4"
            style={{ animationDelay: "260ms" }}
          >
            <Stat term="Prompts" value={dataset.total.toLocaleString("en-US")} />
            <Stat term="Categories" value={String(categories.length)} />
            <Stat term="Copies made" value={`${Math.round(copies / 1000)}k`} />
            <Stat term="Cost" value="Free" />
          </dl>
        </div>
      </section>

      {/* --------------------------- design library strip --------------------------- */}
      <SectionShell
        eyebrow="The design library"
        title="Layers, not templates"
        lede="Five kinds of web layer. Each one is a complete build spec — tokens, motion, responsive rules, performance budget, accessibility and a do-not list — so your AI stops guessing at the hard parts."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {design.map((category) => (
            <Link
              key={category.id}
              href={`/c/${category.id}`}
              className="group rounded-md border border-hairline-soft bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-hairline"
            >
              <p className="label-mono mb-3">{String(category.count).padStart(3, "0")}</p>
              <h3 className="font-display text-[1.0625rem] font-medium text-ink transition-colors group-hover:text-accent-soft">
                {category.label}
              </h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">{category.blurb}</p>
              <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.12em] text-ink-3 uppercase transition-colors group-hover:text-accent">
                Explore <span aria-hidden="true">→</span>
              </p>
            </Link>
          ))}
        </div>
      </SectionShell>

      {/* ------------------------- per-category showcases -------------------------- */}
      {design.map((category) => (
        <SectionShell
          key={category.id}
          eyebrow={`New ${category.label.toLowerCase()} weekly`}
          title={`${category.label} prompts`}
          href={`/c/${category.id}`}
          hrefLabel={`All ${category.count} ${category.label}`}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {getTopPrompts(category.id, 5).map((prompt) => (
              <PromptCard key={prompt.slug} prompt={prompt} />
            ))}
          </div>
        </SectionShell>
      ))}

      {/* -------------------------------- how it works ------------------------------ */}
      <SectionShell
        eyebrow="One prompt from idea to artefact"
        title="Three steps, no account"
        lede="A prompt here is plain structured language, so it is tied to no framework and no vendor. It builds a self-contained file by default; add one line and your AI builds it inside whatever you already use."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Step
            n="01"
            title="Find it"
            body="One search across templates, 3D scenes, sections, backgrounds, gradients and nine vault categories. Filter by mood, tone, type or palette."
          />
          <Step
            n="02"
            title="Copy it"
            body="Every prompt is complete: design tokens with real hex values, a motion spec with named easings, a performance budget, an accessibility checklist and an explicit do-not list."
          />
          <Step
            n="03"
            title="Ship it"
            body="Paste into Claude, ChatGPT, Cursor, Copilot, Lovable, Bolt or v0. Name your stack if it is not plain HTML and the same prompt builds there."
          />
        </div>
      </SectionShell>

      {/* --------------------------------- the vault -------------------------------- */}
      <SectionShell
        eyebrow="Beyond the design library"
        title="The prompt vault"
        lede="Nine categories of working prompts for the rest of the job — the copy, the code, the analysis, the agents. Same discipline: a defined role, a concrete deliverable, explicit constraints and a stated output format."
        href="/vault"
        hrefLabel="Open the vault"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vault.map((category) => (
            <Link
              key={category.id}
              href={`/c/${category.id}`}
              className="group flex items-start justify-between gap-4 rounded-md border border-hairline-soft bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-hairline"
            >
              <div>
                <h3 className="font-display text-[1rem] font-medium text-ink transition-colors group-hover:text-accent-soft">
                  {category.label}
                </h3>
                <p className="mt-2 max-w-sm text-[0.8125rem] leading-relaxed text-ink-3">
                  {category.blurb}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[0.6875rem] text-ink-3">
                {String(category.count).padStart(3, "0")}
              </span>
            </Link>
          ))}
        </div>
      </SectionShell>

      {/* --------------------------------- closing CTA ------------------------------ */}
      <section className="relative mt-32 overflow-hidden border-t border-hairline-soft">
        <div className="art art-aurora absolute inset-0 opacity-45" aria-hidden="true"
          style={{ ["--art-0" as string]: "#060607", ["--art-1" as string]: "#2a1408", ["--art-2" as string]: "#ff6a2b" }}
        />
        <div className="relative mx-auto max-w-[1440px] px-5 py-28 text-center md:px-8">
          <h2 className="mx-auto max-w-[18ch] font-display text-[clamp(2rem,5.4vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
            Stop writing the same prompt twice.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2">
            {dataset.total.toLocaleString("en-US")} prompts, all free, all commercial-use, no
            attribution and no account. Save the ones you like — favourites stay in your browser.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/library"
              className="rounded-sm bg-accent px-6 py-3.5 text-[0.875rem] font-medium text-black transition-all duration-200 hover:bg-accent-soft active:scale-[0.98]"
            >
              Browse the library
            </Link>
            <Link
              href="/favourites"
              className="rounded-sm border border-hairline px-6 py-3.5 text-[0.875rem] text-ink transition-colors duration-200 hover:border-ink-3"
            >
              Your favourites
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="label-mono">{term}</dt>
      <dd className="mt-2 font-display text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-ink">
        {value}
      </dd>
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  lede,
  href,
  hrefLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[1440px] px-5 pt-24 md:px-8">
      <div className="mb-8 flex flex-col gap-4 border-b border-hairline-soft pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="label-mono mb-3">{eyebrow}</p>
          <h2 className="font-display text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.06] font-semibold tracking-[-0.035em]">
            {title}
          </h2>
          {lede && <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-3">{lede}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="group inline-flex shrink-0 items-center gap-2 font-mono text-[0.6875rem] tracking-[0.12em] text-ink-2 uppercase transition-colors hover:text-accent"
          >
            {hrefLabel}
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="relative rounded-md border border-hairline-soft bg-surface p-6">
      <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-accent">{n}</span>
      <h3 className="mt-4 font-display text-[1.125rem] font-medium text-ink">{title}</h3>
      <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-3">{body}</p>
    </div>
  );
}
