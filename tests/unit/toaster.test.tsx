// @vitest-environment jsdom
// Session-14 S14-1 — Toaster auto-dismiss timer hygiene.
//
// The suite's first component test (jsdom via the per-file environment
// docblock; the global suite stays node-env). Fake timers make the 4s
// auto-dismiss deterministic, and `vi.getTimerCount()` exposes the leak:
// with the pre-fix implementation the 4s timer stays pending after a manual
// close or an unmount — an orphan that (a) fires a redundant idempotent
// filter and (b) would call setItems on an unmounted component.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Toaster, useToast } from "@/components/ui/toaster";

function Probe({ title }: { title: string }) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast({ title })}>
      fire-{title}
    </button>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toaster (S14-1 timer hygiene)", () => {
  it("auto-dismisses a toast after 4s", async () => {
    vi.useFakeTimers();
    render(
      <Toaster>
        <Probe title="Hello" />
      </Toaster>,
    );
    const baseline = vi.getTimerCount();

    fireEvent.click(screen.getByText("fire-Hello"));
    expect(screen.getByText("Hello")).toBeVisible();

    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.queryByText("Hello")).toBeNull();
    // The auto-dismiss consumed its own timer — no orphans left.
    expect(vi.getTimerCount()).toBe(baseline);
  });

  it("manual close cancels the pending auto-dismiss timer", async () => {
    vi.useFakeTimers();
    render(
      <Toaster>
        <Probe title="Manual" />
      </Toaster>,
    );
    const baseline = vi.getTimerCount();

    fireEvent.click(screen.getByText("fire-Manual"));
    expect(screen.getByText("Manual")).toBeVisible();

    // The ToastClose affordance is an icon-only button — it carries an
    // accessible name (CLAUDE.md's icon-only rule) and dismisses via Radix's
    // onOpenChange → our `dismiss`, which must also cancel the pending timer.
    fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));
    expect(screen.queryByText("Manual")).toBeNull();

    // RED pre-fix: the 4s timer is still pending after the manual close
    // (vi.getTimerCount() === baseline + 1) — the fix clears it on dismiss.
    expect(vi.getTimerCount()).toBe(baseline);

    // Advancing past the dismiss window must stay quiet and clean.
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    expect(vi.getTimerCount()).toBe(baseline);
    expect(screen.queryByText("Manual")).toBeNull();
  });

  it("unmount clears every pending auto-dismiss timer", async () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <Toaster>
        <Probe title="Unmount" />
      </Toaster>,
    );
    const baseline = vi.getTimerCount();

    fireEvent.click(screen.getByText("fire-Unmount"));
    expect(screen.getByText("Unmount")).toBeVisible();

    // RED pre-fix: the pending 4s timer survives the unmount as an orphan
    // that would call setItems on the unmounted component.
    unmount();
    expect(vi.getTimerCount()).toBe(baseline);

    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    expect(vi.getTimerCount()).toBe(baseline);
  });
});
