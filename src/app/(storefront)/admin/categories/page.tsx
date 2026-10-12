import type { Metadata } from "next";

import { db } from "@/lib/db";
import { CategoryIcon } from "@/components/store/category-card";

import {
  CategoryDeleteButton,
  CategoryDialogButton,
  CategoryToggleButton,
  type CategoryFormValues,
} from "./category-dialog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Categories" };

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <header>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"} organizing the catalog
          </p>
        </header>
        <CategoryDialogButton category={null} label="Add Category" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const formValues: CategoryFormValues = {
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            icon: category.icon,
            iconGradient: category.iconGradient,
            sortOrder: String(category.sortOrder),
            isActive: category.isActive,
          };
          return (
            <article
              key={category.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start gap-3">
                <CategoryIcon icon={category.icon} gradient={category.iconGradient} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">{category.name}</h2>
                    {!category.isActive && (
                      <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                        Hidden
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">/{category.slug}</p>
                </div>
              </div>

              {category.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
              )}

              <div className="mt-auto flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {category._count.products} product{category._count.products === 1 ? "" : "s"}
                  <span className="ml-1.5 text-muted-foreground/60">· order {category.sortOrder}</span>
                </p>
                <div className="flex items-center gap-1">
                  <CategoryToggleButton category={formValues} />
                  <CategoryDialogButton category={formValues} />
                  <CategoryDeleteButton id={category.id} name={category.name} />
                </div>
              </div>
            </article>
          );
        })}
        {categories.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">No categories yet — add your first category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
