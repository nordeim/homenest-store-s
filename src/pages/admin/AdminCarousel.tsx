import { useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useCatalogStore } from "@/store/catalogStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { CarouselSlide } from "@/types";

const emptyForm = { title: "", subtitle: "", image: "", ctaText: "Shop Now", ctaLink: "/products" };

export function AdminCarousel() {
  const slides = useCatalogStore((s) => s.slides);
  const addSlide = useCatalogStore((s) => s.addSlide);
  const updateSlide = useCatalogStore((s) => s.updateSlide);
  const deleteSlide = useCatalogStore((s) => s.deleteSlide);
  const push = useToastStore((s) => s.push);

  const [editing, setEditing] = useState<CarouselSlide | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const sorted = [...slides].sort((a, b) => a.order - b.order);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(slide: CarouselSlide) {
    setEditing(slide);
    setForm({ title: slide.title, subtitle: slide.subtitle, image: slide.image, ctaText: slide.ctaText, ctaLink: slide.ctaLink });
    setModalOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      updateSlide(editing.id, form);
      push("Slide updated", "success");
    } else {
      addSlide({ ...form, image: form.image || "/images/hero-main.jpg", order: slides.length + 1, active: true });
      push("Slide created", "success");
    }
    setModalOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Homepage Carousel</h1>
          <p className="text-sm text-ink-500">Manage hero banners shown on the storefront homepage.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Add Slide
        </Button>
      </div>

      <div className="space-y-4">
        {sorted.map((slide) => (
          <div key={slide.id} className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-cream-50 p-4 sm:flex-row">
            <img src={slide.image} alt="" className="h-28 w-full rounded-xl object-cover sm:w-44" />
            <div className="flex-1">
              <p className="font-semibold text-ink-900">{slide.title}</p>
              <p className="mt-1 text-sm text-ink-500">{slide.subtitle}</p>
              <p className="mt-1 text-xs text-ink-400">
                CTA: {slide.ctaText} → {slide.ctaLink}
              </p>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <button
                onClick={() => updateSlide(slide.id, { active: !slide.active })}
                className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                aria-label={slide.active ? "Hide slide" : "Show slide"}
                title={slide.active ? "Active — click to hide" : "Hidden — click to show"}
              >
                {slide.active ? <Eye size={16} className="text-forest-700" /> : <EyeOff size={16} />}
              </button>
              <button onClick={() => openEdit(slide)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" aria-label="Edit slide">
                <Pencil size={16} />
              </button>
              <button
                onClick={() => {
                  deleteSlide(slide.id);
                  push("Slide removed", "success");
                }}
                className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete slide"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Slide" : "Add Slide"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Subtitle" required value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          <Input label="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="CTA Text" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} />
            <Input label="CTA Link" value={form.ctaLink} onChange={(e) => setForm({ ...form, ctaLink: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save Changes" : "Create Slide"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
