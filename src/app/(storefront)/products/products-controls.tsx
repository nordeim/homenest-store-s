"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CategoryOption = { slug: string; name: string };
export type SortOption = { value: string; label: string };

/**
 * ProductsControls — the two filter dropdowns (category + sort) as a client
 * island. Each change rewrites the ?category/?sort searchParams (resetting
 * ?page) via router.push, so the whole listing stays server-rendered.
 */
export function ProductsControls({
  q,
  category,
  sort,
  categories,
  sortOptions,
}: {
  q: string;
  category: string;
  sort: string;
  categories: CategoryOption[];
  sortOptions: ReadonlyArray<SortOption>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function update(next: { category?: string; sort?: string }) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const nextCategory = next.category ?? category;
    if (nextCategory && nextCategory !== "all") params.set("category", nextCategory);
    const nextSort = next.sort ?? sort;
    if (nextSort && nextSort !== "newest") params.set("sort", nextSort);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/products?${qs}` : "/products");
    });
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 transition-opacity sm:w-auto sm:flex-row sm:items-center",
        pending && "opacity-60",
      )}
    >
      <Select
        value={category || "all"}
        onValueChange={(value) => update({ category: value })}
      >
        <SelectTrigger
          id="category-filter"
          aria-label="Filter by category"
          className="w-full sm:w-48"
        >
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.slug} value={cat.slug}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sort || "newest"}
        onValueChange={(value) => update({ sort: value })}
      >
        <SelectTrigger
          id="sort-order"
          aria-label="Sort products"
          className="w-full sm:w-52"
        >
          <SelectValue placeholder="Newest" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
