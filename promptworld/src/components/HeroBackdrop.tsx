/**
 * Hero atmosphere: layered CSS only.
 *
 * Four drifting washes plus a horizon glow and a grid, all behind the headline.
 * No canvas and no JavaScript, so it costs nothing on the main thread and the
 * text above it is painted on the first frame.
 */

export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* deep base */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,#141419_0%,#060607_58%)]" />

      {/* warm key wash, upper right */}
      <div
        className="absolute -top-[28%] -right-[12%] size-[70vw] min-w-[420px] rounded-full opacity-[0.42] blur-[110px]"
        style={{
          background:
            "radial-gradient(circle at 42% 42%, #ff6a2b 0%, #b8390f 38%, transparent 68%)",
          animation: "hero-drift-a 34s ease-in-out infinite alternate",
        }}
      />

      {/* cool counter wash, lower left */}
      <div
        className="absolute -bottom-[34%] -left-[16%] size-[64vw] min-w-[380px] rounded-full opacity-[0.3] blur-[130px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, #2f6f8f 0%, #16323f 44%, transparent 72%)",
          animation: "hero-drift-b 46s ease-in-out infinite alternate",
        }}
      />

      {/* receding grid floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-[46%] opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.075) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.075) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          transform: "perspective(420px) rotateX(66deg) scale(2.4)",
          transformOrigin: "50% 100%",
          maskImage: "linear-gradient(to top, #000 2%, transparent 74%)",
          WebkitMaskImage: "linear-gradient(to top, #000 2%, transparent 74%)",
          animation: "hero-grid 13s linear infinite",
        }}
      />

      {/* horizon line */}
      <div className="absolute inset-x-0 top-[54%] h-px bg-gradient-to-r from-transparent via-[#ff6a2b]/28 to-transparent" />

      {/* vignette so the copy always sits on dark ground */}
      <div className="absolute inset-0 bg-[radial-gradient(78%_62%_at_50%_42%,transparent_0%,#060607_88%)] opacity-80" />

      <style>{`
        @keyframes hero-drift-a {
          from { transform: translate3d(-3%, 2%, 0) scale(1); }
          to   { transform: translate3d(5%, -4%, 0) scale(1.14); }
        }
        @keyframes hero-drift-b {
          from { transform: translate3d(3%, -2%, 0) scale(1.06); }
          to   { transform: translate3d(-5%, 4%, 0) scale(0.96); }
        }
        @keyframes hero-grid {
          from { background-position: 0 0; }
          to   { background-position: 0 72px; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="hero-drift"], [style*="hero-grid"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
