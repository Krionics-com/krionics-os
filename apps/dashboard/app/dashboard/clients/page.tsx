"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Building2, Plus, RefreshCw, Search,
  Pause, Archive
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { ClientCreateModal } from "@/components/client-create-modal";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Client = {
  id: string;
  slug: string;
  company_name: string;
  status: string;
  automation_level: number;
  mrr_usd: number;
  active_campaigns: number;
  reply_rate: number;
  onboarding_stage: string;
  config?: any;
};

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Onboarding", value: "onboarding" },
  { label: "Archived", value: "churned" },
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active": return "default";
    case "paused": return "secondary";
    case "churned": return "destructive";
    case "onboarding": return "outline";
    case "suspended": return "destructive";
    default: return "outline";
  }
}

function statusLabel(status: string): string {
  if (status === "churned") return "Archived";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatMrr(cents: number): string {
  return `$${cents.toLocaleString("en-US")}`;
}

export default function ClientsPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/clients",
    fetcher
  );
  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    client: Client; action: "pause" | "archive";
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const clients: Client[] = data?.clients ?? [];
    return clients.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (search && !c.company_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data?.clients, statusFilter, search]);

  async function executeAction(client: Client, action: "pause" | "archive") {
    setActionLoading(client.slug);
    const endpoint = `/api/dashboard/clients/${client.slug}/${action}`;
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success(
        action === "pause"
          ? `"${client.company_name}" paused`
          : `"${client.company_name}" archived`
      );
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
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
      <Card className="mx-auto max-w-xl mt-12">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Failed to load clients</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ClientCreateModal open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-heading text-lg font-semibold mb-2">
              {confirmAction.action === "pause"
                ? `Pause ${confirmAction.client.company_name}?`
                : `Archive ${confirmAction.client.company_name}?`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {confirmAction.action === "pause"
                ? "This will stop all active campaigns for this client."
                : "This marks the client as churned. This action is reversible via direct DB edit."}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={actionLoading === confirmAction.client.slug}
                onClick={() => executeAction(confirmAction.client, confirmAction.action)}
              >
                {actionLoading === confirmAction.client.slug ? (
                  <><Spinner className="h-4 w-4 mr-1" /> Working…</>
                ) : confirmAction.action === "pause" ? "Pause" : "Archive"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-heading text-3xl font-bold">Clients</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data?.clients?.length ?? 0} total client{data?.clients?.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Client
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
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

        {/* Table */}
        <Card>
          <CardContent className="pt-4">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground">
                  {data?.clients?.length === 0
                    ? "No clients yet — create your first one"
                    : "No clients match your filters"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Active Campaigns</TableHead>
                    <TableHead className="text-right">Reply Rate</TableHead>
                    <TableHead>Automation</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead>Stage</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/clients/${client.slug}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {client.company_name}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono">{client.slug}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(client.status)}>
                          {statusLabel(client.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {client.active_campaigns}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(client.reply_rate).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        Level {client.automation_level}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatMrr(client.mrr_usd)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {client.onboarding_stage}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {client.status !== "paused" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Pause"
                                onClick={() =>
                                  setConfirmAction({ client, action: "pause" })
                                }
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                            )}
                            {client.status !== "churned" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Archive"
                                className="text-destructive hover:text-destructive"
                                onClick={() =>
                                  setConfirmAction({ client, action: "archive" })
                                }
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
