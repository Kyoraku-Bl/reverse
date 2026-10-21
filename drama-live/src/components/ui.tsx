import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'ghost' | 'outline' | 'gold' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-600/25 focus-visible:ring-brand-500',
  gold: 'bg-gold-500 text-ink-950 hover:bg-gold-400 shadow-lg shadow-gold-500/25 focus-visible:ring-gold-400',
  outline:
    'border border-ink-600/60 text-slate-100 hover:border-brand-500 hover:text-brand-400 dark:border-white/15 dark:hover:border-brand-500',
  ghost: 'text-slate-300 hover:bg-white/10 hover:text-white dark:text-slate-300',
  danger: 'bg-red-600/15 text-red-400 hover:bg-red-600/25 border border-red-500/30',
};

export function Button({
  variant = 'primary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
        'focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className={clsx('block space-y-1.5', className)}>
      {label ? <span className="text-xs font-semibold text-slate-400">{label}</span> : null}
      <input
        className={clsx(
          'w-full rounded-xl border border-ink-600/60 bg-ink-900/70 px-3.5 py-2.5 text-sm text-slate-100',
          'placeholder:text-slate-500 focus:border-brand-500 focus-ring dark:border-white/10',
        )}
        {...rest}
      />
      {hint ? <span className="block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-6 w-11 shrink-0 rounded-full transition focus-ring',
          checked ? 'bg-brand-600' : 'bg-ink-600',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'start-5' : 'start-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('card p-5', className)}>{children}</div>;
}

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: 'default' | 'live' | 'gold' | 'ok';
  className?: string;
}) {
  const tones = {
    default: 'bg-white/10 text-slate-300',
    live: 'bg-red-500/15 text-red-400 border border-red-500/30',
    gold: 'bg-gold-500/15 text-gold-400 border border-gold-500/30',
    ok: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  } as const;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={clsx('mb-10 max-w-3xl', center && 'mx-auto text-center')}>
      {eyebrow ? (
        <span className="mb-3 inline-block rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-bold text-brand-400">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-3 text-base leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  );
}
