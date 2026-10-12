import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useOrderStore } from "@/store/orderStore";
import { useCatalogStore } from "@/store/catalogStore";
import { formatCurrency } from "@/lib/format";

const COLORS = ["#396653", "#d85f2b", "#6fa287", "#efa074", "#8b8276", "#2d5243"];

export function AdminAnalytics() {
  const orders = useOrderStore((s) => s.orders);
  const products = useCatalogStore((s) => s.products);
  const categories = useCatalogStore((s) => s.categories);

  const topProducts = useMemo(() => {
    const counts = new Map<string, { name: string; qty: number; revenue: number }>();
    orders.forEach((order) =>
      order.items.forEach((item) => {
        const entry = counts.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0 };
        entry.qty += item.quantity;
        entry.revenue += item.price * item.quantity;
        counts.set(item.productId, entry);
      }),
    );
    return Array.from(counts.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [orders]);

  const categoryBreakdown = useMemo(() => {
    return categories
      .map((cat) => ({
        name: cat.name,
        value: products.filter((p) => p.categorySlug === cat.slug).length,
      }))
      .filter((c) => c.value > 0);
  }, [categories, products]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Analytics</h1>
        <p className="text-sm text-ink-500">Product and revenue performance across your catalog.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-200 bg-cream-50 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Top Products by Revenue</h2>
          <div className="mt-4 h-72">
            {topProducts.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-ink-400">
                No sales data yet — place a test order to see analytics.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ece8e2" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                  <Bar dataKey="revenue" fill="#396653" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-cream-50 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Catalog Mix by Category</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-cream-50 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Conversion Snapshot</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Sessions (30d)", value: "18,240" },
            { label: "Add-to-Cart Rate", value: "12.4%" },
            { label: "Checkout Conversion", value: "3.1%" },
            { label: "Returning Customers", value: "27%" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-ink-50 p-4">
              <p className="text-xs text-ink-500">{item.label}</p>
              <p className="mt-1 text-xl font-bold text-ink-900">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Traffic metrics are illustrative placeholders pending analytics integration.
        </p>
      </div>
    </div>
  );
}
