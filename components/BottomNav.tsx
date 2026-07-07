"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<string, React.ReactNode> = {
  log: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  history: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  metaphors: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 12m-1 0a1 1 0 1 0 2 0 3 3 0 1 0-6 0 5 5 0 1 0 10 0 7 7 0 1 0-14 0 9 9 0 1 0 18 0" />
    </svg>
  ),
  stats: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20H2" />
    </svg>
  ),
};

const TABS = [
  { href: "/", label: "Log", icon: "log" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/metaphors", label: "Metaphors", icon: "metaphors" },
  { href: "/stats", label: "Stats", icon: "stats" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => {
        const active =
          t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            <span className="icon" aria-hidden>
              {ICONS[t.icon]}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
