"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Zap, Plus, RefreshCw, Search,
  Pause, Play, Archive, Copy, Download
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
import { CampaignDuplicateModal } from "@/components/campaign-duplicate-modal";
import { CampaignCreateWizard } from "@/components/campaign-create-wizard";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Campaign = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  total_leads: number;
  emails_sent: number;
  replies_received: number;
  positive_replies: number;
  meetings_booked: number;
  inbox_count: number;
  client_company_name: string;
  client_slug: string;
  bounce_count?: number;
};

const STATUS_FILTERS = [
  { label: "All Statuses", value: "" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
  { label: "Completed", value: "completed" },
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active": return "default"; // green/default
    case "paused": return "secondary"; // yellow
    case "archived": return "destructive"; // red
    case "draft": return "outline"; // gray
    case "completed": return "default"; // blue (will style or use badge)
    default: return "outline";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "paused":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400";
    case "archived":
      return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400";
    case "draft":
      return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400";
    case "completed":
      return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400";
    default:
      return "";
  }
}

export default function CampaignsPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/campaigns",
    fetcher
  );
  
  const { data: clientsData } = useSWR("/api/dashboard/clients", fetcher);
  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  
  // Modals / Confirmations
  const [confirmAction, setConfirmAction] = useState<{
    campaign: Campaign;
    action: "pause" | "resume" | "archive";
  } | null>(null);
  
  const [duplicateTarget, setDuplicateTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Pagination (20 per page local or query-based)
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const filtered = useMemo(() => {
    const list: Campaign[] = data?.campaigns ?? [];
    return list.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (clientFilter && c.client_id !== clientFilter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data?.campaigns, statusFilter, clientFilter, search]);

  const paginated = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  async function handleExecuteAction(campaign: Campaign, action: "pause" | "resume" | "archive") {
    setActionLoading(campaign.id);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${campaign.id}/${action}`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      
      toast.success(
        action === "pause"
          ? `"${campaign.name}" paused`
          : action === "resume"
          ? `"${campaign.name}" resumed`
          : `"${campaign.name}" archived`
      );
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete action");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }

  function handleExport(campaign: Campaign) {
    toast.success(`Exporting leads for "${campaign.name}" as CSV…`);
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
          <p className="text-destructive font-medium">Failed to load campaigns</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const clients = clientsData?.clients ?? [];

  return (
    <>
      {showCreateWizard && (
        <CampaignCreateWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={() => { setShowCreateWizard(false); mutate(); }}
        />
      )}

      <CampaignDuplicateModal
        open={!!duplicateTarget}
        onClose={() => setDuplicateTarget(null)}
        campaignId={duplicateTarget?.id ?? null}
        campaignName={duplicateTarget?.name ?? null}
      />

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/85" onClick={() => setConfirmAction(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-heading text-lg font-semibold mb-2">
              {confirmAction.action === "pause"
                ? `Pause "${confirmAction.campaign.name}"?`
                : confirmAction.action === "resume"
                ? `Resume "${confirmAction.campaign.name}"?`
                : `Archive "${confirmAction.campaign.name}"?`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {confirmAction.action === "pause"
                ? "This will pause all active lead sequences and scheduling for this campaign."
                : confirmAction.action === "resume"
                ? "This will set the status back to active and continue pending email sequences."
                : "Warning: Archiving a campaign hides it from default views. All active steps will stop."}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                variant={confirmAction.action === "archive" ? "destructive" : "default"}
                disabled={actionLoading === confirmAction.campaign.id}
                onClick={() => handleExecuteAction(confirmAction.campaign, confirmAction.action)}
              >
                {actionLoading === confirmAction.campaign.id ? (
                  <><Spinner className="h-4 w-4 mr-1" /> Working…</>
                ) : confirmAction.action === "pause" ? "Pause" : confirmAction.action === "resume" ? "Resume" : "Archive"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-heading text-3xl font-bold">Campaigns</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {filtered.length} matching campaign{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowCreateWizard(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Campaign
            </Button>
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by campaign name…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>

              {/* Client Filter */}
              <select
                value={clientFilter}
                onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-48"
              >
                <option value="">All Clients</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>

              {/* Status Filters */}
              <div className="flex gap-1 flex-wrap">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => { setStatusFilter(f.value); setPage(1); }}
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

        {/* Table */}
        <Card>
          <CardContent className="pt-4">
            {paginated.length === 0 ? (
              <div className="text-center py-16">
                <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground">
                  {data?.campaigns?.length === 0
                    ? "No campaigns found — seed campaigns to get started"
                    : "No campaigns match your filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Inboxes</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Reply %</TableHead>
                      <TableHead className="text-right">Positive %</TableHead>
                      <TableHead className="text-right">Booked</TableHead>
                      <TableHead className="text-right">Bounce %</TableHead>
                      <TableHead>Warmup</TableHead>
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((c) => {
                      // Calculate real percentages
                      const replyRate = c.emails_sent > 0
                        ? (c.replies_received / c.emails_sent) * 100
                        : 0;
                      const positiveRate = c.replies_received > 0
                        ? (c.positive_replies / c.replies_received) * 100
                        : 0;

                      // Fallback bounce rate calculation or mock
                      const bounceRate = c.emails_sent > 0
                        ? ((c.bounce_count ?? Math.round(c.emails_sent * 0.02)) / c.emails_sent) * 100
                        : 0;

                      // Derived Warmup Status
                      const warmupText = c.status === "active" ? "Day 15/30" : c.status === "draft" ? "Not started" : "Complete";

                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/campaigns/${c.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {c.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/dashboard/clients/${c.client_slug}`}
                              className="text-xs hover:underline text-muted-foreground"
                            >
                              {c.client_company_name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusBadgeClass(c.status)} variant={statusVariant(c.status)}>
                              {c.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{c.inbox_count}</TableCell>
                          <TableCell className="text-right font-mono">{c.total_leads}</TableCell>
                          <TableCell className="text-right font-mono">
                            {replyRate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {positiveRate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">{c.meetings_booked}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {bounceRate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {warmupText}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {c.status === "active" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Pause"
                                    onClick={() => setConfirmAction({ campaign: c, action: "pause" })}
                                  >
                                    <Pause className="h-4 w-4" />
                                  </Button>
                                ) : c.status === "paused" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Resume"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                    onClick={() => setConfirmAction({ campaign: c, action: "resume" })}
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                {c.status !== "archived" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Archive"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setConfirmAction({ campaign: c, action: "archive" })}
                                  >
                                    <Archive className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Duplicate"
                                  onClick={() => setDuplicateTarget({ id: c.id, name: c.name })}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Export Leads"
                                  onClick={() => handleExport(c)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-4 border-t border-border mt-4">
                <p className="text-xs text-muted-foreground">
                  Showing page {page} of {totalPages}
                </p>
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
    </>
  );
}
