import { Link } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { DollarSign, Package, ShoppingCart, Users } from "lucide-react";
import { useOrderStore } from "@/store/orderStore";
import { useCatalogStore } from "@/store/catalogStore";
import { useAuthStore } from "@/store/authStore";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatCurrency, formatDate } from "@/lib/format";

function lastNDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
}

export function AdminDashboard() {
  const orders = useOrderStore((s) => s.orders);
  const products = useCatalogStore((s) => s.products);
  const users = useAuthStore((s) => s.users);

  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderValue = orders.length ? revenue / orders.length : 0;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 10).length;

  const chartData = lastNDays(14).map((d) => {
    const key = d.toDateString();
    const dayRevenue = orders
      .filter((o) => new Date(o.createdAt).toDateString() === key)
      .reduce((sum, o) => sum + o.total, 0);
    return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), revenue: dayRevenue };
  });

  const kpis = [
    { label: "Total Revenue", value: formatCurrency(revenue), icon: DollarSign },
    { label: "Orders", value: orders.length.toLocaleString(), icon: ShoppingCart },
    { label: "Avg. Order Value", value: formatCurrency(avgOrderValue), icon: Package },
    { label: "Registered Customers", value: users.filter((u) => u.role === "customer").length.toLocaleString(), icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-500">A snapshot of how your store is performing.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-ink-200 bg-cream-50 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-500">{kpi.label}</p>
              <kpi.icon size={18} className="text-forest-700" />
            </div>
            <p className="mt-2 text-2xl font-bold text-ink-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {lowStock > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {lowStock} product{lowStock > 1 ? "s are" : " is"} running low on stock.{" "}
          <Link to="/admin/products" className="font-semibold underline">
            Review inventory
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-ink-200 bg-cream-50 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Revenue — Last 14 Days</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#396653" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#396653" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ece8e2" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
              <Area type="monotone" dataKey="revenue" stroke="#396653" fill="url(#revenueFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-cream-50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Recent Orders</h2>
          <Link to="/admin/orders" className="text-xs font-semibold text-forest-800 hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                <th className="pb-2">Order</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.slice(0, 6).map((o) => (
                <tr key={o.id}>
                  <td className="py-2.5 font-medium text-ink-900">{o.orderNumber}</td>
                  <td className="py-2.5 text-ink-600">{o.customerName}</td>
                  <td className="py-2.5 text-ink-500">{formatDate(o.createdAt)}</td>
                  <td className="py-2.5">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="py-2.5 text-right font-semibold text-ink-900">{formatCurrency(o.total)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-400">
                    No orders placed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
