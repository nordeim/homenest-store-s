import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProductCard } from "./ProductCard";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useCatalogStore } from "@/store/catalogStore";

function renderCard(productId = "prod-002") {
  const product = useCatalogStore.getState().products.find((p) => p.id === productId)!;
  render(
    <MemoryRouter>
      <ProductCard product={product} />
    </MemoryRouter>,
  );
  return product;
}

describe("ProductCard", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], couponCode: null });
    useWishlistStore.setState({ productIds: [] });
  });

  it("displays the product name and price", () => {
    const product = renderCard();
    expect(screen.getByText(product.name)).toBeInTheDocument();
    expect(screen.getByText(`$${product.price.toFixed(2)}`)).toBeInTheDocument();
  });

  it("adds the product to the cart via the quick add button without navigating", async () => {
    const product = renderCard();
    await userEvent.click(screen.getByRole("button", { name: /Quick Add/i }));
    expect(useCartStore.getState().items).toEqual([{ productId: product.id, variantId: undefined, quantity: 1 }]);
  });

  it("toggles wishlist state when the heart button is clicked", async () => {
    const product = renderCard();
    const wishlistButton = screen.getByRole("button", { name: /add to wishlist/i });
    await userEvent.click(wishlistButton);
    expect(useWishlistStore.getState().productIds).toContain(product.id);
  });

  it("disables quick add for an out-of-stock product", () => {
    useCatalogStore.getState().updateProduct("prod-002", { stock: 0 });
    renderCard();
    expect(screen.getByRole("button", { name: /Quick Add/i })).toBeDisabled();
    useCatalogStore.getState().updateProduct("prod-002", { stock: 102 });
  });
});
