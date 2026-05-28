"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft, Users, AlertTriangle, CheckCircle2, ExternalLink,
  Mail, Building2, Briefcase, Globe, Clock
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const LEAD_STATUS_COLORS: Record<string, string> = {
  raw_imported: "bg-slate-100 text-slate-600",
  enriched: "bg-blue-100 text-blue-800",
  campaign_ready: "bg-violet-100 text-violet-800",
  queued_for_sending: "bg-amber-100 text-amber-800",
  in_sequence: "bg-emerald-100 text-emerald-800",
  reply_received: "bg-sky-100 text-sky-800",
  positive_reply: "bg-green-100 text-green-800",
  meeting_booked: "bg-teal-100 text-teal-800",
  not_interested: "bg-orange-100 text-orange-800",
  unsubscribed: "bg-rose-100 text-rose-800",
  bounced: "bg-red-100 text-red-800",
  objection_reply: "bg-yellow-100 text-yellow-800",
  faq_reply: "bg-cyan-100 text-cyan-800",
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error, mutate } = useSWR(`/api/dashboard/leads/${id}`, fetcher);
  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [suppressReason, setSuppressReason] = useState("");
  const [showSuppressForm, setShowSuppressForm] = useState(false);
  const [acting, setActing] = useState(false);

  const lead = data?.lead;
  const replyItems: any[] = data?.replyItems ?? [];
  const sequences: any[] = data?.sequences ?? [];
  const history: any[] = data?.history ?? [];
  const enrichment = data?.enrichment;

  async function handleSuppress() {
    setActing(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${id}/suppress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: suppressReason || "Manual suppression by operator" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      setShowSuppressForm(false);
      toast.success("Lead suppressed");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to suppress");
    } finally {
      setActing(false);
    }
  }

  async function handleUnsuppress() {
    if (!confirm("Unsuppress this lead? They will be eligible for future outreach.")) return;
    setActing(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${id}/unsuppress`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      toast.success("Lead unsuppressed");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to unsuppress");
    } finally {
      setActing(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (error || !lead) {
    return (
      <Card className="max-w-md mx-auto mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">Lead not found</p>
          <Link href="/dashboard/leads"><Button variant="ghost" size="sm" className="mt-2"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/leads">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Leads</Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-2xl font-bold">{lead.first_name} {lead.last_name}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEAD_STATUS_COLORS[lead.lead_status] ?? "bg-muted text-muted-foreground"}`}>
                {lead.lead_status?.replace(/_/g, " ")}
              </span>
              {lead.is_suppressed && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> Suppressed
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">{lead.email}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            {lead.is_suppressed ? (
              <Button variant="outline" size="sm" onClick={handleUnsuppress} disabled={acting}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Unsuppress
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => setShowSuppressForm(true)} disabled={acting}>
                <AlertTriangle className="h-4 w-4 mr-1" /> Suppress
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Suppress form */}
      {showSuppressForm && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-900/10">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium text-rose-800 dark:text-rose-300 mb-2">Suppress this lead</p>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                placeholder="Reason (optional)"
                value={suppressReason}
                onChange={(e) => setSuppressReason(e.target.value)}
              />
              <Button size="sm" variant="destructive" onClick={handleSuppress} disabled={acting}>Confirm</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSuppressForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Client", value: lead.client_name },
          { label: "Campaign", value: lead.campaign_name ?? "—" },
          { label: "LQS Score", value: lead.lqs_score != null ? `${(Number(lead.lqs_score) * 100).toFixed(0)}%` : "—" },
          { label: "Source", value: lead.source },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className="text-sm font-bold mt-1 truncate capitalize">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Identity */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Identity</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs">{lead.email}</span>
              </div>
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 text-muted-foreground shrink-0 text-xs">📞</span>
                  <span>{lead.phone}</span>
                </div>
              )}
              {lead.linkedin_url && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs truncate">{lead.linkedin_url}</a>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{lead.title ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{lead.company ?? "—"}</span>
              </div>
              {lead.company_domain && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono">{lead.company_domain}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Key Dates */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Timeline</p>
            <div className="space-y-2 text-sm">
              {[
                { label: "Imported", value: lead.created_at },
                { label: "Last Contacted", value: lead.last_contacted_at },
                { label: "Reply Received", value: lead.replied_at },
                { label: "Meeting Booked", value: lead.meeting_booked_at },
                { label: "Unsubscribed", value: lead.unsubscribed_at },
                { label: "Suppressed At", value: lead.suppressed_at },
              ].filter(({ value }) => value).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs">{label}</span>
                  </div>
                  <span className="text-xs">{new Date(value!).toLocaleString()}</span>
                </div>
              ))}
              {!lead.last_contacted_at && !lead.replied_at && !lead.meeting_booked_at && (
                <p className="text-xs text-muted-foreground">No activity yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sequences */}
      {sequences.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Generated Sequences</p>
            <div className="space-y-2">
              {sequences.map((seq: any) => (
                <div key={seq.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      seq.status === "pushed" ? "bg-emerald-100 text-emerald-800" :
                      seq.status === "pushing" ? "bg-blue-100 text-blue-800" :
                      seq.status === "failed" ? "bg-rose-100 text-rose-800" :
                      "bg-amber-100 text-amber-800"
                    }`}>{seq.status}</span>
                    <span className="text-xs text-muted-foreground">{seq.email_count} emails</span>
                    {seq.icp_fit_score != null && (
                      <span className="text-xs text-muted-foreground">ICP: {(seq.icp_fit_score * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <Link href={`/dashboard/sequences/${seq.id}`}>
                    <Button variant="ghost" size="sm" className="h-6 text-xs">View</Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reply Items */}
      {replyItems.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Reply History</p>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {replyItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{item.id.slice(0, 8)}…</span>
                    {item.intent && <Badge variant="outline" className="text-xs">{item.intent}</Badge>}
                    {item.confidence != null && <span className="text-xs text-muted-foreground">{(item.confidence * 100).toFixed(0)}%</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={item.status === "APPROVED" ? "default" : item.status === "REJECTED" ? "destructive" : "secondary"} className="text-xs">
                      {item.status}
                    </Badge>
                    <Link href={`/dashboard/review/${item.id}`}>
                      <Button variant="ghost" size="sm" className="h-6 text-xs">View</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* State history */}
      {history.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">State History</p>
            <div className="space-y-1.5">
              {history.map((h: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{h.from_state ?? "—"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{h.to_state}</span>
                  {h.transition_reason && <span className="text-muted-foreground text-xs italic">({h.transition_reason})</span>}
                  <span className="text-muted-foreground ml-auto">{new Date(h.transitioned_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suppression reason */}
      {lead.is_suppressed && lead.suppression_reason && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-900/10">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">Suppression Reason</p>
            <p className="text-sm text-rose-800 dark:text-rose-300">{lead.suppression_reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
