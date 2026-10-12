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

/**
 * Minimal structural surface of `db` / a transaction client that
 * `growReviewAggregate` touches — keeps the helper unit-testable with an
 * in-memory fake and lets the caller decide the transaction boundary.
 */
export interface ReviewAggregateClient {
  product: {
    findUnique: (args: {
      where: { id: string };
      select: { rating: true; reviewCount: true };
    }) => Promise<{ rating: number; reviewCount: number } | null>;
    update: (args: {
      where: { id: string };
      data: { rating: number; reviewCount: number };
    }) => Promise<unknown>;
  };
}

/**
 * Read the live baseline, merge the new rating, and write the grown
 * aggregate back. Session-8 S8-2: the read-modify-write MUST run inside the
 * caller's transaction — two concurrent submissions outside one transaction
 * both read `reviewCount = N` and one increment is lost. The caller wraps
 * this in `db.$transaction`, so the sequence is serialized on SQLite.
 */
export async function growReviewAggregate(
  client: ReviewAggregateClient,
  productId: string,
  newRating: number,
): Promise<void> {
  const live = await client.product.findUnique({
    where: { id: productId },
    select: { rating: true, reviewCount: true },
  });
  if (!live) return; // product vanished mid-flight — nothing to grow
  const next = mergeReviewAggregate(live, newRating);
  await client.product.update({ where: { id: productId }, data: next });
}
