import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Package, PackageSearch, RefreshCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Prisma } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { verifyOrderAccessToken } from "@/lib/order-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Confirmation",
  description: "Thank you for your HomeNest order.",
  // A buyer receipt must never become search-engine content.
  robots: { index: false, follow: false },
};

type OrderWithDetails = Prisma.OrderGetPayload<{
  include: { items: true; events: { orderBy: { createdAt: "asc" } } };
}>;

type AddressSnapshot = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/** Safe parse of the JSON address snapshot stored on the order. */
function parseAddressSnapshot(json: string): AddressSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    const str = (key: string): string => (typeof rec[key] === "string" ? (rec[key] as string) : "");
    if (!str("line1") || !str("city")) return null;
    return {
      fullName: str("fullName"),
      phone: str("phone"),
      line1: str("line1"),
      line2: str("line2"),
      city: str("city"),
      state: str("state"),
      postalCode: str("postalCode"),
      country: str("country"),
    };
  } catch {
    return null;
  }
}

function paymentLabel(order: OrderWithDetails): string {
  if (order.paymentMethod === "card") return `Card ending in ${order.cardLast4 ?? "0000"}`;
  if (order.paymentMethod === "paypal") return "PayPal";
  if (order.paymentMethod === "cod") return "Cash on Delivery";
  return order.paymentMethod;
}

const EVENT_ICONS: Record<string, LucideIcon> = {
  placed: CheckCircle2,
  status_changed: RefreshCcw,
  tracking_added: Package,
};

function eventLabel(type: string, status: string | null, note: string | null): string {
  if (note) return note;
  if (type === "status_changed" && status) return `Status updated to ${status}`;
  if (type === "tracking_added") return "Tracking information added";
  return "Order placed";
}

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const { order: orderParam, token: tokenParam } = await searchParams;
  const orderNumber = orderParam?.trim().toUpperCase() ?? "";
  const order = orderNumber
    ? await db.order.findUnique({
        where: { number: orderNumber },
        include: { items: true, events: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  // ACCESS CONTRACT: the receipt (email, address, spend) renders only for a
  // valid order+token pair — the token is minted by /api/checkout and rides
  // in the redirect URL. Order numbers are sequential, so any other
  // combination (missing/bad token, unknown number) renders the SAME shell:
  // an attacker cannot even observe whether a number exists (anti-enumeration).
  // Lost the link? /track-order recovers it with number + purchase email.
  if (!order || !verifyOrderAccessToken(order.number, tokenParam ?? "")) {
    return (
      <div className="container-page flex justify-center py-16 sm:py-24">
        <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary">
            <PackageSearch className="h-8 w-8" aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold">We couldn&apos;t find that order</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The order you&apos;re looking for doesn&apos;t exist. Double-check the link in your confirmation email.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/track-order">Track an Order</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/products">Continue Shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const address = parseAddressSnapshot(order.shippingAddress);

  return (
    <div className="container-page flex flex-col items-center py-14">
      {/* Animated confirmation badge */}
      <span
        className="flex h-20 w-20 animate-in items-center justify-center rounded-full bg-emerald-100 text-emerald-700 zoom-in-50 fade-in duration-700"
        aria-hidden
      >
        <CheckCircle2 className="h-10 w-10" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">Thank You For Your Order!</h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        Order <span className="font-semibold text-foreground">{order.number}</span> placed successfully. A
        confirmation email is on its way to <span className="font-medium text-foreground">{order.email}</span>.
      </p>

      {/* Order summary card */}
      <section
        aria-label="Order summary"
        className="mt-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 text-left shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Number</p>
            <p className="font-display text-lg font-bold">{order.number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Placed On</p>
            <p className="text-sm font-medium">{formatDateTime(order.placedAt)}</p>
          </div>
        </div>

        <ul className="divide-y divide-border" aria-label="Items in this order">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                <Image src={item.imageSnapshot} alt="" fill sizes="56px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium">{item.nameSnapshot}</span>
                <span className="text-xs text-muted-foreground">
                  {formatMoney(item.unitPrice)} × {item.quantity}
                </span>
              </span>
              <span className="text-sm font-bold">{formatMoney(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold">Shipping Address</p>
            {address ? (
              <p className="mt-1 text-muted-foreground">
                {address.fullName}
                <br />
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.country}
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">Address unavailable.</p>
            )}
          </div>
          <div>
            <p className="font-semibold">Payment</p>
            <p className="mt-1 text-muted-foreground">{paymentLabel(order)}</p>
            <p className="mt-1 capitalize text-muted-foreground">Shipping: {order.shippingMethod}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-semibold">{formatMoney(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex items-baseline justify-between text-emerald-700">
              <dt>Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
              <dd className="font-semibold">-{formatMoney(order.discount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="font-semibold">{order.shipping === 0 ? "FREE" : formatMoney(order.shipping)}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="font-semibold">{formatMoney(order.tax)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <dt className="font-bold">Total Paid</dt>
            <dd className="text-lg font-bold">{formatMoney(order.total)}</dd>
          </div>
        </dl>
      </section>

      {/* Order events timeline */}
      {order.events.length > 0 && (
        <section
          aria-label="Order history"
          className="mt-4 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 text-left shadow-sm"
        >
          <h2 className="font-display text-lg font-semibold">Order History</h2>
          <ol className="mt-4 space-y-3">
            {order.events.map((event) => {
              const Icon = EVENT_ICONS[event.type] ?? Package;
              return (
                <li key={event.id} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{eventLabel(event.type, event.status, event.note)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild className="h-11 px-7">
          {/* Prefill both tracking fields — the buyer just paid with this email. */}
          <Link
            href={`/track-order?number=${encodeURIComponent(order.number)}&email=${encodeURIComponent(order.email)}`}
          >
            Track Order
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-11 px-7">
          <Link href="/products">Continue Shopping</Link>
        </Button>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Need help?{" "}
        <Link href="/contact" className="underline underline-offset-2 hover:text-foreground">
          Contact our support team
        </Link>
        .
      </p>
    </div>
  );
}
