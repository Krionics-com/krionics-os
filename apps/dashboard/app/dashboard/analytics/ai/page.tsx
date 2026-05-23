"use client";

import useSWR from "swr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles, RefreshCw, BarChart2, ShieldCheck, CheckCircle2,
  AlertTriangle, Eye, Sliders, Cpu, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AiAnalyticsPage() {
  const pathname = usePathname();

  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/analytics/ai",
    fetcher,
    { refreshInterval: 30000 }
  );

  const qualityData = data?.quality || [];

  const tabs = [
    { name: "Operator Operations", href: "/dashboard/analytics/operations" },
    { name: "Campaign Trends", href: "/dashboard/analytics/campaigns" },
    { name: "AI Quality Metrics", href: "/dashboard/analytics/ai" },
  ];

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
          <p className="text-destructive font-medium">Failed to load AI Quality Metrics</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Analytics & Performance Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Audit team productivity ratios, SLA validations, outreach campaigns, and AI draft accuracies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Poll SWR
          </Button>
        </div>
      </div>

      {/* Tab Navigation header */}
      <div className="flex border-b border-border gap-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link key={tab.href} href={tab.href}>
              <span className={cn(
                "inline-block px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all duration-150",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>

      {/* 4 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: AI Approval Rate (no edits) */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> AI Approval Rate (No Edits)</span>
              <span className="text-xs text-muted-foreground font-mono">7-Day Walk</span>
            </CardTitle>
            <CardDescription className="text-xs">Ratios of outbound drafts approved immediately by operators without custom modifications.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qualityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(value) => [`${value}%`, "Approval Rate"]} />
                <Line type="monotone" dataKey="approval_rate" stroke="#C4521C" strokeWidth={2} dot={true} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 2: Edit Percentage */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Sliders className="h-4 w-4 text-amber-500" /> Operator Edit Percentage</span>
              <span className="text-xs text-muted-foreground font-mono">7-Day Walk</span>
            </CardTitle>
            <CardDescription className="text-xs">Outbound responses that required operator keyboard modifications before scheduling.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qualityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 30]} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(value) => [`${value}%`, "Edit %"]} />
                <Line type="monotone" dataKey="edit_percentage" stroke="#3b82f6" strokeWidth={2} dot={true} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 3: Regenerate Frequency */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-blue-500" /> Draft Regenerations Frequency</span>
              <span className="text-xs text-muted-foreground font-mono">7-Day Walk</span>
            </CardTitle>
            <CardDescription className="text-xs">Outbound draft lines discarded and regenerated entirely via Claude prompts test runs.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qualityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 15]} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(value) => [`${value}%`, "Regeneration %"]} />
                <Line type="monotone" dataKey="regenerate_frequency" stroke="#8b5cf6" strokeWidth={2} dot={true} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 4: Hallucination Rate */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-rose-500" /> Hallucination / Tone Violation Block Rate</span>
              <span className="text-xs text-muted-foreground font-mono">7-Day Walk</span>
            </CardTitle>
            <CardDescription className="text-xs">Draft copies automatically blocked by exclusions, length, or semantic validation tests.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qualityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(value) => [`${value}%`, "Blocked %"]} />
                <Line type="monotone" dataKey="hallucination_rate" stroke="#ef4444" strokeWidth={2} dot={true} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
