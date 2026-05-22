"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { IntentBadge } from "@/components/intent-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorState } from "@/components/error-state";

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
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [loadTrigger, setLoadTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reply-items/${params.replyItemId}`);
        if (!res.ok) {
          throw new Error("Failed to load reply detail");
        }
        const payload = await res.json();
        if (active) {
          setData(payload);
          setSubject(payload.draft?.subject ?? "");
          setBody(payload.draft?.body_text ?? "");
        }
      } catch (err) {
        if (active) {
          setError("Failed to load reply detail. Please verify connection.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [params.replyItemId, loadTrigger]);

  async function handleApprove() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reply-items/${params.replyItemId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_subject: subject, edited_body_text: body })
      });
      if (res.ok) {
        router.push("/dashboard/review");
        router.refresh();
      } else {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Approve failed");
      }
    } catch (err: any) {
      setError(err?.message ?? "Approve failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reply-items/${params.replyItemId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectReason })
      });
      if (res.ok) {
        router.push("/dashboard/review");
        router.refresh();
      } else {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Reject failed");
      }
    } catch (err: any) {
      setError(err?.message ?? "Reject failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingSpinner label="Loading reply detail..." />;
  }

  if (error && !data) {
    return (
      <ErrorState
        message={error}
        onRetry={() => setLoadTrigger((prev) => prev + 1)}
      />
    );
  }

  if (!data) {
    return <ErrorState message="Reply not found." />;
  }

  const { raw_reply, lead, client, classification } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/dashboard/review")}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to queue
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        {/* Left Side: Context & Classification */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
            <h2 className="text-lg font-bold text-gray-900">Raw Reply</h2>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <div>
                <strong className="text-gray-800">From:</strong> {raw_reply.from_email}
              </div>
              <div>
                <strong className="text-gray-800">Subject:</strong> {raw_reply.subject ?? "(no subject)"}
              </div>
            </div>
            <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 font-normal">
              {raw_reply.body_text}
            </div>
            {raw_reply.original_body && (
              <div className="mt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Original Thread</span>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-xs text-gray-600">
                  {raw_reply.original_body}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
            <h2 className="text-lg font-bold text-gray-900">Lead Info</h2>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <div className="font-semibold text-gray-800">
                {lead.first_name ?? ""} {lead.last_name ?? ""}
              </div>
              <div>{lead.email}</div>
              <div>{lead.company ?? ""}</div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
            <h2 className="text-lg font-bold text-gray-900">Classification</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <IntentBadge intent={classification?.intent} />
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-700/10 ring-inset">
                Confidence: {classification?.confidence ? Math.round(classification.confidence * 100) : 0}%
              </span>
            </div>
            <div className="mt-4 grid gap-4 border-t border-gray-150 pt-4 text-sm text-gray-600 md:grid-cols-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Sentiment</span>
                <p className="mt-1 font-medium text-gray-800">{classification?.sentiment ?? "-"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Urgency</span>
                <p className="mt-1 font-medium text-gray-800">{classification?.urgency ?? "-"}</p>
              </div>
            </div>
            {classification?.key_signals && classification.key_signals.length > 0 && (
              <div className="mt-4 border-t border-gray-150 pt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Key Signals</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {classification.key_signals.map((sig: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center rounded-md bg-gray-55 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-600/10">
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Editor & Actions */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
            <h2 className="text-lg font-bold text-gray-900">Draft Editor</h2>
            
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="draft-subject">
                  Subject
                </label>
                <input
                  id="draft-subject"
                  className="mt-1 flex min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs focus:border-gray-900 focus:outline-hidden"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div>
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex gap-4" aria-label="Tabs">
                    <button
                      type="button"
                      onClick={() => setActiveTab("edit")}
                      className={`min-h-[44px] border-b-2 px-1 py-2 text-sm font-semibold transition-all ${
                        activeTab === "edit"
                          ? "border-gray-900 text-gray-900"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("preview")}
                      className={`min-h-[44px] border-b-2 px-1 py-2 text-sm font-semibold transition-all ${
                        activeTab === "preview"
                          ? "border-gray-900 text-gray-900"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      Preview
                    </button>
                  </nav>
                </div>

                <div className="mt-3">
                  {activeTab === "edit" ? (
                    <textarea
                      aria-label="Draft body"
                      className="flex min-h-[220px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs focus:border-gray-900 focus:outline-hidden"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  ) : (
                    <div className="prose prose-sm min-h-[220px] max-w-none rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 overflow-y-auto">
                      <ReactMarkdown>{body}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 animate-fade-in">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
              >
                Approve & Send
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="flex min-h-[44px] items-center justify-center rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-550 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
              >
                Reject
              </button>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700" htmlFor="rejection-reason">
                Rejection Reason (required for reject)
              </label>
              <input
                id="rejection-reason"
                className="mt-1 flex min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs focus:border-gray-900 focus:outline-hidden"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this draft is being rejected..."
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
            <h2 className="text-lg font-bold text-gray-900">Client Context</h2>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <div className="font-semibold text-gray-800">{client.company_name}</div>
              <p>{client.service_description ?? "No description available."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
