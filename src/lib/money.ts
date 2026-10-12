/**
 * Money — all monetary amounts are INTEGER CENTS in the database and in
 * server code. Formatting to display strings happens only at the UI edge.
 * Floats are never used for money arithmetic.
 */

/** Format integer cents as a USD display string, e.g. 19999 -> "$199.99". */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${rem.toString().padStart(2, "0")}`;
}

/** Parse a user-typed dollar string ("199.99", "$1,299") into integer cents. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [dollarPart, centPart = ""] = cleaned.split(".");
  const cents = Number(dollarPart) * 100 + Number((centPart + "00").slice(0, 2));
  return Math.round(cents);
}

/** Percentage discount between compare-at and current price, e.g. -29 => "-29%". */
export function discountPercent(price: number, compareAtPrice: number | null | undefined): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((price - compareAtPrice) / compareAtPrice) * 100);
}
