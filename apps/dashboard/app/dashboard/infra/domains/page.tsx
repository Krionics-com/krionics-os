"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Globe, RefreshCw, Search, ShieldCheck, ShieldAlert, Check, X,
  AlertTriangle, ChevronRight, Activity
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
import { useRouter as useAppRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type DomainStats = {
  domain: string;
  inbox_count: number;
  open_rate: number;
  bounce_rate: number;
  spam_rate: number;
  reputation_score: number;
  spf: string;
  dkim: string;
  dmarc: string;
};

export default function DomainsMonitoringPage() {
  const router = useAppRouter();
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/infra/domains",
    fetcher
  );

  const [search, setSearch] = useState("");
  const [reputationFilter, setReputationFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const filtered = useMemo(() => {
    const list: DomainStats[] = data?.domains ?? [];
    return list.filter((item) => {
      if (search && !item.domain.toLowerCase().includes(search.toLowerCase())) return false;
      
      if (reputationFilter === "healthy" && item.reputation_score <= 80) return false;
      if (reputationFilter === "at-risk" && (item.reputation_score < 50 || item.reputation_score > 80)) return false;
      if (reputationFilter === "critical" && item.reputation_score >= 50) return false;

      return true;
    });
  }, [data?.domains, search, reputationFilter]);

  const paginated = useMemo(() => {
    const offset = (page - 1) * limit;
    return filtered.slice(offset, offset + limit);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / limit) || 1;

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

  function dnsStatusBadge(spf: string, dkim: string, dmarc: string) {
    const allPass = spf === "PASS" && dkim === "PASS" && dmarc === "PASS";
    if (allPass) {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 gap-1 font-semibold">
          <Check className="h-3.5 w-3.5 shrink-0" />
          ALL VALID
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 gap-1 font-semibold">
        <X className="h-3.5 w-3.5 shrink-0" />
        RECORDS ISSUE
      </Badge>
    );
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
          <p className="text-destructive font-medium">Failed to load Domain Infrastructure health</p>
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
          <Globe className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Sending Domains Reputation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Analyze outbound domain scopes, aggregated inbox metrics, reputation weights, and DNS authentication errors.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Search and Filters card */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            
            {/* Search inputs */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search domains by suffix…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>

            {/* Reputation filter selection */}
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

          </div>
        </CardContent>
      </Card>

      {/* Domains table listing */}
      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No sending domains match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain Name</TableHead>
                    <TableHead className="text-center">Inbox Count</TableHead>
                    <TableHead className="text-right">Combined Open Rate</TableHead>
                    <TableHead className="text-right">Combined Bounce Rate</TableHead>
                    <TableHead className="text-right">Combined Spam Rate</TableHead>
                    <TableHead>Avg Reputation</TableHead>
                    <TableHead>SPF / DKIM / DMARC Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((item) => (
                    <TableRow
                      key={item.domain}
                      className="cursor-pointer hover:bg-muted/10"
                      onClick={() => router.push(`/dashboard/infra/domains/${encodeURIComponent(item.domain)}`)}
                    >
                      <TableCell className="font-semibold text-foreground whitespace-nowrap">{item.domain}</TableCell>
                      <TableCell className="text-center font-mono">{item.inbox_count}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{item.open_rate}%</TableCell>
                      <TableCell className={`text-right font-mono ${item.bounce_rate > 2.0 ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>{item.bounce_rate}%</TableCell>
                      <TableCell className={`text-right font-mono ${item.spam_rate > 0.1 ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>{item.spam_rate}%</TableCell>
                      <TableCell>{reputationBadge(item.reputation_score)}</TableCell>
                      <TableCell>{dnsStatusBadge(item.spf, item.dkim, item.dmarc)}</TableCell>
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
              <span className="text-muted-foreground">Showing page {page} of {totalPages} ({filtered.length} total)</span>
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
