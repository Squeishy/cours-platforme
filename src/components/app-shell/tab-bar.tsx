"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { isActive, type NavItem } from "./nav";

/** Barre d'onglets basse (< 1024 px) : cibles de 56 px, marge de zone sûre iOS */
export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="shell-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold"
              >
                <span
                  className={cx(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "bg-accent-soft text-accent" : "text-muted",
                  )}
                >
                  <Icon name={item.icon} size={20} />
                </span>
                <span className={cx("max-w-full truncate", active ? "text-accent" : "text-muted")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
