"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { fetchJson } from "@/lib/http";
import { SlaTimer } from "@/components/sla-timer";
import { MarkdownEditor } from "@/components/markdown-editor";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  Flame, 
  MessageSquare, 
  X,
  FileText,
  User,
  ExternalLink
} from "lucide-react";

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

type ReplyDetail = {
  reply_item: {
    id: string;
    status: string;
    created_at: string;
    sla_expires_at: string;
  };
  thread: Array<{
    from: string;
    to: string;
    subject: string;
    body_text: string;
    received_at: string;
  }>;
  lead: {
    email: string;
    name: string;
    company: string;
    title: string;
    linkedin_url: string | null;
  };
  campaign: {
    name: string;
    client_name: string;
  };
  classification: {
    intent: string;
    confidence: number;
    reasoning: string;
    sentiment: string;
    urgency: string;
    key_signals: string[];
    objection_type: string | null;
    faq_topic: string | null;
  } | null;
  draft: {
    id: string;
    subject: string;
    body_text: string;
  } | null;
};

export default function ReplyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const replyItemId = params.replyItemId as string;

  const [data, setData] = useState<ReplyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft editing state
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [editorMode, setEditorMode] = useState<"edit" | "preview" | "split">("edit");

  // Rejection modal state
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Loading states for actions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mobile navigation tabs
  const [mobileTab, setMobileTab] = useState<"thread" | "classification" | "draft">("thread");

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchJson<ReplyDetail>(`/api/dashboard/review/${replyItemId}`);
        setData(res);
        setSubject(res.draft?.subject ?? "");
        setBodyText(res.draft?.body_text ?? "");
      } catch (err: any) {
        setError(err.message || "Failed to load reply item detail.");
      } finally {
        setLoading(false);
      }
    }
    if (replyItemId) {
      loadDetail();
    }
  }, [replyItemId]);

  const hasEdits = data?.draft ? bodyText !== data.draft.body_text || subject !== data.draft.subject : false;

  async function handleApprove() {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/review/${replyItemId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: hasEdits ? subject : undefined,
          body_text: hasEdits ? bodyText : undefined,
        }),
      });

      if (!res.ok) throw new Error("Approval failed");
      toast.success(hasEdits ? "Draft approved with edits!" : "Draft approved successfully!");
      router.push("/dashboard/review");
    } catch (err: any) {
      toast.error(err.message || "Approval failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectConfirm() {
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/review/${replyItemId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (!res.ok) throw new Error("Rejection failed");
      toast.success("Draft rejected successfully.");
      setIsRejectOpen(false);
      router.push("/dashboard/review");
    } catch (err: any) {
      toast.error(err.message || "Rejection failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegenerate() {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/review/${replyItemId}/regenerate`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Regeneration failed");
      const result = await res.json();
      toast.info(result.message || "Regeneration queued");
    } catch (err: any) {
      toast.error(err.message || "Regeneration failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEscalate() {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/review/${replyItemId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_id: "admin" }),
      });

      if (!res.ok) throw new Error("Escalation failed");
      toast.success("Assigned to administrator.");
      router.push("/dashboard/review");
    } catch (err: any) {
      toast.error(err.message || "Escalation failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner label="Loading reply detail panels..." />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error || "Reply item not found."} />;
  }

  const intentMap: Record<string, string> = {
    POSITIVE: "bg-green-100 text-green-800 border-green-200",
    BOOKING_INTENT: "bg-blue-100 text-blue-800 border-blue-200",
    OBJECTION: "bg-orange-100 text-orange-800 border-orange-200",
    FAQ: "bg-purple-100 text-purple-800 border-purple-200",
    NURTURE: "bg-gray-100 text-gray-800 border-gray-200"
  };

  const intentClass = data.classification ? intentMap[data.classification.intent] || "bg-gray-100 text-gray-800 border-gray-200" : "";

  // Helper to render thread panel
  const renderThreadPanel = () => (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 bg-card rounded-xl border border-border p-5 overflow-y-auto space-y-4 max-h-[500px]">
        <h2 className="font-semibold text-lg text-foreground font-heading border-b border-border pb-3 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" /> Conversation Thread
        </h2>
        
        <div className="space-y-4">
          {data.thread.map((msg, index) => {
            const isIncoming = index === data.thread.length - 1;
            return (
              <div 
                key={index} 
                className={`p-4 rounded-lg border text-sm ${
                  isIncoming 
                    ? "bg-amber-50/50 border-amber-200/70 shadow-xs" 
                    : "bg-muted/30 border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground">{msg.from}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mb-3">To: {msg.to}</div>
                <div className="whitespace-pre-wrap text-foreground font-normal leading-relaxed">
                  {msg.body_text}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lead Card */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-3">
        <h3 className="font-semibold text-base text-foreground font-heading flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> Lead Details
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block">Name</span>
            <span className="font-medium text-foreground">{data.lead.name}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Company</span>
            <span className="font-medium text-foreground">{data.lead.company}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Title</span>
            <span className="font-medium text-foreground">{data.lead.title || "No Title"}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">LinkedIn</span>
            {data.lead.linkedin_url ? (
              <a 
                href={data.lead.linkedin_url} 
                target="_blank" 
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1 text-xs font-semibold"
              >
                <LinkedinIcon className="h-3.5 w-3.5" /> View Profile <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-muted-foreground italic text-xs">Not available</span>
            )}
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <span className="text-xs text-muted-foreground block">Campaign</span>
          <span className="text-xs font-semibold text-foreground bg-muted px-2.5 py-1 rounded-md mt-1 inline-block">
            {data.campaign.name} ({data.campaign.client_name})
          </span>
        </div>
      </div>
    </div>
  );

  // Helper to render classification panel
  const renderClassificationPanel = () => (
    <div className="bg-card rounded-xl border border-border p-5 space-y-6 h-full">
      <div className="border-b border-border pb-4 space-y-2">
        <span className="text-xs text-muted-foreground block uppercase font-semibold tracking-wider">SLA Status</span>
        <div className="flex items-center gap-2">
          <SlaTimer createdAt={data.reply_item.created_at} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold text-lg text-foreground font-heading flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> AI Classification
        </h2>

        {data.classification ? (
          <div className="space-y-5 text-sm">
            {/* Intent Badge */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">Detected Intent</span>
              <Badge variant="outline" className={`${intentClass} text-sm font-semibold px-3 py-1`}>
                {data.classification.intent.replace("_", " ")}
              </Badge>
            </div>

            {/* Confidence Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Confidence Score</span>
                <span className="font-bold text-foreground">{data.classification.confidence}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${data.classification.confidence}%` }}
                />
              </div>
            </div>

            {/* Claude Reasoning */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">Reasoning</span>
              <p className="italic text-muted-foreground font-normal leading-relaxed">
                "{data.classification.reasoning}"
              </p>
            </div>

            {/* Objection or FAQ Specific info */}
            {data.classification.intent === "OBJECTION" && data.classification.objection_type && (
              <div className="bg-orange-50/50 border border-orange-200 rounded-lg p-3">
                <span className="text-xs font-semibold text-orange-800 block">Objection Category</span>
                <span className="text-xs text-orange-900 mt-1 block">{data.classification.objection_type}</span>
              </div>
            )}

            {data.classification.intent === "FAQ" && data.classification.faq_topic && (
              <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-3">
                <span className="text-xs font-semibold text-purple-800 block">FAQ Topic</span>
                <span className="text-xs text-purple-900 mt-1 block">{data.classification.faq_topic}</span>
              </div>
            )}

            {/* Sentiment & Urgency Badges */}
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <span className="text-xs text-muted-foreground block">Sentiment</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                  data.classification.sentiment === "POSITIVE" 
                    ? "bg-green-100 text-green-800" 
                    : data.classification.sentiment === "NEGATIVE"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {data.classification.sentiment}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Urgency</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                  data.classification.urgency === "HIGH" 
                    ? "bg-red-100 text-red-800" 
                    : data.classification.urgency === "MEDIUM"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {data.classification.urgency}
                </span>
              </div>
            </div>

            {/* Key Signals */}
            {data.classification.key_signals.length > 0 && (
              <div className="border-t border-border pt-4">
                <span className="text-xs text-muted-foreground block mb-2">Key Signals Found</span>
                <div className="flex flex-wrap gap-1.5">
                  {data.classification.key_signals.map((sig, idx) => (
                    <span 
                      key={idx} 
                      className="bg-muted text-foreground border border-border text-xs px-2.5 py-1 rounded-md"
                    >
                      "{sig}"
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          <span className="text-sm text-muted-foreground italic">No AI classification details available.</span>
        )}
      </div>
    </div>
  );

  // Helper to render draft editor panel
  const renderDraftPanel = () => (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col h-full space-y-4">
      <h2 className="font-semibold text-lg text-foreground font-heading border-b border-border pb-3 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" /> Draft Editor
      </h2>

      {data.draft ? (
        <div className="flex-1 flex flex-col space-y-4">
          {/* Subject line input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground block" htmlFor="subject-input">
              Subject Line
            </label>
            <Input 
              id="subject-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-muted/30 border-border text-sm font-medium focus-visible:ring-primary w-full"
            />
          </div>

          {/* Markdown editor */}
          <div className="flex-1 flex flex-col min-h-[300px]">
            <div className="flex border-b border-border mb-3">
              {(["edit", "preview", "split"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setEditorMode(mode)}
                  className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-all ${
                    editorMode === mode 
                      ? "border-primary text-primary font-bold" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex-1">
              <MarkdownEditor 
                value={bodyText}
                onChange={setBodyText}
                mode={editorMode}
              />
            </div>
          </div>

          {/* Word/Character count */}
          <div className="text-xs text-muted-foreground flex justify-between">
            <span>Character count: {bodyText.length}</span>
            <span>Word count: {bodyText.split(/\s+/).filter(Boolean).length}</span>
          </div>

          {/* Actions */}
          <div className="border-t border-border pt-4 grid grid-cols-2 gap-3">
            <Button
              className="bg-primary text-white hover:bg-[#a64214] font-semibold text-sm h-11 w-full flex items-center justify-center gap-2 rounded-lg"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              <CheckCircle className="h-4 w-4" />
              {hasEdits ? "Approve with Edits" : "Approve"}
            </Button>
            <Button
              variant="outline"
              className="border-border text-foreground font-semibold text-sm h-11 w-full flex items-center justify-center gap-2 rounded-lg"
              onClick={handleRegenerate}
              disabled={isSubmitting}
            >
              <Flame className="h-4 w-4" />
              Regenerate
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 text-white hover:bg-red-500 font-semibold text-sm h-11 w-full flex items-center justify-center gap-2 rounded-lg col-span-2"
              onClick={() => setIsRejectOpen(true)}
              disabled={isSubmitting}
            >
              <AlertCircle className="h-4 w-4" />
              Reject
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-primary font-semibold text-xs py-2 col-span-2 h-9 w-full flex items-center justify-center"
              onClick={handleEscalate}
              disabled={isSubmitting}
            >
              Escalate to Admin
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <span className="text-sm font-semibold text-foreground block">No Draft Available</span>
          <span className="text-xs text-muted-foreground mt-1 block">
            This incoming reply did not require drafting, or draft generation failed.
          </span>
          <Button
            variant="outline"
            className="border-border mt-4 text-xs font-semibold"
            onClick={handleRegenerate}
          >
            Create Draft Response
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Back button & Action Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2 pl-1 pr-3"
          onClick={() => router.push("/dashboard/review")}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Queue
        </Button>
        <span className="text-sm text-muted-foreground">
          Review Item ID: <span className="font-mono text-xs">{data.reply_item.id}</span>
        </span>
      </div>

      {/* THREE-PANEL GRID FOR DESKTOP */}
      <div className="hidden lg:grid grid-cols-[35%_25%_40%] gap-6 h-fit items-stretch min-h-[600px]">
        {/* Panel 1 */}
        <div className="min-w-0">{renderThreadPanel()}</div>

        {/* Panel 2 */}
        <div className="min-w-0">{renderClassificationPanel()}</div>

        {/* Panel 3 */}
        <div className="min-w-0">{renderDraftPanel()}</div>
      </div>

      {/* MOBILE TABS LAYOUT */}
      <div className="lg:hidden space-y-4">
        {/* Tab Headers */}
        <div className="flex border-b border-border bg-card rounded-lg p-1">
          {(["thread", "classification", "draft"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md text-center transition-all ${
                mobileTab === tab
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Active Tab panel */}
        <div className="animate-in fade-in duration-200">
          {mobileTab === "thread" && renderThreadPanel()}
          {mobileTab === "classification" && renderClassificationPanel()}
          {mobileTab === "draft" && renderDraftPanel()}
        </div>
      </div>

      {/* REJECTION MODAL */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsRejectOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-card rounded-xl border border-border max-w-md w-full shadow-2xl p-6 space-y-4 z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-lg text-foreground font-heading flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" /> Reject Draft Response
              </h3>
              <button 
                onClick={() => setIsRejectOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded-full hover:bg-muted p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="reason-textarea" className="text-xs font-semibold text-muted-foreground block">
                Reason for rejection (Required)
              </label>
              <textarea
                id="reason-textarea"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please describe why this drafted reply is not suitable..."
                className="w-full min-h-[120px] rounded-lg border border-border bg-muted/20 p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button
                variant="outline"
                className="border-border text-foreground font-semibold text-xs px-4"
                onClick={() => setIsRejectOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="bg-red-605 text-white hover:bg-red-500 font-semibold text-xs px-4"
                onClick={handleRejectConfirm}
                disabled={isSubmitting}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
