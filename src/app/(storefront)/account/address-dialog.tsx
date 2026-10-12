"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";

/**
 * Account address islands: the "Add Address" dialog (POST /api/addresses),
 * the per-card "set default" control (PATCH /api/addresses — session-8
 * S8-1) and the per-card delete control (DELETE /api/addresses?id=...).
 * All refresh the server-rendered list via router.refresh().
 */

type AddressFormValues = {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

const EMPTY_FORM: AddressFormValues = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
};

export function AddressDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<AddressFormValues>(EMPTY_FORM);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function setField(field: keyof AddressFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save the address. Please try again.");
        return;
      }
      toast({
        title: "Address saved",
        description: "Your new address is ready for checkout.",
        variant: "success",
      });
      setValues(EMPTY_FORM);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus aria-hidden /> Add Address
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a new address</DialogTitle>
          <DialogDescription>
            Saved addresses speed up checkout — add the ones you ship to most.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="addr-label">Label</Label>
              <Input
                id="addr-label"
                value={values.label}
                onChange={(e) => setField("label", e.target.value)}
                maxLength={40}
                placeholder="Home"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-fullname">Full name</Label>
              <Input
                id="addr-fullname"
                value={values.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                maxLength={80}
                autoComplete="name"
                placeholder="Ada Lovelace"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="addr-line1">Street address</Label>
            <Input
              id="addr-line1"
              value={values.line1}
              onChange={(e) => setField("line1", e.target.value)}
              maxLength={120}
              autoComplete="address-line1"
              placeholder="123 Kitchen Lane"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="addr-line2">
              Apartment, suite <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="addr-line2"
              value={values.line2}
              onChange={(e) => setField("line2", e.target.value)}
              maxLength={120}
              autoComplete="address-line2"
              placeholder="Apt 4B"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="addr-city">City</Label>
              <Input
                id="addr-city"
                value={values.city}
                onChange={(e) => setField("city", e.target.value)}
                maxLength={60}
                autoComplete="address-level2"
                placeholder="Home City"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-state">State</Label>
              <Input
                id="addr-state"
                value={values.state}
                onChange={(e) => setField("state", e.target.value)}
                maxLength={60}
                autoComplete="address-level1"
                placeholder="HC"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="addr-postal">ZIP code</Label>
              <Input
                id="addr-postal"
                value={values.postalCode}
                onChange={(e) => setField("postalCode", e.target.value)}
                maxLength={20}
                autoComplete="postal-code"
                placeholder="10001"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-country">Country</Label>
              <Input
                id="addr-country"
                value={values.country}
                onChange={(e) => setField("country", e.target.value)}
                maxLength={60}
                autoComplete="country-name"
                placeholder="United States"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="addr-phone">Phone</Label>
            <Input
              id="addr-phone"
              type="tel"
              value={values.phone}
              onChange={(e) => setField("phone", e.target.value)}
              maxLength={40}
              autoComplete="tel"
              placeholder="+1 (555) 123-4567"
              required
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {pending ? "Saving..." : "Save Address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SetDefaultAddressButton({ addressId, label }: { addressId: string; label: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  async function handleSetDefault() {
    setPending(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: addressId, isDefault: true }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast({
          title: "Could not set the default address",
          description: data.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Default address updated",
        description: `“${label}” will prefill checkout.`,
        variant: "success",
      });
      router.refresh();
    } catch {
      toast({
        title: "Network error",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleSetDefault}
      disabled={pending}
      aria-label={`Set ${label} as the default address`}
      className="h-8 px-2.5"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Star aria-hidden />}
      Set as default
    </Button>
  );
}

export function DeleteAddressButton({ addressId, label }: { addressId: string; label: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(`Delete the "${label}" address? This can't be undone.`);
    if (!confirmed) return;
    setPending(true);
    try {
      const res = await fetch(`/api/addresses?id=${encodeURIComponent(addressId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast({
          title: "Could not delete address",
          description: data.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Address removed",
        description: "The saved address was deleted.",
        variant: "success",
      });
      router.refresh();
    } catch {
      toast({
        title: "Network error",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
      aria-label={`Delete ${label} address`}
      className="h-8 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
      Remove
    </Button>
  );
}
