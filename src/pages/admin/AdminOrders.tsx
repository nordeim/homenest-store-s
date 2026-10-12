import { useMemo, useState } from "react";
import { useOrderStore, STATUS_FLOW } from "@/store/orderStore";
import { useToastStore } from "@/store/toastStore";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/types";

export function AdminOrders() {
  const orders = useOrderStore((s) => s.orders);
  const updateStatus = useOrderStore((s) => s.updateStatus);
  const push = useToastStore((s) => s.push);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [selected, setSelected] = useState<Order | null>(null);

  const filtered = useMemo(
    () => (statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter)),
    [orders, statusFilter],
  );

  function handleStatusChange(order: Order, status: OrderStatus) {
    updateStatus(order.id, status, `Status updated to ${status} by admin.`);
    push(`Order ${order.orderNumber} marked as ${status}`, "success");
    setSelected((prev) => (prev && prev.id === order.id ? { ...prev, status } : prev));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Orders</h1>
          <p className="text-sm text-ink-500">{orders.length} orders placed</p>
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")} className="w-auto min-w-[160px]">
          <option value="all">All Statuses</option>
          {[...STATUS_FLOW, "cancelled" as const].map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-cream-50">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <th className="p-4">Order</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Date</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Total</th>
              <th className="p-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.map((order) => (
              <tr key={order.id}>
                <td className="p-4 font-medium text-ink-900">{order.orderNumber}</td>
                <td className="p-4 text-ink-600">{order.customerName}</td>
                <td className="p-4 text-ink-500">{formatDateTime(order.createdAt)}</td>
                <td className="p-4">
                  <StatusPill status={order.status} />
                </td>
                <td className="p-4 text-right font-semibold text-ink-900">{formatCurrency(order.total)}</td>
                <td className="p-4 text-right">
                  <button onClick={() => setSelected(order)} className="text-sm font-semibold text-forest-800 hover:underline">
                    View
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ink-400">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.orderNumber} maxWidthClass="max-w-xl">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <StatusPill status={selected.status} />
              <Select
                value={selected.status}
                onChange={(e) => handleStatusChange(selected, e.target.value as OrderStatus)}
                className="w-auto min-w-[160px]"
              >
                {[...STATUS_FLOW, "cancelled" as const].map((s) => (
                  <option key={s} value={s}>
                    Mark as {s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="rounded-lg border border-ink-100 p-3 text-sm">
              <p className="font-semibold text-ink-900">{selected.customerName}</p>
              <p className="text-ink-600">{selected.email}</p>
              <p className="mt-1 text-ink-600">
                {selected.shippingAddress.line1}, {selected.shippingAddress.city}, {selected.shippingAddress.state}{" "}
                {selected.shippingAddress.postalCode}
              </p>
            </div>
            <div className="divide-y divide-ink-100 rounded-lg border border-ink-100">
              {selected.items.map((item) => (
                <div key={item.productId} className="flex justify-between p-3 text-sm">
                  <span className="text-ink-700">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium text-ink-900">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-base font-bold text-ink-900">
              <span>Total</span>
              <span>{formatCurrency(selected.total)}</span>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
