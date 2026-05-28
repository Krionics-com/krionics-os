"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft, Mail, Send, XCircle, Pencil, Check, X,
  ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pushing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  pushed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

interface EmailStep {
  step: number;
  subject: string;
  body: string;
  delay_days?: number;
  subject_b?: string;
}

export default function SequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error, mutate } = useSWR(
    `/api/dashboard/sequences/${id}`,
    fetcher,
    { refreshInterval: (data) => data?.sequence?.status === "pushing" ? 3000 : 0 }
  );
  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [emailDrafts, setEmailDrafts] = useState<Record<number, EmailStep>>({});
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));
  const [pushing, setPushing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const seq = data?.sequence;
  const emails: EmailStep[] = seq?.emails ?? [];

  function toggleStep(idx: number) {
    setExpandedSteps((s) => {
      const n = new Set(s);
      if (n.has(idx)) n.delete(idx); else n.add(idx);
      return n;
    });
  }

  function startEdit(idx: number) {
    setEditingStep(idx);
    setEmailDrafts((d) => ({ ...d, [idx]: { ...emails[idx] } }));
  }

  function cancelEdit() {
    setEditingStep(null);
  }

  async function saveEdit(idx: number) {
    const updated = emails.map((e, i) => i === idx ? emailDrafts[idx] : e);
    try {
      const res = await fetch(`/api/dashboard/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: updated }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      setEditingStep(null);
      toast.success("Email step saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    }
  }

  async function handlePush() {
    if (!confirm("Push this sequence to Instantly? The lead will be enrolled in the campaign.")) return;
    setPushing(true);
    try {
      const res = await fetch(`/api/dashboard/sequences/${id}/push`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      toast.success("Sequence queued for push to Instantly");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to push");
    } finally {
      setPushing(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this sequence? It will be marked as failed and not pushed.")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/dashboard/sequences/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      toast.success("Sequence cancelled");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (error || !seq) {
    return (
      <Card className="max-w-md mx-auto mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">Sequence not found</p>
          <Link href="/dashboard/sequences"><Button variant="ghost" size="sm" className="mt-2"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const canEdit = isAdmin && (seq.status === "pending" || seq.status === "failed");
  const canPush = isAdmin && seq.status === "pending";
  const canCancel = isAdmin && seq.status === "pending";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/sequences">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Sequences</Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold">
                {seq.lead_first_name} {seq.lead_last_name}
              </h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[seq.status] ?? "bg-muted text-muted-foreground"}`}>
                {seq.status === "pushing" && <Loader2 className="h-3 w-3 animate-spin" />}
                {seq.status === "pushed" && <CheckCircle2 className="h-3 w-3" />}
                {seq.status === "failed" && <AlertCircle className="h-3 w-3" />}
                {seq.status === "pending" && <Clock className="h-3 w-3" />}
                {seq.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">{seq.lead_email}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            {canCancel && (
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
                <XCircle className="h-4 w-4 mr-1" /> Cancel
              </Button>
            )}
            {canPush && (
              <Button size="sm" onClick={handlePush} disabled={pushing}>
                {pushing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Push to Instantly
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Campaign", value: seq.campaign_name ?? "—" },
          { label: "Client", value: seq.client_name },
          { label: "ICP Fit", value: seq.icp_fit_score != null ? `${(seq.icp_fit_score * 100).toFixed(0)}%` : "—" },
          { label: "Email Steps", value: emails.length },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className="text-lg font-bold mt-1 truncate">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Push status banner */}
      {seq.status === "pushed" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/10 px-4 py-3">
          <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
            ✓ Pushed to Instantly on {seq.pushed_at ? new Date(seq.pushed_at).toLocaleString() : "—"}
          </p>
          {seq.instantly_contact_id && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 font-mono">Contact ID: {seq.instantly_contact_id}</p>
          )}
        </div>
      )}
      {seq.status === "failed" && seq.push_error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-900/10 px-4 py-3">
          <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">Push failed: {seq.push_error}</p>
        </div>
      )}
      {seq.status === "pushing" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/10 px-4 py-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <p className="text-sm text-blue-800 dark:text-blue-300">Pushing to Instantly… page refreshes automatically.</p>
        </div>
      )}

      {/* Email steps */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Email Sequence ({emails.length} steps)</h2>
          {canEdit && <p className="text-xs text-muted-foreground">Click the pencil icon to edit individual steps.</p>}
        </div>

        <div className="space-y-3">
          {emails.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No email steps found in this sequence.
              </CardContent>
            </Card>
          )}
          {emails.map((email, idx) => {
            const isExpanded = expandedSteps.has(idx);
            const isEditing = editingStep === idx;
            const draft = emailDrafts[idx] ?? email;

            return (
              <Card key={idx} className={isEditing ? "border-primary/50 bg-primary/5" : ""}>
                <CardContent className="p-0">
                  {/* Step header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-t-xl"
                    onClick={() => !isEditing && toggleStep(idx)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{isEditing ? draft.subject : email.subject}</p>
                        {email.delay_days != null && (
                          <p className="text-xs text-muted-foreground">After {email.delay_days} day{email.delay_days !== 1 ? "s" : ""}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && !isEditing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); startEdit(idx); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {(isExpanded || isEditing) && (
                    <div className="px-4 pb-4 border-t border-border">
                      {isEditing ? (
                        <div className="space-y-3 pt-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Subject</label>
                            <input
                              type="text"
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                              value={draft.subject}
                              onChange={(e) => setEmailDrafts((d) => ({ ...d, [idx]: { ...draft, subject: e.target.value } }))}
                            />
                          </div>
                          {email.subject_b !== undefined && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground block mb-1">Subject B (A/B test)</label>
                              <input
                                type="text"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                value={draft.subject_b ?? ""}
                                onChange={(e) => setEmailDrafts((d) => ({ ...d, [idx]: { ...draft, subject_b: e.target.value } }))}
                              />
                            </div>
                          )}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Delay (days from previous)</label>
                            <input
                              type="number" min={0} max={60}
                              className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                              value={draft.delay_days ?? 0}
                              onChange={(e) => setEmailDrafts((d) => ({ ...d, [idx]: { ...draft, delay_days: parseInt(e.target.value) || 0 } }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Email Body</label>
                            <textarea
                              rows={10}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                              value={draft.body}
                              onChange={(e) => setEmailDrafts((d) => ({ ...d, [idx]: { ...draft, body: e.target.value } }))}
                            />
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
                            <Button size="sm" onClick={() => saveEdit(idx)}><Check className="h-3.5 w-3.5 mr-1" /> Save Step</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3 space-y-3">
                          {email.subject_b && (
                            <div className="rounded-md bg-muted/50 px-3 py-2">
                              <p className="text-xs text-muted-foreground mb-0.5">Subject B (A/B variant)</p>
                              <p className="text-sm">{email.subject_b}</p>
                            </div>
                          )}
                          <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono text-muted-foreground rounded-md bg-muted/30 p-3">
                            {email.body}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Strategy notes */}
      {seq.strategy_notes && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Strategy Notes</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{seq.strategy_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Generation metadata */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Generation Metadata</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><p className="text-muted-foreground">Model</p><p className="font-mono mt-0.5">{seq.model_used ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Prompt Version</p><p className="font-mono mt-0.5">{seq.prompt_version}</p></div>
            <div><p className="text-muted-foreground">Generation Time</p><p className="mt-0.5">{seq.generation_ms ? `${seq.generation_ms}ms` : "—"}</p></div>
            <div><p className="text-muted-foreground">Created</p><p className="mt-0.5">{new Date(seq.created_at).toLocaleString()}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
