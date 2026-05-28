"use client";

import { use, useState, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Pencil, X, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

import { BusinessTab } from "@/components/client-tabs/business-tab";
import { IcpTab } from "@/components/client-tabs/icp-tab";
import { AutomationTab } from "@/components/client-tabs/automation-tab";
import { CrmTab } from "@/components/client-tabs/crm-tab";
import { SlackTab } from "@/components/client-tabs/slack-tab";
import { AiTab } from "@/components/client-tabs/ai-tab";
import { TeamTab } from "@/components/client-tabs/team-tab";
import { ReplyPoliciesTab } from "@/components/client-tabs/reply-policies-tab";
import { TimingRulesTab } from "@/components/client-tabs/timing-rules-tab";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TABS = [
  "Overview", "Business Info", "ICP & Positioning",
  "Automation", "CRM Config", "Slack Config", "AI Config", "Team",
  "Reply Policies", "Timing Rules",
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active": return "default";
    case "paused": return "secondary";
    case "churned": return "destructive";
    case "onboarding": return "outline";
    default: return "outline";
  }
}

function statusLabel(status: string): string {
  if (status === "churned") return "Archived";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Deep-set a value at a path in a nested object
function deepSet(obj: any, path: string[], value: any): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  return { ...obj, [head]: deepSet(obj[head] ?? {}, rest, value) };
}

export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/clients/${slug}`,
    fetcher
  );
  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [activeTab, setActiveTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const client = data?.client;
  const recentActivity: any[] = data?.recentActivity ?? [];

  // Initialise draft when entering edit mode
  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(client)));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(null);
  }

  // Scalar field change
  const handleScalarChange = useCallback((key: string, value: any) => {
    setDraft((d: any) => ({ ...d, [key]: value }));
  }, []);

  // Nested config change (e.g. ["icp_config", "industries"])
  const handleConfigChange = useCallback((path: string[], value: any) => {
    setDraft((d: any) => ({
      ...d,
      config: deepSet(d.config ?? {}, path, value),
    }));
  }, []);

  // crm_config top-level key change
  const handleCrmConfigChange = useCallback((key: string, value: any) => {
    setDraft((d: any) => ({
      ...d,
      crm_config: { ...(d.crm_config ?? {}), [key]: value },
    }));
  }, []);

  async function handleSave() {
    if (!draft) return;

    // Validate required fields
    if (!draft.company_name?.trim()) { toast.error("Company name is required"); return; }
    if (!draft.contact_email?.trim()) { toast.error("Contact email is required"); return; }
    if (!draft.contact_name?.trim()) { toast.error("Contact name is required"); return; }

    setSaving(true);
    try {
      // Build patch body — send scalars + JSONB blobs separately
      const patch: any = {};
      const scalarKeys = [
        "company_name", "contact_name", "contact_email", "timezone",
        "service_type", "status", "tier", "automation_level",
        "mrr_usd", "setup_fee_usd", "contract_start", "contract_end",
        "crm_type", "sales_lead_name", "service_description",
        "icp_description", "positioning_statement", "calcom_link",
        "slack_webhook_url", "slack_channel_id",
      ];
      for (const k of scalarKeys) {
        if (draft[k] !== client[k]) patch[k] = draft[k];
      }
      // Always send JSONB blobs so nested edits are captured
      patch.config = draft.config;
      patch.crm_config = draft.crm_config;

      const res = await fetch(`/api/dashboard/clients/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success("Changes saved");
      mutate();
      setEditing(false);
      setDraft(null);
    } catch (err: any) {
      toast.error(err.message || "Save failed");
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

  if (error || !client) {
    return (
      <Card className="mx-auto max-w-xl mt-12">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Client not found</p>
          <Link href="/dashboard/clients">
            <Button variant="ghost" size="sm" className="mt-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Clients
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/clients">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-3xl font-bold">{client.company_name}</h1>
              <Badge variant={statusVariant(client.status)}>{statusLabel(client.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">{client.slug}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {/* KPI cards — always shown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Campaigns", value: client.active_campaigns ?? 0 },
          { label: "Emails Sent", value: (client.total_emails_sent ?? 0).toLocaleString() },
          { label: "Reply Rate", value: `${Number(client.reply_rate ?? 0).toFixed(1)}%` },
          { label: "Meetings Booked", value: client.total_meetings_booked ?? 0 },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div>
        {/* Tab bar */}
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

        {/* Tab panel */}
        <Card className="rounded-tl-none rounded-tr-none border-t-0">
          <CardContent className="pt-6 pb-6">
            {/* Overview */}
            {activeTab === 0 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent reply items</p>
                  ) : (
                    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {recentActivity.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{item.id.slice(0, 8)}…</span>
                            {item.intent && <Badge variant="outline" className="text-xs">{item.intent}</Badge>}
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

            {/* Business Info */}
            {activeTab === 1 && (
              <BusinessTab
                client={client}
                editing={editing}
                draft={draft}
                onChange={handleScalarChange}
              />
            )}

            {/* ICP & Positioning */}
            {activeTab === 2 && (
              <IcpTab
                client={client}
                editing={editing}
                draft={draft}
                onScalarChange={handleScalarChange}
                onConfigChange={handleConfigChange}
              />
            )}

            {/* Automation */}
            {activeTab === 3 && (
              <AutomationTab
                client={client}
                editing={editing}
                draft={draft}
                onScalarChange={handleScalarChange}
                onConfigChange={handleConfigChange}
              />
            )}

            {/* CRM Config */}
            {activeTab === 4 && (
              <CrmTab
                client={client}
                editing={editing}
                draft={draft}
                onScalarChange={handleScalarChange}
                onCrmConfigChange={handleCrmConfigChange}
              />
            )}

            {/* Slack Config */}
            {activeTab === 5 && (
              <SlackTab
                client={client}
                editing={editing}
                draft={draft}
                onScalarChange={handleScalarChange}
                onConfigChange={handleConfigChange}
              />
            )}

            {/* AI Config */}
            {activeTab === 6 && (
              <AiTab
                client={client}
                editing={editing}
                draft={draft}
                onConfigChange={handleConfigChange}
              />
            )}

            {/* Team */}
            {activeTab === 7 && <TeamTab clientId={client.id} />}

            {/* Reply Policies */}
            {activeTab === 8 && <ReplyPoliciesTab clientSlug={slug} isAdmin={isAdmin} />}

            {/* Timing Rules */}
            {activeTab === 9 && <TimingRulesTab clientSlug={slug} isAdmin={isAdmin} />}

            {/* Save button at bottom of editable tabs */}
            {editing && activeTab > 0 && activeTab < 8 && (
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
