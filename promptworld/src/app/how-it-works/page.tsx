import type { Metadata } from "next";
import Link from "next/link";
import { getDataset } from "@/lib/data";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "What a PromptWorld prompt actually contains, why it is written as a spec rather than a wish, and how to move one into your own stack.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  const dataset = getDataset();

  return (
    <div className="mx-auto max-w-[820px] px-5 pt-32 pb-24 md:px-8">
      <header className="mb-14 border-b border-hairline-soft pb-10">
        <p className="label-mono mb-4">How it works</p>
        <h1 className="font-display text-[clamp(2.1rem,5.4vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.045em]">
          A prompt is a spec,
          <span className="block text-ink-3">not a wish.</span>
        </h1>
        <p className="mt-6 text-[1rem] leading-relaxed text-ink-2">
          Most prompt libraries hand an AI an adjective. This one hands it decisions: the hex
          values, the easing curve, the particle budget, the audience, the constraints, the
          format of the answer, and what to do when it is unsure. That is the whole difference
          between a result you can ship and a result you have to rewrite.
        </p>
      </header>

      <div className="space-y-14 text-[0.9375rem] leading-[1.75] text-ink-2">
        <Block heading="What every prompt contains">
          <p>
            A design prompt carries design tokens with real hex values, a typography scale with
            fluid clamp() bounds, a hero technique described in enough detail to build, an
            ordered section list, a motion system naming the library and the easing, three
            genuine responsive layouts, a performance budget, an accessibility checklist, an SEO
            checklist and an explicit do-not list.
          </p>
          <p>
            A vault prompt carries a role with a stated disposition, the task, the audience or
            the situation, the method, the rules that separate a good answer from a plausible
            one, and the exact output format — usually including a section for what the model
            could not verify.
          </p>
          <p className="text-ink-3">
            Across {dataset.total.toLocaleString("en-US")} prompts that is a lot of writing, so
            each one is generated from a structured parameter set rather than typed by hand.
            The parameters are the creative decisions; the prose that wraps them is consistent
            because it comes from the same renderer. Two prompts in the same category never
            share a palette, a technique and a mood at once.
          </p>
        </Block>

        <Block heading="Why one self-contained file">
          <p>
            Design prompts ask for a single <code className="font-mono text-[0.85em] text-accent-soft">.html</code>{" "}
            file by default. One file means you can open it in a browser in two seconds, judge
            it, and throw it away — which is most of the value. It also means the prompt is
            stack-agnostic: nothing in it assumes React, a bundler or a framework.
          </p>
          <p>
            To build in your own stack, add one line when you paste:{" "}
            <em className="text-ink">“Build this as a Next.js App Router page with Tailwind,
            splitting the styles into the project’s design tokens.”</em> Or paste it as-is and
            then ask your AI to port the file it just produced into your project. Both work; the
            second is usually better because the model has already solved the design problem
            before it thinks about your architecture.
          </p>
        </Block>

        <Block heading="Getting a good result">
          <ul className="space-y-3">
            {[
              "Paste the whole prompt, unedited. It is written as one document and the later sections constrain the earlier ones — the do-not list matters as much as the tokens.",
              "Use a current frontier model. An older or smaller model will usually keep the structure and lose the motion, the depth and the specificity.",
              "Give it your content. Replace the placeholder copy instruction with your real headline, your real numbers and your real objection, and the result stops looking like a template.",
              "Iterate on one axis at a time. Ask for a different palette, or slower motion, or a denser grid — not all three at once.",
              "Judge it against the do-not list. If the output contains a centred hero with three equal cards and a purple gradient, the model ignored the brief; say so and ask again.",
            ].map((item) => (
              <li key={item.slice(0, 32)} className="flex gap-3">
                <span aria-hidden="true" className="mt-2.5 size-1 shrink-0 rounded-full bg-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block heading="Favourites and your data">
          <p>
            Saved prompts are written to <code className="font-mono text-[0.85em] text-accent-soft">localStorage</code>{" "}
            under one key and never leave your browser. There is no account, no analytics on
            individual prompts and nothing to sign into. Clearing your site data clears the
            list.
          </p>
        </Block>

        <Block heading="Using the prompts">
          <p>
            Every prompt is free to use, including commercially, with no attribution required.
            What you build from one is yours. What you may not do is republish the library
            itself — the prompt text, in bulk, as a competing product.
          </p>
          <p className="text-ink-3">
            The dataset is also available as JSON at{" "}
            <Link href="/api/prompts" className="text-accent underline underline-offset-4">
              /api/prompts
            </Link>{" "}
            and one prompt at a time at{" "}
            <code className="font-mono text-[0.85em] text-accent-soft">/api/prompt/[slug]</code>,
            which is useful if you want the library inside your own tooling.
          </p>
        </Block>

        <div className="border-t border-hairline-soft pt-8">
          <Link
            href="/library"
            className="inline-block rounded-sm bg-accent px-5 py-3 text-[0.8125rem] font-medium text-black transition-colors hover:bg-accent-soft"
          >
            Browse {dataset.total.toLocaleString("en-US")} prompts
          </Link>
        </div>
      </div>
    </div>
  );
}

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`how-${heading.replace(/\W+/g, "-").toLowerCase()}`}>
      <h2
        id={`how-${heading.replace(/\W+/g, "-").toLowerCase()}`}
        className="label-mono mb-4"
      >
        {heading}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
