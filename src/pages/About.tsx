import { Award, Leaf, Users } from "lucide-react";
import { img } from "@/data/images";
import { useCatalogStore } from "@/store/catalogStore";

const values = [
  { icon: Award, title: "Uncompromising Quality", desc: "Every product is tested for durability before it reaches your kitchen." },
  { icon: Leaf, title: "Responsible Sourcing", desc: "We partner with manufacturers who prioritize sustainable materials and ethical labor." },
  { icon: Users, title: "Customer First", desc: "A dedicated support team and generous guarantees back every purchase." },
];

export function About() {
  const settings = useCatalogStore((s) => s.settings);

  return (
    <div>
      <section className="relative h-72 overflow-hidden sm:h-96">
        <img src={img.aboutWorkshop} alt="Artisans crafting kitchenware" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink-950/55" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-cream-50">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Our Story</h1>
          <p className="mt-3 max-w-xl text-sm text-cream-100/90 sm:text-base">{settings.tagline}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
        <p className="leading-relaxed text-ink-600">
          {settings.storeName} started in a single apartment kitchen with a simple frustration: cookware that
          looked beautiful in photos but warped, scratched or dulled within months. Since then, we've grown into
          a team obsessed with sourcing cookware, cutlery and storage solutions that are built to outlast trends —
          and backed by guarantees we're proud to stand behind.
        </p>
      </section>

      <section className="bg-forest-50/60 py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 sm:grid-cols-3 sm:px-6">
          {values.map((v) => (
            <div key={v.title} className="rounded-2xl bg-cream-50 p-6 text-center shadow-soft">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-forest-100 text-forest-700">
                <v.icon size={22} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{v.title}</h3>
              <p className="mt-2 text-sm text-ink-500">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-14 text-center sm:grid-cols-4 sm:px-6">
        {[
          { stat: "120K+", label: "Happy Households" },
          { stat: "4.8/5", label: "Average Rating" },
          { stat: "30-Day", label: "Hassle-Free Returns" },
          { stat: "Lifetime", label: "Knife Sharpening" },
        ].map((item) => (
          <div key={item.label}>
            <p className="font-display text-3xl font-semibold text-forest-800">{item.stat}</p>
            <p className="mt-1 text-sm text-ink-500">{item.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
