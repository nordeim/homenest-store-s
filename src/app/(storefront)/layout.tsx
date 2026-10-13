import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";
import { getSettings } from "@/lib/settings";
import { buildOrganizationJsonLd, buildWebsiteJsonLd, jsonLdScript, siteBaseUrl } from "@/lib/seo";

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

  // Session-7 S7-4: shared base URL (same source as the canonicals).
  const siteUrl = siteBaseUrl();
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
    <div>
      {/* Site-wide structured data (schema.org Organization + WebSite).
          Data blocks — CSP script-src does not apply to ld+json. Serialized
          through jsonLdScript (session-7 S7-9): `<` and line separators are
          escaped so an admin-authored string can never terminate the element. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd) }}
      />
      {/* Session-16 S16-3: StoreChrome renders the page shell (header + nav +
          main + footer) so the whole background can be inert while the cart
          drawer — its aria-modal dialog — is open. Server-rendered nodes pass
          through the client component as props (main as children, footer as
          the `footer` prop). */}
      <StoreChrome
        user={user}
        cartCount={cartCount}
        footer={
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
        }
      >
        <main className="flex-1">{children}</main>
      </StoreChrome>
    </div>
  );
}

export const dynamic = "force-dynamic";
