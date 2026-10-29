import Link from "next/link";
import type { Category } from "@/lib/data";
import { Wordmark } from "./SiteHeader";

interface SiteFooterProps {
  categories: Category[];
  total: number;
}

export function SiteFooter({ categories, total }: SiteFooterProps) {
  const design = categories.filter((c) => c.group === "design");
  const vault = categories.filter((c) => c.group === "vault");
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-28 border-t border-hairline-soft bg-ground-2">
      <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <Wordmark />
              <span className="font-display text-[0.9375rem] font-semibold tracking-[-0.02em]">
                prompt<span className="text-accent">world</span>
              </span>
            </div>
            <p className="max-w-xs text-[0.875rem] leading-relaxed text-ink-3">
              {total.toLocaleString("en-US")} prompts for building things that do not look
              AI-made. Copy one, paste it into whatever writes your code or your copy, and
              keep going from there.
            </p>
            <p className="label-mono">
              Built for Claude · ChatGPT · Cursor · Copilot · Lovable · Bolt · v0 · Midjourney
            </p>
          </div>

          <FooterColumn title="Design library">
            {design.map((c) => (
              <FooterLink key={c.id} href={`/c/${c.id}`}>
                {c.label}
                <span className="ml-auto font-mono text-[0.6875rem] text-ink-3">{c.count}</span>
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Prompt vault">
            {vault.map((c) => (
              <FooterLink key={c.id} href={`/c/${c.id}`}>
                {c.label}
                <span className="ml-auto font-mono text-[0.6875rem] text-ink-3">{c.count}</span>
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Site">
            <FooterLink href="/library">Browse everything</FooterLink>
            <FooterLink href="/vault">The vault</FooterLink>
            <FooterLink href="/favourites">Your favourites</FooterLink>
            <FooterLink href="/how-it-works">How it works</FooterLink>
            <FooterLink href="/api/prompts">JSON API</FooterLink>
          </FooterColumn>
        </div>

        {/* The wordmark bleeds off the bottom edge, getlayers-style. */}
        <div
          aria-hidden="true"
          className="pointer-events-none mt-14 select-none overflow-hidden font-display text-[19vw] leading-[0.78] font-semibold tracking-[-0.05em] text-transparent [-webkit-text-stroke:1px_#1e1e24]"
        >
          PROMPTWORLD
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-hairline-soft pt-6 text-[0.75rem] text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} PromptWorld. Every prompt is yours to use, commercially, without attribution.</p>
          <p className="font-mono">
            {total.toLocaleString("en-US")} prompts · {categories.length} categories
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="label-mono mb-4">{title}</h2>
      <ul className="space-y-2.5">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 text-[0.8125rem] text-ink-3 transition-colors duration-200 hover:text-ink"
      >
        {children}
      </Link>
    </li>
  );
}
