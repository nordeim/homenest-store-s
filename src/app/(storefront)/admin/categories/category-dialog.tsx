"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { deleteCategoryAction, upsertCategoryAction } from "@/lib/actions/admin";
import { slugify } from "@/lib/format";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type CategoryFormValues = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  icon: string;
  iconGradient: string;
  sortOrder: string;
  isActive: boolean;
};

export const CATEGORY_ICON_OPTIONS = [
  { value: "cooking-pot", label: "Cooking Pot" },
  { value: "cake", label: "Cake" },
  { value: "utensils-crossed", label: "Utensils" },
  { value: "package", label: "Package" },
  { value: "zap", label: "Zap" },
  { value: "wine", label: "Wine" },
  { value: "sparkles", label: "Sparkles" },
  { value: "sprout", label: "Sprout" },
] as const;

export const CATEGORY_GRADIENT_OPTIONS = [
  { value: "from-orange-400 to-orange-600", label: "Orange" },
  { value: "from-pink-400 to-pink-600", label: "Pink" },
  { value: "from-amber-400 to-orange-500", label: "Amber" },
  { value: "from-teal-400 to-emerald-500", label: "Teal" },
  { value: "from-blue-400 to-blue-600", label: "Blue" },
  { value: "from-purple-400 to-purple-600", label: "Purple" },
  { value: "from-cyan-400 to-sky-500", label: "Cyan" },
  { value: "from-green-400 to-emerald-600", label: "Green" },
] as const;

function emptyCategory(): CategoryFormValues {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    icon: "package",
    iconGradient: "from-orange-400 to-orange-600",
    sortOrder: "0",
    isActive: true,
  };
}

// ---------------------------------------------------------------------------
// Add / Edit category dialog
// ---------------------------------------------------------------------------

export function CategoryDialogButton({
  category,
  label,
}: {
  category: CategoryFormValues | null;
  /** Trigger label for the "add" variant; omit to render a compact edit icon. */
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<CategoryFormValues>(category ?? emptyCategory());
  const slugTouched = React.useRef(Boolean(category?.slug));

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(category ?? emptyCategory());
      slugTouched.current = Boolean(category?.slug);
      setError(null);
    }
    setOpen(next);
  }

  function setField<K extends keyof CategoryFormValues>(key: K, value: CategoryFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const sortOrder = Number(form.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError("Sort order must be a whole number of 0 or more.");
      return;
    }

    setPending(true);
    try {
      const result = await upsertCategoryAction({
        id: form.id,
        name: form.name,
        slug: form.slug,
        description: form.description,
        icon: form.icon,
        iconGradient: form.iconGradient,
        sortOrder,
        isActive: form.isActive,
      });
      if (result.ok) {
        toast({ title: form.id ? "Category updated" : "Category created", variant: "success" });
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
        toast({ title: "Could not save category", description: result.error, variant: "destructive" });
      }
    } catch {
      // Session-13 S13-2: unknown errors must be visible, never silent.
      setError("Something went wrong. Please try again.");
      toast({ title: "Something went wrong", description: "The category did not save. Please try again.", variant: "destructive" });
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
          aria-label={`Edit ${category?.name ?? "category"}`}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit Category" : "Add Category"}</DialogTitle>
          <DialogDescription>
            Categories group the catalog and appear as tiles on the storefront home page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({ ...prev, name, slug: slugTouched.current ? prev.slug : slugify(name) }));
              }}
              placeholder="Cookware"
              required
              maxLength={60}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              value={form.slug}
              onChange={(e) => {
                slugTouched.current = true;
                setField("slug", e.target.value);
              }}
              placeholder="cookware"
              required
              maxLength={60}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Short description shown under the category name."
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category-icon">Icon</Label>
              <Select value={form.icon} onValueChange={(value) => setField("icon", value)}>
                <SelectTrigger id="category-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-gradient">Icon gradient</Label>
              <Select value={form.iconGradient} onValueChange={(value) => setField("iconGradient", value)}>
                <SelectTrigger id="category-gradient">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_GRADIENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div
                aria-hidden
                className={cn("h-2 w-full rounded-full bg-gradient-to-br", form.iconGradient)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category-sort">Sort order</Label>
              <Input
                id="category-sort"
                type="number"
                min={0}
                step={1}
                value={form.sortOrder}
                onChange={(e) => setField("sortOrder", e.target.value)}
                required
              />
            </div>
            <label className="flex items-end gap-2 pb-2.5 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(24_70%_50%)]"
                checked={form.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
              />
              Active (visible in store)
            </label>
          </div>

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
              {form.id ? "Save Changes" : "Create Category"}
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

export function CategoryDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      const result = await deleteCategoryAction(id);
      if (result.ok) {
        toast({ title: "Category deleted", variant: "success" });
        setOpen(false);
        router.refresh();
      } else {
        toast({ title: "Could not delete category", description: result.error, variant: "destructive" });
      }
    } catch {
      // Session-13 S13-2: unknown errors must be visible, never silent.
      toast({ title: "Something went wrong", description: "The category was not deleted. Please try again.", variant: "destructive" });
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
        aria-label={`Delete ${name}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete category</DialogTitle>
          <DialogDescription>
            Delete <strong>{name}</strong>? This is only possible when no products are assigned to it.
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

export function CategoryToggleButton({ category }: { category: CategoryFormValues }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  async function handleToggle() {
    setPending(true);
    try {
      const result = await upsertCategoryAction({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        iconGradient: category.iconGradient,
        sortOrder: Number(category.sortOrder) || 0,
        isActive: !category.isActive,
      });
      if (result.ok) {
        toast({
          title: category.isActive ? "Category hidden" : "Category activated",
          variant: "success",
        });
        router.refresh();
      } else {
        toast({ title: "Could not update category", description: result.error, variant: "destructive" });
      }
    } catch {
      // Session-13 S13-2: unknown errors must be visible, never silent.
      toast({ title: "Something went wrong", description: "The category was not updated. Please try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", category.isActive ? "text-emerald-600" : "text-muted-foreground")}
      onClick={handleToggle}
      disabled={pending}
      aria-label={category.isActive ? `Hide ${category.name}` : `Show ${category.name}`}
      title={category.isActive ? "Active — click to hide" : "Hidden — click to show"}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : category.isActive ? (
        <Eye className="h-4 w-4" aria-hidden />
      ) : (
        <EyeOff className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
