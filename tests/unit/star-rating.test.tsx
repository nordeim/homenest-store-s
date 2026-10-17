// @vitest-environment jsdom
// Session-47 S47-2 — the rating announcement is a LEGAL labeled image.
//
// The star rating renders an aria-label ("Rated 4.9 out of 5") on a plain
// <span>. ARIA prohibits aria-label on role-less elements (Lighthouse
// `aria-prohibited-attr`, flagged on every product card + product detail +
// home), and unlike the reference — whose ratings carry NO label at all —
// the clone wants the announcement to reach screen readers. The canonical
// pattern is role="img" + aria-label: the label becomes the image's
// accessible name, legal per the ARIA in HTML spec, with ZERO visual delta
// (role is pure semantics; the Stars stay aria-hidden decorations).
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("lucide-react", () => ({ Star: () => null }));

import { StarRating } from "@/components/store/star-rating";

afterEach(() => {
  cleanup();
});

describe("StarRating (S47-2)", () => {
  it("puts the rating announcement on a role=img span so the aria-label is legal", () => {
    render(<StarRating rating={4.9} />);
    // With role="img", the accessible query resolves by aria-label name.
    const img = screen.getByRole("img", { name: "Rated 4.9 out of 5" });
    expect(img.tagName).toBe("SPAN");
    expect(img).not.toHaveAttribute("role", "presentation");
  });

  it("keeps the announcement for non-round ratings and the value suffix off by default", () => {
    const { container } = render(<StarRating rating={4.2} />);
    expect(screen.getByRole("img", { name: "Rated 4.2 out of 5" })).toBeInTheDocument();
    // showValue=false → no numeric sibling text is rendered.
    expect(container.textContent ?? "").not.toContain("4.2");
  });

  it("renders the visible value alongside the labeled image when showValue", () => {
    render(<StarRating rating={4.2} showValue />);
    expect(screen.getByRole("img", { name: "Rated 4.2 out of 5" })).toBeInTheDocument();
    expect(screen.getByText("4.2")).toBeInTheDocument();
  });
});
