import { Link, Navigate, useParams } from "react-router-dom";
import { CheckCircle2, Package } from "lucide-react";
import { useOrderStore } from "@/store/orderStore";
import { LinkButton } from "@/components/ui/Button";
import { formatCurrency, formatDateTime } from "@/lib/format";

export function OrderSuccess() {
  const { orderNumber } = useParams();
  const order = useOrderStore((s) => (orderNumber ? s.getById(orderNumber) : undefined));

  if (!order) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-forest-100 text-forest-700">
        <CheckCircle2 size={32} />
      </div>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink-900">Thank you for your order!</h1>
      <p className="mt-2 text-ink-500">
        A confirmation has been sent to <span className="font-medium text-ink-800">{order.email}</span>.
      </p>

      <div className="mt-8 rounded-2xl border border-ink-100 bg-cream-50 p-6 text-left">
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Order Number</p>
            <p className="text-lg font-semibold text-ink-900">{order.orderNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-400">Placed On</p>
            <p className="text-sm font-medium text-ink-800">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="divide-y divide-ink-100">
          {order.items.map((item) => (
            <div key={item.productId} className="flex items-center gap-3 py-3">
              <img src={item.image} alt={item.name} className="h-14 w-14 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-900">{item.name}</p>
                <p className="text-xs text-ink-400">Qty {item.quantity}</p>
              </div>
              <p className="text-sm font-semibold text-ink-900">
                {formatCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between border-t border-ink-100 pt-4 text-base font-bold text-ink-900">
          <span>Total Paid</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <LinkButton to={`/order-tracking?order=${order.orderNumber}`} variant="outline">
          <Package size={16} /> Track This Order
        </LinkButton>
        <LinkButton to="/products">Continue Shopping</LinkButton>
      </div>
      <p className="mt-6 text-xs text-ink-400">
        Need help? <Link to="/contact" className="underline">Contact our support team</Link>.
      </p>
    </div>
  );
}
