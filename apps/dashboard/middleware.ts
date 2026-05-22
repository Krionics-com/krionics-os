import { NextResponse, type NextRequest } from "next/server";
import { getCookieName, verifyToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(getCookieName())?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const payload = await verifyToken(token);
    const headers = new Headers(req.headers);
    headers.set("x-operator-id", payload.sub);
    return NextResponse.next({ request: { headers } });
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"]
};
