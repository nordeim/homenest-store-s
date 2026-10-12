import { Link } from "react-router-dom";
import type { Category } from "@/types";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      to={`/categories/${category.slug}`}
      className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl"
    >
      <img
        src={category.image}
        alt={category.name}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/10 to-transparent" />
      <div className="relative p-5 text-cream-50">
        <h3 className="font-display text-xl font-semibold">{category.name}</h3>
        <p className="mt-1 text-sm text-cream-100/80 underline-offset-4 group-hover:underline">
          Shop the collection
        </p>
      </div>
    </Link>
  );
}
