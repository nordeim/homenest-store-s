import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/lib/db";
import { refundEligibility } from "@/lib/admin-payments";
import { ORDER_STATUSES, clampSearchTerm } from "@/lib/validation";
import { formatDate, orderStatusBadgeClass } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import { OrderManageButton, type OrderManageData } from "./order-manage-dialog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Orders" };

const PER_PAGE = 10;

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** First scalar of a possibly-repeated query param. */
function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function ordersUrl(params: { q: string; status: string; page: number }): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}

/** Parse the JSON address snapshot captured at checkout into display lines. */
function parseAddressSnapshot(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const get = (key: string): string => (typeof record[key] === "string" ? (record[key] as string) : "");
      return [
        [get("fullName"), get("phone")].filter(Boolean).join(" · "),
        get("line1"),
        get("line2"),
        [get("city"), get("state"), get("postalCode")].filter(Boolean).join(", "),
        get("country"),
      ].filter(Boolean);
    }
  } catch {
    // fall through to raw snapshot
  }
  return [json];
}

function paymentLabel(method: string, cardLast4: string | null, paymentStatus: string | null): string {
  // The Stripe path (PAY-STRIPE-1): a captured intent renders its paid
  // state beside the method.
  const status =
    paymentStatus === "paid" ? " — paid" : paymentStatus === "refunded" ? " — refunded" : "";
  switch (method) {
    case "card":
      return `${cardLast4 ? `Card ending in ${cardLast4}` : "Card"}${status}`;
    case "paypal":
      return "PayPal";
    case "cod":
      return "Cash on delivery";
    default:
      return method;
  }
}

function statusPillClass(status: string): string {
  return cn(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
    orderStatusBadgeClass(status),
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = clampSearchTerm(firstParam(params.q));
  const statusRaw = firstParam(params.status);
  const status: string = (ORDER_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "all";
  const page = Math.max(1, Number.parseInt(firstParam(params.page) || "1", 10) || 1);

  const where = {
    status: status === "all" ? undefined : status,
    OR: q
      ? [{ number: { contains: q } }, { customerName: { contains: q } }, { email: { contains: q } }]
      : undefined,
  };

  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      include: {
        items: true,
        events: { orderBy: { createdAt: "asc" } },
      },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const rows = orders.map((order) => {
    const data: OrderManageData = {
      id: order.id,
      number: order.number,
      status: order.status,
      customerName: order.customerName,
      email: order.email,
      addressLines: parseAddressSnapshot(order.shippingAddress),
      paymentLabel: paymentLabel(order.paymentMethod, order.cardLast4, order.paymentStatus),
      paymentStatus: order.paymentStatus,
      refundEligible: refundEligibility(order).eligible,
      couponCode: order.couponCode,
      subtotal: order.subtotal,
      shipping: order.shipping,
      tax: order.tax,
      discount: order.discount,
      total: order.total,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.nameSnapshot,
        image: item.imageSnapshot,
        variantLabel: item.variantLabel,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
      events: order.events.map((event) => ({
        id: event.id,
        type: event.type,
        status: event.status,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
    };
    return { order, data };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <header>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} order{total === 1 ? "" : "s"}
            {status !== "all" ? ` · ${STATUS_LABELS[status] ?? status}` : ""}
            {q ? ` · matching “${q}”` : ""}
          </p>
        </header>
      </div>

      {/* Status filter pills */}
      <nav aria-label="Filter orders by status" className="flex flex-wrap gap-2">
        {(["all", ...ORDER_STATUSES] as const).map((value) => {
          const active = status === value;
          return (
            <Link
              key={value}
              href={ordersUrl({ q, status: value, page: 1 })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white"
                  : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {STATUS_LABELS[value] ?? value}
            </Link>
          );
        })}
      </nav>

      {/* Search */}
      <form action="/admin/orders" method="get" className="flex max-w-md gap-2" role="search">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search order number, customer, or email…"
          aria-label="Search orders"
          className="h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <button
          type="submit"
          className="inline-flex h-10 shrink-0 items-center rounded-lg border border-primary/30 px-4 text-sm font-semibold text-primary transition-colors hover:bg-accent"
        >
          Search
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">Order</th>
              <th scope="col" className="px-4 py-3 font-medium">Date</th>
              <th scope="col" className="px-4 py-3 font-medium">Customer</th>
              <th scope="col" className="px-4 py-3 font-medium">Items</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Total</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ order, data }) => (
              <tr key={order.id} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-3 font-mono text-[13px] font-bold">{order.number}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(order.placedAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.email}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{data.items.length}</td>
                <td className="px-4 py-3">
                  <span className={statusPillClass(order.status)}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">{formatMoney(order.total)}</td>
                <td className="px-4 py-3 text-right">
                  <OrderManageButton order={data} />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                  {total === 0 && !q && status === "all"
                    ? "No orders yet."
                    : "No orders match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Orders pagination" className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={ordersUrl({ q, status, page: page - 1 })}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                ← Prev
              </Link>
            ) : (
              <span
                aria-disabled
                className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground/50"
              >
                ← Prev
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={ordersUrl({ q, status, page: page + 1 })}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                Next →
              </Link>
            ) : (
              <span
                aria-disabled
                className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground/50"
              >
                Next →
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
