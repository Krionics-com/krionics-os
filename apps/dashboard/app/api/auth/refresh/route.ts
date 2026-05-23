import { NextResponse, type NextRequest } from "next/server";
import { getCookieName, verifyToken, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(getCookieName())?.value;

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  try {
    const payload = await verifyToken(token);
    
    // Create new token with fresh expiry
    const newToken = await signToken({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      client_access: payload.client_access || []
    });
    
    const response = NextResponse.json({ success: true });
    response.cookies.set(getCookieName(), newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60 // 8 hours
    });
    
    return response;
  } catch (err) {
    return NextResponse.json({ error: "Token invalid" }, { status: 401 });
  }
}
