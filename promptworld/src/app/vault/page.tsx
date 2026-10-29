import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getDataset, getTopPrompts } from "@/lib/data";
import { PromptCard } from "@/components/PromptCard";

export const metadata: Metadata = {
  title: "Prompt vault",
  description:
    "Nine categories of working prompts beyond web design: marketing and copy, code and engineering, writing, image generation, business strategy, agents, SEO, data and learning.",
  alternates: { canonical: "/vault" },
};

export default function VaultPage() {
  const dataset = getDataset();
  const vault = getCategories().filter((c) => c.group === "vault");
  const vaultTotal = vault.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-32 pb-24 md:px-8">
      <header className="mb-14 max-w-3xl border-b border-hairline-soft pb-10">
        <p className="label-mono mb-4">The vault · {vaultTotal} prompts</p>
        <h1 className="font-display text-[clamp(2.2rem,5.6vw,4rem)] leading-[1] font-semibold tracking-[-0.045em]">
          The rest of the job,
          <span className="block text-ink-3">also prompted properly.</span>
        </h1>
        <p className="mt-6 text-[1rem] leading-relaxed text-ink-2">
          The design library builds the thing. The vault does the work around it: the copy that
          sells it, the code that ships it, the images that fill it, the analysis that justifies
          it and the agents that keep it running.
        </p>
        <p className="mt-4 text-[0.875rem] leading-relaxed text-ink-3">
          Same discipline throughout. Every prompt fixes a role, names a concrete deliverable,
          states the constraints that separate a good answer from a plausible one, and specifies
          the output format — including what to say when it is unsure.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/library"
            className="rounded-sm bg-accent px-5 py-3 text-[0.8125rem] font-medium text-black transition-all duration-200 hover:bg-accent-soft active:scale-[0.98]"
          >
            Search all {dataset.total.toLocaleString("en-US")} prompts
          </Link>
          <Link
            href="/how-it-works"
            className="rounded-sm border border-hairline px-5 py-3 text-[0.8125rem] text-ink transition-colors duration-200 hover:border-ink-3"
          >
            How a prompt is written
          </Link>
        </div>
      </header>

      <div className="space-y-20">
        {vault.map((category) => (
          <section key={category.id} aria-labelledby={`vault-${category.id}`}>
            <div className="mb-6 flex flex-col gap-3 border-b border-hairline-soft pb-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="label-mono mb-2.5">{String(category.count).padStart(3, "0")} prompts</p>
                <h2
                  id={`vault-${category.id}`}
                  className="font-display text-[clamp(1.5rem,3vw,2.25rem)] leading-tight font-semibold tracking-[-0.035em]"
                >
                  {category.label}
                </h2>
                <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-3">{category.blurb}</p>
              </div>
              <Link
                href={`/c/${category.id}`}
                className="group inline-flex shrink-0 items-center gap-2 font-mono text-[0.6875rem] tracking-[0.12em] text-ink-2 uppercase transition-colors hover:text-accent"
              >
                All {category.label}
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {getTopPrompts(category.id, 4).map((prompt) => (
                <PromptCard key={prompt.slug} prompt={prompt} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
