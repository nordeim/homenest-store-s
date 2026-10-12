/**
 * Review aggregate growth for the product card's rating/reviewCount pair.
 *
 * The seed stores reference-parity counts (41–412 "reviews" per product —
 * standard e-commerce display data) while only one template Review row is
 * created. Recomputing from the real row aggregate therefore COLLAPSED the
 * displayed count (412 → 2) on the first genuine customer review.
 *
 * Instead, submissions GROW the baseline: reviewCount increments and the
 * rating becomes a rounded weighted average. The displayed numbers stay
 * monotonic and the parity look is preserved.
 */
export function mergeReviewAggregate(
  current: { rating: number; reviewCount: number },
  newRating: number,
): { rating: number; reviewCount: number } {
  if (!Number.isInteger(newRating) || newRating < 1 || newRating > 5) {
    throw new Error(`Invalid review rating: ${newRating}`);
  }
  const reviewCount = current.reviewCount + 1;
  const average =
    current.reviewCount > 0 ? (current.rating * current.reviewCount + newRating) / reviewCount : newRating;
  return { rating: Math.round(average * 10) / 10, reviewCount };
}
