"use client";

import { use, useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft, Pencil, X, Save, RefreshCw, Zap,
  Mail, Award, AlertTriangle, Play, Pause, Trash,
  Calendar, CheckCircle, HelpCircle, Activity,
  ChevronRight, Sparkles, Inbox, ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell
} from "recharts";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TABS = [
  "Overview", "Funnel", "Sequence", "Inbox Health", "Leads", "Live Activity"
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "paused":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400";
    case "archived":
      return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400";
    case "draft":
      return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400";
    case "completed":
      return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400";
    default:
      return "";
  }
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState(0);
  
  // Data Loaders
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/campaigns/${id}`,
    fetcher
  );

  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Live Activity SWR with 5s polling
  const { data: activityData } = useSWR(
    activeTab === 5 ? `/api/dashboard/campaigns/${id}/activity` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Editing Campaign properties
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    status: "",
    start_date: "",
    end_date: "",
  });
  const [saving, setSaving] = useState(false);

  const campaign = data?.campaign;
  const recentReplies = data?.recentReplies ?? [];

  useEffect(() => {
    if (campaign) {
      setForm({
        name: campaign.name || "",
        status: campaign.status || "draft",
        start_date: campaign.start_date ? campaign.start_date.slice(0, 10) : "",
        end_date: campaign.end_date ? campaign.end_date.slice(0, 10) : "",
      });
    }
  }, [campaign]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Campaign name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success("Campaign settings updated");
      mutate();
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update campaign");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <Card className="mx-auto max-w-xl mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Campaign not found</p>
          <Link href="/dashboard/campaigns">
            <Button variant="ghost" size="sm" className="mt-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Campaigns
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Pre-calculate percentages & rates
  const totalLeads = campaign.total_leads ?? 0;
  const emailsSent = campaign.emails_sent ?? 0;
  const replies = campaign.replies_received ?? 0;
  const positive = campaign.positive_replies ?? 0;
  const booked = campaign.meetings_booked ?? 0;

  const replyRate = emailsSent > 0 ? (replies / emailsSent) * 100 : 0;
  const positiveRate = replies > 0 ? (positive / replies) * 100 : 0;

  // Mocked metrics as requested by the spec
  const mockBounceRate = 2.4;
  const mockSpamRate = 0.6;
  const mockResponseTimeDays = 1.2;

  // 1. Funnel data definition
  const funnelData = [
    { name: "1. Leads", value: totalLeads, conversion: 100 },
    { name: "2. Enriched", value: Math.round(totalLeads * 0.95), conversion: 95 },
    { name: "3. Personalized", value: totalLeads, conversion: 100 },
    { name: "4. Sent", value: emailsSent, conversion: totalLeads > 0 ? Math.round((emailsSent / totalLeads) * 100) : 0 },
    { name: "5. Replied", value: replies, conversion: emailsSent > 0 ? Math.round((replies / emailsSent) * 100) : 0 },
    { name: "6. Booked", value: booked, conversion: replies > 0 ? Math.round((booked / replies) * 100) : 0 },
  ];

  // 2. Sequence details
  const steps = [
    { step: "Step 1: Opener (Email 1)", sendPct: 100, openPct: 45, clickPct: 8, replyPct: 3, positivePct: 70 },
    { step: "Step 2: Case Study (Email 2)", sendPct: 80, openPct: 38, clickPct: 6, replyPct: 5, positivePct: 75 },
    { step: "Step 3: Direct Pitch (Email 3)", sendPct: 60, openPct: 25, clickPct: 3, replyPct: 4, positivePct: 80 },
  ];

  // 3. Inboxes list (mocked as requested)
  const mockInboxes = [
    { email: "vishwas@krionics.com", sent: Math.round(emailsSent * 0.4), bounce: 1.8, spam: 0.4, warmup: "Complete", reputation: 98 },
    { email: "aryan@krionics.com", sent: Math.round(emailsSent * 0.35), bounce: 2.1, spam: 0.7, warmup: "Day 24/30", reputation: 87 },
    { email: "avishkar@krionics.com", sent: Math.round(emailsSent * 0.25), bounce: 2.9, spam: 0.9, warmup: "Day 12/30", reputation: 79 },
  ];

  // 4. Leads state distribution (Recharts PieChart)
  const notRepliedCount = Math.max(0, totalLeads - replies);
  const bouncedCount = Math.round(emailsSent * 0.05);

  const leadsPieData = [
    { name: "Not Replied", value: notRepliedCount, color: "#4B5563" }, // dark gray
    { name: "Replied", value: Math.max(0, replies - positive), color: "#3B82F6" }, // blue
    { name: "Positive", value: Math.max(0, positive - booked), color: "#10B981" }, // green
    { name: "Meeting Booked", value: booked, color: "#C4521C" }, // terracotta
    { name: "Bounced", value: bouncedCount, color: "#EF4444" }, // red
  ];

  const totalLeadsState = leadsPieData.reduce((acc, curr) => acc + curr.value, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Back button & Title Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/campaigns">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
                {campaign.name}
              </h1>
              <Badge className={statusBadgeClass(campaign.status)}>
                {campaign.status.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span>Client:</span>
              <Link href={`/dashboard/clients/${campaign.client_slug}`} className="text-primary hover:underline font-medium">
                {campaign.client_company_name}
              </Link>
              {campaign.start_date && (
                <>
                  <span className="mx-1">•</span>
                  <Calendar className="h-4.5 w-4.5 mr-0.5" />
                  <span>
                    {new Date(campaign.start_date).toLocaleDateString()} - {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : "Present"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Action controls */}
        {isAdmin && (
          <div>
            {editing ? (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Settings
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit Settings
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Inline edit panel if editing is active */}
      {editing && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-5 space-y-4">
            <h3 className="font-heading text-base font-semibold">Edit Campaign Parameters</h3>
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="camp-name">Campaign Name</Label>
                <Input id="camp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-status">Status</Label>
                <select
                  id="camp-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-start">Start Date</Label>
                <Input id="camp-start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-end">End Date</Label>
                <Input id="camp-end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabs list */}
      <div>
        <div className="flex gap-0 border-b border-border overflow-x-auto scrollbar-hide">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === i
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab contents panel */}
        <Card className="rounded-tl-none rounded-tr-none border-t-0">
          <CardContent className="pt-6 pb-6">

            {/* TAB 1: OVERVIEW */}
            {activeTab === 0 && (
              <div className="space-y-6">
                {/* 4-column KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Leads", value: totalLeads.toLocaleString() },
                    { label: "Emails Sent", value: emailsSent.toLocaleString() },
                    { label: "Replies Received", value: replies.toLocaleString() },
                    { label: "Reply Rate", value: `${replyRate.toFixed(1)}%` },
                    { label: "Positive Rate", value: `${positiveRate.toFixed(1)}%` },
                    { label: "Meetings Booked", value: booked.toLocaleString() },
                    { label: "Bounce Rate", value: `${mockBounceRate}%`, secondary: "Mocked" },
                    { label: "Avg Response Time", value: `${mockResponseTimeDays} days`, secondary: "Mocked" },
                  ].map((kpi) => (
                    <Card key={kpi.label} className="bg-card">
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          {kpi.label}
                          {kpi.secondary && <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 rounded">{kpi.secondary}</span>}
                        </p>
                        <p className="text-2xl font-bold mt-1.5">{kpi.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Recent Activity List */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Recent Reply Queue Actions</h3>
                  {recentReplies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent review item interactions detected.</p>
                  ) : (
                    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {recentReplies.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{item.id.slice(0, 8)}…</span>
                            {item.intent && (
                              <Badge variant="outline" className="text-xs">
                                {item.intent.toUpperCase()} ({Math.round(item.confidence * 100)}%)
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={item.status === "APPROVED" ? "default" : item.status === "REJECTED" ? "destructive" : "secondary"}>
                              {item.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: FUNNEL VISUALIZATION */}
            {activeTab === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold mb-1">Outbound Funnel Performance</h3>
                  <p className="text-xs text-muted-foreground">Conversion rates computed step-over-step based on actual leads performance.</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                  <div className="lg:col-span-2 h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={110} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Count"]} />
                        <Bar dataKey="value" fill="#C4521C" radius={[0, 4, 4, 0]}>
                          {funnelData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill="#C4521C" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Step Conversion Details */}
                  <div className="space-y-3 bg-muted/40 p-4 rounded-xl border">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Step Conversions</h4>
                    {funnelData.map((step, idx) => (
                      <div key={step.name} className="flex justify-between items-center text-sm py-1 border-b border-border last:border-0">
                        <span className="font-medium">{step.name}</span>
                        <div className="text-right">
                          <span className="font-mono">{step.value.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">({step.conversion}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SEQUENCE */}
            {activeTab === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold mb-1">Sequence Performance Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Step-by-step conversion funnel analysis of outbound sequences.</p>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="p-3 font-semibold">Step</th>
                        <th className="p-3 font-semibold text-right">Send Volume</th>
                        <th className="p-3 font-semibold text-right">Open Rate</th>
                        <th className="p-3 font-semibold text-right">Click Rate</th>
                        <th className="p-3 font-semibold text-right">Reply Rate</th>
                        <th className="p-3 font-semibold text-right">Positive Interest %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {steps.map((step) => (
                        <tr key={step.step} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4 text-primary shrink-0" />
                            {step.step}
                          </td>
                          <td className="p-3 text-right font-mono">{step.sendPct}%</td>
                          <td className="p-3 text-right font-mono text-emerald-600">{step.openPct}%</td>
                          <td className="p-3 text-right font-mono text-blue-600">{step.clickPct}%</td>
                          <td className="p-3 text-right font-mono">{step.replyPct}%</td>
                          <td className="p-3 text-right font-mono font-medium text-primary">{step.positivePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: INBOX HEALTH */}
            {activeTab === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Active Inboxes", value: mockInboxes.length },
                    { label: "Overall Reputation", value: "92/100", color: "text-emerald-600" },
                    { label: "Daily Volume limit", value: `${mockInboxes.length * 50} / day` },
                    { label: "Aggregate Spams", value: "0.6%", color: "text-emerald-600" },
                  ].map((stat) => (
                    <Card key={stat.label}>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground uppercase">{stat.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${stat.color || ""}`}>{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Individual Sending Mailboxes</h3>
                  <div className="divide-y divide-border rounded-lg border border-border overflow-hidden bg-card">
                    {mockInboxes.map((box) => (
                      <div key={box.email} className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-3 hover:bg-muted/15 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <Inbox className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{box.email}</p>
                            <p className="text-xs text-muted-foreground">Warmup status: <span className="font-semibold text-primary">{box.warmup}</span></p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 md:gap-8 text-right shrink-0">
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Sent</p>
                            <p className="text-sm font-mono font-semibold">{box.sent}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Bounce</p>
                            <p className="text-sm font-mono text-rose-500">{box.bounce}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Spam</p>
                            <p className="text-sm font-mono text-amber-500">{box.spam}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Reputation</p>
                            <p className="text-sm font-mono font-bold text-emerald-600">{box.reputation}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: LEADS DISTRIBUTION */}
            {activeTab === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold mb-1">Campaign Leads Funnel Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Pie chart visual representation of leads statuses in the campaigns pool.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="h-[280px] flex justify-center items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leadsPieData}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {leadsPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Leads"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Status tables */}
                  <div className="space-y-2">
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-muted/40 border-b border-border">
                            <th className="p-2.5 font-semibold">Lead State</th>
                            <th className="p-2.5 font-semibold text-right">Count</th>
                            <th className="p-2.5 font-semibold text-right">% of Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {leadsPieData.map((item) => {
                            const pct = (item.value / totalLeadsState) * 100;
                            return (
                              <tr key={item.name}>
                                <td className="p-2.5 flex items-center gap-2">
                                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                  {item.name}
                                </td>
                                <td className="p-2.5 text-right font-mono">{item.value.toLocaleString()}</td>
                                <td className="p-2.5 text-right font-mono">{pct.toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: LIVE ACTIVITY TIMELINE */}
            {activeTab === 5 && (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-semibold mb-0.5">Real-time Campaign Activities Log</h3>
                    <p className="text-xs text-muted-foreground">Polling automatically every 5 seconds for updates.</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-mono bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Polling Active
                  </div>
                </div>

                {!activityData ? (
                  <div className="flex justify-center items-center py-16">
                    <Spinner className="h-6 w-6 mr-2" />
                    <span className="text-sm text-muted-foreground">Syncing live activity events...</span>
                  </div>
                ) : activityData.events?.length === 0 ? (
                  <p className="text-center text-sm py-16 text-muted-foreground">No events recorded for this campaign.</p>
                ) : (
                  <div className="relative border-l border-border pl-6 ml-3 space-y-6">
                    {activityData.events.map((event: any, idx: number) => {
                      const dateObj = new Date(event.timestamp);
                      const isReply = event.event_type === "reply_received";
                      
                      return (
                        <div key={idx} className="relative group">
                          {/* Circle on timeline */}
                          <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-card bg-primary ring-4 ring-background">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>

                          <div className="bg-card border rounded-lg p-3 hover:bg-muted/15 transition-colors">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2">
                                <Badge className="text-[10px] uppercase font-mono tracking-wider">
                                  {event.event_type.replace(/_/g, " ")}
                                </Badge>
                                {isReply && event.reply_intent && (
                                  <Badge variant="outline" className="text-[10px]">
                                    INTENT: {event.reply_intent}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground font-mono">
                                {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="mt-2 text-sm">
                              <p className="font-semibold text-xs text-muted-foreground">
                                Lead: <span className="font-mono font-medium text-foreground">{event.lead_email || "Unknown"}</span>
                              </p>
                              {event.subject && (
                                <p className="text-xs text-muted-foreground mt-0.5 italic">
                                  Subject: "{event.subject}"
                                </p>
                              )}
                              {event.body_snippet && (
                                <p className="text-xs bg-muted/65 p-2 rounded border border-border/50 font-mono mt-1.5 line-clamp-2 max-w-2xl">
                                  {event.body_snippet}
                                </p>
                              )}
                              {isReply && event.reply_status && (
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span>Review Status:</span>
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {event.reply_status}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
