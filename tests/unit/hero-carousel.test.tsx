// @vitest-environment jsdom
// Session-16 S16-4 / C5 — the S15-5 MediaQueryList cache, pinned.
//
// The hero carousel builds its `(prefers-reduced-motion: reduce)` query
// through a module-level LAZY cache (S15-5) — `getSnapshot` runs on every
// render, so a regression back to a per-read `window.matchMedia(...)` would
// construct a fresh MediaQueryList per render and pass every other test.
// The spy must see exactly ONE construction across mount + timer-driven
// re-renders + a prop rerender.
//
// The cache is MODULE-level, so each test re-imports the module through
// `vi.resetModules()` + dynamic import to start from a cold cache. Fake
// timers drive the auto-rotation deterministically (the S14-1 pattern).
// `next/image` / `next/link` are stubbed — the assertions are on the MQL
// cache and slide state, not media.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({ default: () => null }));

import type { Slide } from "@/components/store/hero-carousel";

const SLIDES: Slide[] = [
  {
    id: "s1",
    title: "New Arrivals",
    subtitle: "Explore the latest.",
    image: "/images/hero-new-arrivals.png",
    ctaText: "Browse Collection",
    ctaLink: "/products",
  },
  {
    id: "s2",
    title: "Elevate Your Kitchen",
    subtitle: "Premium tools.",
    image: "/images/hero-elevate.png",
    ctaText: "Shop Now",
    ctaLink: "/products",
  },
];

type MatchMediaStub = ReturnType<typeof makeMatchMedia>;

function makeMatchMedia(matches: boolean) {
  const construct = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.stubGlobal("matchMedia", construct);
  return construct;
}

/** Cold-cache import: the module-level MQL cache starts fresh per test. */
async function loadCarousel() {
  vi.resetModules();
  const mod = await import("@/components/store/hero-carousel");
  return mod.HeroCarousel;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe("HeroCarousel (S16-4 — S15-5 cache + motion pins)", () => {
  it("constructs exactly ONE MediaQueryList across re-renders (S15-5)", async () => {
    vi.useFakeTimers();
    const matchMedia = makeMatchMedia(false);
    const HeroCarousel = await loadCarousel();

    const { rerender } = render(<HeroCarousel slides={SLIDES} autoRotateMs={20} />);
    // Auto-rotation drives several setActive re-renders (each calls
    // getSnapshot), then a prop rerender on top.
    await advance(60);
    rerender(<HeroCarousel slides={[...SLIDES].reverse()} autoRotateMs={20} />);
    await advance(20);

    expect(matchMedia).toHaveBeenCalledTimes(1);
  });

  it("auto-rotates through the slides", async () => {
    vi.useFakeTimers();
    makeMatchMedia(false);
    const HeroCarousel = await loadCarousel();

    render(<HeroCarousel slides={SLIDES} autoRotateMs={20} />);
    expect(screen.getByRole("button", { name: /Slide 1:/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await advance(20);
    expect(screen.getByRole("button", { name: /Slide 2:/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("prefers-reduced-motion freezes the rotation (WCAG 2.2.2)", async () => {
    vi.useFakeTimers();
    makeMatchMedia(true);
    const HeroCarousel = await loadCarousel();

    render(<HeroCarousel slides={SLIDES} autoRotateMs={20} />);
    await advance(80);
    expect(screen.getByRole("button", { name: /Slide 1:/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
