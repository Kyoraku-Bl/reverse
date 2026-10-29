/**
 * Card artwork, drawn entirely in CSS from the prompt's own palette.
 *
 * 1,360 cards with zero image bytes: three custom properties drive one of
 * twelve patterns defined in globals.css. The pattern is chosen by the
 * generator so a category reads as a coherent set rather than noise.
 */

interface CardArtProps {
  pattern: string;
  swatch: string[];
  className?: string;
  /** Pause the animation until hover — used in dense grids. */
  animateOnHover?: boolean;
}

export function CardArt({ pattern, swatch, className = "", animateOnHover = false }: CardArtProps) {
  const style = {
    "--art-0": swatch[0] ?? "#0b0b0d",
    "--art-1": swatch[1] ?? "#4b4b55",
    "--art-2": swatch[2] ?? "#ff6a2b",
  } as React.CSSProperties;

  return (
    <div
      aria-hidden="true"
      style={style}
      className={`art art-${pattern} ${animateOnHover ? "art-idle" : ""} ${className}`}
    >
      <span className="art-layer" />
    </div>
  );
}
