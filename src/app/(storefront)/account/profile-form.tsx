"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { updateProfileAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";

/**
 * Profile settings island — name + phone, prefilled from the session user,
 * saved through the existing `updateProfileAction` server action.
 */
export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string | null }) {
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    try {
      const result = await updateProfileAction(formData);
      if (result.ok) {
        toast({
          title: "Profile updated",
          description: "Your changes have been saved.",
          variant: "success",
        });
      } else {
        setError(result.error);
        toast({
          title: "Could not update profile",
          description: result.error,
          variant: "destructive",
        });
      }
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
    <form
      onSubmit={handleSubmit}
      className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Full name</Label>
        <Input
          id="profile-name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          defaultValue={name}
          autoComplete="name"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          type="email"
          defaultValue={email}
          disabled
          aria-describedby="profile-email-hint"
        />
        <p id="profile-email-hint" className="text-xs text-muted-foreground">
          Your sign-in email can&apos;t be changed.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-phone">
          Phone <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="profile-phone"
          name="phone"
          type="tel"
          maxLength={40}
          defaultValue={phone ?? ""}
          placeholder="+1 (555) 000-0000"
          autoComplete="tel"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
