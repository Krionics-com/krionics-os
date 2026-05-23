import { NextResponse, type NextRequest } from "next/server";
import { getCookieName, verifyToken } from "@/lib/auth";
import { requireRole } from "@/lib/auth-helpers";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(getCookieName())?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const payload = await verifyToken(token);
    const headers = new Headers(req.headers);
    headers.set("x-operator-id", payload.sub);
    headers.set("x-operator-role", payload.role);

    // Role-gated routing
    if (req.nextUrl.pathname.startsWith("/dashboard/admin")) {
      if (!requireRole(payload, "admin")) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next({ request: { headers } });
  } catch {
    // Token expired or invalid
    const response = NextResponse.redirect(new URL("/login?expired=1", req.url));
    response.cookies.delete(getCookieName());
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"]
};

