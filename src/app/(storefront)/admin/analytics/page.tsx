import type { Metadata } from "next";
import { ArrowRightLeft, Package, ReceiptText, Wallet } from "lucide-react";

import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

import { CategoryMixChart, StatusRevenueChart, TopProductsChart } from "./charts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Analytics" };

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#f59e0b" },
  processing: { label: "Processing", color: "#3b82f6" },
  shipped: { label: "Shipped", color: "#8b5cf6" },
  delivered: { label: "Delivered", color: "#10b981" },
  cancelled: { label: "Cancelled", color: "#ef4444" },
};

function truncateLabel(name: string, max = 22): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export default async function AdminAnalyticsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [revenueAgg, nonCancelledCount, customers, monthAgg, orderItems, statusGroups] = await Promise.all([
    db.order.aggregate({ _sum: { total: true }, where: { status: { not: "cancelled" } } }),
    db.order.count({ where: { status: { not: "cancelled" } } }),
    db.user.count({ where: { role: "customer" } }),
    db.order.aggregate({
      _sum: { total: true },
      where: { status: { not: "cancelled" }, placedAt: { gte: monthStart } },
    }),
    db.orderItem.findMany({
      where: { order: { status: { not: "cancelled" } } },
      include: { product: { include: { category: { select: { name: true } } } } },
    }),
    db.order.groupBy({ by: ["status"], _sum: { total: true }, _count: { _all: true } }),
  ]);

  const totalRevenue = revenueAgg._sum.total ?? 0;
  const monthRevenue = monthAgg._sum.total ?? 0;
  const unitsSold = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const conversionProxy =
    customers === 0 ? null : nonCancelledCount / customers; // orders per registered customer

  // Top products by revenue (aggregate order items in JS).
  const byProduct = new Map<string, { name: string; revenue: number }>();
  const byCategory = new Map<string, number>();
  for (const item of orderItems) {
    const key = item.productId ?? item.nameSnapshot;
    const entry = byProduct.get(key) ?? { name: item.product?.name ?? item.nameSnapshot, revenue: 0 };
    entry.revenue += item.unitPrice * item.quantity;
    byProduct.set(key, entry);

    const categoryName = item.product?.category?.name ?? "Uncategorized";
    byCategory.set(categoryName, (byCategory.get(categoryName) ?? 0) + item.unitPrice * item.quantity);
  }
  const topProducts = [...byProduct.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((entry) => ({ name: truncateLabel(entry.name), revenue: entry.revenue }));

  const categoryMix = [...byCategory.entries()]
    .map(([name, value]) => ({ name: truncateLabel(name, 18), value }))
    .sort((a, b) => b.value - a.value);

  const statusData = statusGroups
    .map((group) => ({
      name: STATUS_META[group.status]?.label ?? group.status,
      value: group._sum.total ?? 0,
      color: STATUS_META[group.status]?.color ?? "#a8a29e",
    }))
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);

  const kpis: { label: string; value: string; hint: string; icon: typeof Wallet }[] = [
    {
      label: "Avg Order Value",
      value: nonCancelledCount === 0 ? "$0.00" : formatMoney(Math.round(totalRevenue / nonCancelledCount)),
      hint: `${nonCancelledCount} non-cancelled orders`,
      icon: ReceiptText,
    },
    {
      label: "Conversion Proxy",
      value: conversionProxy === null ? "—" : `${conversionProxy.toFixed(1)}×`,
      hint: "Orders per registered customer",
      icon: ArrowRightLeft,
    },
    {
      label: "Units Sold",
      value: unitsSold.toLocaleString("en-US"),
      hint: "Across all non-cancelled orders",
      icon: Package,
    },
    {
      label: "Revenue This Month",
      value: formatMoney(monthRevenue),
      hint: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Product and revenue performance across your catalog (cancelled orders excluded).
        </p>
      </header>

      {/* KPI row */}
      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                <kpi.icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
          </div>
        ))}
      </section>

      {/* Charts */}
      <section
        aria-labelledby="top-products-heading"
        className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
      >
        <h2 id="top-products-heading" className="text-sm font-semibold">
          Top Products by Revenue
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Best sellers, ranked by gross revenue.</p>
        <div className="mt-4">
          <TopProductsChart data={topProducts} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="category-mix-heading"
          className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
        >
          <h2 id="category-mix-heading" className="text-sm font-semibold">
            Revenue by Category
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Where the revenue comes from.</p>
          <div className="mt-4">
            <CategoryMixChart data={categoryMix} />
          </div>
        </section>

        <section
          aria-labelledby="status-revenue-heading"
          className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
        >
          <h2 id="status-revenue-heading" className="text-sm font-semibold">
            Revenue by Order Status
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Order value distribution across the pipeline.</p>
          <div className="mt-4">
            <StatusRevenueChart data={statusData} />
          </div>
        </section>
      </div>
    </div>
  );
}
