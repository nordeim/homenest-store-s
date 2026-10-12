import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Category, CarouselSlide, Product, StoreSettings } from "@/types";
import { products as seedProducts } from "@/data/products";
import { categories as seedCategories } from "@/data/categories";
import { defaultSlides } from "@/data/carousel";
import { defaultSettings } from "@/data/settings";
import { generateId } from "@/lib/id";

interface CatalogState {
  products: Product[];
  categories: Category[];
  slides: CarouselSlide[];
  settings: StoreSettings;
  addProduct: (input: Omit<Product, "id" | "createdAt">) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addCategory: (input: Omit<Category, "id">) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addSlide: (input: Omit<CarouselSlide, "id">) => CarouselSlide;
  updateSlide: (id: string, patch: Partial<CarouselSlide>) => void;
  deleteSlide: (id: string) => void;
  reorderSlides: (orderedIds: string[]) => void;
  updateSettings: (patch: Partial<StoreSettings>) => void;
  decrementStock: (productId: string, qty: number) => void;
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      products: seedProducts,
      categories: seedCategories,
      slides: defaultSlides,
      settings: defaultSettings,

      addProduct: (input) => {
        const product: Product = {
          ...input,
          id: generateId("prod"),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ products: [product, ...state.products] }));
        return product;
      },
      updateProduct: (id, patch) =>
        set((state) => ({
          products: state.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deleteProduct: (id) =>
        set((state) => ({ products: state.products.filter((p) => p.id !== id) })),

      addCategory: (input) => {
        const category: Category = { ...input, id: generateId("cat") };
        set((state) => ({ categories: [...state.categories, category] }));
        return category;
      },
      updateCategory: (id, patch) =>
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteCategory: (id) =>
        set((state) => ({ categories: state.categories.filter((c) => c.id !== id) })),

      addSlide: (input) => {
        const slide: CarouselSlide = { ...input, id: generateId("slide") };
        set((state) => ({ slides: [...state.slides, slide] }));
        return slide;
      },
      updateSlide: (id, patch) =>
        set((state) => ({
          slides: state.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      deleteSlide: (id) =>
        set((state) => ({ slides: state.slides.filter((s) => s.id !== id) })),
      reorderSlides: (orderedIds) => {
        const bySlideId = new Map(get().slides.map((s) => [s.id, s]));
        const reordered = orderedIds
          .map((id, index) => {
            const slide = bySlideId.get(id);
            return slide ? { ...slide, order: index + 1 } : undefined;
          })
          .filter((s): s is CarouselSlide => Boolean(s));
        set({ slides: reordered });
      },

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      decrementStock: (productId, qty) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, stock: Math.max(0, p.stock - qty) } : p,
          ),
        })),
    }),
    { name: "hnk-catalog" },
  ),
);
