"use client";

import { use } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, RefreshCw, Globe, Check, X, Mail, ShieldCheck,
  ChevronRight, AlertTriangle, AlertOctagon, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DomainDetailPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const router = useRouter();
  const { domain: rawDomain } = use(params);
  const domain = decodeURIComponent(rawDomain);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/infra/domains/${encodeURIComponent(domain)}`,
    fetcher
  );

  const domainData = data?.domain;

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

  function reputationBadge(score: number) {
    if (score > 80) {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {score}%
        </span>
      );
    } else if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 text-amber-500 dark:text-amber-400 font-bold font-mono">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {score}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-rose-500 dark:text-rose-400 font-bold font-mono">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        {score}%
      </span>
    );
  }

  function warmupBadge(status: string) {
    if (status === "Complete") {
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400">COMPLETE</Badge>;
    } else if (status === "Not started") {
      return <Badge variant="outline" className="text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:text-slate-400">NOT STARTED</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400">{status}</Badge>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !domainData) {
    return (
      <Card className="mx-auto max-w-xl mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Domain details not found or error loading</p>
          <Link href="/dashboard/infra/domains">
            <Button variant="ghost" size="sm" className="mt-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Domains list
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header section with back button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/infra/domains">
            <Button variant="ghost" size="sm" className="mt-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-bold">{domainData.domain_name}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              {dnsCheckBadge("SPF", domainData.spf)}
              {dnsCheckBadge("DKIM", domainData.dkim)}
              {dnsCheckBadge("DMARC", domainData.dmarc)}
              <Badge variant="outline" className="font-mono text-xs">Total Inboxes: {domainData.inboxes.length}</Badge>
            </div>
          </div>
        </div>

        {/* Reputation big circle metric */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${reputationCircleColor(domainData.reputation_score)}`}>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 block">Avg Domain Reputation</span>
            <span className="text-xs text-muted-foreground">Delivery score weights</span>
          </div>
          <div className="h-12 w-12 rounded-full border-2 border-current flex items-center justify-center font-mono font-extrabold text-lg">
            {domainData.reputation_score}%
          </div>
        </div>
      </div>

      {/* Domain Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Sent */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total Domain Sent</span>
            <p className="text-xl font-extrabold mt-1 text-foreground font-mono">{domainData.total_sent.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* KPI 2: Open */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Combined Open</span>
            <p className="text-xl font-extrabold mt-1 text-foreground font-mono">{domainData.combined_open_rate}%</p>
          </CardContent>
        </Card>

        {/* KPI 3: Click */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Combined Click</span>
            <p className="text-xl font-extrabold mt-1 text-foreground font-mono">{domainData.combined_click_rate}%</p>
          </CardContent>
        </Card>

        {/* KPI 4: Bounce */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Combined Bounce</span>
            <p className={`text-xl font-extrabold mt-1 font-mono ${domainData.combined_bounce_rate > 2.0 ? "text-rose-500" : "text-foreground"}`}>{domainData.combined_bounce_rate}%</p>
          </CardContent>
        </Card>

        {/* KPI 5: Spam */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Combined Spam</span>
            <p className={`text-xl font-extrabold mt-1 font-mono ${domainData.combined_spam_rate > 0.1 ? "text-rose-500" : "text-foreground"}`}>{domainData.combined_spam_rate}%</p>
          </CardContent>
        </Card>

      </div>

      {/* Listing of inboxes using this domain */}
      <Card>
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Mail className="h-4.5 w-4.5 text-primary" />
            Inboxes Configured on {domainData.domain_name}
          </CardTitle>
          <CardDescription className="text-xs">Individual account analytics, warmup metrics and reputation bounds.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email Address</TableHead>
                  <TableHead className="text-right">Sent Count</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                  <TableHead className="text-right">Click Rate</TableHead>
                  <TableHead className="text-right">Bounce Rate</TableHead>
                  <TableHead className="text-right">Spam Rate</TableHead>
                  <TableHead>Reputation</TableHead>
                  <TableHead>Warmup Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domainData.inboxes.map((inbox: any) => (
                  <TableRow
                    key={inbox.inbox_email}
                    className="cursor-pointer hover:bg-muted/10"
                    onClick={() => router.push(`/dashboard/infra/inboxes/${encodeURIComponent(inbox.inbox_email)}`)}
                  >
                    <TableCell className="font-semibold text-foreground whitespace-nowrap">{inbox.inbox_email}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{inbox.sent_count.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{inbox.open_rate}%</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{inbox.click_rate}%</TableCell>
                    <TableCell className={`text-right font-mono ${inbox.bounce_rate > 2.0 ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>{inbox.bounce_rate}%</TableCell>
                    <TableCell className={`text-right font-mono ${inbox.spam_rate > 0.1 ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>{inbox.spam_rate}%</TableCell>
                    <TableCell>{reputationBadge(inbox.reputation_score)}</TableCell>
                    <TableCell>{warmupBadge(inbox.warmup_status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="p-1">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
