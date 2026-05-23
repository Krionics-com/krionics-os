"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Sliders, RefreshCw, Save, Lock, Sparkles, AlertCircle,
  Key, ShieldCheck, Mail, HelpCircle, Eye, EyeOff, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function GlobalConfigPage() {
  const { data: user, isLoading: isUserLoading } = useSWR("/api/auth/me", fetcher);
  const { data, error, isLoading, mutate } = useSWR("/api/dashboard/settings/config", fetcher, {
    refreshInterval: 30000,
  });

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Section State Toggles
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields State
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [model, setModel] = useState("claude-3-5-sonnet");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);

  const [maxRetries, setMaxRetries] = useState(3);
  const [backoffStrategy, setBackoffStrategy] = useState("exponential");
  const [initialBackoff, setInitialBackoff] = useState(1);

  const [depthWarningThreshold, setDepthWarningThreshold] = useState(100);
  const [maxActiveJobs, setMaxActiveJobs] = useState(50);
  const [failedDiscardAfter, setFailedDiscardAfter] = useState(5);

  const [reviewSlaHours, setReviewSlaHours] = useState(4);
  const [escalationThresholdMinutes, setEscalationThresholdMinutes] = useState(30);

  const [maxEmailsPerInboxDay, setMaxEmailsPerInboxDay] = useState(500);
  const [maxEmailsPerDomainDay, setMaxEmailsPerDomainDay] = useState(5000);
  const [concurrentSendingJobs, setConcurrentSendingJobs] = useState(10);

  // Hydrate fields when API data resolves
  useEffect(() => {
    if (data?.config) {
      const c = data.config;
      if (c.api_provider) {
        setAnthropicApiKey(c.api_provider.anthropic_api_key || "");
        setModel(c.api_provider.model || "claude-3-5-sonnet");
        setTemperature(c.api_provider.temperature ?? 0.7);
        setMaxTokens(c.api_provider.max_tokens ?? 1000);
      }
      if (c.retry_policy) {
        setMaxRetries(c.retry_policy.max_retries ?? 3);
        setBackoffStrategy(c.retry_policy.backoff_strategy || "exponential");
        setInitialBackoff(c.retry_policy.initial_backoff_seconds ?? 1);
      }
      if (c.queue_limits) {
        setDepthWarningThreshold(c.queue_limits.depth_warning_threshold ?? 100);
        setMaxActiveJobs(c.queue_limits.max_active_jobs ?? 50);
        setFailedDiscardAfter(c.queue_limits.failed_discard_after ?? 5);
      }
      if (c.global_sla) {
        setReviewSlaHours(c.global_sla.review_sla_hours ?? 4);
        setEscalationThresholdMinutes(c.global_sla.escalation_threshold_minutes ?? 30);
      }
      if (c.sending_limits) {
        setMaxEmailsPerInboxDay(c.sending_limits.max_emails_per_inbox_day ?? 500);
        setMaxEmailsPerDomainDay(c.sending_limits.max_emails_per_domain_day ?? 5000);
        setConcurrentSendingJobs(c.sending_limits.concurrent_sending_jobs ?? 10);
      }
    }
  }, [data]);

  // Handle Save Configurations Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      config: {
        api_provider: {
          anthropic_api_key: anthropicApiKey,
          model,
          temperature: parseFloat(temperature.toString()),
          max_tokens: parseInt(maxTokens.toString(), 10),
        },
        retry_policy: {
          max_retries: parseInt(maxRetries.toString(), 10),
          backoff_strategy: backoffStrategy,
          initial_backoff_seconds: parseFloat(initialBackoff.toString()),
        },
        queue_limits: {
          depth_warning_threshold: parseInt(depthWarningThreshold.toString(), 10),
          max_active_jobs: parseInt(maxActiveJobs.toString(), 10),
          failed_discard_after: parseInt(failedDiscardAfter.toString(), 10),
        },
        global_sla: {
          review_sla_hours: parseInt(reviewSlaHours.toString(), 10),
          escalation_threshold_minutes: parseInt(escalationThresholdMinutes.toString(), 10),
        },
        sending_limits: {
          max_emails_per_inbox_day: parseInt(maxEmailsPerInboxDay.toString(), 10),
          max_emails_per_domain_day: parseInt(maxEmailsPerDomainDay.toString(), 10),
          concurrent_sending_jobs: parseInt(concurrentSendingJobs.toString(), 10),
        },
      },
    };

    try {
      const response = await fetch("/api/dashboard/settings/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save global configurations properties");
      }

      toast.success("Global configurations saved successfully!");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Error saving global settings");
    } finally {
      setIsSaving(false);
    }
  }

  if (isUserLoading || (isLoading && !data)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // 403 Forbidden Gate screen
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[460px] p-6">
        <Card className="max-w-md w-full border-destructive/20 bg-destructive/[0.01] backdrop-blur shadow-2xl relative overflow-hidden select-none">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-destructive"></div>
          <CardContent className="p-8 text-center space-y-6">
            <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-heading text-foreground">Access Restricted (403)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Global settings configuration dashboards are only accessible to administrators or super admin operators. Contact your workspace manager to elevate permissions.
              </p>
            </div>
            <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/5 font-mono text-[10px]">
              ROLE_REQUIRED: ADMIN_OR_SUPER
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sliders className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Global System Configurations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage API keys, LLM variables models parameters, task queue depths, worker SLA thresholds, and email throttles.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" size="sm" className="h-9" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: API Provider & Retry Policies */}
        <div className="space-y-6">
          
          {/* Section 1: API Settings */}
          <Card>
            <CardHeader className="py-4 border-b border-border/40">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Key className="h-4 w-4 text-primary" /> 1. API Provider Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              {/* Anthropic Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
                  <span>Anthropic API Key</span>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-primary hover:underline text-[10px] uppercase font-bold flex items-center gap-0.5"
                  >
                    {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showKey ? "Mask" : "Reveal"}</span>
                  </button>
                </label>
                <input
                  type={showKey ? "text" : "password"}
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  required
                  placeholder="sk-ant-..."
                  className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase block">RICR LLM Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Recommended)</option>
                  <option value="claude-opus">Claude 3.0 Opus (Max Quality)</option>
                  <option value="claude-haiku">Claude 3.0 Haiku (Max Speed)</option>
                </select>
              </div>

              {/* Grid model options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Temp */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
                    <span>LLM Temperature</span>
                    <span className="font-mono font-bold text-primary">{temperature}</span>
                  </label>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Max Tokens */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Max Output Tokens</label>
                  <input
                    type="number"
                    min="1"
                    max="4096"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                    className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>

              </div>

            </CardContent>
          </Card>

          {/* Section 2: Retry Policies */}
          <Card>
            <CardHeader className="py-4 border-b border-border/40">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> 2. Retry Policies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Max Retries */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Max Job Retries</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(parseInt(e.target.value, 10))}
                    className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Backoff Strategy */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Backoff Strategy</label>
                  <select
                    value={backoffStrategy}
                    onChange={(e) => setBackoffStrategy(e.target.value)}
                    className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="linear">Linear Backoff</option>
                    <option value="exponential">Exponential Backoff</option>
                  </select>
                </div>

              </div>

              {/* Initial Backoff */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase block">Initial Backoff Seconds</label>
                <input
                  type="number"
                  min="0.1"
                  max="60"
                  step="0.1"
                  value={initialBackoff}
                  onChange={(e) => setInitialBackoff(parseFloat(e.target.value))}
                  className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                />
              </div>

            </CardContent>
          </Card>

        </div>

        {/* Right Column: Queue limits, SLAs, Daily Limits */}
        <div className="space-y-6">
          
          {/* Section 3: Queue Limits */}
          <Card>
            <CardHeader className="py-4 border-b border-border/40">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-primary" /> 3. Queue Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Warning Threshold */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Depth Warning Limit</label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={depthWarningThreshold}
                    onChange={(e) => setDepthWarningThreshold(parseInt(e.target.value, 10))}
                    className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Max Active Jobs */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Max Active Jobs</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={maxActiveJobs}
                    onChange={(e) => setMaxActiveJobs(parseInt(e.target.value, 10))}
                    className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>

              </div>

              {/* Auto Discard retries */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase block">Failed Job Auto-Discard Limit</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={failedDiscardAfter}
                  onChange={(e) => setFailedDiscardAfter(parseInt(e.target.value, 10))}
                  className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                />
              </div>

            </CardContent>
          </Card>

          {/* Section 4: Global SLAs */}
          <Card>
            <CardHeader className="py-4 border-b border-border/40">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" /> 4. Global SLA Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Default reviews SLA */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Default Review SLA (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={reviewSlaHours}
                    onChange={(e) => setReviewSlaHours(parseInt(e.target.value, 10))}
                    className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Escalation Threshold */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Escalation Alarm (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={escalationThresholdMinutes}
                    onChange={(e) => setEscalationThresholdMinutes(parseInt(e.target.value, 10))}
                    className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>

              </div>

            </CardContent>
          </Card>

          {/* Section 5: Email sending throttles */}
          <Card>
            <CardHeader className="py-4 border-b border-border/40">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-primary" /> 5. Email Sending Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Inbox Daily throttle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Max Emails / Inbox / Day</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    value={maxEmailsPerInboxDay}
                    onChange={(e) => setMaxEmailsPerInboxDay(parseInt(e.target.value, 10))}
                    className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Domain daily throttle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase block">Max Emails / Domain / Day</label>
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    value={maxEmailsPerDomainDay}
                    onChange={(e) => setMaxEmailsPerDomainDay(parseInt(e.target.value, 10))}
                    className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>

              </div>

              {/* Concurrent sender jobs */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase block">Concurrent Sending Threads</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={concurrentSendingJobs}
                  onChange={(e) => setConcurrentSendingJobs(parseInt(e.target.value, 10))}
                  className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs font-mono focus:ring-1 focus:ring-primary"
                />
              </div>

            </CardContent>
          </Card>

        </div>

        {/* Global Save Form Button */}
        <div className="lg:col-span-2 flex justify-end pt-4">
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-[240px] font-bold h-11 flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
            disabled={isSaving}
          >
            {isSaving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            <span>Save Global Configurations</span>
          </Button>
        </div>

      </form>

    </div>
  );
}
