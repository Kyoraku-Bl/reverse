import { NextResponse } from "next/server";
import { getCategories, getDataset, getPromptsByCategory } from "@/lib/data";
import { renderPromptText } from "@/lib/prompt-text";
import { toSummaryList } from "@/lib/summary";

/**
 * JSON access to the library.
 *
 *   /api/prompts                     → index (no prompt bodies)
 *   /api/prompts?category=templates  → one category's index
 *   /api/prompts?full=1              → index plus rendered text for every prompt
 *   /api/prompts?slug=nexus          → one prompt with its rendered text
 *
 * The default response omits prompt bodies on purpose: the full text for 1,360
 * prompts is several megabytes, and almost nobody wants all of it at once.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const slug = url.searchParams.get("slug");
  const full = url.searchParams.get("full") === "1";

  const dataset = getDataset();
  const headers = {
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  };

  if (slug) {
    const entry = dataset.prompts.find((p) => p.slug === slug);
    if (!entry) {
      return NextResponse.json({ error: "Prompt not found", slug }, { status: 404 });
    }
    return NextResponse.json(
      { ...entry, text: renderPromptText(entry) },
      { headers },
    );
  }

  const categories = getCategories();
  if (category) {
    if (!categories.some((c) => c.id === category)) {
      return NextResponse.json(
        {
          error: "Unknown category",
          category,
          available: categories.map((c) => c.id),
        },
        { status: 404 },
      );
    }

    const entries = getPromptsByCategory(category);
    return NextResponse.json(
      {
        total: entries.length,
        category: categories.find((c) => c.id === category),
        prompts: full
          ? entries.map((entry) => ({ ...entry, text: renderPromptText(entry) }))
          : toSummaryList(entries),
      },
      { headers },
    );
  }

  return NextResponse.json(
    {
      version: dataset.version,
      generatedAt: dataset.generatedAt,
      total: dataset.total,
      categories: dataset.categories,
      facets: dataset.facets,
      prompts: full
        ? dataset.prompts.map((entry) => ({ ...entry, text: renderPromptText(entry) }))
        : toSummaryList(dataset.prompts),
      endpoints: {
        byCategory: "/api/prompts?category=templates",
        one: "/api/prompts?slug=<slug>",
        withText: "/api/prompts?full=1",
        promptText: "/api/prompt/<slug>",
      },
    },
    { headers },
  );
}
