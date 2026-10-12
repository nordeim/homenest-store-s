import type { OrderStatus } from "@/types";
import { Badge } from "./Badge";

const statusTone: Record<OrderStatus, { label: string; tone: "amber" | "blue" | "forest" | "red" | "neutral" }> = {
  pending: { label: "Pending", tone: "amber" },
  processing: { label: "Processing", tone: "blue" },
  shipped: { label: "Shipped", tone: "forest" },
  delivered: { label: "Delivered", tone: "forest" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const config = statusTone[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
