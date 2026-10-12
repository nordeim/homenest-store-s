import { Navigate } from "react-router-dom";
import { legalContent } from "@/data/legalContent";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export function LegalPage({ slug }: { slug: string }) {
  const content = legalContent[slug];
  if (!content) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: content.title }]} />
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink-900">{content.title}</h1>
      <p className="mt-1 text-sm text-ink-400">Last updated {content.updated}</p>
      <div className="mt-8 space-y-8">
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-ink-900">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-2 leading-relaxed text-ink-600">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
