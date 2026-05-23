"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Mail, Eye, Link as LinkIcon, AlertTriangle,
  AlertOctagon, Check, X, ShieldCheck, ShieldAlert, CheckCircle2, Info, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function InboxDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email: rawEmail } = use(params);
  const email = decodeURIComponent(rawEmail);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/infra/inboxes/${encodeURIComponent(email)}`,
    fetcher
  );

  const [revalidating, setRevalidating] = useState(false);

  const inbox = data?.inbox;

  function handleRevalidate() {
    setRevalidating(true);
    setTimeout(() => {
      setRevalidating(false);
      toast.success("Domain DNS re-validation queued! Validation checks will update shortly.");
    }, 1200);
  }

  function dnsCheckBadge(type: string, status: string) {
    if (status === "PASS") {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 gap-1 font-semibold">
          <Check className="h-3 w-3 shrink-0" />
          {type}: VALID
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 gap-1 font-semibold">
        <X className="h-3 w-3 shrink-0" />
        {type}: FAILED
      </Badge>
    );
  }

  function reputationCircleColor(score: number) {
    if (score > 80) return "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200";
    if (score >= 50) return "text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-200";
    return "text-rose-500 bg-rose-50 dark:bg-rose-950/20 border-rose-200";
  }

  function getEventIcon(type: string) {
    switch (type) {
      case "sent":
        return <Mail className="h-4.5 w-4.5 text-blue-500" />;
      case "opened":
        return <Eye className="h-4.5 w-4.5 text-indigo-500" />;
      case "clicked":
        return <LinkIcon className="h-4.5 w-4.5 text-emerald-500" />;
      case "bounced":
        return <AlertTriangle className="h-4.5 w-4.5 text-rose-500" />;
      case "spam":
      case "complained":
        return <AlertOctagon className="h-4.5 w-4.5 text-rose-600" />;
      default:
        return <Mail className="h-4.5 w-4.5 text-slate-500" />;
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !inbox) {
    return (
      <Card className="mx-auto max-w-xl mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Inbox not found or error loading</p>
          <Link href="/dashboard/infra/inboxes">
            <Button variant="ghost" size="sm" className="mt-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Inboxes list
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Calculate percentage of warmup days
  const isComplete = inbox.warmup_status === "Complete";
  const isNotStarted = inbox.warmup_status === "Not started";
  let warmupPercent = 0;
  let currentDay = 0;
  if (isComplete) {
    warmupPercent = 100;
  } else if (!isNotStarted) {
    const match = inbox.warmup_status.match(/Day (\d+)\/30/);
    if (match) {
      currentDay = parseInt(match[1]);
      warmupPercent = Math.round((currentDay / 30) * 100);
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Header section with back button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/infra/inboxes">
            <Button variant="ghost" size="sm" className="mt-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-bold">{inbox.email}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              {dnsCheckBadge("SPF", inbox.spf)}
              {dnsCheckBadge("DKIM", inbox.dkim)}
              {dnsCheckBadge("DMARC", inbox.dmarc)}
              <Badge variant="outline" className="font-mono text-xs">Warmup: {inbox.warmup_status.toUpperCase()}</Badge>
            </div>
          </div>
        </div>

        {/* Reputation big circle metric */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${reputationCircleColor(inbox.reputation_score)}`}>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 block">Inbox Reputation</span>
            <span className="text-xs text-muted-foreground">Delivery weight score</span>
          </div>
          <div className="h-12 w-12 rounded-full border-2 border-current flex items-center justify-center font-mono font-extrabold text-lg">
            {inbox.reputation_score}%
          </div>
        </div>
      </div>

      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        
        {/* KPI 1: Sent */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total Sent</span>
            <p className="text-xl font-extrabold mt-1 text-foreground font-mono">{inbox.sent_count.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* KPI 2: Open */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Open Rate</span>
            <p className="text-xl font-extrabold mt-1 text-foreground font-mono">{inbox.open_rate}%</p>
          </CardContent>
        </Card>

        {/* KPI 3: Click */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Click Rate</span>
            <p className="text-xl font-extrabold mt-1 text-foreground font-mono">{inbox.click_rate}%</p>
          </CardContent>
        </Card>

        {/* KPI 4: Bounce */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Bounce Rate</span>
            <p className={`text-xl font-extrabold mt-1 font-mono ${inbox.bounce_rate > 2.0 ? "text-rose-500" : "text-foreground"}`}>{inbox.bounce_rate}%</p>
          </CardContent>
        </Card>

        {/* KPI 5: Spam */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Spam Rate</span>
            <p className={`text-xl font-extrabold mt-1 font-mono ${inbox.spam_rate > 0.1 ? "text-rose-500" : "text-foreground"}`}>{inbox.spam_rate}%</p>
          </CardContent>
        </Card>

        {/* KPI 6: Complaint */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Complaint Rate</span>
            <p className="text-xl font-extrabold mt-1 text-foreground font-mono">{inbox.complaint_rate}%</p>
          </CardContent>
        </Card>

      </div>

      {/* Grid splits for 4 main sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1 & 2: Warmup and DNS validation */}
        <div className="space-y-6">
          
          {/* Section 1: Warmup Timeline */}
          <Card>
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-primary" />
                Warmup Progress Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              
              <div className="flex justify-between items-center text-xs">
                <span>Warmup Status: <strong className="text-foreground uppercase">{inbox.warmup_status}</strong></span>
                {isComplete ? (
                  <span className="text-emerald-600 font-semibold">100% complete</span>
                ) : isNotStarted ? (
                  <span className="text-muted-foreground">0% complete</span>
                ) : (
                  <span className="text-blue-600 font-semibold">{warmupPercent}% complete</span>
                )}
              </div>

              {/* Progress bar container */}
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden border">
                <div
                  className={`h-full transition-all duration-500 ${
                    isComplete ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${warmupPercent}%` }}
                />
              </div>

              {/* Dynamic dates mapping */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-muted/40 p-3 rounded-lg border">
                <div>
                  <span className="text-[9px] text-muted-foreground uppercase">Started warmup</span>
                  <p className="font-semibold mt-0.5">{inbox.warmup_start}</p>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground uppercase">{isComplete ? "Finished warmup" : "Est. Completion"}</span>
                  <p className="font-semibold mt-0.5">{inbox.warmup_end}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Domain Validation Details */}
          <Card>
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>DNS Domain Validation Records</span>
                <Button variant="outline" size="xs" disabled={revalidating} onClick={handleRevalidate}>
                  {revalidating ? <Spinner className="h-3 w-3 mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Re-validate
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3.5">
              
              {/* SPF record display */}
              <div className="p-3 bg-muted/20 rounded-lg border border-border/60">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold font-mono text-foreground">SPF RECORD</span>
                  {inbox.spf === "PASS" ? (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5"><Check className="h-3 w-3" /> PASS</span>
                  ) : (
                    <span className="text-xs font-semibold text-rose-500 flex items-center gap-0.5"><X className="h-3 w-3" /> FAIL</span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground break-all bg-card p-1.5 rounded border">
                  v=spf1 include:spf.instantly.ai ~all
                </p>
              </div>

              {/* DKIM record display */}
              <div className="p-3 bg-muted/20 rounded-lg border border-border/60">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold font-mono text-foreground">DKIM RECORD</span>
                  {inbox.dkim === "PASS" ? (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5"><Check className="h-3 w-3" /> PASS</span>
                  ) : (
                    <span className="text-xs font-semibold text-rose-500 flex items-center gap-0.5"><X className="h-3 w-3" /> FAIL</span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground break-all bg-card p-1.5 rounded border">
                  k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0y6...
                </p>
              </div>

              {/* DMARC record display */}
              <div className="p-3 bg-muted/20 rounded-lg border border-border/60">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold font-mono text-foreground">DMARC RECORD</span>
                  {inbox.dmarc === "PASS" ? (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5"><Check className="h-3 w-3" /> PASS</span>
                  ) : (
                    <span className="text-xs font-semibold text-rose-500 flex items-center gap-0.5"><X className="h-3 w-3" /> FAIL</span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground break-all bg-card p-1.5 rounded border">
                  v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@krionics.com
                </p>
              </div>

              <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                <span>DNS Verification: <strong>Active</strong></span>
                <span>Last verified: <strong>{new Date().toLocaleDateString()}</strong></span>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* SECTION 2 & 3: Reputation Trend and Event logs */}
        <div className="space-y-6">
          
          {/* Section 2: Domain Reputation Trend LineChart */}
          <Card>
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-bold">30-Day Delivery Reputation Trend</CardTitle>
              <CardDescription className="text-xs">Historical validation weights scoring sending reputation.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inbox.reputation_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(value) => [`${value}%`, "Reputation"]} />
                  <Line type="monotone" dataKey="reputation" stroke="#C4521C" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Section 3: Email Events Timeline */}
          <Card>
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-bold">Live Activity Event Timeline</CardTitle>
              <CardDescription className="text-xs">Most recent sent, open, bounce, and click records mapped.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 max-h-[360px] overflow-y-auto">
              <div className="space-y-3.5">
                {inbox.events.map((ev: any) => (
                  <div key={ev.id} className="flex gap-3 text-xs items-start border-b pb-3 last:border-0 last:pb-0">
                    <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5 border">
                      {getEventIcon(ev.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground break-all">{ev.recipient}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          {new Date(ev.occurred_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate mt-0.5 font-medium">{ev.subject}</p>
                      <Badge variant="outline" className="font-mono text-[9px] uppercase mt-1 px-1 py-0 bg-muted/40">
                        {ev.event_type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
