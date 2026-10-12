import type { Metadata } from "next";
import Image from "next/image";
import { AlertCircle, Check, XCircle } from "lucide-react";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { formatDateTime, orderStatusBadgeClass, statusStepIndex } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Enter your HomeNest order number to see live status and shipment history.",
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

const STATUS_STEPS = ["pending", "processing", "shipped", "delivered"] as const;
const STATUS_LABELS: Record<(typeof STATUS_STEPS)[number], string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
};

/** Latest event carrying a given status (events are ordered oldest-first). */
function eventForStatus(events: OrderWithDetails["events"], status: string) {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event && event.status === status) return event;
  }
  return null;
}

export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string }>;
}) {
  const { number: numberParam } = await searchParams;
  const raw = numberParam?.trim() ?? "";
  const number = raw.toUpperCase();
  const order = number
    ? await db.order.findUnique({
        where: { number },
        include: { items: true, events: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <h1 className="font-display text-3xl font-bold">Track Your Order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the order number from your confirmation email to see live status and shipment history.
        </p>

        <form action="/track-order" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="order-number" className="sr-only">
            Order number
          </label>
          <input
            id="order-number"
            name="number"
            defaultValue={raw}
            placeholder="ORD-2026-001"
            autoComplete="off"
            className="h-11 flex-1 rounded-lg border border-input bg-card px-4 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Track Order
          </button>
        </form>

        {number && !order && (
          <div
            role="alert"
            className="mt-8 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p>We couldn&apos;t find an order with that number. Please check and try again.</p>
          </div>
        )}

        {order && <TrackResult order={order} />}
      </div>
    </div>
  );
}

function TrackResult({ order }: { order: OrderWithDetails }) {
  const cancelled = order.status === "cancelled";
  const currentIdx = statusStepIndex(order.status);
  const address = parseAddressSnapshot(order.shippingAddress);

  return (
    <div className="mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
          <p className="font-display text-xl font-bold">{order.number}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold capitalize", orderStatusBadgeClass(order.status))}>
          {order.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Placed {formatDateTime(order.placedAt)} · {order.email}
      </p>

      {cancelled ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>This order was cancelled. Contact our support team if you believe this is a mistake.</p>
        </div>
      ) : (
        <nav aria-label="Order progress">
          <ol className="mt-8 flex items-start">
            {STATUS_STEPS.map((status, i) => {
              const done = i < currentIdx;
              const current = i === currentIdx;
              const event = eventForStatus(order.events, status);
              const when = event
                ? formatDateTime(event.createdAt)
                : i === 0
                  ? formatDateTime(order.placedAt)
                  : "";
              return (
                <li key={status} className={cn("flex items-start", i < STATUS_STEPS.length - 1 && "flex-1")}>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <span
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
                        done && "bg-primary text-primary-foreground",
                        current && "animate-pulse border-2 border-primary bg-card text-primary",
                        !done && !current && "bg-secondary text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        i <= currentIdx ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                    {when && <span className="text-[11px] text-muted-foreground">{when}</span>}
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={cn("mx-2 mt-4 h-0.5 flex-1 rounded", i < currentIdx ? "bg-primary" : "bg-border")}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <ul className="mt-8 divide-y divide-border rounded-xl border border-border" aria-label="Items in this order">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 p-3">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
              <Image src={item.imageSnapshot} alt="" fill sizes="48px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-medium">{item.nameSnapshot}</span>
              <span className="text-xs text-muted-foreground">Qty {item.quantity}</span>
            </span>
            <span className="text-sm font-semibold">{formatMoney(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
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
              <br />
              {address.phone}
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground">Address unavailable.</p>
          )}
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="font-semibold">Order Total</p>
          <dl className="mt-1 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-medium">{formatMoney(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex items-baseline justify-between text-emerald-700">
                <dt>Discount</dt>
                <dd className="font-medium">-{formatMoney(order.discount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="font-medium">{order.shipping === 0 ? "FREE" : formatMoney(order.shipping)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="font-medium">{formatMoney(order.tax)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-1.5">
              <dt className="font-bold">Total</dt>
              <dd className="font-display text-lg font-bold">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
