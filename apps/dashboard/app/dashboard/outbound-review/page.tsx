"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronUp, Send, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SequenceStep = {
  step: number;
  subject: string;
  body: string;
  delay_days: number;
};

type Lead = {
  id: string;
  client_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  company_domain: string | null;
  lead_status: string;
  review_status: string;
  enriched_data: Record<string, any>;
  lead_sequence: SequenceStep[] | null;
  created_at: string;
  client_name?: string;
};

// ── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-5 bg-muted rounded-full w-16" />
      </div>
      <div className="h-3 bg-muted rounded w-1/2" />
      <div className="h-3 bg-muted rounded w-2/3" />
      <div className="flex justify-end gap-2 pt-2">
        <div className="h-8 bg-muted rounded w-20" />
        <div className="h-8 bg-muted rounded w-24" />
      </div>
    </div>
  );
}

// ── Enrichment data section ───────────────────────────────────────────────────

function EnrichmentSection({ data }: { data: Record<string, any> }) {
  const [open, setOpen] = useState(false);
  const isEmpty = !data || Object.keys(data).length === 0;

  return (
    <div className="border-t border-border pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Clay Enrichment Data
      </button>

      {open && (
        <div className="mt-3 space-y-1.5 text-xs">
          {isEmpty ? (
            <p className="text-muted-foreground">No enrichment data yet.</p>
          ) : (
            <>
              {(data.linkedin_headline || data.headline) && (
                <Row label="Headline" value={data.linkedin_headline ?? data.headline} />
              )}
              {data.company_summary && <Row label="Company" value={data.company_summary} />}
              {data.tech_stack && (
                <Row
                  label="Tech Stack"
                  value={Array.isArray(data.tech_stack) ? data.tech_stack.join(", ") : data.tech_stack}
                />
              )}
              {(data.funding_stage || data.funding_amount) && (
                <Row
                  label="Funding"
                  value={[data.funding_stage, data.funding_amount].filter(Boolean).join(" · ")}
                />
              )}
              {data.hiring_signals && Array.isArray(data.hiring_signals) && data.hiring_signals.length > 0 && (
                <Row label="Hiring Signals" value={data.hiring_signals.join(", ")} />
              )}
              {data.buying_signals && Array.isArray(data.buying_signals) && data.buying_signals.length > 0 && (
                <Row label="Buying Signals" value={data.buying_signals.join(", ")} />
              )}
              {data.recent_news && <Row label="Recent News" value={data.recent_news} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 font-medium text-muted-foreground w-28">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

// ── Email step section ────────────────────────────────────────────────────────

function EmailStep({ step }: { step: SequenceStep }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <span>
          Email {step.step} — Day {step.delay_days}
        </span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="px-3 py-2.5 space-y-1.5 text-xs">
          <p className="font-medium text-muted-foreground">
            Subject: <span className="text-foreground">{step.subject}</span>
          </p>
          <div
            className="text-foreground whitespace-pre-wrap leading-relaxed border-t border-border pt-2 mt-2"
          >
            {step.body}
          </div>
        </div>
      )}

      {!open && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{step.subject}</span>
          {" · "}
          {step.body.slice(0, 120)}{step.body.length > 120 ? "…" : ""}
        </div>
      )}
    </div>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({
  lead,
  onRemove,
}: {
  lead: Lead;
  onRemove: (id: string) => void;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const fullName =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email;

  const sequence: SequenceStep[] = Array.isArray(lead.lead_sequence)
    ? (lead.lead_sequence as SequenceStep[])
    : [];

  async function approve() {
    setBusy(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${lead.id}/approve`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Approve failed");
      toast.success("Lead approved and queued for Instantly");
      onRemove(lead.id);
    } catch (err: any) {
      toast.error(err.message || "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    setBusy(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${lead.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Reject failed");
      toast.success("Lead rejected");
      onRemove(lead.id);
    } catch (err: any) {
      toast.error(err.message || "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              {lead.client_name && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  {lead.client_name}
                </Badge>
              )}
              <span className="font-semibold text-sm">
                {fullName}
                {(lead.title || lead.company) && (
                  <span className="font-normal text-muted-foreground">
                    {" "}— {[lead.title, lead.company].filter(Boolean).join(", ")}
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {lead.email}
              {lead.company && ` · ${lead.company}`}
              {lead.enriched_data?.funding_stage && ` · ${lead.enriched_data.funding_stage}`}
            </p>
          </div>
          <Badge
            className="shrink-0 capitalize"
            variant={
              lead.review_status === "pending"
                ? "secondary"
                : lead.review_status === "approved"
                ? "default"
                : "destructive"
            }
          >
            ● {lead.review_status}
          </Badge>
        </div>

        {/* Enrichment */}
        <EnrichmentSection data={lead.enriched_data ?? {}} />

        {/* Email sequence */}
        {sequence.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email Sequence ({sequence.length} steps)
            </p>
            <div className="space-y-2">
              {sequence.map((step) => (
                <EmailStep key={step.step} step={step} />
              ))}
            </div>
          </div>
        )}

        {sequence.length === 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">No sequence generated yet.</p>
          </div>
        )}

        {/* Rejection note input */}
        {rejectMode && (
          <div className="border-t border-border pt-3 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Rejection note (optional)
            </label>
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
              placeholder="Reason for rejection…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="border-t border-border pt-3 flex items-center justify-end gap-2">
          {rejectMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => { setRejectMode(false); setNotes(""); }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={confirmReject}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Confirm Reject
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setRejectMode(true)}
              >
                <XCircle className="h-4 w-4 mr-1 text-destructive" />
                Reject
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={approve}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OutboundReviewPage() {
  const { data, isLoading } = useSWR<{ leads: Lead[]; total: number }>(
    "/api/dashboard/leads?review_status=pending&limit=50",
    fetcher
  );

  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [clientFilter, setClientFilter] = useState<string>("all");

  function handleRemove(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
  }

  const allLeads: Lead[] = (data?.leads ?? []).filter((l) => !removed.has(l.id));

  // Unique client names for the filter dropdown
  const clientNames = Array.from(
    new Set(allLeads.map((l) => l.client_name).filter(Boolean) as string[])
  );

  const filtered =
    clientFilter === "all"
      ? allLeads
      : allLeads.filter((l) => l.client_name === clientFilter);

  const pendingCount = allLeads.length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Send className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-3xl font-bold">Outbound Review</h1>
          {!isLoading && (
            <Badge variant={pendingCount > 0 ? "secondary" : "outline"} className="text-sm">
              {pendingCount} pending
            </Badge>
          )}
        </div>

        {clientNames.length > 1 && (
          <select
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="all">All clients</option>
            {clientNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <p className="text-lg font-semibold">No sequences pending review</p>
            <p className="text-sm text-muted-foreground">
              All leads have been reviewed. Check back after the next sequence generation run.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lead cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((lead) => (
            <ReviewCard key={lead.id} lead={lead} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
