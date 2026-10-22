import React from "react";
import { templateRecipe } from "./template-catalog";
let measure;
function wrapText(n, w) {
  measure ||= document.createElement("canvas").getContext("2d");
  measure.font = `${n.fontStyle || "normal"} ${n.fontWeight || 400} ${n.size * w}px "${n.fontFamily}"`;
  return n.text.split("\n").flatMap((paragraph) => {
    const lines = [];
    let line = "";
    for (const word of paragraph.split(" ")) {
      const test = line ? line + " " + word : word;
      if (line && measure.measureText(test).width > n.w * w) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
    return lines;
  });
}
export default function TemplatePreview({ item }) {
  const { width: w, height: h } = item;
  return (
    <div className="original-preview">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={item.title}>
        <rect width={w} height={h} fill={item.color} />
        {templateRecipe(item).map((n, i) =>
          n.kind === "rect" ? (
            <rect
              key={i}
              x={n.x * w}
              y={n.y * h}
              width={n.w * w}
              height={n.h * h}
              fill={n.fill}
            />
          ) : n.kind === "circle" ? (
            <circle
              key={i}
              cx={(n.x + n.r) * w}
              cy={n.y * h + n.r * w}
              r={n.r * w}
              fill={n.fill}
            />
          ) : (
            <text
              key={i}
              x={
                n.x * w +
                (n.textAlign === "center"
                  ? (n.w * w) / 2
                  : n.textAlign === "right"
                    ? n.w * w
                    : 0)
              }
              y={n.y * h}
              fill={n.fill}
              fontFamily={n.fontFamily}
              fontWeight={n.fontWeight || 400}
              fontStyle={n.fontStyle}
              fontSize={n.size * w}
              dominantBaseline="hanging"
              textAnchor={
                n.textAlign === "center"
                  ? "middle"
                  : n.textAlign === "right"
                    ? "end"
                    : "start"
              }
            >
              {wrapText(n, w).map((s, j) => (
                <tspan
                  key={j}
                  x={
                    n.x * w +
                    (n.textAlign === "center"
                      ? (n.w * w) / 2
                      : n.textAlign === "right"
                        ? n.w * w
                        : 0)
                  }
                  dy={j ? n.size * w * (n.lineHeight || 1.16) : 0}
                >
                  {s}
                </tspan>
              ))}
            </text>
          ),
        )}
      </svg>
    </div>
  );
}
