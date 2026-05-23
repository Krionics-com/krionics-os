"use client";

import useSWR from "swr";
import {
  BarChart2, RefreshCw, Coins, Zap, ShieldAlert, Cpu, Timer, RefreshCcw, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, Legend, CartesianGrid
} from "recharts";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AIAnalyticsPage() {
  // SWR fetches with 60s auto-refresh polling interval
  const { data, error, isLoading, mutate } = useSWR(
    "/api/dashboard/ai/analytics",
    fetcher,
    { refreshInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="mx-auto max-w-xl mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Failed to load AI Analytics data</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Latency percentiles array for BarChart
  const latencyPercentilesData = [
    { name: "p50 (Median)", value: data.latency_percentiles?.p50 || 0, fill: "#3B82F6" },
    { name: "p75 (High)", value: data.latency_percentiles?.p75 || 0, fill: "#C4521C" },
    { name: "p95 (Outlier)", value: data.latency_percentiles?.p95 || 0, fill: "#EF4444" },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">AI Performance & Cost Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live operational metrics for Claude LLM prompts execution, cost aggregations, and token volumes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">Auto-refresh: 60s</span>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        
        {/* Card 1: Daily Cost */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex justify-between items-start text-muted-foreground">
              <span className="text-[10px] uppercase font-bold tracking-wider">AI Cost Today</span>
              <Coins className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xl font-extrabold mt-2 text-foreground font-mono">
              ${(data.daily_cost || 0).toFixed(4)}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Tokens Consumed */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex justify-between items-start text-muted-foreground">
              <span className="text-[10px] uppercase font-bold tracking-wider">Tokens Consumed</span>
              <Cpu className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-extrabold mt-2 text-foreground font-mono">
              {(data.daily_tokens || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Cache Hit Rate */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex justify-between items-start text-muted-foreground">
              <span className="text-[10px] uppercase font-bold tracking-wider">Cache Hit Rate</span>
              <Zap className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xl font-extrabold mt-2 text-emerald-600 font-mono">
              {data.cache_hit_rate}%
            </p>
            <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-0.5">
              <Info className="h-2.5 w-2.5" /> TODO: Add redis cache layer
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Failures Today */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex justify-between items-start text-muted-foreground">
              <span className="text-[10px] uppercase font-bold tracking-wider">Failures Today</span>
              <ShieldAlert className="h-4 w-4 text-rose-500" />
            </div>
            <p className={`text-xl font-extrabold mt-2 font-mono ${data.daily_failures > 0 ? "text-rose-500" : "text-foreground"}`}>
              {data.daily_failures || 0}
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Avg Latency */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex justify-between items-start text-muted-foreground">
              <span className="text-[10px] uppercase font-bold tracking-wider">Avg Latency</span>
              <Timer className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-extrabold mt-2 text-foreground font-mono">
              {data.avg_latency || 0}ms
            </p>
          </CardContent>
        </Card>

        {/* Card 6: Regenerations Frequency */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex justify-between items-start text-muted-foreground">
              <span className="text-[10px] uppercase font-bold tracking-wider">Regen Ratio (7d)</span>
              <RefreshCcw className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-xl font-extrabold mt-2 text-foreground font-mono">
              {data.regenerate_frequency || 0}%
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Split Charts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Cost Trend AreaChart */}
        <Card className="lg:col-span-2 shadow-sm border">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold">7-Day LLM Spending Trend</CardTitle>
            <CardDescription className="text-xs">Aggregated cost in USD generated across all environments.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.cost_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]} />
                <Area type="monotone" dataKey="cost" stroke="#C4521C" fill="#C4521C" fillOpacity={0.06} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 2: Latency percentiles BarChart */}
        <Card className="shadow-sm border">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold">API Latency Percentiles (7d)</CardTitle>
            <CardDescription className="text-xs">Response speeds in milliseconds across outlier grades.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latencyPercentilesData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value}ms`, "Latency"]} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {latencyPercentilesData.map((entry, index) => (
                    <Bar key={`bar-${index}`} dataKey="value" fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 3: Token Usage BarChart */}
        <Card className="lg:col-span-3 shadow-sm border">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold">7-Day Token Ingestion & Output Volume</CardTitle>
            <CardDescription className="text-xs">Daily split between input prompt tokens and generated output completions.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.token_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Tokens"]} />
                <Legend />
                <Bar dataKey="input" name="Input Tokens" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="output" name="Output Completion Tokens" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
