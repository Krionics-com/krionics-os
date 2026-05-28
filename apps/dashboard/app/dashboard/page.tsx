"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetchJson } from "@/lib/http";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorState } from "@/components/error-state";
import { KpiCard } from "@/components/kpi-card";
import { ActivityFeed } from "@/components/activity-feed";
import { SystemHealth } from "@/components/system-health";
import {
  Inbox,
  CheckCircle2,
  XOctagon,
  Send,
  TrendingUp,
  Zap,
  Activity,
  DollarSign,
  AlertCircle,
  Clock,
  History,
  AlertTriangle,
  ChevronRight,
  Users,
} from "lucide-react";

type DashboardStats = {
  pending: number;
  approved: number;
  suppressed: number;
  sent: number;
  positive: number;
  active_campaigns: number;
  queue_health: number;
  ai_cost: number;
  failure_rate: number;
  avg_sla_remaining: number;
  overdue_reviews: number;
  onboarding_count: number;
};

const fetcher = (url: string) => fetchJson<DashboardStats>(url);

function formatSla(hours: number) {
  if (hours < 0) return "Overdue";
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h}h ${m}m`;
}

type AttentionItem = {
  label: string;
  detail: string;
  href: string;
  severity: "critical" | "warning" | "info";
};

function buildAttentionItems(data: DashboardStats): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (data.overdue_reviews > 0) {
    items.push({
      label: `${data.overdue_reviews} overdue review${data.overdue_reviews !== 1 ? "s" : ""}`,
      detail: "SLA has expired — these replies need immediate attention",
      href: "/dashboard/review",
      severity: "critical",
    });
  }

  if (data.positive > 0) {
    items.push({
      label: `${data.positive} positive intent${data.positive !== 1 ? "s" : ""} awaiting review`,
      detail: "High-value prospects are waiting — don't let them go cold",
      href: "/dashboard/review",
      severity: "warning",
    });
  }

  if (data.failure_rate > 5) {
    items.push({
      label: `Queue failure rate at ${data.failure_rate.toFixed(1)}%`,
      detail: "More than 5% of jobs are failing — check the DLQ",
      href: "/dashboard/dlq",
      severity: "critical",
    });
  }

  if (data.onboarding_count > 0) {
    items.push({
      label: `${data.onboarding_count} client${data.onboarding_count !== 1 ? "s" : ""} in onboarding`,
      detail: "Review onboarding progress and complete pending setup steps",
      href: "/dashboard/onboarding",
      severity: "info",
    });
  }

  return items;
}

const SEVERITY_STYLES = {
  critical: {
    border: "border-rose-500/40 bg-rose-500/5",
    icon: "text-rose-500",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
  warning: {
    border: "border-amber-500/40 bg-amber-500/5",
    icon: "text-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  info: {
    border: "border-blue-500/30 bg-blue-500/5",
    icon: "text-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
};

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/stats",
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  const attentionItems = data ? buildAttentionItems(data) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* System Health Bar */}
      <SystemHealth />

      {isLoading && !data && (
        <div className="flex items-center justify-center min-h-[300px]">
          <LoadingSpinner label="Loading…" />
        </div>
      )}

      {error && (
        <ErrorState message="Failed to load dashboard metrics." onRetry={() => mutate()} />
      )}

      {data && (
        <>
          {/* Attention Required */}
          {attentionItems.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Requires Attention
              </h2>
              {attentionItems.map((item) => {
                const styles = SEVERITY_STYLES[item.severity];
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-opacity hover:opacity-90 ${styles.border}`}
                  >
                    <AlertCircle className={`h-5 w-5 flex-shrink-0 ${styles.icon}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* KPI Cards */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Today's Operations
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Pending Review"
                subtitle="Awaiting approval"
                value={data.pending}
                icon={<Inbox className="h-5 w-5" />}
                color="primary"
                link={{ text: "Go to queue", href: "/dashboard/review" }}
              />
              <KpiCard
                title="Approved Today"
                subtitle="Sent to queue"
                value={data.approved}
                icon={<CheckCircle2 className="h-5 w-5" />}
                color="green"
              />
              <KpiCard
                title="Suppressed"
                subtitle="Auto-removed today"
                value={data.suppressed}
                icon={<XOctagon className="h-5 w-5" />}
                color="orange"
              />
              <KpiCard
                title="Sent Today"
                subtitle="Successfully delivered"
                value={data.sent}
                icon={<Send className="h-5 w-5" />}
                color="blue"
              />
              <KpiCard
                title="Positive Replies"
                subtitle="High-intent, pending"
                value={data.positive}
                icon={<TrendingUp className="h-5 w-5" />}
                color="green"
              />
            </div>
          </div>

          {/* System + Revenue KPIs */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              System Health
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Active Campaigns"
                subtitle="Running now"
                value={data.active_campaigns}
                icon={<Zap className="h-5 w-5" />}
                color="primary"
              />
              <KpiCard
                title="Queue Depth"
                subtitle="Waiting jobs"
                value={data.queue_health}
                icon={<Activity className="h-5 w-5" />}
                color={data.queue_health > 100 ? "red" : data.queue_health > 50 ? "yellow" : "green"}
              />
              <KpiCard
                title="AI Cost Today"
                subtitle="Claude API spend"
                value={`$${data.ai_cost.toFixed(2)}`}
                icon={<DollarSign className="h-5 w-5" />}
                color="primary"
              />
              <KpiCard
                title="Failure Rate"
                subtitle="Failed queue jobs"
                value={`${data.failure_rate.toFixed(1)}%`}
                icon={<AlertCircle className="h-5 w-5" />}
                color={data.failure_rate > 5 ? "red" : data.failure_rate > 1 ? "yellow" : "green"}
              />
              <KpiCard
                title="Avg SLA Left"
                subtitle="Median time remaining"
                value={formatSla(data.avg_sla_remaining)}
                icon={<Clock className="h-5 w-5" />}
                color={data.avg_sla_remaining < 0 ? "red" : data.avg_sla_remaining < 1 ? "yellow" : "green"}
              />
            </div>
          </div>

          {/* Onboarding clients pill if any */}
          {data.onboarding_count > 0 && (
            <Link
              href="/dashboard/onboarding"
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 hover:bg-muted/30 transition-colors"
            >
              <Users className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <span className="text-sm font-medium">{data.onboarding_count} client{data.onboarding_count !== 1 ? "s" : ""} in onboarding</span>
                <span className="ml-2 text-xs text-muted-foreground">— review setup progress</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}
        </>
      )}

      {/* Activity Feed */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-heading font-bold mb-4 flex items-center gap-2 text-foreground">
          <History className="h-5 w-5 text-primary" /> Recent Activity
        </h2>
        <ActivityFeed />
      </div>
    </div>
  );
}
