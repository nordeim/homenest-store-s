import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import { useCatalogStore } from "@/store/catalogStore";

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M15 8h-2a2 2 0 0 0-2 2v10M9 14h5M15 2H9a7 7 0 0 0-7 7v6a7 7 0 0 0 7 7h6a7 7 0 0 0 7-7V9a7 7 0 0 0-7-7Z" />
    </svg>
  );
}

const shopLinks = [
  { label: "All Products", to: "/products" },
  { label: "Cookware", to: "/categories/cookware" },
  { label: "Bakeware", to: "/categories/bakeware" },
  { label: "Kitchen Storage", to: "/categories/kitchen-storage" },
  { label: "Knives & Cutlery", to: "/categories/knives-cutlery" },
];

const helpLinks = [
  { label: "Contact Us", to: "/contact" },
  { label: "Order Tracking", to: "/order-tracking" },
  { label: "Refund Policy", to: "/refund-policy" },
  { label: "Terms of Service", to: "/terms-of-service" },
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Cookie Policy", to: "/cookie-policy" },
  { label: "Disclaimer", to: "/disclaimer" },
];

export function Footer() {
  const settings = useCatalogStore((s) => s.settings);

  return (
    <footer className="border-t border-ink-100 bg-forest-950 text-cream-100">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-cream-50">
              {settings.storeName}
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream-100/70">
              {settings.tagline}
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-50/10 hover:bg-cream-50/20"
              >
                <InstagramIcon width={16} height={16} />
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-50/10 hover:bg-cream-50/20"
              >
                <FacebookIcon width={16} height={16} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-cream-50/80">Shop</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-cream-100/70">
              {shopLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="hover:text-cream-50">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-cream-50/80">
              Help & Policies
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm text-cream-100/70">
              {helpLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="hover:text-cream-50">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-cream-50/80">
              Get in Touch
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-cream-100/70">
              <li className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0" /> {settings.address}
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} className="shrink-0" /> {settings.contactPhone}
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="shrink-0" /> {settings.contactEmail}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-cream-50/10 pt-6 text-xs text-cream-100/60 sm:flex-row">
          <p>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</p>
          <p>Crafted for people who love their kitchens.</p>
        </div>
      </div>
    </footer>
  );
}
