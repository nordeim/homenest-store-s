import Link from "next/link";
import { Facebook, Instagram, MapPin, Mail, Phone } from "lucide-react";

const QUICK_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
  { href: "/track-order", label: "Track Order" },
];

const POLICIES = [
  { href: "/legal/privacy-policy", label: "Privacy Policy" },
  { href: "/legal/terms-of-service", label: "Terms of Service" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
  { href: "/legal/cookie-policy", label: "Cookie Policy" },
  { href: "/legal/refund-policy", label: "Refund Policy" },
];

export function Footer({
  settings,
}: {
  settings: {
    storeName: string;
    tagline: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    socialFacebook?: string;
    socialInstagram?: string;
    socialPinterest?: string;
    socialTikTok?: string;
  };
}) {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 className="mb-4 font-display text-lg font-semibold">{settings.storeName}</h3>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">{settings.tagline}</p>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide">Quick Links</h4>
          <ul className="space-y-2.5">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide">Policies</h4>
          <ul className="space-y-2.5">
            {POLICIES.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide">Contact Us</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-primary" aria-hidden />
              <a href={`mailto:${settings.contactEmail}`} className="hover:text-primary">
                {settings.contactEmail}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-primary" aria-hidden />
              <a href={`tel:${settings.contactPhone}`} className="hover:text-primary">
                {settings.contactPhone}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{settings.address}</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {settings.storeName}. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <SocialLinks settings={settings} />
            <Link href="/legal/privacy-policy" className="hover:text-primary">
              Privacy
            </Link>
            <Link href="/legal/terms-of-service" className="hover:text-primary">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-primary">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Inline SVG paths for the two networks lucide-react doesn't ship (Pinterest,
// TikTok) — decorative, links carry the accessible names.
const PINTEREST_PATH =
  "M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.31-.09-.79-.17-2.01.03-2.87.18-.78 1.18-4.97 1.18-4.97s-.3-.6-.3-1.49c0-1.4.81-2.44 1.82-2.44.86 0 1.27.64 1.27 1.41 0 .86-.55 2.15-.83 3.34-.24 1 .5 1.81 1.48 1.81 1.78 0 3.15-1.88 3.15-4.59 0-2.4-1.72-4.08-4.19-4.08-2.85 0-4.53 2.14-4.53 4.35 0 .86.33 1.79.75 2.29.08.1.09.19.07.29-.08.31-.25 1-.28 1.14-.04.19-.15.23-.34.14-1.25-.58-2.03-2.41-2.03-3.88 0-3.16 2.3-6.06 6.62-6.06 3.48 0 6.18 2.48 6.18 5.79 0 3.45-2.18 6.23-5.2 6.23-1.02 0-1.97-.53-2.3-1.15l-.62 2.38c-.23.87-.84 1.96-1.25 2.63.94.29 1.94.45 2.97.45 5.52 0 10-4.48 10-10S17.52 2 12 2z";
const TIKTOK_PATH =
  "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.31-2.83V9.35a6.35 6.35 0 1 0 5.76 6.32V8.75a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.18z";

/** Admin-editable social links (settings) — wired into the footer bottom bar
 *  in session 5 (S5-10): previously validated + seeded + editable but never
 *  rendered (dead data end-to-end). */
function SocialLinks({
  settings,
}: {
  settings: {
    storeName?: string;
    socialFacebook?: string;
    socialInstagram?: string;
    socialPinterest?: string;
    socialTikTok?: string;
  };
}) {
  const socials: { label: string; href: string; icon: React.ReactNode }[] = [];
  if (settings.socialFacebook) {
    socials.push({ label: "Facebook", href: settings.socialFacebook, icon: <Facebook className="h-4 w-4" aria-hidden /> });
  }
  if (settings.socialInstagram) {
    socials.push({ label: "Instagram", href: settings.socialInstagram, icon: <Instagram className="h-4 w-4" aria-hidden /> });
  }
  if (settings.socialPinterest) {
    socials.push({
      label: "Pinterest",
      href: settings.socialPinterest,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path d={PINTEREST_PATH} />
        </svg>
      ),
    });
  }
  if (settings.socialTikTok) {
    socials.push({
      label: "TikTok",
      href: settings.socialTikTok,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path d={TIKTOK_PATH} />
        </svg>
      ),
    });
  }

  if (socials.length === 0) return null;

  return (
    <ul className="flex items-center gap-4" aria-label="Social media">
      {socials.map(({ label, href, icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${settings.storeName ?? "HomeNest"} on ${label}`}
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            {icon}
            <span className="sr-only">{label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
