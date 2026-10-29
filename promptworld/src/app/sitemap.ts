import type { MetadataRoute } from "next";
import { getDataset } from "@/lib/data";

const SITE = "https://promptworld.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const dataset = getDataset();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/library`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/vault`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/how-it-works`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = dataset.categories.map((category) => ({
    url: `${SITE}/c/${category.id}`,
    changeFrequency: "daily",
    priority: 0.85,
    lastModified: dataset.generatedAt,
  }));

  const promptRoutes: MetadataRoute.Sitemap = dataset.prompts.map((prompt) => ({
    url: `${SITE}/p/${prompt.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
    lastModified: prompt.updated,
  }));

  return [...staticRoutes, ...categoryRoutes, ...promptRoutes];
}
