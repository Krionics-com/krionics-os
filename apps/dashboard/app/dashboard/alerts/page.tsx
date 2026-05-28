"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Bell, RefreshCw, AlertTriangle, AlertOctagon, CheckCircle2,
  Clock, X, Check, Filter, ShieldAlert, ArrowRight, Info
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

type Alert = {
  id: string;
  type: string;
  severity: string;
  client_id: string | null;
  client_name: string | null;
  title: string;
  description: string;
  status: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

export default function AlertCenterPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/alerts",
    fetcher,
    { refreshInterval: 10000 } // Auto-poll every 10s
  );

  const alerts: Alert[] = data?.alerts || [];

  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // 1. Calculate relative time helper
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

  // 2. Acknowledge Alert Handler
  async function handleAcknowledge(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setActingId(id);
    try {
      const res = await fetch(`/api/dashboard/alerts/${id}/acknowledge`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to acknowledge alert");
      
      toast.success("Alert acknowledged successfully!");
      mutate();
      if (selectedAlert?.id === id) {
        setSelectedAlert((prev) => prev ? { ...prev, status: "acknowledged", acknowledged_at: new Date().toISOString() } : null);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActingId(null);
    }
  }

  // 3. Resolve Alert Handler
  async function handleResolve(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setActingId(id);
    try {
      const res = await fetch(`/api/dashboard/alerts/${id}/resolve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to resolve alert");
      
      toast.success("Alert marked as resolved!");
      mutate();
      if (selectedAlert?.id === id) {
        setSelectedAlert((prev) => prev ? { ...prev, status: "resolved", resolved_at: new Date().toISOString() } : null);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActingId(null);
    }
  }

  // 4. Filters & Stats derived in memory
  const stats = useMemo(() => {
    return {
      critical: alerts.filter((x) => x.severity === "critical" && x.status !== "resolved").length,
      warning: alerts.filter((x) => x.severity === "warning" && x.status !== "resolved").length,
      acknowledged: alerts.filter((x) => x.status === "acknowledged").length,
      resolvedToday: alerts.filter((x) => x.status === "resolved").length
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      if (filterSeverity !== "all" && item.severity !== filterSeverity) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (filterType !== "all" && !item.type.toLowerCase().includes(filterType.toLowerCase())) return false;
      return true;
    });
  }, [alerts, filterSeverity, filterStatus, filterType]);

  const distinctTypes = useMemo(() => {
    const set = new Set(alerts.map((x) => x.type));
    return Array.from(set);
  }, [alerts]);

  // Color badges helper
  function getSeverityBadge(sev: string) {
    switch (sev) {
      case "critical":
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 gap-1 font-bold">CRITICAL</Badge>;
      case "warning":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 gap-1 font-bold">WARNING</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 gap-1 font-bold">INFO</Badge>;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "resolved":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold uppercase">RESOLVED</Badge>;
      case "acknowledged":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 font-semibold uppercase">ACKNOWLEDGED</Badge>;
      default:
        return <Badge className="bg-rose-500 text-white font-bold uppercase animate-pulse">NEW</Badge>;
    }
  }

  function getTypeBadge(type: string) {
    const clean = type.toLowerCase();
    if (clean.includes("sla")) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 font-mono font-bold uppercase text-[9px]">SLA Breach</Badge>;
    } else if (clean.includes("overload")) {
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 font-mono font-bold uppercase text-[9px]">Queue Overload</Badge>;
    } else if (clean.includes("failure") && clean.includes("workflow")) {
      return <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400 font-mono font-bold uppercase text-[9px]">Workflow failure</Badge>;
    } else if (clean.includes("bounce")) {
      return <Badge variant="secondary" className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 font-mono font-bold uppercase text-[9px]">Bounce Spike</Badge>;
    } else if (clean.includes("inbox")) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 font-mono font-bold uppercase text-[9px]">Inbox Issue</Badge>;
    } else if (clean.includes("crm")) {
      return <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 font-mono font-bold uppercase text-[9px]">CRM Failure</Badge>;
    }
    return <Badge variant="secondary" className="bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-400 font-mono font-bold uppercase text-[9px]">{type}</Badge>;
  }

  function getSuggestedAction(type: string) {
    const clean = type.toLowerCase();
    if (clean.includes("sla")) {
      return "Immediate action required: Assign the reply review item to an active operator now. Escalate to campaign manager if client config SLA requires it.";
    } else if (clean.includes("overload")) {
      return "Operational check: Check packages/workers BullMQ latency charts. Consider scaling up draft generation worker instances or flush dead-letter jobs.";
    } else if (clean.includes("failure") && clean.includes("workflow")) {
      return "Code action: Analyze BullMQ job parameters in DLQ. Resolve any database connection bounds before executing retry.";
    } else if (clean.includes("bounce")) {
      return "Infrastructure check: Temporarily pause campaigns using this inbox domain suffix. Warmup domains again or re-validate SPF/DKIM DNS records.";
    } else if (clean.includes("inbox")) {
      return "Inbox review: Inspect delivery score in Inboxes profile. Make sure the SPF record has the required v=spf1 include:spf.instantly.ai block.";
    } else if (clean.includes("crm")) {
      return "CRM authentication: Ask the client team to re-authenticate HubSpot/Pipedrive integration oauth token under campaign configuration sheet.";
    }
    return "Operations check: Investigate the alert details and resource logs to isolate the trigger failure.";
  }

  if (isLoading && alerts.length === 0) {
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
          <p className="text-destructive font-medium">Failed to load system alerts</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 relative min-h-screen pb-20">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-rose-500 animate-swing" />
          <div>
            <h1 className="font-heading text-3xl font-bold">System Alerts Center</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor active operator SLAs, queue overloads, bounce rate anomalies, and outbound delivery faults.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Stat 1: Critical */}
        <Card className="border-l-4 border-l-rose-500 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Critical Incidents</span>
            <p className="text-2xl font-extrabold text-rose-600 font-mono mt-1">{stats.critical}</p>
          </CardContent>
        </Card>

        {/* Stat 2: Warnings */}
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Active Warnings</span>
            <p className="text-2xl font-extrabold text-amber-500 font-mono mt-1">{stats.warning}</p>
          </CardContent>
        </Card>

        {/* Stat 3: Acknowledged */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Acknowledged</span>
            <p className="text-2xl font-extrabold text-blue-500 font-mono mt-1">{stats.acknowledged}</p>
          </CardContent>
        </Card>

        {/* Stat 4: Resolved Today */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Resolved Alerts</span>
            <p className="text-2xl font-extrabold text-emerald-600 font-mono mt-1">{stats.resolvedToday}</p>
          </CardContent>
        </Card>

      </div>

      {/* Filters Bar Card */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            
            {/* Filter Severity */}
            <div className="flex-1 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Severity Level</span>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical Only</option>
                <option value="warning">Warning Only</option>
                <option value="info">Info Only</option>
              </select>
            </div>

            {/* Filter Status */}
            <div className="flex-1 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Alert Status</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="new">New Only</option>
                <option value="acknowledged">Acknowledged Only</option>
                <option value="resolved">Resolved Only</option>
              </select>
            </div>

            {/* Filter Type */}
            <div className="flex-1 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Incident Type</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Incident Types</option>
                {distinctTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Clear button */}
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => { setFilterSeverity("all"); setFilterStatus("all"); setFilterType("all"); }}
              >
                Reset Filters
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Alerts Master Grid */}
      <Card>
        <CardContent className="pt-4">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No active system alerts matched your search filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Affected Client</TableHead>
                    <TableHead>Incident Details</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map((item) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/10",
                        selectedAlert?.id === item.id && "bg-muted/30"
                      )}
                      onClick={() => setSelectedAlert(item)}
                    >
                      <TableCell>{getSeverityBadge(item.severity)}</TableCell>
                      <TableCell>{getTypeBadge(item.type)}</TableCell>
                      <TableCell className="font-semibold text-foreground">{item.client_name || "GLOBAL SYSTEM"}</TableCell>
                      <TableCell className="font-medium max-w-sm truncate text-muted-foreground">{item.title}</TableCell>
                      <TableCell className="font-mono text-muted-foreground whitespace-nowrap">{formatRelativeTime(item.created_at)}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {item.status === "new" && (
                          <Button
                            variant="outline"
                            size="xs"
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                            disabled={actingId === item.id}
                            onClick={(e) => handleAcknowledge(item.id, e)}
                          >
                            Acknowledge
                          </Button>
                        )}
                        {item.status === "acknowledged" && (
                          <Button
                            variant="outline"
                            size="xs"
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                            disabled={actingId === item.id}
                            onClick={(e) => handleResolve(item.id, e)}
                          >
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slide-over Detail Sheet panel */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/85 z-50 flex justify-end transition-all duration-300">
          
          {/* Backdrop Click Dismiss */}
          <div className="flex-1" onClick={() => setSelectedAlert(null)} />

          {/* Right Panel Sheet block */}
          <div className="w-full md:w-[480px] bg-card h-full border-l border-border shadow-2xl flex flex-col p-6 space-y-6 animate-slide-in">
            
            {/* Header detail */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex flex-wrap gap-2 items-center">
                  {getSeverityBadge(selectedAlert.severity)}
                  {getTypeBadge(selectedAlert.type)}
                </div>
                <h2 className="text-lg font-extrabold text-foreground mt-2">{selectedAlert.title}</h2>
                <span className="text-[10px] text-muted-foreground font-mono block">Incident Reference: {selectedAlert.id}</span>
              </div>
              <Button variant="ghost" size="icon" className="p-1 h-7 w-7" onClick={() => setSelectedAlert(null)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>

            {/* Severity context warning block */}
            <div className={cn(
              "p-3 rounded-lg border text-xs flex gap-2.5 items-start",
              selectedAlert.severity === "critical"
                ? "bg-rose-50/50 border-rose-200 text-rose-800 dark:bg-rose-950/15 dark:text-rose-300"
                : "bg-amber-50/50 border-amber-200 text-amber-800 dark:bg-amber-950/15 dark:text-amber-300"
            )}>
              <Info className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <p className="font-medium">
                <strong>{selectedAlert.severity.toUpperCase()} ALERT:</strong> Urgent attention is required for the affected campaign resource scopes listed.
              </p>
            </div>

            {/* Resource details */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Affected Target Resource</span>
              <div className="bg-muted/40 p-3 rounded-lg border grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[9px] text-muted-foreground uppercase">Associated Client</span>
                  <p className="font-bold mt-0.5 text-foreground">{selectedAlert.client_name || "System Global"}</p>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground uppercase">Target Type</span>
                  <p className="font-bold mt-0.5 text-foreground font-mono">{selectedAlert.type.toUpperCase()}</p>
                </div>
              </div>
            </div>

            {/* Description details */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Full Incident Description</span>
              <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border font-mono">
                {selectedAlert.description}
              </p>
            </div>

            {/* Operations action playbook */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Suggested Resolution Playbook</span>
              <p className="text-xs text-slate-800 dark:text-slate-300 leading-relaxed bg-amber-500/5 p-3 rounded-lg border border-amber-500/20 font-medium">
                {getSuggestedAction(selectedAlert.type)}
              </p>
            </div>

            {/* Incident timeline progress logs */}
            <div className="space-y-3 flex-1 overflow-y-auto">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">State Audit History Log</span>
              <div className="space-y-3.5 border-l-2 border-border pl-4 ml-2 text-xs">
                
                {/* Step 1: Created */}
                <div className="relative">
                  <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-400 border border-card" />
                  <p className="font-semibold text-foreground">Incident Triggered</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{new Date(selectedAlert.created_at).toLocaleString()}</p>
                </div>

                {/* Step 2: Acknowledged */}
                {selectedAlert.acknowledged_at && (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-blue-500 border border-card" />
                    <p className="font-semibold text-foreground">Operator Acknowledged</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{new Date(selectedAlert.acknowledged_at).toLocaleString()}</p>
                  </div>
                )}

                {/* Step 3: Resolved */}
                {selectedAlert.resolved_at && (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-emerald-500 border border-card" />
                    <p className="font-semibold text-foreground">Incident Resolved</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{new Date(selectedAlert.resolved_at).toLocaleString()}</p>
                  </div>
                )}

              </div>
            </div>

            {/* Action buttons footer inside sheet */}
            <div className="flex gap-3 pt-4 border-t border-border">
              {selectedAlert.status === "new" && (
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  disabled={actingId === selectedAlert.id}
                  onClick={() => handleAcknowledge(selectedAlert.id)}
                >
                  <Check className="h-4 w-4 mr-1.5" /> Acknowledge Incident
                </Button>
              )}
              {selectedAlert.status === "acknowledged" && (
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  disabled={actingId === selectedAlert.id}
                  onClick={() => handleResolve(selectedAlert.id)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Resolve Incident
                </Button>
              )}
              <Button variant="outline" className="flex-1 font-semibold" onClick={() => setSelectedAlert(null)}>
                Dismiss Panel
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
