"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Menu, X, Moon, Sun } from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "./ThemeProvider";
import { NotificationBell } from "./NotificationBell";

const AuthButton = dynamic(
  () => import("./AuthButton").then((m) => ({ default: m.AuthButton })),
  { ssr: false, loading: () => <div className="skeleton w-24 h-8 rounded-lg" /> }
);

const NAV_LINKS = [
  { href: "/marketplace", label: "Creators" },
  { href: "/jobs", label: "Jobs" },
  { href: "/post-job", label: "Post Job" },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: "color-mix(in srgb, var(--surface) 80%, transparent)",
        backdropFilter: "blur(12px)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        {/* Logo — flex-1 so nav links are truly centered */}
        <div className="flex-1">
          <Link href="/" className="flex items-center gap-2 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Yapper Agent" className="w-7 h-7" />
            <span className="font-bold text-sm tracking-tight" style={{ color: "var(--text-1)" }}>
              Yapper<span className="text-blue-500"> Agent</span>
            </span>
          </Link>
        </div>

        {/* Desktop links — center */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-600"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side — flex-1 justify-end */}
        <div className="flex-1 flex items-center justify-end gap-2">
          {pathname === "/dashboard" && <NotificationBell />}
          <ThemeToggle />
          <AuthButton />

          <button
            className="md:hidden p-1.5 rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-t px-4 py-3 flex flex-col gap-1"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-600"
                  : "text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          >
            Dashboard
          </Link>
        </div>
      )}
    </nav>
  );
}
