import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/lib/db";
import { paymentFailureReasonView, paymentOutcomeView } from "@/lib/admin-payments";
import { clampSearchTerm } from "@/lib/validation";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Payments" };

const PER_PAGE = 20;

/** First scalar of a possibly-repeated query param. */
function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * The Stripe payments ledger (the Stripe retrofit, PAY-OPS family — ported
 * from the reference implementation, compacted): every webhook delivery the
 * StripeEvent table recorded, newest first, with the honest outcome
 * derivation (a succeeded event with no linked order is the refund-needed
 * signal — the deterministic-failure family the webhook records + 200s) and
 * the failure-reason enrichment.
 *
 * The q search matches the two identifiers an operator relays from the
 * Stripe dashboard: the payment intent id and the event id.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = clampSearchTerm(firstParam(params.q));
  const page = Math.max(1, Number.parseInt(firstParam(params.page) || "1", 10) || 1);

  const where = q
    ? { OR: [{ paymentIntentId: { contains: q } }, { eventId: { contains: q } }] }
    : {};

  const [total, events] = await Promise.all([
    db.stripeEvent.count({ where }),
    db.stripeEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  // Resolve the linked orders for the page's intent ids (the outcome
  // derivation's input — derived from DB state, never from the event).
  const intentIds = [
    ...new Set(events.map((e) => e.paymentIntentId).filter((id): id is string => id !== null)),
  ];
  const linked = intentIds.length
    ? await db.order.findMany({
        where: { stripePaymentIntentId: { in: intentIds } },
        select: { number: true, stripePaymentIntentId: true },
      })
    : [];
  const orderByIntent = new Map(linked.map((o) => [o.stripePaymentIntentId, o.number]));

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <header>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} Stripe event{total === 1 ? "" : "s"}
            {q ? ` · matching “${q}”` : ""}
          </p>
        </header>
      </div>

      {/* Search */}
      <form action="/admin/payments" method="get" className="flex max-w-md gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search intent or event id…"
          aria-label="Search payments"
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
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">Event</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Intent</th>
              <th scope="col" className="px-4 py-3 font-medium">Amount</th>
              <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
              <th scope="col" className="px-4 py-3 font-medium">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((event) => {
              const linkedNumber = event.paymentIntentId
                ? (orderByIntent.get(event.paymentIntentId) ?? null)
                : null;
              const outcome = paymentOutcomeView(event, linkedNumber);
              const reason = paymentFailureReasonView(event.failureReason);
              return (
                <tr key={event.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3 font-mono text-[13px] text-muted-foreground">{event.eventId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{event.type}</td>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {event.paymentIntentId ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {event.amount !== null ? formatMoney(event.amount) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        outcome.refundNeeded
                          ? "bg-amber-100 text-amber-700"
                          : linkedNumber
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {outcome.label}
                    </span>
                    {reason.visible && (
                      <p className="mt-1 text-xs text-muted-foreground">{reason.label}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(event.receivedAt)}</td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-muted-foreground">
                  {total === 0 && !q
                    ? "No Stripe events recorded yet."
                    : "No events match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Payments pagination" className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/admin/payments?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}
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
                href={`/admin/payments?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}
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
