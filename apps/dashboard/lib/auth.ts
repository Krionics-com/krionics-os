import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

export type OperatorToken = {
  sub: string;
  email: string;
  name: string;
  role: string;
  client_access: string[] | null;
};

const COOKIE_NAME = "kos_session";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: OperatorToken): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<OperatorToken> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as OperatorToken;
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

export function getTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}
