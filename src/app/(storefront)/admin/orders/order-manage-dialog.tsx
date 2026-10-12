"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  BadgeDollarSign,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  ReceiptText,
  RefreshCcw,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { setOrderStatusAction, setTrackingAction } from "@/lib/actions/admin";
import { ORDER_STATUSES } from "@/lib/validation";
import { formatDateTime, orderStatusBadgeClass } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type OrderManageItem = {
  id: string;
  name: string;
  image: string;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
};

export type OrderManageEvent = {
  id: string;
  type: string;
  status: string | null;
  note: string | null;
  createdAt: string;
};

export type OrderManageData = {
  id: string;
  number: string;
  status: string;
  customerName: string;
  email: string;
  addressLines: string[];
  paymentLabel: string;
  couponCode: string | null;
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  carrier: string | null;
  trackingNumber: string | null;
  items: OrderManageItem[];
  events: OrderManageEvent[];
};

const EVENT_ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  placed: { icon: ReceiptText, className: "bg-accent text-primary" },
  status_changed: { icon: RefreshCcw, className: "bg-secondary text-secondary-foreground" },
  tracking_added: { icon: Truck, className: "bg-emerald-100 text-emerald-700" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function statusPillClass(status: string): string {
  return cn(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
    orderStatusBadgeClass(status),
  );
}

/**
 * "Manage" button + full order management dialog: items, address, payment,
 * status updates, tracking and the order event timeline. Data arrives fully
 * serialized from the server table row.
 */
export function OrderManageButton({ order }: { order: OrderManageData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  type OrderStatusValue = (typeof ORDER_STATUSES)[number];
  const initialStatus: OrderStatusValue = (ORDER_STATUSES as readonly string[]).includes(order.status)
    ? (order.status as OrderStatusValue)
    : ORDER_STATUSES[0];
  const [status, setStatus] = React.useState<OrderStatusValue>(initialStatus);
  const [statusNote, setStatusNote] = React.useState("");
  const [statusPending, setStatusPending] = React.useState(false);

  const [carrier, setCarrier] = React.useState(order.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = React.useState(order.trackingNumber ?? "");
  const [trackingPending, setTrackingPending] = React.useState(false);

  async function handleStatusUpdate() {
    setStatusPending(true);
    try {
      const result = await setOrderStatusAction({
        orderId: order.id,
        status,
        note: statusNote.trim() === "" ? undefined : statusNote.trim(),
      });
      if (result.ok) {
        toast({
          title: `Order ${order.number} updated`,
          description: `Status set to ${STATUS_LABELS[status] ?? status}.`,
          variant: "success",
        });
        setStatusNote("");
        router.refresh();
      } else {
        toast({ title: "Could not update status", description: result.error, variant: "destructive" });
      }
    } finally {
      setStatusPending(false);
    }
  }

  async function handleTrackingSave() {
    setTrackingPending(true);
    try {
      const result = await setTrackingAction({
        orderId: order.id,
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim(),
      });
      if (result.ok) {
        toast({ title: "Tracking saved", description: `${carrier.trim()} · ${trackingNumber.trim()}`, variant: "success" });
        router.refresh();
      } else {
        toast({ title: "Could not save tracking", description: result.error, variant: "destructive" });
      }
    } finally {
      setTrackingPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)}>
        Manage
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{order.number}</DialogTitle>
          <DialogDescription>
            Placed by {order.customerName} · {order.email}
          </DialogDescription>
        </DialogHeader>

        {/* Status + tracking management */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={statusPillClass(order.status)}>{STATUS_LABELS[order.status] ?? order.status}</span>
              <BadgeDollarSign className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="text-sm font-semibold">{formatMoney(order.total)}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`status-${order.id}`}>Update status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as OrderStatusValue)}>
                <SelectTrigger id={`status-${order.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      Mark as {STATUS_LABELS[value] ?? value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`note-${order.id}`} className="sr-only">
                Status note (optional)
              </Label>
              <Input
                id={`note-${order.id}`}
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Note for the timeline (optional)"
                maxLength={280}
              />
            </div>
            <Button onClick={handleStatusUpdate} disabled={statusPending || status === order.status} className="w-full">
              {statusPending && <Loader2 className="animate-spin" aria-hidden />}
              Update Status
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="h-4 w-4" aria-hidden />
              <span>
                {order.carrier
                  ? `${order.carrier} · ${order.trackingNumber ?? "—"}`
                  : "No tracking information yet"}
              </span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`carrier-${order.id}`}>Carrier</Label>
              <Input
                id={`carrier-${order.id}`}
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="UPS, FedEx, USPS…"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tracking-${order.id}`}>Tracking number</Label>
              <Input
                id={`tracking-${order.id}`}
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="1Z999AA10123456784"
                maxLength={60}
              />
            </div>
            <Button variant="outline" onClick={handleTrackingSave} disabled={trackingPending} className="w-full">
              {trackingPending && <Loader2 className="animate-spin" aria-hidden />}
              Save Tracking
            </Button>
          </div>
        </div>

        {/* Items */}
        <section aria-label="Order items">
          <h3 className="text-sm font-semibold">Items</h3>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <Image
                  src={item.image}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {formatMoney(item.unitPrice)}
                    {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatMoney(item.unitPrice * item.quantity)}</p>
              </li>
            ))}
            {order.items.length === 0 && (
              <li className="p-4 text-center text-sm text-muted-foreground">No line items recorded.</li>
            )}
          </ul>
        </section>

        {/* Address + payment */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" aria-hidden /> Shipping address
            </h3>
            <address className="mt-2 space-y-0.5 text-sm not-italic text-muted-foreground">
              {order.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </address>
          </div>
          <div className="rounded-xl border border-border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4 text-primary" aria-hidden /> Payment
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{order.paymentLabel}</p>
            {order.couponCode && (
              <p className="mt-1 text-sm text-muted-foreground">
                Coupon: <span className="font-medium text-foreground">{order.couponCode}</span>
              </p>
            )}
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatMoney(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{formatMoney(order.shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>{formatMoney(order.tax)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="text-emerald-700">−{formatMoney(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Events timeline */}
        <section aria-label="Order timeline">
          <h3 className="text-sm font-semibold">Timeline</h3>
          <ol className="mt-2 max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {order.events.map((event) => {
              const config = EVENT_ICONS[event.type] ?? { icon: Package, className: "bg-secondary text-secondary-foreground" };
              const Icon = config.icon;
              return (
                <li key={event.id} className="flex items-start gap-3">
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", config.className)}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {event.type === "placed" && "Order placed"}
                      {event.type === "tracking_added" && "Tracking added"}
                      {event.type === "status_changed" &&
                        `Status changed${event.status ? ` → ${STATUS_LABELS[event.status] ?? event.status}` : ""}`}
                      {!["placed", "tracking_added", "status_changed"].includes(event.type) && event.type}
                    </p>
                    {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                    <p className="text-[11px] text-muted-foreground/80">{formatDateTime(event.createdAt)}</p>
                  </div>
                </li>
              );
            })}
            {order.events.length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">No events recorded yet.</li>
            )}
          </ol>
        </section>
      </DialogContent>
    </Dialog>
  );
}
