"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp, RefreshCw, BarChart2, DollarSign, Percent, Mail,
  ChevronDown, HelpCircle, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area
} from "recharts";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CampaignAnalyticsPage() {
  const pathname = usePathname();
  const [dateRange, setDateRange] = useState("30");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [activeMetricTab, setActiveMetricTab] = useState("reply_rate"); // reply_rate, positive_rate, meeting_rate, bounce_rate, cost_per_meeting

  // Fetch directory values
  const { data: clientsData } = useSWR("/api/dashboard/clients", fetcher);
  const { data: campaignsData } = useSWR("/api/dashboard/campaigns", fetcher);

  // Fetch Trend Analytics
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/analytics/campaigns?dateFrom=${dateRange}&clientId=${selectedClient}&campaignId=${selectedCampaign}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const trends = data?.trends || [];

  const tabs = [
    { name: "Operator Operations", href: "/dashboard/analytics/operations" },
    { name: "Campaign Trends", href: "/dashboard/analytics/campaigns" },
    { name: "AI Quality Metrics", href: "/dashboard/analytics/ai" },
  ];

  const metricTabs = [
    { key: "reply_rate", label: "Reply Rate %", color: "#C4521C", symbol: "%" },
    { key: "positive_rate", label: "Positive Intent Rate %", color: "#C4521C", symbol: "%" },
    { key: "meeting_rate", label: "Meeting Booked Rate %", color: "#10b981", symbol: "%" },
    { key: "bounce_rate", label: "Bounce Rate %", color: "#ef4444", symbol: "%" },
    { key: "cost_per_meeting", label: "Cost Per Meeting", color: "#C4521C", symbol: "$" }
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
          <p className="text-destructive font-medium">Failed to load campaign trend analytics</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeTabConfig = metricTabs.find((t) => t.key === activeMetricTab) || metricTabs[0];

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

      {/* Campaign & Client Filters Bar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            
            {/* Client Filter */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Select Client</span>
              <select
                value={selectedClient}
                onChange={(e) => { setSelectedClient(e.target.value); setSelectedCampaign(""); }}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">All Clients</option>
                {clientsData?.clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>

            {/* Campaign Filter */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Select Campaign</span>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
                disabled={!selectedClient}
              >
                <option value="">All Campaigns</option>
                {campaignsData?.campaigns
                  ?.filter((c: any) => !selectedClient || c.client_id === selectedClient)
                  ?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </div>

            {/* Date Range Selector */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Date Range</span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
            </div>

            {/* Clear Button */}
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => { setSelectedClient(""); setSelectedCampaign(""); setDateRange("30"); }}
              >
                Reset Filters
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Main Charts & Selector Splits */}
      <div className="space-y-4">
        
        {/* Metric selection buttons */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {metricTabs.map((t) => {
            const active = activeMetricTab === t.key;
            
            // Extract latest value for preview
            const latestVal = trends.length > 0 ? trends[trends.length - 1][t.key] : 0;

            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveMetricTab(t.key)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all duration-150",
                  active
                    ? "bg-primary/[0.03] border-primary shadow-sm"
                    : "bg-card border-border hover:bg-muted/10"
                )}
              >
                <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">{t.label}</span>
                <p className="text-lg font-extrabold mt-1 text-foreground font-mono">
                  {t.symbol === "$" ? `$${latestVal}` : `${latestVal}%`}
                </p>
              </button>
            );
          })}
        </div>

        {/* Dynamic Recharts Chart Card */}
        <Card>
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Outreach Delivery Trend: {activeTabConfig.label}</span>
              <Badge className="font-mono bg-primary/[0.08] text-primary hover:bg-primary/[0.08]">{activeTabConfig.label.toUpperCase()}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Outbound sender health, intent detection ratios, and cost per meeting bookings over time.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeTabConfig.color} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={activeTabConfig.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(value) => [activeTabConfig.symbol === "$" ? `$${value}` : `${value}%`, activeTabConfig.label]} />
                <Area type="monotone" dataKey={activeMetricTab} stroke={activeTabConfig.color} strokeWidth={2} fillOpacity={1} fill="url(#colorMetric)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
