"use client";

import React from "react";
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
  History
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
};

const fetcher = (url: string) => fetchJson<DashboardStats>(url);

function formatSla(hours: number) {
  if (hours < 0) return "Overdue";
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h}h ${m}m`;
}

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/stats",
    fetcher,
    {
      refreshInterval: 10000, // 10s refresh interval
      revalidateOnFocus: true
    }
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. System Health Bar */}
      <SystemHealth />

      {isLoading && !data && (
        <div className="flex items-center justify-center min-h-[300px]">
          <LoadingSpinner label="Loading KPIs..." />
        </div>
      )}

      {error && (
        <ErrorState 
          message="Failed to load dashboard metrics." 
          onRetry={() => mutate()} 
        />
      )}

      {/* 2. KPI Cards Grid */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            title="Suppressed Today"
            subtitle="Auto-removed"
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
            subtitle="High-intent prospects"
            value={data.positive}
            icon={<TrendingUp className="h-5 w-5" />}
            color="green"
          />
          <KpiCard
            title="Active Campaigns"
            subtitle="Running now"
            value={data.active_campaigns}
            icon={<Zap className="h-5 w-5" />}
            color="primary"
          />
          <KpiCard
            title="Queue Health"
            subtitle="All queues combined"
            value={data.queue_health}
            icon={<Activity className="h-5 w-5" />}
            color={data.queue_health > 100 ? 'red' : data.queue_health > 50 ? 'yellow' : 'green'}
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
            color={data.failure_rate > 5 ? 'red' : data.failure_rate > 1 ? 'yellow' : 'green'}
          />
          <KpiCard
            title="Avg SLA Remaining"
            subtitle="Median time left"
            value={formatSla(data.avg_sla_remaining)}
            icon={<Clock className="h-5 w-5" />}
            color={data.avg_sla_remaining < 0 ? 'red' : data.avg_sla_remaining < 1 ? 'yellow' : 'green'}
          />
        </div>
      )}

      {/* 3. Activity Feed */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-heading font-bold mb-4 flex items-center gap-2 text-foreground">
          <History className="h-5 w-5 text-primary" /> Recent Activity
        </h2>
        <ActivityFeed />
      </div>
    </div>
  );
}
