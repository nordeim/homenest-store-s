// @vitest-environment jsdom
// Session-47 S47-3 — the card media link's accessible name contains its
// VISIBLE text (WCAG 2.5.3 Label in Name).
//
// The media link carries aria-label={product.name} but its VISIBLE content
// includes the stacked badges ("-29%", "Featured"). Lighthouse flags this
// as label-content-name-mismatch: a voice-control user who says the visible
// badge text ("click minus twenty-nine percent") cannot match a link whose
// accessible name omits it. The reference does not carry the label at all
// (its links name themselves from visible content) — the clone keeps the
// richer product-name name AND folds the visible badge text in, zero
// visual delta (the label is not rendered).
//
// S47-1's sibling pin: the link itself is unchanged geometry-wise; only the
// non-rendered accessible name string changes.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// The card's action buttons (useToast + useRouter internals) are outside
// this spec's surface — the assertions are on the media/title LINK
// semantics, so the buttons render as inert placeholders.
vi.mock("@/components/store/add-to-cart-button", () => ({
  AddToCartButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AddToWishlistButton: () => <button type="button">Toggle wishlist</button>,
}));

import type { ProductCardData } from "@/lib/products";
import { ProductCard } from "@/components/store/product-card";

afterEach(() => {
  cleanup();
});

const BASE: ProductCardData = {
  id: "prod-1",
  name: "Damascus Steel Chef Knife Set",
  image: "/images/products/damascus.png",
  price: 19999,
  compareAtPrice: 27999,
  rating: 4.9,
  reviewCount: 412,
  categoryName: "Kitchen Tools",
  categorySlug: "kitchen-tools",
  badge: "Featured",
};

// The badge renders discountPercent(price, compareAtPrice) + "%".
// (19999 - 27999) / 27999 = -28.57% → rounds to -29 → visible "-29%".
function renderCard(overrides: Partial<ProductCardData> = {}) {
  return render(<ProductCard product={{ ...BASE, ...overrides }} />);
}

describe("ProductCard media link label (S47-3)", () => {
  it("names the media link with product name AND the visible discount + badge text", () => {
    renderCard();
    // The media link is the only link whose accessible name carries the
    // visible badge text; the title link below the media keeps the plain name.
    const media = screen.getByRole("link", { name: /-29%/ });
    expect(media).toHaveAccessibleName(/Damascus Steel Chef Knife Set/);
    // The VISIBLE text must be contained in the accessible name (2.5.3).
    expect(media).toHaveAccessibleName(/-29%/);
    expect(media).toHaveAccessibleName(/Featured/);
  });

  it("omits absent badges from the name instead of padding with separators", () => {
    renderCard({ badge: null, compareAtPrice: null });
    // No badges → both the media link and the title link carry the plain
    // product name exactly.
    const links = screen.getAllByRole("link", { name: "Damascus Steel Chef Knife Set" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAccessibleName("Damascus Steel Chef Knife Set");
    }
  });

  it("names the title link with the plain product name (no badge text — none is visible in it)", () => {
    renderCard();
    // Two links point at /product/prod-1: the media link (badges folded in)
    // and the title link (visible name only).
    const title = screen.getByRole("link", { name: "Damascus Steel Chef Knife Set" });
    expect(title).toHaveAccessibleName("Damascus Steel Chef Knife Set");
  });
});
