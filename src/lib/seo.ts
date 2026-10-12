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
