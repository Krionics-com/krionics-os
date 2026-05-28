"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Users, Search, RefreshCw, ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const LEAD_STATUS_COLORS: Record<string, string> = {
  raw_imported: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
  enriched: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  campaign_ready: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  queued_for_sending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  in_sequence: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  reply_received: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  positive_reply: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  meeting_booked: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  not_interested: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  unsubscribed: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  bounced: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  objection_reply: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  faq_reply: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Raw", value: "raw_imported" },
  { label: "Enriched", value: "enriched" },
  { label: "Campaign Ready", value: "campaign_ready" },
  { label: "In Sequence", value: "in_sequence" },
  { label: "Reply Received", value: "reply_received" },
  { label: "Meeting Booked", value: "meeting_booked" },
];

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [suppressedFilter, setSuppressedFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: clientsData } = useSWR("/api/dashboard/clients", fetcher);
  const clients: any[] = clientsData?.clients ?? [];

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (clientFilter) params.set("client_id", clientFilter);
  if (suppressedFilter) params.set("suppressed", suppressedFilter);
  if (search) params.set("search", search);
  params.set("skip", String((page - 1) * pageSize));
  params.set("limit", String(pageSize));

  const { data, isLoading, error, mutate } = useSWR(
    `/api/dashboard/leads?${params}`,
    fetcher,
    { keepPreviousData: true }
  );

  const leads: any[] = data?.leads ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total.toLocaleString()} total lead{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or company…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
              <select
                value={clientFilter}
                onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
                className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm md:w-48"
              >
                <option value="">All Clients</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <select
                value={suppressedFilter}
                onChange={(e) => { setSuppressedFilter(e.target.value); setPage(1); }}
                className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm md:w-40"
              >
                <option value="">All</option>
                <option value="false">Active only</option>
                <option value="true">Suppressed only</option>
              </select>
            </div>
            <div className="flex gap-1 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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
            <p className="text-destructive">Failed to load leads</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>Retry</Button>
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No leads found</p>
            <p className="text-xs text-muted-foreground mt-1">Leads are imported from Apollo and enriched via Clay.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">LQS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead: any) => (
                <tr key={lead.id} className={`hover:bg-muted/30 transition-colors ${lead.is_suppressed ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {lead.is_suppressed && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      <div>
                        <p className="font-medium text-xs">
                          {lead.first_name} {lead.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{lead.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs">{lead.company ?? "—"}</p>
                    {lead.title && <p className="text-xs text-muted-foreground">{lead.title}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{lead.campaign_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LEAD_STATUS_COLORS[lead.lead_status] ?? "bg-muted text-muted-foreground"}`}>
                      {lead.lead_status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.lqs_score != null ? (
                      <span className={`text-xs font-semibold ${Number(lead.lqs_score) >= 0.7 ? "text-emerald-600 dark:text-emerald-400" : Number(lead.lqs_score) >= 0.4 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {(Number(lead.lqs_score) * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground capitalize">{lead.source}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/leads/${lead.id}`}>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total.toLocaleString()} leads
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
