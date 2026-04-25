/** Admin Twitter handles — set via NEXT_PUBLIC_ADMIN_HANDLES env var (comma-separated). */
export const ADMINS: string[] =
  (process.env.NEXT_PUBLIC_ADMIN_HANDLES ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
