"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users, RefreshCw, BarChart2, Zap, Activity, Clock, ShieldCheck,
  TrendingUp, Award, CheckCircle2, AlertTriangle, ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OperationsAnalyticsPage() {
  const pathname = usePathname();
  const [dateRange, setDateRange] = useState("30"); // 7, 30, 90 days

  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/analytics/operations?dateFrom=${dateRange}`,
    fetcher,
    { refreshInterval: 30000 } // 30s polling
  );

  const metrics = data?.metrics;
  const operators = data?.operators || [];

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

  if (error || !metrics) {
    return (
      <Card className="mx-auto max-w-xl mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Failed to load operations performance metrics</p>
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
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="h-8.5 rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
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

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* KPI 1: Productivity */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-5 pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Operator Productivity</span>
              <p className="text-2xl font-extrabold text-foreground font-mono">{metrics.operator_productivity}</p>
              <span className="text-[10px] text-emerald-600 font-semibold block flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> +4.2% daily average
              </span>
            </div>
            <div className="p-2.5 bg-primary/[0.05] rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Turnaround */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-5 pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Approval Turnaround</span>
              <p className="text-2xl font-extrabold text-foreground font-mono">{metrics.approval_turnaround_time}h</p>
              <span className="text-[10px] text-emerald-600 font-semibold block flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> -12m median hours
              </span>
            </div>
            <div className="p-2.5 bg-primary/[0.05] rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: SLA Adherence */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-5 pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">SLA Adherence Rate</span>
              <p className="text-2xl font-extrabold text-foreground font-mono">{metrics.sla_adherence}%</p>
              <span className="text-[10px] text-emerald-600 font-semibold block flex items-center gap-0.5">
                <CheckCircle2 className="h-3 w-3" /> 100% within SLA
              </span>
            </div>
            <div className="p-2.5 bg-primary/[0.05] rounded-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Workflow Success */}
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="pt-5 pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Workflow Success Rate</span>
              <p className="text-2xl font-extrabold text-foreground font-mono">{metrics.workflow_success_rate}%</p>
              <span className="text-[10px] text-slate-500 font-semibold block">
                BullMQ first-try logs
              </span>
            </div>
            <div className="p-2.5 bg-primary/[0.05] rounded-lg">
              <Activity className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Operators list table */}
      <Card>
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Award className="h-4.5 w-4.5 text-primary" />
            Operator Productivity Leaderboard
          </CardTitle>
          <CardDescription className="text-xs">Individual review quantities, median speeds, SLA records, and draft edits ratios.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operator Name</TableHead>
                  <TableHead className="text-right">Items Approved (This Month)</TableHead>
                  <TableHead className="text-right">Avg Turnaround Time</TableHead>
                  <TableHead className="text-right">SLA Adherence</TableHead>
                  <TableHead className="text-right">Accuracy (Approved No Edits)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((op: any) => (
                  <TableRow key={op.email} className="hover:bg-muted/10">
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex flex-col">
                        <span>{op.name}</span>
                        <span className="text-[10px] font-normal text-muted-foreground">{op.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-foreground font-bold">{op.items_approved.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{op.avg_turnaround}h</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${op.sla_adherence > 95 ? "text-emerald-600" : "text-amber-500"}`}>{op.sla_adherence}%</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${op.accuracy > 95 ? "text-emerald-600" : "text-amber-500"}`}>{op.accuracy}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
