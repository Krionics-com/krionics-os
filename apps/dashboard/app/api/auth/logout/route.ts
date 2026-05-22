import { NextResponse } from "next/server";
import { getCookieName } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getCookieName(), "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  return response;
}
