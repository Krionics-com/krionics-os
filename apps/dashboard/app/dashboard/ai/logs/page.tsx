"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  ScrollText, RefreshCw, Filter, Clock, X, Info,
  CheckCircle2, AlertOctagon, HelpCircle, ChevronRight, Coins, Zap
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const INVOCATION_TYPES = [
  { label: "All Types", value: "" },
  { label: "Reply Classification", value: "reply_classification" },
  { label: "Draft Generation", value: "draft_generation" },
  { label: "Personalization", value: "personalization" },
  { label: "Signal Extraction", value: "signal_extraction" },
  { label: "Lead Scoring", value: "lead_scoring" },
];

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Success", value: "success" },
  { label: "Failure", value: "failure" },
];

const RANGE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
];

function formatTimeAgo(dateString: string): string {
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffHrs = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

export default function AIInvocationsLogsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState("7d");

  // Slide-over Drawer state
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch paginated logs
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/ai/logs?page=${page}&type=${typeFilter}&status=${statusFilter}&range=${rangeFilter}`,
    fetcher
  );

  // Fetch single log detail for slide-over drawer
  const { data: detailData, isLoading: loadingDetail } = useSWR(
    selectedId ? `/api/dashboard/ai/logs/${selectedId}` : null,
    fetcher
  );

  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  function statusBadge(status: string) {
    if (status === "success") {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">
          SUCCESS
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400">
        FAILURE
      </Badge>
    );
  }

  return (
    <div className="relative min-h-[600px] space-y-6">
      
      {/* Drawer Overlay for Slide-Over */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/85"
            onClick={() => setSelectedId(null)}
          />
          {/* Slide-over Content Drawer */}
          <div className="relative z-10 w-full max-w-2xl bg-card border-l h-full shadow-2xl overflow-y-auto p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  <h2 className="font-heading text-lg font-bold">Invocation Details</h2>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="flex justify-center items-center py-20">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : !detailData?.log ? (
                <p className="text-center py-10 text-muted-foreground">Failed to load log metrics.</p>
              ) : (
                <div className="space-y-5 text-sm">
                  {/* Metadata fields */}
                  <div className="grid grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase">Prompt Template</span>
                      <p className="font-semibold">{detailData.log.prompt_name || "Unknown / Test Sandbox"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase">Invocation Type</span>
                      <Badge variant="outline" className="font-mono text-xs mt-1 block w-fit">
                        {detailData.log.invocation_type.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase">LLM Model</span>
                      <p className="font-mono text-xs mt-0.5">{detailData.log.model}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase">Cost</span>
                      <p className="font-semibold text-primary">${(detailData.log.cost_usd || 0).toFixed(5)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase">Latency</span>
                      <p className="font-mono">{detailData.log.latency_ms}ms</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase">Tokens (In / Out)</span>
                      <p className="font-mono">{detailData.log.input_tokens || 0} / {detailData.log.output_tokens || 0}</p>
                    </div>
                  </div>

                  {/* System Prompt override */}
                  {detailData.log.system_prompt && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">System Prompt Used</span>
                      <pre className="w-full bg-card border rounded-lg p-3 font-mono text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-40">
                        {detailData.log.system_prompt}
                      </pre>
                    </div>
                  )}

                  {/* User Template */}
                  {detailData.log.user_template && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">User Template/Prompt Rendered</span>
                      <pre className="w-full bg-card border rounded-lg p-3 font-mono text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-40">
                        {detailData.log.user_template}
                      </pre>
                    </div>
                  )}

                  {/* AI Response output */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-primary uppercase">Model Response Output</span>
                    {detailData.log.success ? (
                      <pre className="w-full bg-primary/[0.01] border border-primary/10 rounded-lg p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-64">
                        {detailData.log.raw_output?.response || JSON.stringify(detailData.log.raw_output, null, 2)}
                      </pre>
                    ) : (
                      <pre className="w-full bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/30 rounded-lg p-3 font-mono text-xs text-destructive overflow-x-auto whitespace-pre-wrap">
                        Error code: {detailData.log.error_code || "Unknown prompt exception"}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4 mt-8 flex justify-end">
              <Button variant="ghost" onClick={() => setSelectedId(null)}>Close panel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">AI Invocation Logs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live audit stream of all LLM requests, token counts, error rates, and API billing costs.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filter panel */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            
            {/* Range selection */}
            <div className="flex rounded-lg border border-border overflow-hidden shrink-0 bg-card">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setRangeFilter(r.value); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-0 ${
                    rangeFilter === r.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Invocation Type select */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-56"
            >
              {INVOCATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Success Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-40"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <span className="ml-auto text-xs text-muted-foreground self-center">
              Total found: <strong>{totalCount}</strong> logs
            </span>

          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="h-8 w-8" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Filter className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No logged AI invocations match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time ago</TableHead>
                    <TableHead>Invocation Type</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead className="text-right">Input Tokens</TableHead>
                    <TableHead className="text-right">Output Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/10"
                      onClick={() => setSelectedId(log.id)}
                    >
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {formatTimeAgo(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {log.invocation_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{log.latency_ms}ms</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{log.input_tokens || 0}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{log.output_tokens || 0}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">
                        ${(log.cost_usd || 0).toFixed(5)}
                      </TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
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

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center border-t pt-4 mt-4 text-xs">
              <span className="text-muted-foreground">Showing page {page} of {totalPages}</span>
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
