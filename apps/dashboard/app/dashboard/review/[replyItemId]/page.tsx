"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IntentBadge } from "@/components/intent-badge";

type ReplyDetail = {
  reply_item: any;
  classification: any;
  draft: any;
  raw_reply: any;
  lead: any;
  client: any;
};

export default function ReplyDetailPage({ params }: { params: { replyItemId: string } }) {
  const router = useRouter();
  const [data, setData] = useState<ReplyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/reply-items/${params.replyItemId}`);
        if (!res.ok) {
          throw new Error("Failed to load reply detail");
        }
        const payload = await res.json();
        setData(payload);
        setSubject(payload.draft?.subject ?? "");
        setBody(payload.draft?.body_text ?? "");
      } catch (err) {
        setError("Failed to load reply detail");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.replyItemId]);

  async function handleApprove() {
    setSubmitting(true);
    const res = await fetch(`/api/reply-items/${params.replyItemId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edited_subject: subject, edited_body_text: body })
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/dashboard/review");
    } else {
      setError("Approve failed");
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setError("Rejection reason required");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/reply-items/${params.replyItemId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejection_reason: rejectReason })
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/dashboard/review");
    } else {
      setError("Reject failed");
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error || !data) {
    return <div className="text-red-600">{error ?? "Unknown error"}</div>;
  }

  const { raw_reply, lead, client, classification } = data;

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard/review")}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to queue
        </button>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Raw Reply</h2>
          <div className="mt-3 text-sm text-gray-600">
            <div><strong>From:</strong> {raw_reply.from_email}</div>
            <div><strong>Subject:</strong> {raw_reply.subject ?? "(no subject)"}</div>
          </div>
          <div className="mt-3 max-h-64 overflow-y-auto rounded-md bg-gray-50 p-3 text-sm">
            {raw_reply.body_text}
          </div>
          <div className="mt-3 text-xs text-gray-500">Original: {raw_reply.original_body ?? "[Original email not available]"}</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Lead Info</h2>
          <div className="mt-2 text-sm text-gray-600">
            <div>{lead.first_name ?? ""} {lead.last_name ?? ""}</div>
            <div>{lead.email}</div>
            <div>{lead.company ?? ""}</div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Classification</h2>
          <div className="mt-2 flex items-center gap-3">
            <IntentBadge intent={classification?.intent} />
            <span className="text-sm text-gray-600">
              Confidence: {classification?.confidence ? Math.round(classification.confidence * 100) : 0}%
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <div>Sentiment: {classification?.sentiment ?? "-"}</div>
            <div>Urgency: {classification?.urgency ?? "-"}</div>
            <div>Signals: {(classification?.key_signals ?? []).join(", ")}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Draft Editor</h2>
          <label className="mt-3 block text-sm font-medium text-gray-700">
            Subject
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm font-medium text-gray-700">
            Body
            <textarea
              className="mt-1 h-48 w-full rounded-md border border-gray-300 px-3 py-2"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={submitting}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={submitting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700">
              Rejection Reason
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Client Context</h2>
          <div className="mt-2 text-sm text-gray-600">
            <div>{client.company_name}</div>
            <div>{client.service_description ?? ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
