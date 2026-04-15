import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  icon?: "home";
};

type Props = {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: Props) {
  return (
    <nav aria-label="현재 위치" className="mb-3 flex items-center gap-1.5 text-base text-slate-500">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const content = (
          <span className={`inline-flex items-center gap-1 ${isLast ? "font-semibold text-slate-800" : "hover:text-slate-700"}`}>
            {item.icon === "home" && <Home className="h-4 w-4" />}
            {item.label}
          </span>
        );
        return (
          <span key={idx} className="inline-flex items-center gap-1.5">
            {item.href && !isLast ? <Link href={item.href}>{content}</Link> : content}
            {!isLast && <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />}
          </span>
        );
      })}
    </nav>
  );
}
