import type { Review } from "@/types";

const reviewPool: Omit<Review, "id" | "productId">[] = [
  {
    author: "Jamie L.",
    rating: 5,
    title: "Exceeded expectations",
    comment:
      "Heats evenly and cleans up in seconds. This has become the piece I reach for every single day.",
    date: "2025-09-12",
    verified: true,
  },
  {
    author: "Priya S.",
    rating: 5,
    title: "Worth every penny",
    comment:
      "I compared this to three other brands before buying and I'm glad I went with HomeNest. Noticeably better build quality.",
    date: "2025-08-30",
    verified: true,
  },
  {
    author: "Marcus T.",
    rating: 4,
    title: "Great quality, runs a little heavy",
    comment:
      "Solid construction and performs exactly as described. Just slightly heavier than I expected, which is a minor tradeoff for the durability.",
    date: "2025-10-02",
    verified: true,
  },
  {
    author: "Devon K.",
    rating: 5,
    title: "Gifted it twice already",
    comment:
      "Bought one for myself and loved it so much I bought it again as a housewarming gift. Packaging was lovely too.",
    date: "2025-07-21",
    verified: false,
  },
  {
    author: "Alicia R.",
    rating: 4,
    title: "Reliable daily driver",
    comment:
      "Does exactly what it says. Shipping was fast and it arrived well protected.",
    date: "2025-10-18",
    verified: true,
  },
  {
    author: "Ben H.",
    rating: 5,
    title: "Professional results at home",
    comment:
      "As someone who trained in restaurant kitchens, I'm picky about my tools. This holds up to the standard I expect.",
    date: "2025-09-05",
    verified: true,
  },
];

function buildReviews(productId: string, count: number, seed: number): Review[] {
  const list: Review[] = [];
  for (let i = 0; i < count; i++) {
    const base = reviewPool[(seed + i) % reviewPool.length];
    list.push({
      ...base,
      id: `${productId}-rev-${i + 1}`,
      productId,
    });
  }
  return list;
}

export const reviews: Review[] = [
  ...buildReviews("prod-001", 4, 0),
  ...buildReviews("prod-002", 5, 1),
  ...buildReviews("prod-003", 3, 2),
  ...buildReviews("prod-007", 4, 3),
  ...buildReviews("prod-009", 5, 0),
  ...buildReviews("prod-013", 5, 1),
  ...buildReviews("prod-014", 4, 2),
  ...buildReviews("prod-017", 4, 4),
  ...buildReviews("prod-018", 5, 5),
  ...buildReviews("prod-020", 3, 0),
  ...buildReviews("prod-021", 4, 1),
  ...buildReviews("prod-024", 3, 2),
];

export function getReviewsForProduct(productId: string): Review[] {
  return reviews.filter((r) => r.productId === productId);
}
