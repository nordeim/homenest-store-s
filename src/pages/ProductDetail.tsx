import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Heart, ShieldCheck, Truck } from "lucide-react";
import { useCatalogStore } from "@/store/catalogStore";
import { useReviewStore } from "@/store/reviewStore";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Rating } from "@/components/ui/Rating";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Textarea } from "@/components/ui/Input";
import { ProductCard } from "@/components/shop/ProductCard";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { cn } from "@/utils/cn";

export function ProductDetail() {
  const { slug } = useParams();
  const products = useCatalogStore((s) => s.products);
  const categories = useCatalogStore((s) => s.categories);
  const product = products.find((p) => p.slug === slug);

  const reviews = useReviewStore((s) => (product ? s.reviewsForProduct(product.id) : []));
  const addReview = useReviewStore((s) => s.addReview);
  const addItem = useCartStore((s) => s.addItem);
  const inWishlist = useWishlistStore((s) => (product ? s.has(product.id) : false));
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const user = useAuthStore((s) => s.currentUser());
  const push = useToastStore((s) => s.push);

  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState<string | undefined>(product?.variants?.[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<"description" | "specs" | "reviews">("description");
  const [reviewForm, setReviewForm] = useState({ title: "", comment: "", rating: 5 });

  const related = useMemo(
    () =>
      product
        ? products.filter((p) => p.id !== product.id && p.categorySlug === product.categorySlug).slice(0, 4)
        : [],
    [product, products],
  );

  if (!product) return <Navigate to="/products" replace />;

  const category = categories.find((c) => c.slug === product.categorySlug);
  const variant = product.variants?.find((v) => v.id === variantId);
  const price = product.price + (variant?.priceDelta ?? 0);

  function handleAddToCart() {
    if (!product) return;
    addItem(product.id, quantity, variantId);
    push(`${product.name} added to cart`, "success");
  }

  function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    if (!user) {
      push("Please sign in to leave a review", "error");
      return;
    }
    addReview({
      productId: product.id,
      author: user.name,
      rating: reviewForm.rating,
      title: reviewForm.title,
      comment: reviewForm.comment,
      verified: true,
    });
    setReviewForm({ title: "", comment: "", rating: 5 });
    push("Thanks for your review!", "success");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: category?.name ?? "Shop", to: `/categories/${product.categorySlug}` },
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-ink-50">
            <img
              src={product.images[activeImage]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {product.images.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "h-20 w-20 overflow-hidden rounded-lg border-2",
                    i === activeImage ? "border-forest-700" : "border-transparent",
                  )}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-1.5">
            {product.isNew && <Badge tone="forest">New Arrival</Badge>}
            {product.isBestseller && <Badge tone="ember">Bestseller</Badge>}
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold text-ink-900">{product.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <Rating value={product.rating} count={product.reviewCount} />
            <span className="text-xs text-ink-400">SKU: {product.sku}</span>
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-ink-900">{formatCurrency(price)}</span>
            {product.compareAtPrice && (
              <span className="text-lg text-ink-400 line-through">
                {formatCurrency(product.compareAtPrice)}
              </span>
            )}
          </div>
          <p className="mt-4 leading-relaxed text-ink-600">{product.shortDescription}</p>

          {product.variants && product.variants.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-ink-900">Options</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVariantId(v.id)}
                    className={cn(
                      "rounded-lg border px-3.5 py-2 text-sm font-medium",
                      variantId === v.id
                        ? "border-forest-700 bg-forest-50 text-forest-800"
                        : "border-ink-200 text-ink-600 hover:border-ink-300",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-5 text-sm font-medium">
            {product.stock > 0 ? (
              <span className="text-forest-700">
                In stock{product.stock < 10 ? ` — only ${product.stock} left` : ""}
              </span>
            ) : (
              <span className="text-red-600">Out of stock</span>
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} max={product.stock || 1} />
            <Button onClick={handleAddToCart} disabled={product.stock === 0} size="lg" className="flex-1 sm:flex-none">
              Add to Cart — {formatCurrency(price * quantity)}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => toggleWishlist(product.id)}
              aria-pressed={inWishlist}
              aria-label="Toggle wishlist"
            >
              <Heart size={18} className={cn(inWishlist && "fill-ember-600 text-ember-600")} />
            </Button>
          </div>

          <div className="mt-6 space-y-2.5 rounded-xl border border-ink-100 bg-cream-50 p-4 text-sm text-ink-600">
            <p className="flex items-center gap-2">
              <Truck size={16} className="text-forest-700" /> Free shipping on orders over $75
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-forest-700" /> 30-day hassle-free returns
            </p>
          </div>
        </div>
      </div>

      <div className="mt-14">
        <div className="flex gap-6 border-b border-ink-100">
          {(["description", "specs", "reviews"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 pb-3 text-sm font-semibold capitalize",
                tab === t ? "border-forest-800 text-forest-900" : "border-transparent text-ink-400",
              )}
            >
              {t === "specs" ? "Specifications" : t} {t === "reviews" && `(${reviews.length})`}
            </button>
          ))}
        </div>

        <div className="py-8">
          {tab === "description" && (
            <p className="max-w-3xl leading-relaxed text-ink-600">{product.description}</p>
          )}
          {tab === "specs" && (
            <dl className="grid max-w-2xl grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {product.specs.map((spec) => (
                <div key={spec.label} className="flex justify-between border-b border-ink-100 py-2 text-sm">
                  <dt className="text-ink-500">{spec.label}</dt>
                  <dd className="font-medium text-ink-900">{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {tab === "reviews" && (
            <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                {reviews.length === 0 && (
                  <p className="text-sm text-ink-500">No reviews yet. Be the first to share your experience.</p>
                )}
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-ink-100 pb-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-100 text-xs font-semibold text-forest-800">
                        {initials(review.author)}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {review.author}{" "}
                          {review.verified && (
                            <span className="ml-1 text-xs font-normal text-forest-600">
                              · Verified Purchase
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-400">{formatDate(review.date)}</p>
                      </div>
                    </div>
                    <Rating value={review.rating} size={14} className="mt-2" />
                    <p className="mt-2 text-sm font-semibold text-ink-900">{review.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{review.comment}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink-900">Write a review</h3>
                {user ? (
                  <form onSubmit={handleSubmitReview} className="mt-3 space-y-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button
                          type="button"
                          key={r}
                          onClick={() => setReviewForm((f) => ({ ...f, rating: r }))}
                          aria-label={`Rate ${r} stars`}
                          className={cn(
                            "h-8 w-8 rounded text-sm font-semibold",
                            reviewForm.rating >= r ? "bg-ember-500 text-white" : "bg-ink-100 text-ink-400",
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <input
                      required
                      placeholder="Review title"
                      value={reviewForm.title}
                      onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                    />
                    <Textarea
                      required
                      placeholder="Share details about your experience"
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                    />
                    <Button type="submit" size="sm" className="w-full">
                      Submit Review
                    </Button>
                  </form>
                ) : (
                  <p className="mt-3 text-sm text-ink-500">
                    <Link to="/login" className="font-semibold text-forest-800 underline">
                      Sign in
                    </Link>{" "}
                    to write a review.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-5 font-display text-2xl font-semibold text-ink-900">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
