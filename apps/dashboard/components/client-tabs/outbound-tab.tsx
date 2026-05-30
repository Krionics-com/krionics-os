"use client";

import { useState } from "react";
import { Plus, Trash2, Rocket, Pause, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface SequenceStep {
  step: number;
  name: string;
  delay_days: number;
}

interface ApolloConfig {
  pull_cadence?: "daily" | "weekly" | "threshold";
  daily_lead_target?: number;
  threshold_min?: number;
  max_total_leads?: number;
  icp_filters?: {
    titles?: string[];
    industries?: string[];
    company_sizes?: string[];
    seniority?: string[];
    geographies?: string[];
    excluded_domains?: string[];
    excluded_keywords?: string[];
  };
}

interface ClayConfig {
  enrich_linkedin?: boolean;
  linkedin_depth?: "basic" | "full";
  enrich_website?: boolean;
  enrich_email_verify?: boolean;
  enrich_tech_stack?: boolean;
  enrich_funding_news?: boolean;
  enrich_company_news?: boolean;
}

interface SequenceConfig {
  steps: SequenceStep[];
}

interface InstantlyConfig {
  campaign_id?: string;
  from_emails?: string[];
  daily_limit?: number;
  send_window_start?: string;
  send_window_end?: string;
  timezone?: string;
}

interface OutboundTabProps {
  client: any;
  slug: string;
  isAdmin: boolean;
  onRefresh: () => void;
}

// ──────────────────────────────────────────────
// Sub-tab types
// ──────────────────────────────────────────────

type SubTab = "Apollo" | "Clay" | "Sequence" | "Instantly" | "Review Mode";
const SUB_TABS: SubTab[] = ["Apollo", "Clay", "Sequence", "Instantly", "Review Mode"];

// ──────────────────────────────────────────────
// Helper: Toggle button
// ──────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        enabled ? "bg-primary" : "bg-muted",
        disabled ? "opacity-50 cursor-default" : "cursor-pointer"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
          enabled ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

// ──────────────────────────────────────────────
// Helper: SectionHeader
// ──────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────
// Helper: Field wrapper
// ──────────────────────────────────────────────

function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────
// Helper: ToggleRow
// ──────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  enabled,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Toggle enabled={enabled} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ──────────────────────────────────────────────
// Common timezones
// ──────────────────────────────────────────────

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

// ──────────────────────────────────────────────
// Apollo Sub-tab
// ──────────────────────────────────────────────

function ApolloSubTab({
  client,
  slug,
  isAdmin,
}: {
  client: any;
  slug: string;
  isAdmin: boolean;
}) {
  const initial: ApolloConfig = client.apollo_config ?? {};
  const [cadence, setCadence] = useState<"daily" | "weekly" | "threshold">(
    initial.pull_cadence ?? "daily"
  );
  const [dailyTarget, setDailyTarget] = useState<number>(initial.daily_lead_target ?? 50);
  const [maxLeads, setMaxLeads] = useState<number>(initial.max_total_leads ?? 2000);
  const [thresholdMin, setThresholdMin] = useState<number>(initial.threshold_min ?? 100);
  const [saving, setSaving] = useState(false);

  // ICP preview data sourced from client.config
  const config = client.config ?? {};
  const icp = config.icp_config ?? {};
  const icpDescription = client.icp_description ?? null;
  const icpIndustries: string[] = icp.industries ?? [];
  const icpTitles: string[] = icp.target_titles ?? [];
  const icpGeographies: string[] = icp.geographies ?? [];

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${slug}/outbound-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apollo_config: {
            pull_cadence: cadence,
            daily_lead_target: dailyTarget,
            max_total_leads: maxLeads,
            threshold_min: cadence === "threshold" ? thresholdMin : undefined,
            icp_filters: initial.icp_filters ?? {},
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast.success("Apollo config saved");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Apollo Lead Acquisition"
        subtitle="Configure cadence and lead targets for Apollo.io pull jobs."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pull Cadence */}
        <div className="space-y-1.5 md:col-span-2">
          <Label>Pull Cadence</Label>
          <div className="flex gap-3 flex-wrap">
            {(["daily", "weekly", "threshold"] as const).map((opt) => (
              <label
                key={opt}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors",
                  cadence === opt
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border text-muted-foreground",
                  !isAdmin && "pointer-events-none opacity-70"
                )}
              >
                <input
                  type="radio"
                  name="cadence"
                  value={opt}
                  checked={cadence === opt}
                  onChange={() => isAdmin && setCadence(opt)}
                  className="sr-only"
                />
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <Field label="Daily Lead Target" id="apollo-daily-target">
          <Input
            id="apollo-daily-target"
            type="number"
            min={1}
            value={dailyTarget}
            onChange={(e) => isAdmin && setDailyTarget(parseInt(e.target.value) || 50)}
            disabled={!isAdmin}
          />
        </Field>

        <Field label="Max Total Leads" id="apollo-max-leads">
          <Input
            id="apollo-max-leads"
            type="number"
            min={1}
            value={maxLeads}
            onChange={(e) => isAdmin && setMaxLeads(parseInt(e.target.value) || 2000)}
            disabled={!isAdmin}
          />
        </Field>

        {cadence === "threshold" && (
          <Field label="Threshold Min Leads" id="apollo-threshold-min">
            <Input
              id="apollo-threshold-min"
              type="number"
              min={1}
              value={thresholdMin}
              onChange={(e) => isAdmin && setThresholdMin(parseInt(e.target.value) || 100)}
              disabled={!isAdmin}
            />
          </Field>
        )}
      </div>

      {/* ICP Filters — read-only preview from client ICP setup */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">ICP Filters</h4>
          <Badge variant="outline" className="text-xs">Sourced from client ICP setup</Badge>
        </div>
        {icpDescription && (
          <p className="text-sm text-muted-foreground">{icpDescription}</p>
        )}
        {icpIndustries.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Target Industries</p>
            <div className="flex flex-wrap gap-1.5">
              {icpIndustries.map((ind) => (
                <Badge key={ind} variant="secondary" className="text-xs">{ind}</Badge>
              ))}
            </div>
          </div>
        )}
        {icpTitles.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Target Titles</p>
            <div className="flex flex-wrap gap-1.5">
              {icpTitles.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
          </div>
        )}
        {icpGeographies.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Geographies</p>
            <div className="flex flex-wrap gap-1.5">
              {icpGeographies.map((g) => (
                <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
              ))}
            </div>
          </div>
        )}
        {icpIndustries.length === 0 && icpTitles.length === 0 && icpGeographies.length === 0 && !icpDescription && (
          <p className="text-sm text-muted-foreground italic">No ICP data configured. Go to the ICP & Positioning tab to set it up.</p>
        )}
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Apollo Config"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Clay Sub-tab
// ──────────────────────────────────────────────

function ClaySubTab({
  client,
  slug,
  isAdmin,
}: {
  client: any;
  slug: string;
  isAdmin: boolean;
}) {
  const initial: ClayConfig = client.clay_config ?? {};
  const [enrichLinkedin, setEnrichLinkedin] = useState(initial.enrich_linkedin ?? true);
  const [linkedinDepth, setLinkedinDepth] = useState<"basic" | "full">(
    initial.linkedin_depth ?? "full"
  );
  const [enrichWebsite, setEnrichWebsite] = useState(initial.enrich_website ?? true);
  const [enrichEmailVerify, setEnrichEmailVerify] = useState(
    initial.enrich_email_verify ?? true
  );
  const [enrichTechStack, setEnrichTechStack] = useState(initial.enrich_tech_stack ?? true);
  const [enrichFundingNews, setEnrichFundingNews] = useState(
    initial.enrich_funding_news ?? true
  );
  const [enrichCompanyNews, setEnrichCompanyNews] = useState(
    initial.enrich_company_news ?? false
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${slug}/outbound-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clay_config: {
            enrich_linkedin: enrichLinkedin,
            linkedin_depth: linkedinDepth,
            enrich_website: enrichWebsite,
            enrich_email_verify: enrichEmailVerify,
            enrich_tech_stack: enrichTechStack,
            enrich_funding_news: enrichFundingNews,
            enrich_company_news: enrichCompanyNews,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast.success("Clay config saved");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Clay Enrichment"
        subtitle="Control which enrichment signals Clay collects for each lead."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ToggleRow
          label="Enrich LinkedIn Profile"
          description="Scrape LinkedIn profile data for each lead"
          enabled={enrichLinkedin}
          onChange={setEnrichLinkedin}
          disabled={!isAdmin}
        />

        {enrichLinkedin && (
          <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/30">
            <Label htmlFor="clay-linkedin-depth">LinkedIn Depth</Label>
            <select
              id="clay-linkedin-depth"
              value={linkedinDepth}
              onChange={(e) => isAdmin && setLinkedinDepth(e.target.value as "basic" | "full")}
              disabled={!isAdmin}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-50"
            >
              <option value="basic">Basic</option>
              <option value="full">Full</option>
            </select>
          </div>
        )}

        <ToggleRow
          label="Enrich Website"
          description="Scrape company website for context signals"
          enabled={enrichWebsite}
          onChange={setEnrichWebsite}
          disabled={!isAdmin}
        />

        <ToggleRow
          label="Email Verification"
          description="Validate email deliverability before outreach"
          enabled={enrichEmailVerify}
          onChange={setEnrichEmailVerify}
          disabled={!isAdmin}
        />

        <ToggleRow
          label="Tech Stack Detection"
          description="Identify technologies the prospect uses"
          enabled={enrichTechStack}
          onChange={setEnrichTechStack}
          disabled={!isAdmin}
        />

        <ToggleRow
          label="Funding & News"
          description="Pull recent funding rounds and news mentions"
          enabled={enrichFundingNews}
          onChange={setEnrichFundingNews}
          disabled={!isAdmin}
        />

        <ToggleRow
          label="Company News"
          description="Monitor recent company press releases"
          enabled={enrichCompanyNews}
          onChange={setEnrichCompanyNews}
          disabled={!isAdmin}
        />
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Clay Config"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Sequence Sub-tab
// ──────────────────────────────────────────────

function SequenceSubTab({
  client,
  slug,
  isAdmin,
}: {
  client: any;
  slug: string;
  isAdmin: boolean;
}) {
  const initial: SequenceConfig = client.sequence_config ?? {
    steps: [{ step: 1, name: "Initial Email", delay_days: 0 }],
  };
  const [steps, setSteps] = useState<SequenceStep[]>(
    initial.steps?.length > 0
      ? initial.steps
      : [{ step: 1, name: "Initial Email", delay_days: 0 }]
  );
  const [saving, setSaving] = useState(false);

  function updateStep(index: number, field: "name" | "delay_days", value: string | number) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function addStep() {
    if (steps.length >= 8) { toast.error("Maximum 8 steps allowed"); return; }
    setSteps((prev) => [
      ...prev,
      { step: prev.length + 1, name: `Follow-up ${prev.length}`, delay_days: 3 },
    ]);
  }

  function removeStep(index: number) {
    if (steps.length <= 1) { toast.error("At least 1 step is required"); return; }
    setSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step: i + 1 }))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${slug}/outbound-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequence_config: { steps },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast.success("Sequence config saved");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sequence Steps"
        subtitle="Define the outreach steps and delays. Min 1, max 8 steps."
      />

      <div className="space-y-2">
        {/* Header row */}
        <div className="grid grid-cols-[2rem_1fr_9rem_2.5rem] gap-2 px-3 pb-1">
          <span className="text-xs font-medium text-muted-foreground">#</span>
          <span className="text-xs font-medium text-muted-foreground">Step Name</span>
          <span className="text-xs font-medium text-muted-foreground">Delay (days)</span>
          <span></span>
        </div>

        {steps.map((step, i) => (
          <div
            key={i}
            className="grid grid-cols-[2rem_1fr_9rem_2.5rem] gap-2 items-center px-3 py-2 rounded-lg border border-border"
          >
            <span className="text-sm font-mono text-muted-foreground">{step.step}</span>
            <Input
              value={step.name}
              onChange={(e) => isAdmin && updateStep(i, "name", e.target.value)}
              disabled={!isAdmin}
              className="h-8 text-sm"
              placeholder="Step name"
            />
            <Input
              type="number"
              min={0}
              value={step.delay_days}
              onChange={(e) =>
                isAdmin && updateStep(i, "delay_days", parseInt(e.target.value) || 0)
              }
              disabled={!isAdmin}
              className="h-8 text-sm"
            />
            {isAdmin ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => removeStep(i)}
                disabled={steps.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            onClick={addStep}
            disabled={steps.length >= 8}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Sequence Config"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Instantly Sub-tab
// ──────────────────────────────────────────────

function InstantlySubTab({
  client,
  slug,
  isAdmin,
}: {
  client: any;
  slug: string;
  isAdmin: boolean;
}) {
  const initial: InstantlyConfig = client.instantly_config ?? {};
  const [campaignId, setCampaignId] = useState(initial.campaign_id ?? "");
  const [fromEmails, setFromEmails] = useState<string[]>(initial.from_emails ?? []);
  const [emailInput, setEmailInput] = useState("");
  const [dailyLimit, setDailyLimit] = useState<number>(initial.daily_limit ?? 50);
  const [windowStart, setWindowStart] = useState(initial.send_window_start ?? "09:00");
  const [windowEnd, setWindowEnd] = useState(initial.send_window_end ?? "17:00");
  const [timezone, setTimezone] = useState(initial.timezone ?? "America/New_York");
  const [saving, setSaving] = useState(false);

  function addEmail() {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (fromEmails.includes(trimmed)) { toast.error("Email already added"); return; }
    setFromEmails((prev) => [...prev, trimmed]);
    setEmailInput("");
  }

  function removeEmail(email: string) {
    setFromEmails((prev) => prev.filter((e) => e !== email));
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail();
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${slug}/outbound-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instantly_config: {
            campaign_id: campaignId || undefined,
            from_emails: fromEmails,
            daily_limit: dailyLimit,
            send_window_start: windowStart,
            send_window_end: windowEnd,
            timezone,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast.success("Instantly config saved");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Instantly Configuration"
        subtitle="Link an Instantly campaign and configure sending parameters."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Campaign ID" id="instantly-campaign-id">
          <Input
            id="instantly-campaign-id"
            placeholder="e.g. camp_abc123"
            value={campaignId}
            onChange={(e) => isAdmin && setCampaignId(e.target.value)}
            disabled={!isAdmin}
          />
        </Field>

        <Field label="Daily Send Limit" id="instantly-daily-limit">
          <Input
            id="instantly-daily-limit"
            type="number"
            min={1}
            value={dailyLimit}
            onChange={(e) => isAdmin && setDailyLimit(parseInt(e.target.value) || 50)}
            disabled={!isAdmin}
          />
        </Field>

        {/* From Emails */}
        <div className="space-y-1.5 md:col-span-2">
          <Label>From Emails</Label>
          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-input bg-background min-h-[2.5rem]">
            {fromEmails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
              >
                {email}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="text-muted-foreground hover:text-foreground ml-0.5"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {isAdmin && (
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                onBlur={addEmail}
                placeholder={fromEmails.length === 0 ? "Type email and press Enter" : "Add another…"}
                className="flex-1 min-w-[180px] text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
            )}
          </div>
          {isAdmin && (
            <p className="text-xs text-muted-foreground">Press Enter or comma to add an email address.</p>
          )}
        </div>

        <Field label="Send Window Start" id="instantly-window-start">
          <Input
            id="instantly-window-start"
            type="time"
            value={windowStart}
            onChange={(e) => isAdmin && setWindowStart(e.target.value)}
            disabled={!isAdmin}
          />
        </Field>

        <Field label="Send Window End" id="instantly-window-end">
          <Input
            id="instantly-window-end"
            type="time"
            value={windowEnd}
            onChange={(e) => isAdmin && setWindowEnd(e.target.value)}
            disabled={!isAdmin}
          />
        </Field>

        <Field label="Timezone" id="instantly-timezone">
          <select
            id="instantly-timezone"
            value={timezone}
            onChange={(e) => isAdmin && setTimezone(e.target.value)}
            disabled={!isAdmin}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-50"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Instantly Config"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Review Mode Sub-tab
// ──────────────────────────────────────────────

const REVIEW_MODE_OPTIONS: Array<{
  value: "human" | "ai" | "auto";
  label: string;
  description: string;
}> = [
  {
    value: "human",
    label: "Human Review",
    description: "Every AI sequence is reviewed by a human before sending.",
  },
  {
    value: "ai",
    label: "AI Review",
    description: "An AI quality check approves/rejects sequences automatically.",
  },
  {
    value: "auto",
    label: "Auto",
    description: "Sequences are pushed to Instantly immediately after generation.",
  },
];

function ReviewModeSubTab({
  client,
  slug,
  isAdmin,
}: {
  client: any;
  slug: string;
  isAdmin: boolean;
}) {
  const [reviewMode, setReviewMode] = useState<"human" | "ai" | "auto">(
    client.review_mode ?? "human"
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${slug}/outbound-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_mode: reviewMode }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast.success("Review mode saved");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Review Mode"
        subtitle="Choose how AI-generated sequences are handled before sending."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REVIEW_MODE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex flex-col gap-1.5 p-4 rounded-xl border-2 cursor-pointer transition-all",
              reviewMode === opt.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50",
              !isAdmin && "pointer-events-none opacity-70"
            )}
          >
            <input
              type="radio"
              name="review-mode"
              value={opt.value}
              checked={reviewMode === opt.value}
              onChange={() => isAdmin && setReviewMode(opt.value)}
              className="sr-only"
            />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{opt.label}</span>
              {reviewMode === opt.value && (
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary">
                  <Check className="h-3 w-3 text-white" />
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{opt.description}</p>
          </label>
        ))}
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Review Mode"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main OutboundTab component
// ──────────────────────────────────────────────

export function OutboundTab({ client, slug, isAdmin, onRefresh }: OutboundTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("Apollo");
  const [launchLoading, setLaunchLoading] = useState(false);

  const isActive: boolean = !!client.outbound_active;
  const launchedAt: string | null = client.outbound_launched_at ?? null;

  async function handleLaunch() {
    setLaunchLoading(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${slug}/launch-outbound`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Launch failed");
      toast.success("Outbound launched successfully");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Launch failed");
    } finally {
      setLaunchLoading(false);
    }
  }

  async function handlePause() {
    setLaunchLoading(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${slug}/launch-outbound`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Pause failed");
      toast.success("Outbound paused");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Pause failed");
    } finally {
      setLaunchLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Launch/Pause Banner */}
      <div
        className={cn(
          "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border-2",
          isActive
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-border bg-muted/30"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              isActive ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-muted"
            )}
          >
            {isActive ? (
              <Rocket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Pause className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {isActive ? "Outbound Active" : "Outbound Not Started"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isActive && launchedAt
                ? `Active since ${new Date(launchedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}`
                : "Launch to begin Apollo lead pulls and sequence delivery."}
            </p>
          </div>
        </div>

        {isAdmin && (
          <Button
            size="sm"
            variant={isActive ? "outline" : "default"}
            onClick={isActive ? handlePause : handleLaunch}
            disabled={launchLoading}
            className={cn(
              isActive && "border-emerald-500/50 hover:border-destructive hover:text-destructive"
            )}
          >
            {launchLoading ? (
              "Loading…"
            ) : isActive ? (
              <>
                <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause Outbound
              </>
            ) : (
              <>
                <Rocket className="h-3.5 w-3.5 mr-1.5" /> Launch Outbound
              </>
            )}
          </Button>
        )}
      </div>

      {/* Sub-tab nav */}
      <div>
        <div className="flex gap-0 border-b border-border overflow-x-auto scrollbar-hide">
          {SUB_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={cn(
                "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeSubTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sub-tab panels */}
        <div className="pt-5">
          {activeSubTab === "Apollo" && (
            <ApolloSubTab client={client} slug={slug} isAdmin={isAdmin} />
          )}
          {activeSubTab === "Clay" && (
            <ClaySubTab client={client} slug={slug} isAdmin={isAdmin} />
          )}
          {activeSubTab === "Sequence" && (
            <SequenceSubTab client={client} slug={slug} isAdmin={isAdmin} />
          )}
          {activeSubTab === "Instantly" && (
            <InstantlySubTab client={client} slug={slug} isAdmin={isAdmin} />
          )}
          {activeSubTab === "Review Mode" && (
            <ReviewModeSubTab client={client} slug={slug} isAdmin={isAdmin} />
          )}
        </div>
      </div>
    </div>
  );
}
