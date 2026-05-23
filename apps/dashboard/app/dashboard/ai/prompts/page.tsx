"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Sparkles, RefreshCw, Search, Pencil, ToggleLeft, ToggleRight,
  ShieldCheck, HelpCircle
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
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AIPrompt = {
  id: string;
  client_id: string | null;
  name: string;
  slug: string;
  version: number;
  invocation_type: string;
  system_prompt: string;
  user_template: string;
  model: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  is_global: boolean;
  client_company_name: string | null;
  created_at: string;
  updated_at?: string;
};

const INVOCATION_TYPES = [
  { label: "All Types", value: "" },
  { label: "Reply Classification", value: "reply_classification" },
  { label: "Draft Generation", value: "draft_generation" },
  { label: "Personalization", value: "personalization" },
  { label: "Signal Extraction", value: "signal_extraction" },
  { label: "Lead Scoring", value: "lead_scoring" },
];

export default function AIPromptsPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/ai/prompts",
    fetcher
  );

  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("all"); // all, global, client
  const [statusFilter, setStatusFilter] = useState(""); // all, active, inactive

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list: AIPrompt[] = data?.prompts ?? [];
    return list.filter((p) => {
      // 1. Search
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      // 2. Invocation Type
      if (typeFilter && p.invocation_type !== typeFilter) return false;
      // 3. Client scope
      if (clientFilter === "global" && p.client_id !== null) return false;
      if (clientFilter === "client" && p.client_id === null) return false;
      // 4. Status
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "inactive" && p.is_active) return false;
      return true;
    });
  }, [data?.prompts, search, typeFilter, clientFilter, statusFilter]);

  async function handleToggleActive(prompt: AIPrompt) {
    if (!isAdmin) {
      toast.error("Permissions required: Admin or Super Admin only");
      return;
    }
    setTogglingId(prompt.id);
    try {
      const res = await fetch(`/api/dashboard/ai/prompts/${prompt.id}/toggle`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success(`Prompt "${prompt.name}" status updated`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update prompt status");
    } finally {
      setTogglingId(null);
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
      <Card className="mx-auto max-w-xl mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Failed to load AI Prompts</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">AI Prompt Engine</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage core templates driving RICR classifier rules and response workflows.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filter Panel */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search prompt templates by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Scope filter */}
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-40"
            >
              <option value="all">All Scopes</option>
              <option value="global">Global Prompts</option>
              <option value="client">Client Override Prompts</option>
            </select>

            {/* Invocation Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-48"
            >
              {INVOCATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-36"
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Prompts table */}
      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">
                {data?.prompts?.length === 0
                  ? "No prompt records found."
                  : "No prompt records match your criteria."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prompt Name</TableHead>
                    <TableHead>Invocation Type</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-center">Version</TableHead>
                    <TableHead>LLM Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const updateDate = p.updated_at ? new Date(p.updated_at) : new Date(p.created_at);
                    
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-foreground">
                          <Link href={`/dashboard/ai/prompts/${p.id}`} className="hover:underline hover:text-primary">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {p.invocation_type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {p.client_id === null ? (
                            <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400">
                              GLOBAL
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">{p.client_company_name}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono font-medium">v{p.version}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{p.model}</TableCell>
                        <TableCell>
                          <Badge className={p.is_active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400"}>
                            {p.is_active ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {updateDate.toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/dashboard/ai/prompts/${p.id}`}>
                              <Button variant="ghost" size="sm" title="Edit Template">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={togglingId === p.id}
                                onClick={() => handleToggleActive(p)}
                                title={p.is_active ? "Deactivate" : "Activate"}
                              >
                                {togglingId === p.id ? (
                                  <Spinner className="h-4 w-4" />
                                ) : p.is_active ? (
                                  <ToggleRight className="h-5 w-5 text-emerald-600" />
                                ) : (
                                  <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                                )}
                              </Button>
                            )}
                          </div>
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
