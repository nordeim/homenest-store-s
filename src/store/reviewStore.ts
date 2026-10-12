import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Review } from "@/types";
import { reviews as seedReviews } from "@/data/reviews";
import { generateId } from "@/lib/id";

interface ReviewState {
  reviews: Review[];
  addReview: (input: Omit<Review, "id" | "date">) => void;
  reviewsForProduct: (productId: string) => Review[];
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      reviews: seedReviews,
      addReview: (input) => {
        const review: Review = {
          ...input,
          id: generateId("rev"),
          date: new Date().toISOString(),
        };
        set((state) => ({ reviews: [review, ...state.reviews] }));
      },
      reviewsForProduct: (productId) => get().reviews.filter((r) => r.productId === productId),
    }),
    { name: "hnk-reviews" },
  ),
);
