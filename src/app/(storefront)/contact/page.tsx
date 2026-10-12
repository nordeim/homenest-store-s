import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { siteBaseUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";

import { ContactForm } from "./contact-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Questions about an order, product advice, or a partnership? Reach the HomeNest Kitchen team by email, phone, or the contact form — we reply within 24 hours.",
  alternates: { canonical: `${siteBaseUrl()}/contact` },
};

// ---------------------------------------------------------------------------
// Contact — info cards from store settings + the client form island.
// ---------------------------------------------------------------------------

export default async function ContactPage() {
  const settings = await getSettings();

  const INFO_CARDS = [
    {
      icon: Mail,
      title: "Email Us",
      value: settings.contactEmail,
      note: "We reply within 24 hours",
      href: `mailto:${settings.contactEmail}`,
    },
    {
      icon: Phone,
      title: "Call Us",
      value: settings.contactPhone,
      note: "Mon–Fri, 9am–6pm",
      href: `tel:${settings.contactPhone.replace(/[^+\d]/g, "")}`,
    },
    {
      icon: MapPin,
      title: "Visit Us",
      value: settings.address,
      note: "Showroom open by appointment",
      href: null,
    },
    {
      icon: Clock,
      title: "Live Chat",
      value: "Average wait under 2 minutes",
      note: "Available Mon–Fri, 9am–6pm from your account page",
      href: null,
    },
  ] as const;

  return (
    <div className="container-page flex flex-col gap-10 py-8 sm:py-10">
      <header>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Get in Touch</h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Have a question about an order, need help picking the right pan, or want to talk about a
          partnership? We&apos;d love to hear from you — our team replies within one business day, usually
          much faster.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        {/* Info cards */}
        <section aria-label="Contact information" className="flex flex-col gap-4">
          {INFO_CARDS.map((card) => (
            <div
              key={card.title}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                <card.icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">{card.title}</h2>
                {card.href ? (
                  <a
                    href={card.href}
                    className="mt-0.5 block break-words text-sm text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {card.value}
                  </a>
                ) : (
                  <p className="mt-0.5 break-words text-sm text-foreground">{card.value}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">{card.note}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Form island */}
        <section aria-label="Send us a message">
          <ContactForm />
        </section>
      </div>
    </div>
  );
}
