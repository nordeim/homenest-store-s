import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageSearch, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { clampSearchTerm } from "@/lib/validation";
import { db } from "@/lib/db";
import { siteBaseUrl } from "@/lib/seo";
import { SORT_OPTIONS, queryProducts } from "@/lib/products";
import { getWishlistIds } from "@/lib/wishlist";
import { ProductCard } from "@/components/store/product-card";

import { ProductsControls } from "./products-controls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop Premium Kitchenware & Home Essentials",
  description:
    "Browse the full HomeNest Kitchen catalog — cookware, bakeware, appliances, dining and more, with search, category and sort filters.",
  // Faceted URLs (?q=&category=&sort=&page=) canonicalize to the un-parameterized
  // listing — the standard duplicate-content dedup for filter permutations.
  alternates: { canonical: `${siteBaseUrl()}/products` },
};

const PER_PAGE = 12;
const MAX_PAGE = 1000; // sanity clamp against hand-typed ?page= URLs

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** Build a /products href preserving q/category/sort; page 1 stays off the URL. */
function buildHref(q: string, category: string, sort: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (sort && sort !== "newest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/products?${qs}` : "/products";
}

/** 1 … (c-1) c (c+1) … N with ellipsis markers where pages are skipped. */
function paginationPages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) wanted.add(p);
  }
  const sorted = Array.from(wanted).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = clampSearchTerm(firstParam(sp.q));
  const category = firstParam(sp.category).trim();
  const sortRaw = firstParam(sp.sort).trim();
  const sortValues: readonly string[] = SORT_OPTIONS.map((o) => o.value);
  const sort = sortValues.includes(sortRaw) ? sortRaw : "";
  const pageRaw = Number.parseInt(firstParam(sp.page) || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, MAX_PAGE) : 1;

  const [categories, result, wishlistIds] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
    queryProducts({
      search: q || undefined,
      category: category || undefined,
      sort: sort || undefined,
      page,
      perPage: PER_PAGE,
    }),
    // Session-11 S11-2: the grid hearts render the filled wishlist state.
    getWishlistIds(),
  ]);

  // Snap a stale out-of-range page (?page=99) back to the last real page.
  const effective =
    result.products.length === 0 && result.page > result.totalPages && result.total > 0
      ? await queryProducts({
          search: q || undefined,
          category: category || undefined,
          sort: sort || undefined,
          page: result.totalPages,
          perPage: PER_PAGE,
        })
      : result;
  const { products, total, page: currentPage, totalPages } = effective;

  const pageBtn =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary";

  return (
    <div className="container-page flex flex-col gap-8 py-6 sm:py-8">
      {/* Title + count */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">All Products</h1>
          {q && (
            <p className="mt-1 text-sm text-muted-foreground">
              Showing results for &ldquo;{q}&rdquo;
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total} product{total === 1 ? "" : "s"} found
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form action="/products" role="search" className="relative w-full lg:max-w-md">
          {category && <input type="hidden" name="category" value={category} />}
          {sort && sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search products..."
            aria-label="Search products"
            className="h-10 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </form>
        <ProductsControls
          q={q}
          category={category}
          sort={sort || "newest"}
          categories={categories}
          sortOptions={SORT_OPTIONS}
        />
      </div>

      {/* Grid */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
            <PackageSearch className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-foreground">No products found</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Try adjusting your search or filters.
          </p>
          <Link
            href="/products"
            className="mt-5 inline-flex h-11 items-center rounded-lg border border-primary/30 px-6 text-sm font-semibold text-primary transition-colors hover:bg-accent"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4 && currentPage === 1} inWishlist={wishlistIds.has(p.id)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Product pages" className="mt-2 flex items-center justify-center gap-2">
          {currentPage > 1 ? (
            <Link
              href={buildHref(q, category, sort, currentPage - 1)}
              className={pageBtn}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className={cn(pageBtn, "cursor-not-allowed opacity-40")} aria-hidden="true">
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}

          {paginationPages(currentPage, totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <span
                key={`ellipsis-${i}`}
                className="inline-flex h-10 min-w-6 items-center justify-center text-sm text-muted-foreground"
              >
                &hellip;
              </span>
            ) : p === currentPage ? (
              <span
                key={p}
                aria-current="page"
                className={cn(
                  pageBtn,
                  "pointer-events-none border-primary bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {p}
              </span>
            ) : (
              <Link key={p} href={buildHref(q, category, sort, p)} className={pageBtn} aria-label={`Page ${p}`}>
                {p}
              </Link>
            ),
          )}

          {currentPage < totalPages ? (
            <Link
              href={buildHref(q, category, sort, currentPage + 1)}
              className={pageBtn}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className={cn(pageBtn, "cursor-not-allowed opacity-40")} aria-hidden="true">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
