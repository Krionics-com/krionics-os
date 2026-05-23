"use client";

import React from "react";
import useSWR from "swr";
import Link from "next/link";
import { fetchJson } from "@/lib/http";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorState } from "@/components/error-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Inbox, 
  CheckCircle2, 
  XOctagon, 
  SendHorizontal, 
  ArrowRight,
  TrendingUp,
  Activity
} from "lucide-react";

type DashboardStats = {
  pending: number;
  approved: number;
  suppressed: number;
  sent: number;
};

const fetcher = (url: string) => fetchJson<DashboardStats>(url);

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/stats",
    fetcher,
    {
      refreshInterval: 10000, // 10s refresh interval
      revalidateOnFocus: true
    }
  );

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner label="Loading dashboard metrics..." />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState 
        message="Failed to load dashboard metrics overview." 
        onRetry={() => mutate()} 
      />
    );
  }

  const statCards = [
    { 
      label: "Pending Review", 
      value: data?.pending ?? 0, 
      color: "text-amber-600 bg-amber-50 border-amber-200", 
      icon: Inbox,
      description: "Replies awaiting operator review" 
    },
    { 
      label: "Approved Today", 
      value: data?.approved ?? 0, 
      color: "text-green-600 bg-green-50 border-green-200", 
      icon: CheckCircle2,
      description: "Approved for sequence response"
    },
    { 
      label: "Suppressed Today", 
      value: data?.suppressed ?? 0, 
      color: "text-red-600 bg-red-50 border-red-200", 
      icon: XOctagon,
      description: "Replies automatically dismissed"
    },
    { 
      label: "Sent Today", 
      value: data?.sent ?? 0, 
      color: "text-blue-600 bg-blue-50 border-blue-200", 
      icon: SendHorizontal,
      description: "Delivered auto-response replies"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card rounded-2xl border border-border p-6 shadow-xs">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-foreground font-heading">
            Dashboard Overview
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            Live operators stats monitoring (updates every 10s)
          </p>
        </div>
        <Link href="/dashboard/review">
          <span className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#a64214] transition-all hover:translate-x-1 cursor-pointer">
            Go to Review Queue <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card 
              key={card.label} 
              className="hover:shadow-md transition-shadow duration-300 border border-border bg-card overflow-hidden"
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block">
                    {card.label}
                  </span>
                  <div className={`p-2.5 rounded-lg border ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold text-foreground font-heading tracking-tight">
                    {card.value}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Guide */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground font-heading flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Getting Started with Phase 2
        </h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div className="space-y-2 border-r border-border pr-4 last:border-0 last:pr-0">
            <span className="font-bold text-primary block">1. Review Queue</span>
            <p className="text-muted-foreground leading-relaxed">
              Navigate to the review queue to see pending items flagged with POSITIVE intent or commercial inquiries.
            </p>
          </div>
          <div className="space-y-2 border-r border-border pr-4 last:border-0 last:pr-0">
            <span className="font-bold text-primary block">2. Compare & Edit</span>
            <p className="text-muted-foreground leading-relaxed">
              Use the three-panel interface on desktop to inspect full conversation history, verify Claude's classification, and polish response drafts.
            </p>
          </div>
          <div className="space-y-2 last:border-0 last:pr-0">
            <span className="font-bold text-primary block">3. One-Click Approval</span>
            <p className="text-muted-foreground leading-relaxed">
              Accept drafts immediately or edit them inline. They transition to APPROVED and are queued for delivery!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
