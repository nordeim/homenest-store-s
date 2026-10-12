import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCatalogStore } from "@/store/catalogStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/types";

type FormState = {
  name: string;
  categorySlug: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  sku: string;
  image: string;
  shortDescription: string;
  description: string;
  status: Product["status"];
  featured: boolean;
  isNew: boolean;
  isBestseller: boolean;
};

const emptyForm: FormState = {
  name: "",
  categorySlug: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  sku: "",
  image: "",
  shortDescription: "",
  description: "",
  status: "active",
  featured: false,
  isNew: false,
  isBestseller: false,
};

export function AdminProducts() {
  const products = useCatalogStore((s) => s.products);
  const categories = useCatalogStore((s) => s.categories);
  const addProduct = useCatalogStore((s) => s.addProduct);
  const updateProduct = useCatalogStore((s) => s.updateProduct);
  const deleteProduct = useCatalogStore((s) => s.deleteProduct);
  const push = useToastStore((s) => s.push);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, query],
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, categorySlug: categories[0]?.slug ?? "" });
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      categorySlug: product.categorySlug,
      price: String(product.price),
      compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : "",
      stock: String(product.stock),
      sku: product.sku,
      image: product.images[0] ?? "",
      shortDescription: product.shortDescription,
      description: product.description,
      status: product.status,
      featured: product.featured,
      isNew: product.isNew,
      isBestseller: product.isBestseller,
    });
    setModalOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const slug =
      editing?.slug ??
      form.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const payload = {
      name: form.name,
      slug,
      currency: "USD",
      categorySlug: form.categorySlug,
      price: Number(form.price) || 0,
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
      images: [form.image || "/images/category-cookware.jpg"],
      shortDescription: form.shortDescription,
      description: form.description || form.shortDescription,
      specs: editing?.specs ?? [],
      rating: editing?.rating ?? 0,
      reviewCount: editing?.reviewCount ?? 0,
      stock: Number(form.stock) || 0,
      sku: form.sku,
      tags: editing?.tags ?? [],
      featured: form.featured,
      isNew: form.isNew,
      isBestseller: form.isBestseller,
      status: form.status,
    };

    if (editing) {
      updateProduct(editing.id, payload);
      push("Product updated", "success");
    } else {
      addProduct(payload);
      push("Product created", "success");
    }
    setModalOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Products</h1>
          <p className="text-sm text-ink-500">{products.length} total products</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Add Product
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or SKU"
          className="w-full rounded-lg border border-ink-200 bg-cream-50 py-2.5 pl-9 pr-3 text-sm focus:border-forest-600 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-cream-50">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <th className="p-4">Product</th>
              <th className="p-4">Category</th>
              <th className="p-4">Price</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.map((product) => (
              <tr key={product.id}>
                <td className="flex items-center gap-3 p-4">
                  <img src={product.images[0]} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  <div>
                    <p className="font-medium text-ink-900">{product.name}</p>
                    <p className="text-xs text-ink-400">{product.sku}</p>
                  </div>
                </td>
                <td className="p-4 capitalize text-ink-600">{product.categorySlug.replace("-", " ")}</td>
                <td className="p-4 font-medium text-ink-900">{formatCurrency(product.price)}</td>
                <td className="p-4">
                  <span className={product.stock <= 10 ? "font-semibold text-amber-600" : "text-ink-600"}>
                    {product.stock}
                  </span>
                </td>
                <td className="p-4">
                  <Badge tone={product.status === "active" ? "forest" : "neutral"}>{product.status}</Badge>
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(product)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
                      aria-label={`Edit ${product.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(product)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete ${product.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ink-400">
                  No products match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Product" : "Add Product"} maxWidthClass="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Product Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select
              label="Category"
              required
              value={form.categorySlug}
              onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Price" type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input
              label="Compare-at Price"
              type="number"
              step="0.01"
              value={form.compareAtPrice}
              onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
            />
            <Input label="Stock" type="number" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="SKU" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Product["status"] })}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <Input
            label="Image URL"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            hint="Leave blank to use a default image"
          />
          <Textarea
            label="Short Description"
            required
            value={form.shortDescription}
            onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
          />
          <div className="flex flex-wrap gap-4 text-sm text-ink-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="accent-forest-700" />
              Featured
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isNew} onChange={(e) => setForm({ ...form, isNew: e.target.checked })} className="accent-forest-700" />
              New Arrival
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isBestseller} onChange={(e) => setForm({ ...form, isBestseller: e.target.checked })} className="accent-forest-700" />
              Bestseller
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save Changes" : "Create Product"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Delete Product">
        <p className="text-sm text-ink-600">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirmDelete) {
                deleteProduct(confirmDelete.id);
                push("Product deleted", "success");
              }
              setConfirmDelete(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
