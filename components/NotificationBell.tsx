"use client";

import { useAppKitAccount } from "@reown/appkit/react";
import { useState, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";

interface Notification {
  id: string;
  message: string;
  job_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { embeddedWalletInfo, isConnected } = useAppKitAccount();
  const handle = (embeddedWalletInfo?.user?.username ?? "").replace(/^@/, "");

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!handle) return;

    async function fetchNotifs() {
      try {
        const r = await fetch(`/api/notifications?handle=${encodeURIComponent(handle)}`);
        const d = await r.json();
        setNotifications(d.notifications ?? []);
      } catch { /* ignore */ }
    }

    fetchNotifs();
    const timer = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(timer);
  }, [handle]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleMarkRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  if (!isConnected || !handle) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-xl z-50 overflow-hidden"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>Notifications</span>
            <button onClick={() => setOpen(false)} style={{ color: "var(--text-3)" }}
              className="hover:text-[var(--text-1)] transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: "var(--border)" }}>
            {notifications.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: "var(--text-3)" }}>No notifications</p>
            ) : notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                className={`px-4 py-3 transition-colors hover:bg-[var(--surface-2)] ${n.is_read ? "opacity-60" : "cursor-pointer"}`}
              >
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-1)" }}>{n.message}</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-3)" }}>
                  {new Date(n.created_at).toLocaleString("id-ID", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                  {!n.is_read && <span className="ml-2 font-semibold text-blue-500">New</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
