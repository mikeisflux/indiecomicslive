import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://indiecomics.live";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/onboarding/", "/account/", "/orders/", "/seller/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
