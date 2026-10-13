import type { Metadata } from "next";
import Link from "next/link";
import { DollarSign, Package, ShoppingBag, TriangleAlert, Users } from "lucide-react";

import { db } from "@/lib/db";
import { buildRevenueChart, type RevenueDayRow } from "@/lib/analytics";
import { orderStatusBadgeClass } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import { RevenueChart, type RevenuePoint } from "./revenue-chart";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Dashboard" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function statusPillClass(status: string): string {
  return cn(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
    orderStatusBadgeClass(status),
  );
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  // The chart window starts at UTC midnight 13 days ago — the SQL buckets
  // below are UTC days, so the bound must line up with them.
  const chartStart = new Date(now);
  chartStart.setUTCDate(chartStart.getUTCDate() - 13);
  chartStart.setUTCHours(0, 0, 0, 0);

  const [revenueAgg, orderCount, weekOrderCount, activeProducts, totalProducts, customers, recentOrders, lowStock, revenueBuckets] =
    await Promise.all([
      db.order.aggregate({ _sum: { total: true }, where: { status: { not: "cancelled" } } }),
      db.order.count(),
      db.order.count({ where: { placedAt: { gte: weekStart } } }),
      db.product.count({ where: { isActive: true } }),
      db.product.count(),
      db.user.count({ where: { role: "customer" } }),
      db.order.findMany({
        orderBy: { placedAt: "desc" },
        take: 8,
        include: { _count: { select: { items: true } } },
      }),
      db.product.findMany({
        where: { stock: { lt: 10 } },
        orderBy: [{ stock: "asc" }, { name: "asc" }],
        include: { category: { select: { name: true } } },
      }),
      // Bounded in SQL (session-9 S9-4): one SUM row per UTC day instead of
      // every order in the window. Prisma stores SQLite DateTimes as
      // epoch-millis INTEGERs — the bare date(placedAt) form returns NULL,
      // the /1000,'unixepoch' form is required.
      db.$queryRaw<RevenueDayRow[]>`
        SELECT date(placedAt / 1000, 'unixepoch') AS day, SUM(total) AS revenue
        FROM "Order"
        WHERE status != 'cancelled' AND placedAt >= ${chartStart}
        GROUP BY date(placedAt / 1000, 'unixepoch')
      `,
    ]);

  // Fold the bounded day buckets into the fixed 14-point chart (pure,
  // unit-pinned in tests/unit/analytics.test.ts).
  const chartData: RevenuePoint[] = buildRevenueChart(revenueBuckets, now);

  const totalRevenue = revenueAgg._sum.total ?? 0;
  const archivedCount = Math.max(0, totalProducts - activeProducts);

  const kpis: { label: string; value: string; hint: string; icon: typeof DollarSign }[] = [
    { label: "Total Revenue", value: formatMoney(totalRevenue), hint: "Excludes cancelled orders", icon: DollarSign },
    { label: "Orders", value: orderCount.toLocaleString("en-US"), hint: `+${weekOrderCount} this week`, icon: ShoppingBag },
    { label: "Active Products", value: activeProducts.toLocaleString("en-US"), hint: `${archivedCount} archived`, icon: Package },
    { label: "Customers", value: customers.toLocaleString("en-US"), hint: "Registered accounts", icon: Users },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">A snapshot of how your store is performing.</p>
      </header>

      {/* KPI cards */}
      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                <kpi.icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
          </div>
        ))}
      </section>

      {/* Revenue chart */}
      <section aria-labelledby="revenue-heading" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 id="revenue-heading" className="text-sm font-semibold">
          Revenue — Last 14 Days
        </h2>
        <div className="mt-4">
          <RevenueChart data={chartData} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent orders */}
        <section aria-labelledby="recent-orders-heading" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-orders-heading" className="text-sm font-semibold">
              Recent Orders
            </h2>
            <Link href="/admin/orders" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="pb-2 pr-3 font-medium">Order</th>
                  <th scope="col" className="pb-2 pr-3 font-medium">Customer</th>
                  <th scope="col" className="pb-2 pr-3 font-medium">Items</th>
                  <th scope="col" className="pb-2 pr-3 font-medium">Status</th>
                  <th scope="col" className="pb-2 pr-3 font-medium">Date</th>
                  <th scope="col" className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-accent/40">
                    <td className="py-2.5 pr-3 font-semibold">
                      <Link
                        href={`/admin/orders?q=${encodeURIComponent(order.number)}`}
                        className="rounded font-mono text-[13px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {order.number}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">{order.customerName}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{order._count.items}</td>
                    <td className="py-2.5 pr-3">
                      <span className={statusPillClass(order.status)}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {order.placedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="py-2.5 text-right font-semibold">{formatMoney(order.total)}</td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Low stock */}
        <section aria-labelledby="low-stock-heading" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 id="low-stock-heading" className="text-sm font-semibold">
            Low Stock
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Products with fewer than 10 units left.</p>
          <ul className="mt-4 space-y-3">
            {lowStock.map((product) => (
              <li key={product.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <TriangleAlert className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.stock === 0 ? (
                      <span className="font-semibold text-red-600">Out of stock</span>
                    ) : (
                      <span className="font-semibold text-amber-600">{product.stock} left</span>
                    )}
                    {" · "}
                    {product.category.name}
                  </p>
                </div>
              </li>
            ))}
            {lowStock.length === 0 && (
              <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                All stocked up — nothing below 10 units.
              </li>
            )}
          </ul>
          {lowStock.length > 0 && (
            <Link
              href="/admin/products"
              className="mt-4 inline-flex h-9 items-center rounded-lg border border-primary/30 px-4 text-xs font-semibold text-primary transition-colors hover:bg-accent"
            >
              Review inventory
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
