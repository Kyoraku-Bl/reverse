import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-[720px] flex-col items-start justify-center px-5 pt-28 pb-24 md:px-8">
      <p className="label-mono mb-5">404 — nothing at this address</p>
      <h1 className="font-display text-[clamp(2rem,6vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.045em]">
        That prompt does not exist.
      </h1>
      <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-ink-3">
        It may have been renamed, or the link may be mistyped. The library is all still here —
        1,360 prompts across fourteen categories.
      </p>
      <div className="mt-9 flex flex-wrap gap-3">
        <Link
          href="/library"
          className="rounded-sm bg-accent px-5 py-3 text-[0.8125rem] font-medium text-black transition-colors hover:bg-accent-soft"
        >
          Browse the library
        </Link>
        <Link
          href="/"
          className="rounded-sm border border-hairline px-5 py-3 text-[0.8125rem] text-ink transition-colors hover:border-ink-3"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
