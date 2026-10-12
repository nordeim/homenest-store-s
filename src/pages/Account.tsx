import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MapPin, Package, User as UserIcon } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useOrderStore } from "@/store/orderStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { WishlistGrid } from "@/components/shop/WishlistGrid";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import type { Address } from "@/types";

const tabs = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "orders", label: "Orders", icon: Package },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "wishlist", label: "Wishlist", icon: Heart },
] as const;

export function Account() {
  const user = useAuthStore((s) => s.currentUser())!;
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addAddress = useAuthStore((s) => s.addAddress);
  const removeAddress = useAuthStore((s) => s.removeAddress);
  const logout = useAuthStore((s) => s.logout);
  const orders = useOrderStore((s) => s.getByEmail(user.email));
  const push = useToastStore((s) => s.push);

  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("profile");
  const [name, setName] = useState(user.name);
  const [newAddress, setNewAddress] = useState<Address>({
    fullName: "",
    line1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",
    phone: "",
  });

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    updateProfile({ name });
    push("Profile updated", "success");
  }

  function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddress.fullName || !newAddress.line1 || !newAddress.city) return;
    addAddress(newAddress);
    setNewAddress({ fullName: "", line1: "", city: "", state: "", postalCode: "", country: "United States", phone: "" });
    push("Address added", "success");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-800 text-lg font-semibold text-cream-50">
          {initials(user.name)}
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">{user.name}</h1>
          <p className="text-sm text-ink-500">{user.email}</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={logout}>
          Sign Out
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                tab === t.id ? "bg-forest-800 text-cream-50" : "text-ink-600 hover:bg-ink-100"
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>

        <div>
          {tab === "profile" && (
            <form onSubmit={handleSaveProfile} className="max-w-md space-y-4 rounded-2xl border border-ink-100 bg-cream-50 p-6">
              <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Email" value={user.email} disabled hint="Contact support to change your email." />
              <Button type="submit">Save Changes</Button>
            </form>
          )}

          {tab === "orders" && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <EmptyState icon={Package} title="No orders yet" description="Your order history will appear here." />
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-ink-100 bg-cream-50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{order.orderNumber}</p>
                        <p className="text-xs text-ink-400">{formatDate(order.createdAt)}</p>
                      </div>
                      <StatusPill status={order.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-ink-500">{order.items.length} item(s)</p>
                      <p className="text-sm font-semibold text-ink-900">{formatCurrency(order.total)}</p>
                    </div>
                    <Link
                      to={`/order-tracking?order=${order.orderNumber}`}
                      className="mt-3 inline-block text-sm font-medium text-forest-800 hover:underline"
                    >
                      Track Order
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "addresses" && (
            <div className="space-y-6">
              <div className="space-y-3">
                {user.addresses.map((addr, i) => (
                  <div key={i} className="flex items-start justify-between rounded-xl border border-ink-100 bg-cream-50 p-4 text-sm">
                    <div>
                      <p className="font-semibold text-ink-900">{addr.fullName}</p>
                      <p className="text-ink-600">
                        {addr.line1}, {addr.city}, {addr.state} {addr.postalCode}
                      </p>
                      <p className="text-ink-500">{addr.phone}</p>
                    </div>
                    <button onClick={() => removeAddress(i)} className="text-xs font-semibold text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                ))}
                {user.addresses.length === 0 && <p className="text-sm text-ink-500">No saved addresses yet.</p>}
              </div>
              <form onSubmit={handleAddAddress} className="max-w-md space-y-3 rounded-2xl border border-ink-100 bg-cream-50 p-6">
                <h3 className="text-sm font-semibold text-ink-900">Add New Address</h3>
                <Input
                  label="Full Name"
                  value={newAddress.fullName}
                  onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                />
                <Input
                  label="Street Address"
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="City"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  />
                  <Input
                    label="State"
                    value={newAddress.state}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="ZIP Code"
                    value={newAddress.postalCode}
                    onChange={(e) => setNewAddress({ ...newAddress, postalCode: e.target.value })}
                  />
                  <Input
                    label="Phone"
                    value={newAddress.phone}
                    onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                  />
                </div>
                <Button type="submit" size="sm">
                  Add Address
                </Button>
              </form>
            </div>
          )}

          {tab === "wishlist" && <WishlistGrid />}
        </div>
      </div>
    </div>
  );
}
