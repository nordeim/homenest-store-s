"use client";

import * as React from "react";
import { Toast, ToastProvider, ToastTitle, ToastDescription, ToastViewport, ToastClose } from "@/components/ui/toast-primitives";

type ToastInput = {
  title: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
};

type ToastItem = ToastInput & { id: number };

const ToastContext = React.createContext<{ toast: (t: ToastInput) => void } | null>(null);

let nextId = 1;

/**
 * Toaster — provides the imperative `toast()` imperative to the whole tree
 * (children render INSIDE the context) and portals the visible toasts.
 */
export function Toaster({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  // S14-1: pending auto-dismiss timers, tracked so a manual close or an
  // unmount can clear them instead of leaving orphans that fire a redundant
  // filter (and would call setItems after unmount).
  const timersRef = React.useRef<Map<number, number>>(new Map());

  const removeItem = React.useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toast = React.useCallback((t: ToastInput) => {
    const id = nextId++;
    setItems((prev) => [...prev, { ...t, id }]);
    // Auto-dismiss after 4s — register the timer so dismiss/unmount clear it.
    const timer = window.setTimeout(() => {
      timersRef.current.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 4000);
    timersRef.current.set(id, timer);
  }, []);

  const dismiss = removeItem;

  React.useEffect(() => {
    const pending = timersRef.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastProvider>
        {items.map((item) => (
          <Toast key={item.id} variant={item.variant ?? "default"} onOpenChange={(open) => !open && dismiss(item.id)}>
            <div className="grid gap-1">
              <ToastTitle>{item.title}</ToastTitle>
              {item.description ? <ToastDescription>{item.description}</ToastDescription> : null}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within Toaster");
  return ctx;
}
