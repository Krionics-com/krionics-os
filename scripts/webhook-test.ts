import crypto from "crypto";

(async () => {
  const PORT = Number(process.env.WEBHOOK_PORT ?? "3000");
  const SECRET = process.env.INSTANTLY_WEBHOOK_SECRET;

  if (!SECRET) {
    console.error("Missing INSTANTLY_WEBHOOK_SECRET");
    process.exit(1);
  }

  const payload = {
    reply_id: `test-reply-${Date.now()}`,
    email_id: `email-${Date.now()}`,
    campaign_id: "test-campaign-1",
    from_email: "reply-sender@example.com",
    to_email: "outbound@example.com",
    subject: "Re: Test",
    body_text: "Hello there",
    body_html: "<p>Hello there</p>",
    received_at: new Date().toISOString(),
    headers: {
      "x-test": "true"
    },
    trace_id: crypto.randomUUID()
  };

  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", SECRET).update(body).digest("hex");

  const response = await fetch(`http://localhost:${PORT}/webhooks/instantly`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "instantly-webhook-secret": signature
    },
    body
  });

  const text = await response.text();
  console.log("status", response.status);
  console.log(text);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
