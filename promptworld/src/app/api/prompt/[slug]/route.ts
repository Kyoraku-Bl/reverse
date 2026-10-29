import { NextResponse } from "next/server";
import { getPrompt } from "@/lib/data";
import { renderPromptText, wordCount } from "@/lib/prompt-text";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * One prompt's rendered text. Cards and the command palette fetch this on
 * demand, which keeps 1,360 prompt bodies out of every page payload.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const entry = getPrompt(slug);

  if (!entry) {
    return NextResponse.json({ error: "Prompt not found", slug }, { status: 404 });
  }

  const text = renderPromptText(entry);

  return NextResponse.json(
    {
      slug: entry.slug,
      title: entry.title,
      category: entry.category,
      kind: entry.kind,
      text,
      words: wordCount(text),
      updated: entry.updated,
    },
    {
      headers: {
        // The dataset is generated at build time, so a prompt's text cannot
        // change until the next deploy.
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
