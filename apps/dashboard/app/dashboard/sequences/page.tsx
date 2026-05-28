"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Mail, Search, RefreshCw, ChevronRight, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Pushing", value: "pushing" },
  { label: "Pushed", value: "pushed" },
  { label: "Failed", value: "failed" },
];

const STATUS_ICONS = {
  pending: <Clock className="h-3.5 w-3.5" />,
  pushing: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  pushed: <CheckCircle2 className="h-3.5 w-3.5" />,
  failed: <AlertCircle className="h-3.5 w-3.5" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pushing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  pushed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

export default function SequencesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const url = `/api/dashboard/sequences?status=${statusFilter}&limit=50`;
  const { data, isLoading, error, mutate } = useSWR(url, fetcher, { refreshInterval: 10000 });

  const sequences: any[] = data?.sequences ?? [];
  const filtered = sequences.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.lead_email?.toLowerCase().includes(q) ||
      s.client_name?.toLowerCase().includes(q) ||
      s.campaign_name?.toLowerCase().includes(q) ||
      `${s.lead_first_name} ${s.lead_last_name}`.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Sequences</h1>
            <p className="text-sm text-muted-foreground mt-0.5">AI-generated email sequences pending review or push to Instantly.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by lead email, name, or campaign…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load sequences</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>Retry</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No sequences found</p>
            <p className="text-xs text-muted-foreground mt-1">Sequences are generated automatically when leads are enriched.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Emails</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ICP Fit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((seq: any) => (
                <tr key={seq.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-xs">{seq.lead_first_name} {seq.lead_last_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{seq.lead_email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{seq.campaign_name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{seq.client_name}</td>
                  <td className="px-4 py-3 text-xs">
                    {Array.isArray(seq.emails) ? seq.emails.length : 0} steps
                  </td>
                  <td className="px-4 py-3">
                    {seq.icp_fit_score != null ? (
                      <span className={`text-xs font-semibold ${seq.icp_fit_score >= 0.7 ? "text-emerald-600 dark:text-emerald-400" : seq.icp_fit_score >= 0.4 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {(seq.icp_fit_score * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[seq.status] ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_ICONS[seq.status as keyof typeof STATUS_ICONS]}
                      {seq.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(seq.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/sequences/${seq.id}`}>
                      <Button variant="ghost" size="sm" className="h-7">
                        View <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filtered.length} of {data.total} sequences · Auto-refreshes every 10s
        </p>
      )}
    </div>
  );
}
