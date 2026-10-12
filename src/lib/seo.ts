// ---------------------------------------------------------------------------
// JSON-LD structured data (schema.org) — pure builders so the shapes are
// unit-testable and the pages stay markup-only. Session-5 audit S5-1: the
// storefront shipped sitemap/robots/metadata but no structured data, which
// is the one SEO surface that actually drives rich results (price, stock,
// stars) for an e-commerce catalog.
// ---------------------------------------------------------------------------

/** Minimal loose shape for tests + consumers — schema.org nodes are open objects. */
export type JsonLdObject = {
  "@context"?: string;
  "@type"?: string;
  [key: string]: unknown;
};

export type ProductJsonLdInput = {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string;
  /** Raw comma-separated / JSON-ish images column as stored on the row. */
  images: string;
  sku: string;
  /** Integer cents — the money invariant (AGENTS.md). */
  price: number;
  currency: string;
  stock: number;
  rating: number;
  reviewCount: number;
  categoryName?: string;
  url: string;
  brandName: string;
};

/** Parse the images column (array JSON or comma-separated) into string paths. */
export function parseImageList(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
  } catch {
    // fall through to comma-separated
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Absolute-ize a stored image path against the site base URL. */
function absolutizeImage(baseUrl: string, image: string): string {
  if (/^https?:\/\//i.test(image)) return image;
  return `${baseUrl}${image.startsWith("/") ? "" : "/"}${image}`;
}

/** Integer cents → decimal dollars (19999 → 199.99). Never a float math trap: prices are whole cents. */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Canonical site origin (session-6 S6-4) — every public page's
 * `alternates.canonical` composes from this so the base can never disagree
 * between pages. Trailing slashes are stripped; unset falls back to
 * localhost:3000 (the documented .env.example default).
 */
export function siteBaseUrl(envValue?: string): string {
  const base = envValue ?? process.env.NEXT_PUBLIC_SITE_URL;
  return (base || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * offers.priceValidUntil (session-6 S6-14) — Google's rich-result docs
 * recommend a price-validity date. Pure: a date ~1 year out from `now`,
 * rendered as the YYYY-MM-DD the schema expects.
 */
export function priceValidUntil(now: Date = new Date()): string {
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  return later.toISOString().slice(0, 10);
}

function availabilityFor(stock: number): string {
  return stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}

/** schema.org/Product node for a product detail page. */
export function buildProductJsonLd(product: ProductJsonLdInput): JsonLdObject {
  const images = parseImageList(product.images).map((img) => absolutizeImage(new URL(product.url).origin, img));

  const ld: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description,
    image: images,
    sku: product.sku,
    category: product.categoryName,
    brand: { "@type": "Brand", name: product.brandName },
    offers: {
      "@type": "Offer",
      url: product.url,
      priceCurrency: product.currency,
      price: centsToDollars(product.price),
      availability: availabilityFor(product.stock),
      itemCondition: "https://schema.org/NewCondition",
      priceValidUntil: priceValidUntil(),
    },
  };

  if (product.reviewCount > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    };
  }

  return ld;
}

export type OrganizationJsonLdInput = {
  baseUrl: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  socials: string[];
};

/** schema.org/Organization node for the site-wide layout. */
export function buildOrganizationJsonLd(input: OrganizationJsonLdInput): JsonLdObject {
  const ld: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    description: input.description,
    url: input.baseUrl,
  };

  if (input.email || input.phone) {
    ld.contactPoint = {
      "@type": "ContactPoint",
      contactType: "customer service",
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { telephone: input.phone } : {}),
    };
  }

  if (input.socials.length > 0) {
    ld.sameAs = input.socials;
  }

  return ld;
}

/** schema.org/WebSite node — carries the typeahead SearchAction (`/products?q=`). */
export function buildWebsiteJsonLd(input: { baseUrl: string; name: string }): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: input.baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${input.baseUrl}/products?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * JSON-LD serialization for `ld+json` script blocks (session-7 S7-9).
 *
 * The HTML parser does not honor JSON context inside <script>: a raw `</script>`
 * (or U+2028/U+2029, which break JS string semantics in some embedding contexts)
 * inside ANY interpolated string — admin-authored names/descriptions included —
 * terminates the element early and can pivot into markup injection. Escaping
 * `<` as `\u003c` (and the line separators) is JSON-equivalent, so the output
 * still parses to the exact same object; it just can no longer break out of
 * the element. Every `dangerouslySetInnerHTML` ld+json site must go through
 * this helper — no bare `JSON.stringify` in page markup. Unit-pinned in
 * tests/unit/session7-hardening.test.ts.
 */
export function jsonLdScript(data: JsonLdObject): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
