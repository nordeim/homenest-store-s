import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LEGAL_SLUGS, legalContent, type LegalSlug } from "./content";

// ---------------------------------------------------------------------------
// Legal pages — statically generated for the five known slugs, typed content
// from ./content.ts. Unknown slugs 404.
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

function isLegalSlug(slug: string): slug is LegalSlug {
  return Object.prototype.hasOwnProperty.call(legalContent, slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) {
    return { title: "Page Not Found" };
  }
  const doc = legalContent[slug];
  return {
    title: doc.title,
    description: doc.intro.slice(0, 155),
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  const doc = legalContent[slug];

  return (
    <div className="container-page py-10 sm:py-14">
      <article className="mx-auto max-w-3xl space-y-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-primary">
            Home
          </Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          <span aria-current="page">{doc.title}</span>
        </nav>

        <header>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{doc.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {doc.updated}</p>
        </header>

        <p className="leading-7 text-muted-foreground">{doc.intro}</p>

        <div className="space-y-6 border-t border-border pt-6">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-semibold">{section.heading}</h2>
              {section.body.map((paragraph, i) => (
                <p key={i} className="mt-2 leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          Questions about this policy? Email{" "}
          <a
            href="mailto:hello@homenest.com"
            className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
          >
            hello@homenest.com
          </a>{" "}
          — we reply within 24 hours on business days.
        </footer>
      </article>
    </div>
  );
}
