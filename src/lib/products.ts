import { db } from "@/lib/db";
import type { Category, Product } from "@prisma/client";

/** The exact shape ProductCard renders — parsed from a Prisma Product row. */
export type ProductCardData = {
  id: string;
  name: string;
  image: string;
  price: number;
  compareAtPrice: number | null;
  rating: number;
  reviewCount: number;
  categoryName: string;
  categorySlug: string;
  badge: string | null;
};

export function parseImages(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function parseTags(json: string): string[] {
  return parseImages(json);
}

export type ParsedSpec = { label: string; value: string };

export function parseSpecs(json: string): ParsedSpec[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is ParsedSpec =>
        typeof v === "object" && v !== null && typeof (v as ParsedSpec).label === "string",
    );
  } catch {
    return [];
  }
}

/** Project a Prisma Product + Category into the card shape. */
export function toCardData(product: Product, category: Pick<Category, "name" | "slug">): ProductCardData {
  return {
    id: product.id,
    name: product.name,
    image: parseImages(product.images)[0] ?? "/images/placeholder.svg",
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    rating: product.rating,
    reviewCount: product.reviewCount,
    categoryName: category.name,
    categorySlug: category.slug,
    badge: product.badge,
  };
}

export type ProductQuery = {
  search?: string;
  category?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  onlyActive?: boolean;
};

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
  { value: "name", label: "Name: A to Z" },
] as const;

/** Storefront product query — search + category + sort + pagination. */
export async function queryProducts(query: ProductQuery) {
  const perPage = query.perPage ?? 12;
  const page = Math.max(1, query.page ?? 1);
  const where = {
    isActive: query.onlyActive === false ? undefined : true,
    name: query.search ? { contains: query.search } : undefined,
    category: query.category ? { slug: query.category, isActive: true } : undefined,
  };

  const orderBy = (() => {
    switch (query.sort) {
      case "price-asc":
        return { price: "asc" as const };
      case "price-desc":
        return { price: "desc" as const };
      case "rating":
        return { rating: "desc" as const };
      case "name":
        return { name: "asc" as const };
      default:
        return { createdAt: "desc" as const };
    }
  })();

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy,
      include: { category: { select: { name: true, slug: true } } },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    products: products.map((p) => toCardData(p, p.category)),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
