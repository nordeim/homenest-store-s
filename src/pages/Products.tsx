import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PackageSearch, SlidersHorizontal, X } from "lucide-react";
import { useCatalogStore } from "@/store/catalogStore";
import { ProductCard } from "@/components/shop/ProductCard";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const PAGE_SIZE = 12;

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "bestselling", label: "Bestselling" },
  { value: "new", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Customer Rating" },
];

export function Products() {
  const [params, setParams] = useSearchParams();
  const products = useCatalogStore((s) => s.products);
  const categories = useCatalogStore((s) => s.categories);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = params.get("q") ?? "";
  const categoryFilter = params.get("category") ?? "";
  const sort = params.get("sort") ?? "featured";
  const maxPrice = Number(params.get("maxPrice") ?? 400);
  const inStockOnly = params.get("inStock") === "1";
  const page = Number(params.get("page") ?? 1);

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.status === "active");
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q)),
      );
    }
    if (categoryFilter) list = list.filter((p) => p.categorySlug === categoryFilter);
    list = list.filter((p) => p.price <= maxPrice);
    if (inStockOnly) list = list.filter((p) => p.stock > 0);

    const sorted = [...list];
    switch (sort) {
      case "bestselling":
        sorted.sort((a, b) => Number(b.isBestseller) - Number(a.isBestseller) || b.reviewCount - a.reviewCount);
        break;
      case "new":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      default:
        sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return sorted;
  }, [products, query, categoryFilter, sort, maxPrice, inStockOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const FilterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Category</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input
              type="radio"
              name="category"
              checked={categoryFilter === ""}
              onChange={() => updateParam("category", null)}
              className="h-4 w-4 accent-forest-700"
            />
            All Categories
          </label>
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="radio"
                name="category"
                checked={categoryFilter === cat.slug}
                onChange={() => updateParam("category", cat.slug)}
                className="h-4 w-4 accent-forest-700"
              />
              {cat.name}
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink-900">
          Max Price: ${maxPrice}
        </h3>
        <input
          type="range"
          min={20}
          max={400}
          step={10}
          value={maxPrice}
          onChange={(e) => updateParam("maxPrice", e.target.value)}
          className="w-full accent-forest-700"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => updateParam("inStock", e.target.checked ? "1" : null)}
          className="h-4 w-4 accent-forest-700"
        />
        In stock only
      </label>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setParams(new URLSearchParams())}
      >
        Reset Filters
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Shop All" }]} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-ink-900">
          {query ? `Results for "${query}"` : "Shop All Products"}
        </h1>
        <p className="text-sm text-ink-500">{filtered.length} products</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">{FilterPanel}</aside>

        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal size={15} /> Filters
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="sort" className="hidden text-sm text-ink-500 sm:inline">
                Sort by
              </label>
              <Select
                id="sort"
                value={sort}
                onChange={(e) => updateParam("sort", e.target.value)}
                className="w-auto min-w-[170px]"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {pageItems.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No products match your filters"
              description="Try adjusting your search or clearing filters to see more results."
              action={
                <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>
                  Clear all filters
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {pageItems.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <div className="mt-10">
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onChange={(p) => updateParam("page", String(p))}
            />
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setFiltersOpen(false)} />
          <div className="relative ml-auto flex h-full w-80 max-w-[85%] flex-col overflow-y-auto bg-cream-50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                <X size={20} />
              </button>
            </div>
            {FilterPanel}
          </div>
        </div>
      )}
    </div>
  );
}
