"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { deleteSlideAction, reorderSlidesAction, upsertSlideAction } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SlideFormValues = {
  id: string | null;
  title: string;
  subtitle: string;
  image: string;
  ctaText: string;
  ctaLink: string;
  sortOrder: number;
  isActive: boolean;
};

const IMAGE_SUGGESTIONS =
  "/images/hero-new-arrivals.png, /images/hero-elevate.png, /images/hero-sale.png";

function emptySlide(nextSortOrder: number): SlideFormValues {
  return {
    id: null,
    title: "",
    subtitle: "",
    image: "",
    ctaText: "Shop Now",
    ctaLink: "/products",
    sortOrder: nextSortOrder,
    isActive: true,
  };
}

// ---------------------------------------------------------------------------
// Add / Edit slide dialog
// ---------------------------------------------------------------------------

export function SlideDialogButton({
  slide,
  nextSortOrder,
  label,
}: {
  slide: SlideFormValues | null;
  /** Sort order used when creating a new slide. */
  nextSortOrder: number;
  /** Trigger label for the "add" variant; omit to render a compact edit icon. */
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<SlideFormValues>(slide ?? emptySlide(nextSortOrder));

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(slide ?? emptySlide(nextSortOrder));
      setError(null);
    }
    setOpen(next);
  }

  function setField<K extends keyof SlideFormValues>(key: K, value: SlideFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (form.image.trim() === "") {
      setError("An image path is required.");
      return;
    }

    setPending(true);
    try {
      const result = await upsertSlideAction({
        id: form.id,
        title: form.title,
        subtitle: form.subtitle,
        image: form.image.trim(),
        ctaText: form.ctaText,
        ctaLink: form.ctaLink,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      });
      if (result.ok) {
        toast({ title: form.id ? "Slide updated" : "Slide created", variant: "success" });
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
        toast({ title: "Could not save slide", description: result.error, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {label ? (
        <Button onClick={() => handleOpenChange(true)}>
          <Plus aria-hidden /> {label}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => handleOpenChange(true)}
          aria-label={`Edit slide ${slide?.title ?? ""}`}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit Slide" : "Add Slide"}</DialogTitle>
          <DialogDescription>
            Hero banners shown at the top of the storefront home page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slide-title">Title</Label>
            <Input
              id="slide-title"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="New Arrivals"
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slide-subtitle">Subtitle</Label>
            <Input
              id="slide-subtitle"
              value={form.subtitle}
              onChange={(e) => setField("subtitle", e.target.value)}
              placeholder="Fresh looks for your kitchen"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slide-image">Image path</Label>
            <Input
              id="slide-image"
              value={form.image}
              onChange={(e) => setField("image", e.target.value)}
              placeholder="/images/hero-new-arrivals.png"
              className="font-mono text-xs"
              required
            />
            <p className="text-xs text-muted-foreground">Suggested paths: {IMAGE_SUGGESTIONS}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slide-cta-text">CTA text</Label>
              <Input
                id="slide-cta-text"
                value={form.ctaText}
                onChange={(e) => setField("ctaText", e.target.value)}
                placeholder="Shop Now"
                maxLength={40}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slide-cta-link">CTA link</Label>
              <Input
                id="slide-cta-link"
                value={form.ctaLink}
                onChange={(e) => setField("ctaLink", e.target.value)}
                placeholder="/products"
                maxLength={200}
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(24_70%_50%)]"
              checked={form.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
            />
            Active (shown on the home page)
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {form.id ? "Save Changes" : "Create Slide"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

export function SlideDeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      const result = await deleteSlideAction(id);
      if (result.ok) {
        toast({ title: "Slide deleted", variant: "success" });
        setOpen(false);
        router.refresh();
      } else {
        toast({ title: "Could not delete slide", description: result.error, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label={`Delete slide ${title}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete slide</DialogTitle>
          <DialogDescription>
            Remove <strong>{title}</strong> from the hero carousel? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Active toggle (via guarded upsert)
// ---------------------------------------------------------------------------

export function SlideToggleButton({ slide }: { slide: SlideFormValues }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  async function handleToggle() {
    setPending(true);
    try {
      const result = await upsertSlideAction({
        id: slide.id,
        title: slide.title,
        subtitle: slide.subtitle,
        image: slide.image,
        ctaText: slide.ctaText,
        ctaLink: slide.ctaLink,
        sortOrder: slide.sortOrder,
        isActive: !slide.isActive,
      });
      if (result.ok) {
        toast({
          title: slide.isActive ? "Slide hidden" : "Slide activated",
          variant: "success",
        });
        router.refresh();
      } else {
        toast({ title: "Could not update slide", description: result.error, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", slide.isActive ? "text-emerald-600" : "text-muted-foreground")}
      onClick={handleToggle}
      disabled={pending}
      aria-label={slide.isActive ? `Hide slide ${slide.title}` : `Show slide ${slide.title}`}
      title={slide.isActive ? "Active — click to hide" : "Hidden — click to show"}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : slide.isActive ? (
        <Eye className="h-4 w-4" aria-hidden />
      ) : (
        <EyeOff className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Reorder (Move Up / Move Down via guarded reorder)
// ---------------------------------------------------------------------------

export function SlideMoveButton({
  ids,
  index,
  direction,
}: {
  /** The full ordered list of slide ids. */
  ids: string[];
  index: number;
  direction: "up" | "down";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  const disabled = pending || targetIndex < 0 || targetIndex >= ids.length;

  async function handleMove() {
    if (disabled) return;
    const next = [...ids];
    const a = next[index];
    const b = next[targetIndex];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[targetIndex] = a;

    setPending(true);
    try {
      const result = await reorderSlidesAction(next);
      if (result.ok) {
        toast({ title: "Slide order updated", variant: "success" });
        router.refresh();
      } else {
        toast({ title: "Could not reorder slides", description: result.error, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      onClick={handleMove}
      disabled={disabled}
      aria-label={direction === "up" ? "Move slide up" : "Move slide down"}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : direction === "up" ? (
        <ArrowUp className="h-4 w-4" aria-hidden />
      ) : (
        <ArrowDown className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
