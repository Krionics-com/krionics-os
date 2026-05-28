const SLACK_API = "https://slack.com/api/chat.postMessage";

let botToken: string | undefined;
let reviewChannel: string | undefined;

function init(): void {
  botToken = process.env.SLACK_BOT_TOKEN;
  reviewChannel = process.env.SLACK_REVIEW_CHANNEL_ID;
}

async function postMessage(channel: string, text: string, blocks?: unknown[]): Promise<void> {
  if (!botToken) return;

  const body: Record<string, unknown> = { channel, text };
  if (blocks?.length) body.blocks = blocks;

  const res = await fetch(SLACK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${botToken}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Slack API error: ${res.status} ${t}`);
  }
}

export async function notifyDLQ(
  originalQueue: string,
  jobName: string,
  error: Error,
  attemptsMade: number
): Promise<void> {
  init();
  if (!botToken || !reviewChannel) return;

  try {
    await postMessage(reviewChannel, `🚨 DLQ entry`, [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Dead Letter Queue Entry*\n*Queue:* \`${originalQueue}\`\n*Job:* \`${jobName}\`\n*Attempts:* ${attemptsMade}\n*Error:* \`${error.message.slice(0, 200)}\``
        }
      }
    ]);
  } catch (err) {
    console.error("[notify-slack] DLQ notification failed", err);
  }
}

export async function notifyEscalation(params: {
  clientId: string;
  replyItemId: string;
  objectionCategory: string;
  escalationReason: string | null;
}): Promise<void> {
  init();
  if (!botToken || !reviewChannel) return;

  try {
    await postMessage(reviewChannel, `⚠️ Reply escalated`, [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Escalated Reply*\n*Client:* \`${params.clientId}\`\n*Reply:* \`${params.replyItemId}\`\n*Objection:* ${params.objectionCategory}\n*Reason:* ${params.escalationReason ?? "unspecified"}`
        }
      }
    ]);
  } catch (err) {
    console.error("[notify-slack] Escalation notification failed", err);
  }
}

export async function notifyReviewQueued(params: {
  clientId: string;
  replyItemId: string;
  reviewItemId: string;
  intent: string;
  priority: number;
}): Promise<void> {
  init();
  if (!botToken || !reviewChannel) return;

  // Only ping for high-priority items (BOOKING_INTENT, POSITIVE)
  if (params.priority > 30) return;

  try {
    await postMessage(reviewChannel, `📬 New review item`, [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*New Review Item*\n*Client:* \`${params.clientId}\`\n*Intent:* ${params.intent}\n*Review ID:* \`${params.reviewItemId}\``
        }
      }
    ]);
  } catch (err) {
    console.error("[notify-slack] Review queued notification failed", err);
  }
}
