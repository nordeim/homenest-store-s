import { Navigate, useParams } from "react-router-dom";
import { useCatalogStore } from "@/store/catalogStore";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductCard } from "@/components/shop/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PackageSearch } from "lucide-react";

export function CategoryPage() {
  const { slug } = useParams();
  const categories = useCatalogStore((s) => s.categories);
  const products = useCatalogStore((s) => s.products);
  const category = categories.find((c) => c.slug === slug);

  if (!category) return <Navigate to="/products" replace />;

  const items = products.filter((p) => p.categorySlug === category.slug && p.status === "active");

  return (
    <div>
      <div className="relative h-56 overflow-hidden sm:h-72">
        <img src={category.image} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink-950/50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-cream-50">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{category.name}</h1>
          <p className="mt-2 max-w-xl text-sm text-cream-100/90 sm:text-base">{category.description}</p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Shop All", to: "/products" }, { label: category.name }]}
        />
        <p className="mt-4 text-sm text-ink-500">{items.length} products</p>
        {items.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={PackageSearch} title="No products in this category yet" />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
