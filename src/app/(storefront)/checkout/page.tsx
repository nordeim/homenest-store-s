import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { findCartId, getCartSummary } from "@/lib/cart";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

import { CheckoutClient, type CheckoutAddress } from "./checkout-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your HomeNest order — shipping, payment and review.",
  // Session-8 S8-9: per-visitor private content — noindex like checkout/success.
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const cartId = await findCartId(user?.id ?? null);
  const summary = await getCartSummary(cartId);
  if (summary.lines.length === 0) {
    redirect("/cart");
  }

  const [settings, defaultAddress] = await Promise.all([
    getSettings(),
    user
      ? db.address.findFirst({ where: { userId: user.id, isDefault: true } })
      : Promise.resolve(null),
  ]);

  const address: CheckoutAddress | null = defaultAddress
    ? {
        fullName: defaultAddress.fullName,
        phone: defaultAddress.phone,
        line1: defaultAddress.line1,
        line2: defaultAddress.line2 ?? "",
        city: defaultAddress.city,
        state: defaultAddress.state,
        postalCode: defaultAddress.postalCode,
        country: defaultAddress.country,
      }
    : null;

  return (
    <CheckoutClient
      lines={summary.lines}
      subtotal={summary.subtotal}
      user={user ? { name: user.name, email: user.email, phone: user.phone } : null}
      defaultAddress={address}
      shipping={{
        standardCents: settings.standardShippingCents,
        expressCents: settings.expressShippingCents,
        freeThresholdCents: settings.freeShippingThresholdCents,
        taxRatePercent: settings.taxRatePercent,
      }}
    />
  );
}
