import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleDashed, PackageSearch } from "lucide-react";
import { useOrderStore, STATUS_FLOW } from "@/store/orderStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/utils/cn";
import type { Order } from "@/types";

export function OrderTracking() {
  const [params] = useSearchParams();
  const getById = useOrderStore((s) => s.getById);
  const [orderNumber, setOrderNumber] = useState(params.get("order") ?? "");
  const [result, setResult] = useState<Order | null | undefined>(
    params.get("order") ? getById(params.get("order")!) : undefined,
  );
  const [searched, setSearched] = useState(Boolean(params.get("order")));

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setResult(getById(orderNumber.trim()) ?? null);
    setSearched(true);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Track Your Order</h1>
      <p className="mt-2 text-ink-500">Enter your order number to see live status and shipment history.</p>

      <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="e.g. HK-20251201-4821"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          className="flex-1"
        />
        <Button type="submit">Track Order</Button>
      </form>

      {searched && !result && (
        <div className="mt-8">
          <EmptyState
            icon={PackageSearch}
            title="We couldn't find that order"
            description="Double-check your order number and try again, or contact support for help."
          />
        </div>
      )}

      {result && (
        <div className="mt-8 rounded-2xl border border-ink-100 bg-cream-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Order</p>
              <p className="text-lg font-semibold text-ink-900">{result.orderNumber}</p>
            </div>
            <StatusPill status={result.status} />
          </div>

          {result.status !== "cancelled" && (
            <ol className="mt-6 flex flex-col gap-0 sm:flex-row sm:items-center">
              {STATUS_FLOW.map((status, idx) => {
                const reached = STATUS_FLOW.indexOf(result.status) >= idx;
                return (
                  <li key={status} className="flex flex-1 items-center gap-2 sm:flex-col sm:items-center">
                    <div className="flex items-center gap-2 sm:flex-col">
                      {reached ? (
                        <CheckCircle2 size={22} className="text-forest-700" />
                      ) : (
                        <CircleDashed size={22} className="text-ink-300" />
                      )}
                      <span className={cn("text-xs font-medium capitalize sm:mt-1", reached ? "text-ink-900" : "text-ink-400")}>
                        {status}
                      </span>
                    </div>
                    {idx < STATUS_FLOW.length - 1 && (
                      <span className={cn("mx-2 hidden h-0.5 flex-1 sm:block", reached ? "bg-forest-600" : "bg-ink-200")} />
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-6 space-y-3">
            {[...result.statusHistory].reverse().map((event, i) => (
              <div key={i} className="flex justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                <span className="font-medium capitalize text-ink-800">{event.note}</span>
                <span className="text-ink-400">{formatDateTime(event.date)}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between border-t border-ink-100 pt-4 text-sm font-semibold text-ink-900">
            <span>Order Total</span>
            <span>{formatCurrency(result.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
