import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Order, OrderStatus } from "@/types";
import { generateId, generateOrderNumber } from "@/lib/id";

interface OrderState {
  orders: Order[];
  placeOrder: (input: Omit<Order, "id" | "orderNumber" | "status" | "statusHistory" | "createdAt">) => Order;
  updateStatus: (orderId: string, status: OrderStatus, note: string) => void;
  getById: (idOrNumber: string) => Order | undefined;
  getByEmail: (email: string) => Order[];
}

const STATUS_FLOW: OrderStatus[] = ["pending", "processing", "shipped", "delivered"];

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],
      placeOrder: (input) => {
        const now = new Date().toISOString();
        const order: Order = {
          ...input,
          id: generateId("order"),
          orderNumber: generateOrderNumber(),
          status: "pending",
          statusHistory: [{ status: "pending", date: now, note: "Order placed successfully." }],
          createdAt: now,
        };
        set((state) => ({ orders: [order, ...state.orders] }));
        return order;
      },
      updateStatus: (orderId, status, note) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status,
                  statusHistory: [
                    ...o.statusHistory,
                    { status, date: new Date().toISOString(), note },
                  ],
                }
              : o,
          ),
        })),
      getById: (idOrNumber) =>
        get().orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber),
      getByEmail: (email) =>
        get().orders.filter((o) => o.email.toLowerCase() === email.trim().toLowerCase()),
    }),
    { name: "hnk-orders" },
  ),
);

export { STATUS_FLOW };
