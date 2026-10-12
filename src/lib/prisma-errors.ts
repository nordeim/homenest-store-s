/**
 * Prisma unique-violation introspection (session-8 S8-3).
 *
 * The checkout retry loop branches on WHICH unique constraint fired: a P2002
 * on `number` retries with the next suffix, a P2002 on `idempotencyKey`
 * resolves to the winning order (ownership-gated). Prisma reports the target
 * differently across engines/versions — as a field array (`["idempotencyKey"]`,
 * `["Order.idempotencyKey"]`) or as the raw constraint NAME string
 * (`"Order_idempotencyKey_key"`). Matching only the field shape silently
 * disables the recovery branch whenever the engine reports the name form —
 * the retry loop would then re-run the same key five times and 500.
 *
 * `uniqueTargetField` therefore accepts both shapes: array targets match by
 * their last dot-segment, string targets match exactly OR as a constraint
 * name containing the field between underscores.
 */

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * True when the P2002 `meta.target` identifies the given model field — via a
 * field-shaped target (array or exact string) or via a constraint-name
 * string that contains `_<field>_` / ends with `_<field>_key`.
 */
export function uniqueTargetField(error: unknown, field: string): boolean {
  if (!isUniqueViolation(error)) return false;
  const meta = (error as { meta?: { target?: unknown } }).meta;
  const target = meta?.target;

  if (Array.isArray(target)) {
    const parts = target.filter((t): t is string => typeof t === "string");
    return parts.some((part) => part.split(".").pop() === field);
  }
  if (typeof target === "string") {
    if (target === field || target.split(".").pop() === field) return true;
    // Constraint-name form: e.g. "Order_idempotencyKey_key". Bound the field
    // with underscores so "number" never matches "Order_number_key"-style
    // names for a different field.
    return target.includes(`_${field}_`);
  }
  return false;
}
