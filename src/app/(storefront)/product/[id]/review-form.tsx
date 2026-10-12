"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";

import { submitReviewAction } from "@/lib/actions/reviews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

/**
 * ReviewForm — client island posting through the submitReviewAction server
 * action. The author name is prefilled when the visitor is signed in
 * (passed down from the server page via getCurrentUser).
 */
export function ReviewForm({ productId, authorName }: { productId: string; authorName?: string | null }) {
  const [name, setName] = React.useState(authorName ?? "");
  const [rating, setRating] = React.useState(5);
  const [title, setTitle] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await submitReviewAction(productId, rating, title, comment, name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast({
        title: "Thanks for your review!",
        description: "It has been published below.",
        variant: "success",
      });
      setTitle("");
      setComment("");
      setRating(5);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="font-display text-lg font-semibold">Write a Review</h3>
      <p className="mt-1 text-sm text-muted-foreground">Share your experience with this product.</p>

      <div className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-name">Your name</Label>
          <Input
            id="review-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label id="review-rating-label">Your rating</Label>
          <div role="radiogroup" aria-labelledby="review-rating-label" className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                onClick={() => setRating(value)}
                disabled={pending}
                className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
              >
                <Star
                  className={cn(
                    "h-6 w-6",
                    value <= rating ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200",
                  )}
                  aria-hidden
                />
              </button>
            ))}
            <span className="ml-2 text-sm text-muted-foreground" aria-live="polite">
              {rating} / 5
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-title">Title</Label>
          <Input
            id="review-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Great quality, fast delivery"
            maxLength={120}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-comment">Your review</Label>
          <Textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what you liked or what could be better…"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="self-start">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Submitting…" : "Submit Review"}
        </Button>
      </div>
    </form>
  );
}
