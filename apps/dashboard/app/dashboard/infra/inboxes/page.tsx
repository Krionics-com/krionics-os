"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail, RefreshCw, Search, ShieldCheck, ShieldAlert, Check, X,
  AlertTriangle, CheckCircle2, ChevronRight, Activity
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type InboxStats = {
  inbox_email: string;
  campaign_count: number;
  sent_count: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  spam_rate: number;
  reputation_score: number;
  warmup_status: string;
  spf: string;
  dkim: string;
  dmarc: string;
};

export default function InboxesMonitoringPage() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/infra/inboxes",
    fetcher
  );

  const [search, setSearch] = useState("");
  const [reputationFilter, setReputationFilter] = useState("all"); // all, healthy, at-risk, critical
  const [warmupFilter, setWarmupFilter] = useState("all"); // all, not-started, in-progress, complete
  const [page, setPage] = useState(1);
  const limit = 20;

  const filteredInboxes = useMemo(() => {
    const list: InboxStats[] = data?.inboxes ?? [];
    return list.filter((item) => {
      // 1. Search filter
      if (search && !item.inbox_email.toLowerCase().includes(search.toLowerCase())) return false;
      
      // 2. Reputation filter
      if (reputationFilter === "healthy" && item.reputation_score <= 80) return false;
      if (reputationFilter === "at-risk" && (item.reputation_score < 50 || item.reputation_score > 80)) return false;
      if (reputationFilter === "critical" && item.reputation_score >= 50) return false;

      // 3. Warmup status filter
      if (warmupFilter === "not-started" && item.warmup_status !== "Not started") return false;
      if (warmupFilter === "in-progress" && (item.warmup_status === "Not started" || item.warmup_status === "Complete")) return false;
      if (warmupFilter === "complete" && item.warmup_status !== "Complete") return false;

      return true;
    });
  }, [data?.inboxes, search, reputationFilter, warmupFilter]);

  // Paginate client-side
  const paginated = useMemo(() => {
    const offset = (page - 1) * limit;
    return filteredInboxes.slice(offset, offset + limit);
  }, [filteredInboxes, page]);

  const totalPages = Math.ceil(filteredInboxes.length / limit) || 1;

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

  function dnsCheckBadge(status: string) {
    if (status === "PASS") {
      return <Check className="h-4 w-4 text-emerald-500 shrink-0" />;
    }
    return <X className="h-4 w-4 text-rose-500 shrink-0" />;
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

  if (error) {
    return (
      <Card className="mx-auto max-w-xl mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Failed to load Inbox Infrastructure health</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Email Inboxes Health</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor active inboxes, warmup timelines, SPF/DKIM/DMARC statuses, and delivery reputation scores.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filters card */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inboxes by email address…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>

            {/* Reputation filter */}
            <select
              value={reputationFilter}
              onChange={(e) => { setReputationFilter(e.target.value); setPage(1); }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-48"
            >
              <option value="all">All Reputations</option>
              <option value="healthy">Healthy Only (&gt;80%)</option>
              <option value="at-risk">At Risk (50% - 80%)</option>
              <option value="critical">Critical (&lt;50%)</option>
            </select>

            {/* Warmup filter */}
            <select
              value={warmupFilter}
              onChange={(e) => { setWarmupFilter(e.target.value); setPage(1); }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-44"
            >
              <option value="all">All Warmup States</option>
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Warmup Progress</option>
              <option value="complete">Warmup Complete</option>
            </select>

          </div>
        </CardContent>
      </Card>

      {/* Main listing table */}
      <Card>
        <CardContent className="pt-4">
          {filteredInboxes.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No email inboxes found matching your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Address</TableHead>
                    <TableHead className="text-center">Campaigns</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Open Rate</TableHead>
                    <TableHead className="text-right">Click Rate</TableHead>
                    <TableHead className="text-right">Bounce Rate</TableHead>
                    <TableHead className="text-right">Spam Rate</TableHead>
                    <TableHead>Reputation</TableHead>
                    <TableHead>Warmup status</TableHead>
                    <TableHead className="text-center">SPF / DKIM / DMARC</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((item) => (
                    <TableRow
                      key={item.inbox_email}
                      className="cursor-pointer hover:bg-muted/10"
                      onClick={() => router.push(`/dashboard/infra/inboxes/${encodeURIComponent(item.inbox_email)}`)}
                    >
                      <TableCell className="font-semibold text-foreground whitespace-nowrap">{item.inbox_email}</TableCell>
                      <TableCell className="text-center font-mono">{item.campaign_count}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{item.sent_count.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{item.open_rate}%</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{item.click_rate}%</TableCell>
                      <TableCell className={`text-right font-mono ${item.bounce_rate > 2.0 ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>{item.bounce_rate}%</TableCell>
                      <TableCell className={`text-right font-mono ${item.spam_rate > 0.1 ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>{item.spam_rate}%</TableCell>
                      <TableCell>{reputationBadge(item.reputation_score)}</TableCell>
                      <TableCell>{warmupBadge(item.warmup_status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-4">
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] text-muted-foreground uppercase font-bold">SPF</span>
                            {dnsCheckBadge(item.spf)}
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] text-muted-foreground uppercase font-bold">DKIM</span>
                            {dnsCheckBadge(item.dkim)}
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] text-muted-foreground uppercase font-bold">DMARC</span>
                            {dnsCheckBadge(item.dmarc)}
                          </div>
                        </div>
                      </TableCell>
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
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center border-t pt-4 mt-4 text-xs">
              <span className="text-muted-foreground">Showing page {page} of {totalPages} ({filteredInboxes.length} total)</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
