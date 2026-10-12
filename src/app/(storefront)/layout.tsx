import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";
import { getSettings } from "@/lib/settings";

import { StoreChrome } from "@/components/store/store-chrome";
import { Footer } from "@/components/store/footer";

/**
 * Storefront layout — server shell that resolves the session, cart count and
 * settings once, then renders the sticky header + mobile nav + footer chrome
 * around each page.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const settings = await getSettings();

  // Best-effort cart count (never blocks rendering).
  let cartCount = 0;
  try {
    const cartId = await findCartId(user?.id ?? null);
    const summary = await getCartSummary(cartId);
    cartCount = summary.itemCount;
  } catch {
    cartCount = 0;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <StoreChrome user={user} cartCount={cartCount} />
      <main className="flex-1">{children}</main>
      <Footer
        settings={{
          storeName: settings.storeName,
          tagline: settings.tagline,
          contactEmail: settings.contactEmail,
          contactPhone: settings.contactPhone,
          address: settings.address,
        }}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
