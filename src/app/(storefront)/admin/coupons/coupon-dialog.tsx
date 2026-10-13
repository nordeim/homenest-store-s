"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { deleteCouponAction, upsertCouponAction } from "@/lib/actions/admin";
import { parseDollarsToCents } from "@/lib/money";
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

export type CouponFormValues = {
  id: string | null;
  code: string;
  type: "percent" | "fixed";
  /** percent: integer 1..100 · fixed: a dollar string parsed to cents. */
  value: string;
  description: string;
  /** Dollar string; "" / "0" = no minimum. */
  minSubtotalDollars: string;
  /** Date-input value (YYYY-MM-DD); "" = never expires. */
  expiresAtDate: string;
  /** "" = unlimited. */
  maxRedemptions: string;
  isActive: boolean;
};

function emptyCoupon(): CouponFormValues {
  return {
    id: null,
    code: "",
    type: "percent",
    value: "",
    description: "",
    minSubtotalDollars: "",
    expiresAtDate: "",
    maxRedemptions: "",
    isActive: true,
  };
}

// ---------------------------------------------------------------------------
// Add / edit coupon dialog
// ---------------------------------------------------------------------------

export function CouponDialogButton({
  coupon,
  label,
}: {
  coupon: CouponFormValues | null;
  /** Trigger label for the "add" variant; omit to render a compact edit icon. */
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<CouponFormValues>(coupon ?? emptyCoupon());

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(coupon ?? emptyCoupon());
      setError(null);
    }
    setOpen(next);
  }

  function setField<K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Type-aware value parsing: percent takes a whole 1..100 integer; fixed
    // takes a dollar amount parsed to integer cents (the product-form
    // convention). Both land as `value` (cents for fixed) in the action.
    let parsedValue: number;
    if (form.type === "percent") {
      parsedValue = Number(form.value);
      if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 100) {
        setError("Percent discount must be a whole number between 1 and 100.");
        return;
      }
    } else {
      const cents = parseDollarsToCents(form.value);
      if (cents === null || cents < 1) {
        setError("Amount off must be a dollar amount of $0.01 or more.");
        return;
      }
      parsedValue = cents;
    }

    let minSubtotal = 0;
    if (form.minSubtotalDollars.trim() !== "") {
      const cents = parseDollarsToCents(form.minSubtotalDollars);
      if (cents === null) {
        setError("Minimum subtotal must be a dollar amount, like 25.00.");
        return;
      }
      minSubtotal = cents;
    }

    let maxRedemptions: number | null = null;
    if (form.maxRedemptions.trim() !== "") {
      maxRedemptions = Number(form.maxRedemptions);
      if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1) {
        setError("Redemption cap must be a whole number of 1 or more.");
        return;
      }
    }

    // A date-only pick expires at the END of that day (UTC) — "valid
    // through" the selected date, matching the dialog's helper text.
    const expiresAt =
      form.expiresAtDate.trim() !== "" ? `${form.expiresAtDate.trim()}T23:59:59.999Z` : null;

    setPending(true);
    try {
      const result = await upsertCouponAction({
        id: form.id,
        code: form.code.trim(),
        type: form.type,
        value: parsedValue,
        description: form.description,
        minSubtotal,
        isActive: form.isActive,
        expiresAt,
        maxRedemptions,
      });
      if (result.ok) {
        toast({ title: form.id ? "Coupon updated" : "Coupon created", variant: "success" });
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
        toast({ title: "Could not save coupon", description: result.error, variant: "destructive" });
      }
    } catch {
      // Session-13 S13-2: unknown errors must be visible, never silent.
      setError("Something went wrong. Please try again.");
      toast({ title: "Something went wrong", description: "The coupon did not save. Please try again.", variant: "destructive" });
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
          aria-label={`Edit coupon ${coupon?.code ?? ""}`}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit Coupon" : "Add Coupon"}</DialogTitle>
          <DialogDescription>
            Coupons are redeemed at the cart and checkout — codes are matched case-insensitively.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Code</Label>
              <Input
                id="coupon-code"
                value={form.code}
                onChange={(e) => setField("code", e.target.value.toUpperCase())}
                placeholder="SAVE15"
                required
                minLength={3}
                maxLength={40}
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">Letters, numbers and dashes.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setField("type", value as CouponFormValues["type"])}
              >
                <SelectTrigger id="coupon-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent off</SelectItem>
                  <SelectItem value="fixed">Fixed amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-value">
                {form.type === "percent" ? "Percent off (1–100)" : "Amount off (USD)"}
              </Label>
              <div className="relative">
                {form.type === "fixed" && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                )}
                <Input
                  id="coupon-value"
                  type="number"
                  min={form.type === "percent" ? 1 : 0.01}
                  max={form.type === "percent" ? 100 : undefined}
                  step={form.type === "percent" ? 1 : 0.01}
                  value={form.value}
                  onChange={(e) => setField("value", e.target.value)}
                  required
                  className={form.type === "fixed" ? "pl-7" : undefined}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-min-subtotal">Minimum subtotal (USD)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="coupon-min-subtotal"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.minSubtotalDollars}
                  onChange={(e) => setField("minSubtotalDollars", e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">Leave empty or 0 for no minimum.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-expires">Expires</Label>
              <Input
                id="coupon-expires"
                type="date"
                value={form.expiresAtDate}
                onChange={(e) => setField("expiresAtDate", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Valid through the end of this day (UTC). Empty = never expires.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-max-redemptions">Redemption cap</Label>
              <Input
                id="coupon-max-redemptions"
                type="number"
                min={1}
                step={1}
                value={form.maxRedemptions}
                onChange={(e) => setField("maxRedemptions", e.target.value)}
                placeholder="Unlimited"
              />
              <p className="text-xs text-muted-foreground">Total times this code can be used.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coupon-description">Description</Label>
            <Textarea
              id="coupon-description"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Shown to customers when the code applies."
              maxLength={200}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(24_70%_50%)]"
              checked={form.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
            />
            Active (redeemable in store)
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
              {form.id ? "Save Changes" : "Create Coupon"}
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

export function CouponDeleteButton({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      const result = await deleteCouponAction(id);
      if (result.ok) {
        toast({ title: "Coupon deleted", variant: "success" });
        setOpen(false);
        router.refresh();
      } else {
        toast({ title: "Could not delete coupon", description: result.error, variant: "destructive" });
      }
    } catch {
      // Session-13 S13-2: unknown errors must be visible, never silent.
      toast({ title: "Something went wrong", description: "The coupon was not deleted. Please try again.", variant: "destructive" });
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
        aria-label={`Delete coupon ${code}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete coupon</DialogTitle>
          <DialogDescription>
            Delete <strong className="font-mono">{code}</strong>? Past orders keep the discount they
            recorded — only the code stops existing.
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
// Active toggle (via guarded upsert — round-trips the STORED values)
// ---------------------------------------------------------------------------

export function CouponToggleButton({ coupon }: { coupon: CouponFormValues }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  async function handleToggle() {
    setPending(true);
    try {
      const result = await upsertCouponAction({
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        // The page's form values carry the display shapes: percent is already
        // a whole number; fixed is a dollar string parsed back to cents.
        value:
          coupon.type === "fixed"
            ? parseDollarsToCents(coupon.value) ?? -1
            : Number(coupon.value),
        description: coupon.description,
        minSubtotal:
          coupon.minSubtotalDollars.trim() === ""
            ? 0
            : parseDollarsToCents(coupon.minSubtotalDollars) ?? 0,
        isActive: !coupon.isActive,
        expiresAt: coupon.expiresAtDate ? `${coupon.expiresAtDate}T23:59:59.999Z` : null,
        maxRedemptions:
          coupon.maxRedemptions.trim() === "" ? null : Number(coupon.maxRedemptions),
      });
      if (result.ok) {
        toast({
          title: coupon.isActive ? "Coupon deactivated" : "Coupon activated",
          variant: "success",
        });
        router.refresh();
      } else {
        toast({ title: "Could not update coupon", description: result.error, variant: "destructive" });
      }
    } catch {
      // Session-13 S13-2: unknown errors must be visible, never silent.
      toast({ title: "Something went wrong", description: "The coupon was not updated. Please try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", coupon.isActive ? "text-emerald-600" : "text-muted-foreground")}
      onClick={handleToggle}
      disabled={pending}
      aria-label={coupon.isActive ? `Deactivate coupon ${coupon.code}` : `Activate coupon ${coupon.code}`}
      title={coupon.isActive ? "Active — click to deactivate" : "Inactive — click to activate"}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : coupon.isActive ? (
        <Eye className="h-4 w-4" aria-hidden />
      ) : (
        <EyeOff className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
