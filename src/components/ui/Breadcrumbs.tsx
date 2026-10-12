import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => (
          <Fragment key={item.label}>
            {idx > 0 && <ChevronRight size={14} className="text-ink-300" aria-hidden="true" />}
            <li>
              {item.to ? (
                <Link to={item.to} className="hover:text-forest-700 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-ink-800" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
