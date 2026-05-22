import crypto from "crypto";

export function computeSignature(payload: Buffer, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifySignature(
  payload: Buffer,
  secret: string,
  signature: string | null
): boolean {
  if (!signature) {
    return false;
  }

  const expected = computeSignature(payload, secret);
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");

  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, expBuf);
}
