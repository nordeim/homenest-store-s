import type { CarouselSlide } from "@/types";
import { img } from "./images";

export const defaultSlides: CarouselSlide[] = [
  {
    id: "slide-1",
    title: "Elevate Every Meal",
    subtitle:
      "Professional-grade cookware and tools, curated for home kitchens that mean business.",
    image: img.heroMain,
    ctaText: "Shop Bestsellers",
    ctaLink: "/products?sort=bestselling",
    order: 1,
    active: true,
  },
  {
    id: "slide-2",
    title: "Knife Skills, Solved",
    subtitle:
      "Precision-forged chef knives with a lifetime sharpening guarantee.",
    image: img.categoryKnives,
    ctaText: "Shop Knives",
    ctaLink: "/categories/knives-cutlery",
    order: 2,
    active: true,
  },
  {
    id: "slide-3",
    title: "Organize Your Pantry",
    subtitle:
      "Airtight glass storage sets that keep ingredients fresh and shelves beautiful.",
    image: img.categoryStorage,
    ctaText: "Shop Storage",
    ctaLink: "/categories/kitchen-storage",
    order: 3,
    active: true,
  },
];
