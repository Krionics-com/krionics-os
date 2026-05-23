"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  ShieldAlert, RefreshCw, Save, CheckCircle2, AlertTriangle,
  Mail, BellRing, Settings, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AlertRule = {
  id?: string;
  rule_type: string;
  enabled: boolean;
  severity: string;
  threshold: number | null;
  destinations: string[];
  updated_at?: string;
};

export default function AlertRulesConfigPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/settings/alerts",
    fetcher
  );

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync loaded database config
  useEffect(() => {
    if (data?.rules) {
      setRules(data.rules);
    }
  }, [data?.rules]);

  // Handler to toggle rule enabled/disabled
  function handleToggleEnabled(ruleType: string) {
    setRules((prev) =>
      prev.map((r) => (r.rule_type === ruleType ? { ...r, enabled: !r.enabled } : r))
    );
  }

  // Handler to modify severity
  function handleSeverityChange(ruleType: string, severity: string) {
    setRules((prev) =>
      prev.map((r) => (r.rule_type === ruleType ? { ...r, severity } : r))
    );
  }

  // Handler to modify threshold
  function handleThresholdChange(ruleType: string, val: string) {
    const num = val === "" ? null : parseFloat(val);
    setRules((prev) =>
      prev.map((r) => (r.rule_type === ruleType ? { ...r, threshold: num } : r))
    );
  }

  // Handler to toggle destinations checkbox
  function handleDestinationToggle(ruleType: string, dest: string) {
    setRules((prev) =>
      prev.map((r) => {
        if (r.rule_type !== ruleType) return r;
        const current = r.destinations;
        const next = current.includes(dest)
          ? current.filter((d) => d !== dest)
          : [...current, dest];
        return { ...r, destinations: next };
      })
    );
  }

  // Save Settings handler
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules })
      });

      if (!res.ok) throw new Error("Failed to save rules config");
      
      toast.success("Alert routing configurations saved successfully!");
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function getFriendlyName(type: string) {
    switch (type) {
      case "SLA_BREACH": return "SLA Response Breach";
      case "QUEUE_OVERLOAD": return "Workers Queue Overload";
      case "WORKFLOW_FAILURE": return "RICR Workflow Job Failure";
      case "BOUNCE_SPIKE": return "Outbound Bounce Rate Spike";
      case "INBOX_ISSUE": return "Inbox Deliverability Drop";
      case "AI_FAILURE": return "AI Invocation Provider Failure";
      default: return type.replace("_", " ");
    }
  }

  function getFriendlyDesc(type: string) {
    switch (type) {
      case "SLA_BREACH": return "Fires when a pending manual review item exceeds the configured response SLA deadline (hours).";
      case "QUEUE_OVERLOAD": return "Fires when any BullMQ queue active depth surpasses the threshold quantity.";
      case "WORKFLOW_FAILURE": return "Fires when a workers background job is abandoned and discarded after all active retries.";
      case "BOUNCE_SPIKE": return "Fires when domain bounce rates climb past the configured limit ratio.";
      case "INBOX_ISSUE": return "Fires when an individual warmups inbox health score falls below the delivery threshold.";
      case "AI_FAILURE": return "Fires when Claude-3 provider invocation failure rates exceed the percent threshold.";
      default: return "";
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
          <p className="text-destructive font-medium">Failed to load alert rules configurations</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-20">
      
      {/* Header title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Alert Rules Configurations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Set severity bounds, delivery destinations, and trigger limits for automated operations monitoring.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Reload
        </Button>
      </div>

      {/* Info warning */}
      <div className="p-3.5 bg-primary/[0.03] border border-primary/20 rounded-lg text-xs text-primary flex gap-2.5 items-start">
        <Info className="h-4.5 w-4.5 shrink-0 mt-0.5" />
        <p className="font-medium leading-relaxed">
          Alert configurations control real-time monitors. Enabled rules evaluate incoming logs and dispatch alerts directly to dashboard feeds, Slack channels, and emails.
        </p>
      </div>

      {/* Alert Rules List */}
      <div className="space-y-4">
        {rules.map((rule) => {
          const hasThreshold = rule.threshold !== null;
          
          return (
            <Card key={rule.rule_type} className={cn("transition-all", !rule.enabled && "opacity-75")}>
              <CardContent className="pt-5 pb-5 space-y-4">
                
                {/* Line 1: Header + Active toggle */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{getFriendlyName(rule.rule_type)}</span>
                      <Badge className="font-mono text-[9px] uppercase px-1 py-0">{rule.rule_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{getFriendlyDesc(rule.rule_type)}</p>
                  </div>
                  
                  {/* Slider Toggle */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold text-muted-foreground">Fires Alert</span>
                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(rule.rule_type)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden",
                        rule.enabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200",
                          rule.enabled ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Line 2: Configurations form inside active card */}
                {rule.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/60">
                    
                    {/* Severity Option */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Alert Severity</span>
                      <select
                        value={rule.severity}
                        onChange={(e) => handleSeverityChange(rule.rule_type, e.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
                      >
                        <option value="critical">Critical (Red Flag)</option>
                        <option value="warning">Warning (Amber Alert)</option>
                        <option value="info">Info Badge</option>
                      </select>
                    </div>

                    {/* Threshold Option */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        {rule.rule_type === "SLA_BREACH" && "SLA Deadline (Hours)"}
                        {rule.rule_type === "QUEUE_OVERLOAD" && "Active Queue Depth Limit"}
                        {rule.rule_type === "BOUNCE_SPIKE" && "Bounce Rate Ceiling (%)"}
                        {rule.rule_type === "INBOX_ISSUE" && "Deliverability Floor (%)"}
                        {rule.rule_type === "AI_FAILURE" && "Provider Failure Rate (%)"}
                        {!hasThreshold && "Trigger Condition"}
                      </span>
                      {hasThreshold ? (
                        <input
                          type="number"
                          step={rule.rule_type === "BOUNCE_SPIKE" || rule.rule_type === "AI_FAILURE" ? "0.1" : "1"}
                          value={rule.threshold ?? ""}
                          onChange={(e) => handleThresholdChange(rule.rule_type, e.target.value)}
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary font-mono"
                          placeholder="Set threshold value..."
                        />
                      ) : (
                        <input
                          type="text"
                          disabled
                          value="Auto-detects failure logs"
                          className="h-8 w-full rounded-lg border border-muted bg-muted/40 px-2.5 text-xs text-muted-foreground font-medium"
                        />
                      )}
                    </div>

                    {/* Routing destinations */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Notification Destinations</span>
                      <div className="flex gap-4 pt-1">
                        
                        {/* Slack destination */}
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.destinations.includes("slack")}
                            onChange={() => handleDestinationToggle(rule.rule_type, "slack")}
                            className="rounded-sm border-input h-3.5 w-3.5 text-primary focus:ring-1 focus:ring-primary"
                          />
                          Slack Channel
                        </label>

                        {/* Email destination */}
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.destinations.includes("email")}
                            onChange={() => handleDestinationToggle(rule.rule_type, "email")}
                            className="rounded-sm border-input h-3.5 w-3.5 text-primary focus:ring-1 focus:ring-primary"
                          />
                          Email Digest
                        </label>

                        {/* Dashboard toast destination */}
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.destinations.includes("toast")}
                            onChange={() => handleDestinationToggle(rule.rule_type, "toast")}
                            className="rounded-sm border-input h-3.5 w-3.5 text-primary focus:ring-1 focus:ring-primary"
                          />
                          UI Toast
                        </label>

                      </div>
                    </div>

                  </div>
                )}

              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Save bar floating footer */}
      <div className="flex justify-end pt-4 border-t border-border mt-6">
        <Button
          className="bg-primary hover:bg-primary/90 text-white font-bold"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? <Spinner className="h-4 w-4 mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
          Save Configuration
        </Button>
      </div>

    </div>
  );
}
