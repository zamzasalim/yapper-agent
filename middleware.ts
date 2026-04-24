import { NextRequest, NextResponse } from "next/server";

/**
 * Subdomain routing:
 *   agent.*  → /agent   (agent landing page)
 *   docs.*   → /docs    (documentation)
 *   admin.*  → /admin   (admin panel)
 *   api.*    → /api/*   (API gateway — prepends /api to the path)
 *   default  → main app (unchanged)
 *
 * API routes, static assets, and well-known endpoints are
 * always passed through regardless of subdomain.
 */

const PASSTHROUGH = (pathname: string) =>
  pathname.startsWith("/api/") ||
  pathname.startsWith("/_next/") ||
  pathname.startsWith("/favicon") ||
  pathname.startsWith("/.well-known") ||
  pathname === "/skill.md" ||
  pathname === "/openapi.json" ||
  pathname === "/mcp" ||
  /\.(png|jpg|jpeg|svg|ico|webp|gif|woff2?)$/.test(pathname);

export function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") ?? "";
  const { pathname } = req.nextUrl;

  if (PASSTHROUGH(pathname)) return NextResponse.next();

  // api.* — gateway: prepend /api to every path
  // e.g. api.yapperagent.xyz/agent/jobs → /api/agent/jobs
  if (hostname.startsWith("api.")) {
    const url = req.nextUrl.clone();
    url.pathname = `/api${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (hostname.startsWith("agent.")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/agent" : `/agent${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (hostname.startsWith("docs.")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/docs" : `/docs${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (hostname.startsWith("admin.")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
