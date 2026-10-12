import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { LogOut, MapPin, Package, ShoppingBag, UserRound } from "lucide-react";

import { logoutAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, orderStatusBadgeClass } from "@/lib/format";
import { formatMoney } from "@/lib/money";

import { AddressDialog, DeleteAddressButton } from "./address-dialog";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your HomeNest Kitchen profile, orders, and saved addresses.",
};

// ---------------------------------------------------------------------------
// Account dashboard — session-guarded server component. Tabs are expressed
// as ?tab= links so every view is shareable and server-rendered.
// ---------------------------------------------------------------------------

const TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "orders", label: "Orders", icon: Package },
  { id: "addresses", label: "Addresses", icon: MapPin },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | undefined): value is TabId {
  return value === "profile" || value === "orders" || value === "addresses";
}

/** Loosely-typed view of the JSON shipping-address snapshot stored on Order. */
type AddressSnapshot = {
  fullName?: unknown;
  phone?: unknown;
  line1?: unknown;
  line2?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  country?: unknown;
};

function parseAddressSnapshot(raw: string): AddressSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AddressSnapshot;
    }
    return null;
  } catch {
    return null;
  }
}

function snapshotString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => (part.charAt(0) ?? "").toUpperCase()).join("");
  return letters || "H";
}

function tabHref(tab: TabId, page = 1): string {
  if (tab === "profile") return "/account";
  return page > 1 ? `/account?tab=${tab}&page=${page}` : `/account?tab=${tab}`;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { tab: tabParam, page: pageParam } = await searchParams;
  const tab: TabId = isTabId(tabParam) ? tabParam : "profile";
  // Honest pagination for order history (session-6 S6-9) — server-rendered
  // prev/next, real totals, no silent caps.
  const ORDER_PAGE_SIZE = 5;
  const parsedPage = Number.parseInt(pageParam ?? "1", 10);
  const ordersPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 1000) : 1;

  // Count first so an out-of-range ?page= snaps back to page 1 (the /products
  // snap-back contract) instead of rendering an empty list.
  const orderTotal = await db.order.count({ where: { userId: user.id } });
  const ordersPages = Math.max(1, Math.ceil(orderTotal / ORDER_PAGE_SIZE));
  const ordersPageSafe = Math.min(ordersPage, ordersPages);

  const [orders, addresses] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { placedAt: "desc" },
      include: { items: true, _count: { select: { items: true } } },
      skip: (ordersPageSafe - 1) * ORDER_PAGE_SIZE,
      take: ORDER_PAGE_SIZE,
    }),
    db.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="container-page flex flex-col gap-8 py-8 sm:py-10">
      {/* Header */}
      <header className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground"
        >
          {initials(user.name)}
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">My Account</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Welcome back, {firstName} — manage your profile, orders, and saved addresses.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <nav aria-label="Account sections" className="flex flex-col gap-6">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {TABS.map((t) => (
              <li key={t.id} className="shrink-0">
                <Link
                  href={tabHref(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" aria-hidden /> {t.label}
                </Link>
              </li>
            ))}
          </ul>

          <form action={logoutAction} className="border-t border-border pt-4">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign Out
            </button>
          </form>
        </nav>

        {/* Content */}
        <div>
          {tab === "profile" ? (
            <section aria-labelledby="account-profile-heading">
              <h2 id="account-profile-heading" className="sr-only">
                Profile settings
              </h2>
              <ProfileForm name={user.name} email={user.email} phone={user.phone} />
            </section>
          ) : null}

          {tab === "orders" ? (
            <OrdersSection
              orders={orders}
              pagination={{ page: ordersPageSafe, totalPages: ordersPages, hrefFor: (p) => tabHref("orders", p) }}
            />
          ) : null}

          {tab === "addresses" ? (
            <section aria-labelledby="account-addresses-heading" className="flex flex-col gap-5">
              <h2 id="account-addresses-heading" className="sr-only">
                Saved addresses
              </h2>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {addresses.length === 1 ? "1 saved address" : `${addresses.length} saved addresses`}
                </p>
                <AddressDialog />
              </div>

              {addresses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                    <MapPin className="h-6 w-6" aria-hidden />
                  </span>
                  <p className="mt-3 font-semibold">No saved addresses yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Add an address once and check out in seconds on every future order.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {addresses.map((addr) => (
                    <li
                      key={addr.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                            {addr.label}
                          </span>
                          {addr.isDefault ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 font-semibold">{addr.fullName}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {addr.line1}
                          {addr.line2 ? `, ${addr.line2}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {addr.city}, {addr.state} {addr.postalCode}, {addr.country}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{addr.phone}</p>
                      </div>
                      <div className="flex justify-end border-t border-border pt-3">
                        <DeleteAddressButton addressId={addr.id} label={addr.label} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders tab — order cards with an expandable <details> per order.
// ---------------------------------------------------------------------------

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true; _count: { select: { items: true } } };
}>;

function OrdersSection({
  orders,
  pagination,
}: {
  orders: OrderWithItems[];
  pagination: { page: number; totalPages: number; hrefFor: (page: number) => string };
}) {
  if (orders.length === 0) {
    return (
      <section aria-labelledby="account-orders-heading">
        <h2 id="account-orders-heading" className="sr-only">
          Order history
        </h2>
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
            <Package className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 font-semibold">No orders yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            When you place an order, it will appear here with live status updates and receipts.
          </p>
          <Link
            href="/products"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden /> Start Shopping
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="account-orders-heading" className="flex flex-col gap-4">
      <h2 id="account-orders-heading" className="sr-only">
        Order history
      </h2>
      {orders.map((order) => {
        const snapshot = parseAddressSnapshot(order.shippingAddress);
        return (
          <article key={order.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{order.number}</p>
                <p className="text-xs text-muted-foreground">Placed {formatDate(order.placedAt)}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${orderStatusBadgeClass(
                  order.status,
                )}`}
              >
                {order.status}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {order._count.items} {order._count.items === 1 ? "item" : "items"}
              </p>
              <p className="font-semibold">{formatMoney(order.total)}</p>
            </div>

            <details className="group mt-3 border-t border-border pt-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline [&::-webkit-details-marker]:hidden">
                View details
              </summary>

              <ul className="mt-4 space-y-3">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                      {item.imageSnapshot ? (
                        // eslint-disable-next-line @next/next/no-img-element -- snapshot may be any stored path/URL; thumbnails are display-only
                        <img
                          src={item.imageSnapshot}
                          alt=""
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-secondary-foreground">
                          <Package className="h-5 w-5" aria-hidden />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.nameSnapshot}
                        {item.variantLabel ? (
                          <span className="font-normal text-muted-foreground"> — {item.variantLabel}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity} × {formatMoney(item.unitPrice)}
                      </p>
                    </div>
                    <p className="text-sm font-medium">{formatMoney(item.unitPrice * item.quantity)}</p>
                  </li>
                ))}
              </ul>

              <dl className="mt-4 space-y-1 rounded-lg bg-secondary/60 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatMoney(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd>{order.shipping === 0 ? "Free" : formatMoney(order.shipping)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd>{formatMoney(order.tax)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-1 font-semibold">
                  <dt>Total</dt>
                  <dd>{formatMoney(order.total)}</dd>
                </div>
              </dl>

              {snapshot ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Shipping address
                  </p>
                  <p className="mt-1 text-sm">{snapshotString(snapshot.fullName)}</p>
                  <p className="text-sm text-muted-foreground">
                    {snapshotString(snapshot.line1)}
                    {snapshotString(snapshot.line2) ? `, ${snapshotString(snapshot.line2)}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {snapshotString(snapshot.city)}, {snapshotString(snapshot.state)}{" "}
                    {snapshotString(snapshot.postalCode)}, {snapshotString(snapshot.country) || "United States"}
                  </p>
                  {snapshotString(snapshot.phone) ? (
                    <p className="text-sm text-muted-foreground">{snapshotString(snapshot.phone)}</p>
                  ) : null}
                </div>
              ) : null}
            </details>
          </article>
        );
      })}
      {pagination.totalPages > 1 && (
        <nav aria-label="Order pages" className="flex items-center gap-3 text-sm">
          {pagination.page > 1 ? (
            <Link
              href={pagination.hrefFor(pagination.page - 1)}
              className="rounded-lg border border-border px-3 py-1.5 transition-colors hover:bg-secondary"
            >
              Previous
            </Link>
          ) : (
            <span aria-disabled className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground/50">
              Previous
            </span>
          )}
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          {pagination.page < pagination.totalPages ? (
            <Link
              href={pagination.hrefFor(pagination.page + 1)}
              className="rounded-lg border border-border px-3 py-1.5 transition-colors hover:bg-secondary"
            >
              Next
            </Link>
          ) : (
            <span aria-disabled className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground/50">
              Next
            </span>
          )}
        </nav>
      )}
    </section>
  );
}
