import type { Category } from "@/types";
import { img } from "./images";

export const categories: Category[] = [
  {
    id: "cat-cookware",
    slug: "cookware",
    name: "Cookware",
    description:
      "Professional-grade pots, pans and skillets built for even heat and a lifetime of family meals.",
    image: img.categoryCookware,
    featured: true,
  },
  {
    id: "cat-bakeware",
    slug: "bakeware",
    name: "Bakeware",
    description:
      "Trusted trays, tins and racks that deliver consistent, golden results every bake.",
    image: img.categoryBakeware,
    featured: true,
  },
  {
    id: "cat-storage",
    slug: "kitchen-storage",
    name: "Kitchen Storage",
    description:
      "Airtight, stackable storage that keeps your pantry organized and ingredients fresher for longer.",
    image: img.categoryStorage,
    featured: true,
  },
  {
    id: "cat-knives",
    slug: "knives-cutlery",
    name: "Knives & Cutlery",
    description:
      "Precision-forged blades with balanced handles, designed for effortless everyday prep.",
    image: img.categoryKnives,
    featured: true,
  },
  {
    id: "cat-appliances",
    slug: "small-appliances",
    name: "Small Appliances",
    description:
      "Countertop machines that bring café-quality coffee and bakery-quality bread home.",
    image: img.categoryAppliances,
    featured: true,
  },
  {
    id: "cat-dinnerware",
    slug: "dinnerware",
    name: "Dinnerware",
    description:
      "Minimalist, chip-resistant plates, bowls and mugs that set a beautiful table every day.",
    image: img.categoryDinnerware,
    featured: true,
  },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
