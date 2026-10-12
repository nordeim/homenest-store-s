import type { Metadata } from "next";
import type { Product } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";

import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { parseImages, parseSpecs, parseTags } from "@/lib/products";
import { cn } from "@/lib/utils";

import {
  ProductDeleteButton,
  ProductDialogButton,
  ProductToggleActiveButton,
  type CategoryOption,
  type ProductFormValues,
} from "./product-dialog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Products" };

const PER_PAGE = 10;

/** First scalar of a possibly-repeated query param. */
function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function toFormValues(product: Product, categoryId: string): ProductFormValues {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categoryId,
    shortDescription: product.shortDescription,
    description: product.description,
    priceDollars: (product.price / 100).toFixed(2),
    compareAtDollars: product.compareAtPrice === null ? "" : (product.compareAtPrice / 100).toFixed(2),
    sku: product.sku,
    stock: String(product.stock),
    imagesText: parseImages(product.images).join("\n"),
    tagsText: parseTags(product.tags).join(", "),
    specsText: parseSpecs(product.specs)
      .map((spec) => `${spec.label}: ${spec.value}`)
      .join("\n"),
    badge: product.badge ?? "",
    isFeatured: product.isFeatured,
    isNewArrival: product.isNewArrival,
    isActive: product.isActive,
  };
}

function stockClass(stock: number): string {
  if (stock === 0) return "font-semibold text-red-600";
  if (stock < 10) return "font-semibold text-amber-600";
  return "text-foreground";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q).trim();
  const page = Math.max(1, Number.parseInt(firstParam(params.page) || "1", 10) || 1);

  const where = { name: q ? { contains: q } : undefined };

  const [total, products, categories] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { category: { select: { id: true, name: true } } },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const categoryOptions: CategoryOption[] = categories;

  const pageHref = (nextPage: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (nextPage > 1) search.set("page", String(nextPage));
    const qs = search.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <header>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} product{total === 1 ? "" : "s"} in the catalog
          </p>
        </header>
        <ProductDialogButton categories={categoryOptions} product={null} label="Add Product" />
      </div>

      {/* Search */}
      <form action="/admin/products" method="get" className="flex max-w-md gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by product name…"
          aria-label="Search products by name"
          className="h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <button
          type="submit"
          className="inline-flex h-10 shrink-0 items-center rounded-lg border border-primary/30 px-4 text-sm font-semibold text-primary transition-colors hover:bg-accent"
        >
          Search
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">Category</th>
              <th scope="col" className="px-4 py-3 font-medium">Price</th>
              <th scope="col" className="px-4 py-3 font-medium">Stock</th>
              <th scope="col" className="px-4 py-3 font-medium">Badges</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((product) => {
              const image = parseImages(product.images)[0] ?? "/images/hero-elevate.png";
              const formValues = toFormValues(product, product.category.id);
              return (
                <tr key={product.id} className="align-middle transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Image
                        src={image}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                      />
                      <div className="min-w-0">
                        <p className="max-w-[220px] truncate font-semibold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{product.category.name}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{formatMoney(product.price)}</span>
                    {product.compareAtPrice !== null && (
                      <s className="ml-1.5 text-xs text-muted-foreground">{formatMoney(product.compareAtPrice)}</s>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={stockClass(product.stock)}>{product.stock}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {product.isFeatured && (
                        <span className="inline-flex items-center rounded-full bg-badge-featured px-2 py-0.5 text-[11px] font-semibold text-white">
                          Featured
                        </span>
                      )}
                      {product.isNewArrival && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          New
                        </span>
                      )}
                      {product.badge && (
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                          {product.badge}
                        </span>
                      )}
                      {!product.isFeatured && !product.isNewArrival && !product.badge && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        product.isActive ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600",
                      )}
                    >
                      {product.isActive ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ProductDialogButton categories={categoryOptions} product={formValues} />
                      <ProductDeleteButton id={product.id} name={product.name} />
                      <ProductToggleActiveButton
                        id={product.id}
                        name={product.name}
                        isActive={product.isActive}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                  {q ? `No products match “${q}”.` : "No products yet — add your first product."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Products pagination" className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                ← Prev
              </Link>
            ) : (
              <span
                aria-disabled
                className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground/50"
              >
                ← Prev
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                Next →
              </Link>
            ) : (
              <span
                aria-disabled
                className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground/50"
              >
                Next →
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
