import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  LEGAL_DOC_SLUGS,
  LEGAL_INDEX,
  type LegalSlug,
} from "@/lib/legal";
import { LEGAL_COMPONENTS } from "@/components/legal";

export function generateStaticParams() {
  return LEGAL_DOC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return { title: "Legal" };
  const meta = LEGAL_INDEX[slug];
  return {
    title: `${meta.title} — Indie Comics Live`,
    description: meta.description,
    alternates: { canonical: `/legal/${slug}` },
  };
}

function isLegalSlug(s: string): s is LegalSlug {
  return (LEGAL_DOC_SLUGS as readonly string[]).includes(s);
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const Component = LEGAL_COMPONENTS[slug];
  return <Component />;
}
