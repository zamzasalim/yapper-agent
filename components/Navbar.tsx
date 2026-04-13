"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Zap, Menu, X } from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import so usePrivy only runs client-side (no SSR crash)
const AuthButton = dynamic(
  () => import("./AuthButton").then((m) => ({ default: m.AuthButton })),
  { ssr: false, loading: () => <div className="skeleton w-24 h-8 rounded-lg" /> }
);

const NAV_LINKS = [
  { href: "/marketplace", label: "Creators" },
  { href: "/jobs", label: "Jobs" },
  { href: "/post-job", label: "Post Job" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </span>
          <span className="font-bold text-sm tracking-tight text-neutral-900">
            yapper<span className="text-blue-600">.agent</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-blue-50 text-blue-600"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth + mobile toggle */}
        <div className="flex items-center gap-2">
          <AuthButton />

          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-blue-50 text-blue-600"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Dashboard
          </Link>
        </div>
      )}
    </nav>
  );
}
