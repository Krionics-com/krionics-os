import crypto from "node:crypto";
import type { ReplyIntent } from "@krionics/schema";

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sentimentFromScore(score: number): "POSITIVE" | "NEUTRAL" | "NEGATIVE" {
  if (score >= 0.2) {
    return "POSITIVE";
  }
  if (score <= -0.2) {
    return "NEGATIVE";
  }
  return "NEUTRAL";
}

export function urgencyFromScore(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 0.66) {
    return "HIGH";
  }
  if (score >= 0.33) {
    return "MEDIUM";
  }
  return "LOW";
}

export function replyPriority(intent: ReplyIntent): number {
  if (intent === "UNSUBSCRIBE") {
    return 1;
  }
  if (intent === "POSITIVE" || intent === "BOOKING_INTENT") {
    return 10;
  }
  if (intent === "OBJECTION" || intent === "FAQ") {
    return 30;
  }
  if (intent === "NURTURE") {
    return 70;
  }
  return 50;
}

export function shouldAutoSend(
  automationLevel: number,
  intent: ReplyIntent,
  confidence: number,
  requiresHuman: boolean,
  autoRouteThreshold: number
): boolean {
  if (requiresHuman) {
    return false;
  }
  if (automationLevel <= 1) {
    return false;
  }

  if (automationLevel === 2) {
    return (intent === "POSITIVE" || intent === "BOOKING_INTENT") && confidence >= autoRouteThreshold;
  }

  return confidence >= autoRouteThreshold;
}

export function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60000);
}
