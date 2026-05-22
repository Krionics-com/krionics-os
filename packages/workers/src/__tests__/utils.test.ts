import assert from "node:assert/strict";
import { test } from "node:test";
import { addMinutes, replyPriority, sentimentFromScore, shouldAutoSend, urgencyFromScore } from "../utils.js";

test("sentimentFromScore buckets", () => {
  assert.equal(sentimentFromScore(0.8), "POSITIVE");
  assert.equal(sentimentFromScore(0.0), "NEUTRAL");
  assert.equal(sentimentFromScore(-0.8), "NEGATIVE");
});

test("urgencyFromScore buckets", () => {
  assert.equal(urgencyFromScore(0.9), "HIGH");
  assert.equal(urgencyFromScore(0.5), "MEDIUM");
  assert.equal(urgencyFromScore(0.1), "LOW");
});

test("replyPriority respects intent", () => {
  assert.equal(replyPriority("UNSUBSCRIBE"), 1);
  assert.equal(replyPriority("POSITIVE"), 10);
  assert.equal(replyPriority("OBJECTION"), 30);
  assert.equal(replyPriority("NURTURE"), 70);
  assert.equal(replyPriority("UNKNOWN"), 50);
});

test("shouldAutoSend respects automation level", () => {
  assert.equal(shouldAutoSend(1, "POSITIVE", 0.99, false, 0.85), false);
  assert.equal(shouldAutoSend(2, "POSITIVE", 0.9, false, 0.85), true);
  assert.equal(shouldAutoSend(2, "OBJECTION", 0.9, false, 0.85), false);
  assert.equal(shouldAutoSend(3, "FAQ", 0.9, false, 0.85), true);
  assert.equal(shouldAutoSend(3, "FAQ", 0.4, false, 0.85), false);
  assert.equal(shouldAutoSend(3, "FAQ", 0.9, true, 0.85), false);
});

test("addMinutes offsets time", () => {
  const base = new Date("2026-05-22T10:00:00Z");
  const result = addMinutes(base, 15);
  assert.equal(result.toISOString(), "2026-05-22T10:15:00.000Z");
});
