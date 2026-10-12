import { useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { useCatalogStore } from "@/store/catalogStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";

export function Contact() {
  const settings = useCatalogStore((s) => s.settings);
  const push = useToastStore((s) => s.push);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    push("Message sent — we'll reply within 1 business day.", "success");
    setForm({ name: "", email: "", subject: "", message: "" });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Contact Us</h1>
      <p className="mt-2 max-w-xl text-ink-500">
        Have a question about an order, a product, or a partnership? Our team typically responds within one
        business day.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-ink-100 bg-cream-50 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Full Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <Input
            label="Subject"
            required
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <Textarea
            label="Message"
            required
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          <Button type="submit">Send Message</Button>
          {sent && <p className="text-sm text-forest-700">Thanks! Your message has been received.</p>}
        </form>

        <div className="space-y-4 rounded-2xl border border-ink-100 bg-cream-50 p-6 text-sm">
          <h2 className="text-base font-semibold text-ink-900">Reach us directly</h2>
          <p className="flex items-start gap-2 text-ink-600">
            <MapPin size={16} className="mt-0.5 shrink-0 text-forest-700" /> {settings.address}
          </p>
          <p className="flex items-center gap-2 text-ink-600">
            <Phone size={16} className="text-forest-700" /> {settings.contactPhone}
          </p>
          <p className="flex items-center gap-2 text-ink-600">
            <Mail size={16} className="text-forest-700" /> {settings.contactEmail}
          </p>
          <div className="border-t border-ink-100 pt-4">
            <h3 className="text-sm font-semibold text-ink-900">Support Hours</h3>
            <p className="mt-1 text-ink-500">Monday – Friday, 8am – 6pm PT</p>
            <p className="text-ink-500">Saturday, 9am – 3pm PT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
