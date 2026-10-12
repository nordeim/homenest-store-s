import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";
import { getSettings } from "@/lib/settings";
import { buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";

import { StoreChrome } from "@/components/store/store-chrome";
import { Footer } from "@/components/store/footer";

/**
 * Storefront layout — server shell that resolves the session, cart count and
 * settings once, then renders the sticky header + mobile nav + footer chrome
 * around each page.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  // The user + settings reads are independent — resolve them together (the
  // cart-count chain below is the only one that depends on `user`).
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  // Best-effort cart count (never blocks rendering).
  let cartCount = 0;
  try {
    const cartId = await findCartId(user?.id ?? null);
    const summary = await getCartSummary(cartId);
    cartCount = summary.itemCount;
  } catch {
    cartCount = 0;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const socials = [settings.socialFacebook, settings.socialInstagram, settings.socialPinterest, settings.socialTikTok]
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const organizationJsonLd = buildOrganizationJsonLd({
    baseUrl: siteUrl,
    name: settings.storeName,
    description: settings.tagline || "Premium home & kitchen products for the modern lifestyle",
    email: settings.contactEmail,
    phone: settings.contactPhone,
    socials,
  });
  const websiteJsonLd = buildWebsiteJsonLd({ baseUrl: siteUrl, name: settings.storeName });

  return (
    <div className="flex min-h-screen flex-col">
      {/* Site-wide structured data (schema.org Organization + WebSite).
          Data blocks — CSP script-src does not apply to ld+json. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <StoreChrome user={user} cartCount={cartCount} />
      <main className="flex-1">{children}</main>
      <Footer
        settings={{
          storeName: settings.storeName,
          tagline: settings.tagline,
          contactEmail: settings.contactEmail,
          contactPhone: settings.contactPhone,
          address: settings.address,
          socialFacebook: settings.socialFacebook,
          socialInstagram: settings.socialInstagram,
          socialPinterest: settings.socialPinterest,
          socialTikTok: settings.socialTikTok,
        }}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
