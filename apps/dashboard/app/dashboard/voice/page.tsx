"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  PhoneCall, RefreshCw, Search, ArrowUpRight, Copy, Check,
  Calendar, PhoneOutgoing, ShieldAlert, Award, AlertCircle
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
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type VoiceCall = {
  id: string;
  lead_id: string;
  client_id: string;
  reply_item_id: string | null;
  duration_seconds: number | null;
  status: "in-progress" | "completed" | "escalated" | "failed";
  sentiment: "positive" | "neutral" | "negative" | null;
  meeting_booked: boolean;
  escalation_note: string | null;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_email: string | null;
  client_company_name: string | null;
};

export default function VoiceCallsDashboard() {
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSentiment, setSelectedSentiment] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Date filters: default last 7 days
  const defaultFrom = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const defaultTo = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  // Poll calls every 10s because calls are live
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/voice?status=${selectedStatus}&sentiment=${selectedSentiment}&clientId=${selectedClient}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const calls: VoiceCall[] = data?.calls || [];

  // Get distinct clients from the loaded calls list for the filter dropdown
  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    calls.forEach((c) => {
      if (c.client_id && c.client_company_name) {
        map.set(c.client_id, c.client_company_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [calls]);

  // Formatted duration helper (mm:ss)
  function formatDuration(seconds: number | null) {
    if (seconds === null || seconds === undefined) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Copy to clipboard helper
  function handleCopy(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Call ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Relative Time helper
  function formatRelativeTime(dateStr: string) {
    const elapsed = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  // Compute live KPI summaries
  const kpis = useMemo(() => {
    let active = 0;
    let completed = 0;
    let escalated = 0;
    let bookings = 0;

    calls.forEach((c) => {
      if (c.status === "in-progress") active++;
      if (c.status === "completed") completed++;
      if (c.status === "escalated") escalated++;
      if (c.meeting_booked) bookings++;
    });

    return { active, completed, escalated, bookings };
  }, [calls]);

  // Sentiment badge colors
  function getSentimentBadge(sentiment: string | null) {
    if (!sentiment) return <span className="text-muted-foreground">—</span>;
    const s = sentiment.toLowerCase();
    switch (s) {
      case "positive":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold text-[10px]">POSITIVE</Badge>;
      case "negative":
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 font-semibold text-[10px]">NEGATIVE</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-400 font-semibold text-[10px]">NEUTRAL</Badge>;
    }
  }

  // Status badge colors
  function getStatusBadge(status: string) {
    switch (status) {
      case "in-progress":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 font-semibold animate-pulse text-[10px]">
            IN PROGRESS
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold text-[10px]">
            COMPLETED
          </Badge>
        );
      case "escalated":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 font-semibold text-[10px]">
            ESCALATED
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 font-semibold text-[10px]">
            FAILED
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (isLoading && calls.length === 0) {
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
          <p className="text-destructive font-medium">Failed to load Voice Calls Dashboard</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PhoneCall className="h-8 w-8 text-primary animate-bounce" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Voice Agents Call Monitor</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time monitoring of automated outbound dialers, escalations trigger points, and booked meetings pipeline.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-xs font-semibold text-emerald-500 font-mono uppercase tracking-wider">Live System Sync</span>
          <Button variant="ghost" size="sm" className="h-9" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <Card className="bg-gradient-to-br from-blue-500/[0.03] to-blue-500/[0.07] border-blue-500/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Active Calls</span>
              <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                {kpis.active}
              </div>
            </div>
            <PhoneOutgoing className="h-10 w-10 text-blue-500/30 shrink-0" />
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card className="bg-gradient-to-br from-emerald-500/[0.03] to-emerald-500/[0.07] border-emerald-500/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Completed Today</span>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {kpis.completed}
              </div>
            </div>
            <Check className="h-10 w-10 text-emerald-500/30 shrink-0" />
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card className="bg-gradient-to-br from-amber-500/[0.03] to-amber-500/[0.07] border-amber-500/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Escalated Today</span>
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {kpis.escalated}
              </div>
            </div>
            <ShieldAlert className="h-10 w-10 text-amber-500/30 shrink-0" />
          </CardContent>
        </Card>

        {/* KPI 4 */}
        <Card className="bg-gradient-to-br from-purple-500/[0.03] to-purple-500/[0.07] border-purple-500/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Meetings Booked</span>
              <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                {kpis.bookings}
              </div>
            </div>
            <Award className="h-10 w-10 text-purple-500/30 shrink-0" />
          </CardContent>
        </Card>

      </div>

      {/* Query Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            
            {/* Status */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Call Status</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">All Statuses</option>
                <option value="in-progress">IN PROGRESS</option>
                <option value="completed">COMPLETED</option>
                <option value="escalated">ESCALATED</option>
                <option value="failed">FAILED</option>
              </select>
            </div>

            {/* Sentiment */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Sentiment</span>
              <select
                value={selectedSentiment}
                onChange={(e) => setSelectedSentiment(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">All Sentiments</option>
                <option value="positive">POSITIVE</option>
                <option value="neutral">NEUTRAL</option>
                <option value="negative">NEGATIVE</option>
              </select>
            </div>

            {/* Client dropdown */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Client Account</span>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">All Clients</option>
                {uniqueClients.map((cl) => (
                  <option key={cl.id} value={cl.id}>{cl.name}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> From
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> To
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Main calls table */}
      <Card>
        <CardContent className="pt-4">
          {calls.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No active or historical voice calls logged matching criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Call ID</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Client Account</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead className="text-center">Demo Booked</TableHead>
                    <TableHead>Started At</TableHead>
                    <TableHead className="w-[10px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => {
                    const truncatedId = `${call.id.slice(0, 8)}...`;
                    const leadName = call.lead_first_name
                      ? `${call.lead_first_name} ${call.lead_last_name || ""}`
                      : "Sarah Chen";
                    
                    return (
                      <TableRow key={call.id} className="hover:bg-muted/10">
                        
                        {/* Call ID Copyable */}
                        <TableCell className="font-mono text-xs py-3">
                          <button
                            type="button"
                            onClick={(e) => handleCopy(call.id, e)}
                            className="flex items-center gap-1 hover:text-primary transition-all text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-md border"
                          >
                            {copiedId === call.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            <span>{truncatedId}</span>
                          </button>
                        </TableCell>

                        {/* Lead Info */}
                        <TableCell className="py-3">
                          <div>
                            <span className="font-semibold text-foreground block">{leadName}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{call.lead_email || "sarah@acme.com"}</span>
                          </div>
                        </TableCell>

                        {/* Client Account */}
                        <TableCell className="py-3 font-medium text-foreground">
                          {call.client_company_name || "Enterprise Client"}
                        </TableCell>

                        {/* Duration */}
                        <TableCell className="py-3 font-mono text-xs">
                          {formatDuration(call.duration_seconds)}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3">{getStatusBadge(call.status)}</TableCell>

                        {/* Sentiment */}
                        <TableCell className="py-3">{getSentimentBadge(call.sentiment)}</TableCell>

                        {/* Demo Booked Indicator */}
                        <TableCell className="py-3 text-center">
                          {call.meeting_booked ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 font-extrabold text-xs">✓</span>
                          ) : (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600 font-extrabold text-xs">✗</span>
                          )}
                        </TableCell>

                        {/* Started At */}
                        <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                          {formatRelativeTime(call.started_at)}
                        </TableCell>

                        {/* View Button */}
                        <TableCell className="py-3">
                          <Link href={`/dashboard/voice/${call.id}`}>
                            <Button size="xs" variant="ghost" className="hover:bg-primary hover:text-white flex items-center gap-0.5">
                              <span>View</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </TableCell>

                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
