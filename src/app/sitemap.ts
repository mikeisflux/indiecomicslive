import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://indiecomicslive.com";

  const shows = await prisma.show
    .findMany({
      where: { status: { in: ["live", "scheduled", "ended"] } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    })
    .catch(() => []);

  return [
    {
      url: `${siteUrl}/`,
      changeFrequency: "hourly",
      priority: 1,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/sell`,
      changeFrequency: "weekly",
      priority: 0.9,
      lastModified: new Date(),
    },
    ...shows.map((s) => ({
      url: `${siteUrl}/s/${s.id}`,
      lastModified: s.createdAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
