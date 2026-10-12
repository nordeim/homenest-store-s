import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCatalogStore } from "@/store/catalogStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Category } from "@/types";

const emptyForm = { name: "", slug: "", description: "", image: "", featured: true };

export function AdminCategories() {
  const categories = useCatalogStore((s) => s.categories);
  const addCategory = useCatalogStore((s) => s.addCategory);
  const updateCategory = useCatalogStore((s) => s.updateCategory);
  const deleteCategory = useCatalogStore((s) => s.deleteCategory);
  const products = useCatalogStore((s) => s.products);
  const push = useToastStore((s) => s.push);

  const [editing, setEditing] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({ name: cat.name, slug: cat.slug, description: cat.description, image: cat.image, featured: cat.featured });
    setModalOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (editing) {
      updateCategory(editing.id, { ...form, slug });
      push("Category updated", "success");
    } else {
      addCategory({ ...form, slug, image: form.image || "/images/category-cookware.jpg" });
      push("Category created", "success");
    }
    setModalOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Categories</h1>
          <p className="text-sm text-ink-500">{categories.length} categories</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div key={cat.id} className="overflow-hidden rounded-2xl border border-ink-200 bg-cream-50">
            <img src={cat.image} alt="" className="h-32 w-full object-cover" />
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{cat.name}</p>
                  <p className="text-xs text-ink-400">/{cat.slug}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(cat)} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Edit ${cat.name}`}>
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(cat)}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-500">{products.filter((p) => p.categorySlug === cat.slug).length} products</p>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Category" : "Add Category"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} hint="Auto-generated if left blank" />
          <Textarea label="Description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save Changes" : "Create Category"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Delete Category">
        <p className="text-sm text-ink-600">
          Delete <strong>{confirmDelete?.name}</strong>? Products in this category will remain but lose their category link.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirmDelete) {
                deleteCategory(confirmDelete.id);
                push("Category deleted", "success");
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
