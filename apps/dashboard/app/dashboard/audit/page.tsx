"use client";

import { useState, useMemo, Fragment } from "react";
import useSWR from "swr";
import {
  ClipboardList, RefreshCw, Search, Download, Calendar,
  ChevronDown, ChevronUp, Copy, Check, Filter, User, ArrowRight
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

type AuditLog = {
  id: string;
  operator_id: string | null;
  operator_name: string | null;
  operator_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  summary: string;
  before_value: Record<string, any> | null;
  after_value: Record<string, any> | null;
  created_at: string;
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedResourceType, setSelectedResourceType] = useState("");

  // Default dates: last 7 days
  const defaultFrom = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const defaultTo = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch Directory Values (operators)
  const { data: operatorsData } = useSWR("/api/operators", fetcher);

  // Fetch Paginated Logs
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/audit?page=${page}&operatorId=${selectedOperator}&action=${selectedAction}&resourceType=${selectedResourceType}&dateFrom=${dateFrom}&dateTo=${dateTo}&search=${search}`,
    fetcher,
    { refreshInterval: 30000 } // Auto-poll 30s
  );

  const logs: AuditLog[] = data?.logs || [];
  const total = data?.total || 0;
  const limit = data?.limit || 50;
  const totalPages = Math.ceil(total / limit);

  // 1. Copy to clipboard helper
  function handleCopy(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Resource ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  // 2. Relative time formatter
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

  // 3. Client-side CSV download export
  function handleExportCSV() {
    if (logs.length === 0) {
      toast.warning("No rows available to export");
      return;
    }

    const headers = ["Timestamp", "Operator Name", "Operator Email", "Action", "Resource Type", "Resource ID", "Summary"];
    const rows = logs.map((log) => [
      new Date(log.created_at).toLocaleString(),
      log.operator_name || "System",
      log.operator_email || "System",
      log.action,
      log.resource_type,
      log.resource_id || "",
      log.summary.replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `krionics_audit_log_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV log exported successfully");
  }

  // Action badge colors helper
  function getActionBadge(action: string) {
    const act = action.toLowerCase();
    switch (act) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 font-bold uppercase text-[9px]">APPROVED</Badge>;
      case "rejected":
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 font-bold uppercase text-[9px]">REJECTED</Badge>;
      case "config_changed":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 font-bold uppercase text-[9px]">CONFIG CHANGED</Badge>;
      case "regenerated":
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 font-bold uppercase text-[9px]">REGENERATED</Badge>;
      case "escalated":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 font-bold uppercase text-[9px]">ESCALATED</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-400 font-bold uppercase text-[9px]">{act}</Badge>;
    }
  }

  function getResourceTypeBadge(res: string) {
    return (
      <Badge variant="outline" className="font-mono text-[9px] uppercase font-bold border-border">
        {res}
      </Badge>
    );
  }

  const actions = ["approved", "rejected", "edited", "created", "deleted", "config_changed", "escalated", "regenerated", "acknowledged", "resolved"];
  const resourceTypes = ["reply", "client", "campaign", "prompt", "alert", "operator"];

  if (isLoading && logs.length === 0) {
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
          <p className="text-destructive font-medium">Failed to load system audit logs</p>
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
          <ClipboardList className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Immutable System Audit Log</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tracks every critical operator decision, configuration update, review dispatch action, and trigger alert state change.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" size="sm" className="h-9" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
          <Button variant="ghost" size="sm" className="h-9" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Complex Filter Bars */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            
            {/* Search Input */}
            <div className="md:col-span-2 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Search Summary / ID</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter logs summary..."
                  className="h-8.5 w-full rounded-lg border border-input bg-transparent pl-8 pr-2.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Operator Filter */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Operator</span>
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">All Operators</option>
                {operatorsData?.operators?.map((op: any) => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Action Type</span>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">All Actions</option>
                {actions.map((act) => (
                  <option key={act} value={act}>{act.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Resource Type Filter */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Resource Type</span>
              <select
                value={selectedResourceType}
                onChange={(e) => setSelectedResourceType(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">All Resources</option>
                {resourceTypes.map((res) => (
                  <option key={res} value={res}>{res.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Clear filters button */}
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-semibold h-8.5"
                onClick={() => {
                  setSearch("");
                  setSelectedOperator("");
                  setSelectedAction("");
                  setSelectedResourceType("");
                  setDateFrom(defaultFrom);
                  setDateTo(defaultTo);
                }}
              >
                Reset Filters
              </Button>
            </div>

          </div>

          {/* Date Picker Split Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/40">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Date From
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Date To
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

      {/* Main Table Grid */}
      <Card>
        <CardContent className="pt-4">
          {logs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No audit log records found matching selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[10px]"></TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource Type</TableHead>
                    <TableHead>Resource ID</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((item) => {
                    const isExpanded = expandedId === item.id;
                    const truncatedId = item.resource_id ? `${item.resource_id.slice(0, 8)}...` : "—";
                    
                    return (
                      <Fragment key={item.id}>
                        {/* Summary Row */}
                        <TableRow
                          className={cn(
                            "cursor-pointer hover:bg-muted/10",
                            isExpanded && "bg-muted/30"
                          )}
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          <TableCell className="py-3 px-1 text-center">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="py-3">
                            <span
                              title={new Date(item.created_at).toLocaleString()}
                              className="font-mono text-muted-foreground whitespace-nowrap cursor-help border-b border-dashed border-border"
                            >
                              {formatRelativeTime(item.created_at)}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 font-semibold text-foreground">
                            {item.operator_name ? (
                              <span title={item.operator_email || ""}>{item.operator_name}</span>
                            ) : (
                              <span className="text-muted-foreground font-medium">SYSTEM GLOBAL</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">{getActionBadge(item.action)}</TableCell>
                          <TableCell className="py-3">{getResourceTypeBadge(item.resource_type)}</TableCell>
                          <TableCell className="py-3 font-mono text-xs">
                            {item.resource_id ? (
                              <button
                                type="button"
                                onClick={(e) => handleCopy(item.resource_id!, e)}
                                className="flex items-center gap-1 hover:text-primary transition-all text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-md border"
                              >
                                {copiedId === item.resource_id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                <span>{truncatedId}</span>
                              </button>
                            ) : (
                              <span className="text-muted-foreground">SYSTEM</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 font-medium text-slate-700 dark:text-slate-300 max-w-sm truncate">
                            {item.summary}
                          </TableCell>
                        </TableRow>

                        {/* Expandable JSON Diff Row */}
                        {isExpanded && (
                          <TableRow className="bg-muted/15 border-t border-border">
                            <TableCell colSpan={7} className="py-4 px-6">
                              <div className="space-y-4">
                                <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">State Delta Diff Analysis</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  
                                  {/* Before Block */}
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] uppercase font-bold text-rose-500">State BEFORE Action</span>
                                    <pre className="p-3 bg-rose-500/[0.03] border border-rose-500/20 text-rose-600 rounded-lg text-[10px] font-mono overflow-auto max-h-[220px]">
                                      {item.before_value ? JSON.stringify(item.before_value, null, 2) : "/* Null initial state / Resource creation event */"}
                                    </pre>
                                  </div>

                                  {/* After Block */}
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] uppercase font-bold text-emerald-500">State AFTER Action</span>
                                    <pre className="p-3 bg-emerald-500/[0.03] border border-emerald-500/20 text-emerald-600 rounded-lg text-[10px] font-mono overflow-auto max-h-[220px]">
                                      {item.after_value ? JSON.stringify(item.after_value, null, 2) : "/* Null final state / Resource deletion event */"}
                                    </pre>
                                  </div>

                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Simple Pagination bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border/60 mt-4">
              <span className="text-xs text-muted-foreground font-mono">
                Showing Page {page} of {totalPages} ({total} audit logs)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="font-bold text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="font-bold text-xs"
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
