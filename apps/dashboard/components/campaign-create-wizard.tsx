"use client";

import { useState } from "react";
import useSWR from "swr";
import { X, ChevronRight, ChevronLeft, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STEPS = ["Basics", "ICP Config", "Sequence", "Sending", "Review"];

const INDUSTRIES = ["SaaS", "FinTech", "Healthcare", "E-commerce", "Manufacturing", "Professional Services", "Real Estate", "Education", "Media", "Logistics"];
const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001+"];
const SENIORITY_LEVELS = ["C-Level", "VP", "Director", "Manager", "Senior", "Mid-Level", "Entry-Level"];

interface WizardData {
  name: string;
  client_id: string;
  start_date: string;
  end_date: string;
  icp_config: {
    industries: string[];
    company_sizes: string[];
    seniority_levels: string[];
    title_keywords: string;
    exclude_titles: string;
  };
  sequence_config: {
    email_count: number;
    delay_days_between: number;
    ab_test_subjects: boolean;
  };
  sending_config: {
    daily_limit: number;
    send_window_start: string;
    send_window_end: string;
    timezone: string;
  };
}

const INITIAL: WizardData = {
  name: "",
  client_id: "",
  start_date: "",
  end_date: "",
  icp_config: {
    industries: [],
    company_sizes: [],
    seniority_levels: [],
    title_keywords: "",
    exclude_titles: "",
  },
  sequence_config: {
    email_count: 5,
    delay_days_between: 3,
    ab_test_subjects: false,
  },
  sending_config: {
    daily_limit: 100,
    send_window_start: "08:00",
    send_window_end: "18:00",
    timezone: "America/New_York",
  },
};

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore", "UTC",
];

function MultiSelectChips({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CampaignCreateWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const { data: clientsRes } = useSWR("/api/dashboard/clients", fetcher);
  const clients: any[] = clientsRes?.clients ?? [];

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function updateICP<K extends keyof WizardData["icp_config"]>(key: K, value: WizardData["icp_config"][K]) {
    setData((d) => ({ ...d, icp_config: { ...d.icp_config, [key]: value } }));
  }

  function updateSeq<K extends keyof WizardData["sequence_config"]>(key: K, value: WizardData["sequence_config"][K]) {
    setData((d) => ({ ...d, sequence_config: { ...d.sequence_config, [key]: value } }));
  }

  function updateSend<K extends keyof WizardData["sending_config"]>(key: K, value: WizardData["sending_config"][K]) {
    setData((d) => ({ ...d, sending_config: { ...d.sending_config, [key]: value } }));
  }

  function canAdvance(): boolean {
    if (step === 0) return data.name.trim().length > 0 && !!data.client_id;
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        client_id: data.client_id,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        icp_config: {
          industries: data.icp_config.industries,
          company_sizes: data.icp_config.company_sizes,
          seniority_levels: data.icp_config.seniority_levels,
          title_keywords: data.icp_config.title_keywords.split(",").map((s) => s.trim()).filter(Boolean),
          exclude_titles: data.icp_config.exclude_titles.split(",").map((s) => s.trim()).filter(Boolean),
        },
        sequence_config: data.sequence_config,
        sending_config: data.sending_config,
      };

      const res = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create");
      toast.success("Campaign created as draft");
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedClient = clients.find((c) => c.id === data.client_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
      <div className="relative w-full max-w-2xl bg-background rounded-xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold">New Campaign</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={`ml-1.5 text-xs font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                {i < STEPS.length - 1 && <div className={`mx-3 h-px w-8 ${i < step ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 0: Basics */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="camp-name">Campaign Name *</Label>
                <Input id="camp-name" className="mt-1" placeholder="Q3 Enterprise Outreach" value={data.name} onChange={(e) => update("name", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="camp-client">Client *</Label>
                <select
                  id="camp-client"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={data.client_id}
                  onChange={(e) => update("client_id", e.target.value)}
                >
                  <option value="">Select a client…</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="camp-start">Start Date</Label>
                  <input
                    id="camp-start"
                    type="date"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={data.start_date}
                    onChange={(e) => update("start_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="camp-end">End Date</Label>
                  <input
                    id="camp-end"
                    type="date"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={data.end_date}
                    onChange={(e) => update("end_date", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: ICP */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium">Target Industries</Label>
                <p className="text-xs text-muted-foreground mb-2">Select all industries you want to target.</p>
                <MultiSelectChips options={INDUSTRIES} selected={data.icp_config.industries} onChange={(v) => updateICP("industries", v)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Company Sizes</Label>
                <p className="text-xs text-muted-foreground mb-2">Select employee count ranges.</p>
                <MultiSelectChips options={COMPANY_SIZES} selected={data.icp_config.company_sizes} onChange={(v) => updateICP("company_sizes", v)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Seniority Levels</Label>
                <p className="text-xs text-muted-foreground mb-2">Which roles to target.</p>
                <MultiSelectChips options={SENIORITY_LEVELS} selected={data.icp_config.seniority_levels} onChange={(v) => updateICP("seniority_levels", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="title-kw">Title Keywords (comma-separated)</Label>
                  <input
                    id="title-kw"
                    type="text"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="e.g. Head of Sales, VP Revenue"
                    value={data.icp_config.title_keywords}
                    onChange={(e) => updateICP("title_keywords", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="excl-titles">Exclude Titles (comma-separated)</Label>
                  <input
                    id="excl-titles"
                    type="text"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="e.g. Intern, Coordinator"
                    value={data.icp_config.exclude_titles}
                    onChange={(e) => updateICP("exclude_titles", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Sequence */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email-count">Number of Emails</Label>
                  <p className="text-xs text-muted-foreground mb-1">Steps in the sequence (1–10).</p>
                  <input
                    id="email-count"
                    type="number" min={1} max={10}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={data.sequence_config.email_count}
                    onChange={(e) => updateSeq("email_count", Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>
                <div>
                  <Label htmlFor="delay-days">Days Between Emails</Label>
                  <p className="text-xs text-muted-foreground mb-1">Minimum gap between steps.</p>
                  <input
                    id="delay-days"
                    type="number" min={1} max={30}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={data.sequence_config.delay_days_between}
                    onChange={(e) => updateSeq("delay_days_between", Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={data.sequence_config.ab_test_subjects}
                  onClick={() => updateSeq("ab_test_subjects", !data.sequence_config.ab_test_subjects)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${data.sequence_config.ab_test_subjects ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${data.sequence_config.ab_test_subjects ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <div>
                  <Label className="text-sm font-medium">A/B Test Subject Lines</Label>
                  <p className="text-xs text-muted-foreground">AI will generate 2 subject variants per email step.</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">
                  AI will automatically generate email content for each step based on the ICP config and client positioning. You can review and edit generated sequences from the <strong>Sequences</strong> page before pushing to Instantly.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Sending */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="daily-limit">Daily Send Limit</Label>
                <p className="text-xs text-muted-foreground mb-1">Max emails to send per day across all inboxes.</p>
                <input
                  id="daily-limit"
                  type="number" min={10} max={2000} step={10}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={data.sending_config.daily_limit}
                  onChange={(e) => updateSend("daily_limit", Math.min(2000, Math.max(10, parseInt(e.target.value) || 100)))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="send-start">Send Window Start</Label>
                  <input
                    id="send-start"
                    type="time"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={data.sending_config.send_window_start}
                    onChange={(e) => updateSend("send_window_start", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="send-end">Send Window End</Label>
                  <input
                    id="send-end"
                    type="time"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={data.sending_config.send_window_end}
                    onChange={(e) => updateSend("send_window_end", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="send-tz">Timezone</Label>
                <select
                  id="send-tz"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={data.sending_config.timezone}
                  onChange={(e) => updateSend("timezone", e.target.value)}
                >
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Campaign Name</span>
                  <span className="text-sm font-semibold">{data.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Client</span>
                  <span className="text-sm">{selectedClient?.company_name ?? "—"}</span>
                </div>
                {data.start_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Start Date</span>
                    <span className="text-sm">{data.start_date}</span>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ICP</p>
                <div className="flex flex-wrap gap-1">
                  {data.icp_config.industries.length > 0
                    ? data.icp_config.industries.map((i) => <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>)
                    : <span className="text-xs text-muted-foreground">All industries</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.icp_config.company_sizes.length > 0
                    ? data.icp_config.company_sizes.map((s) => <Badge key={s} variant="outline" className="text-xs">{s} employees</Badge>)
                    : <span className="text-xs text-muted-foreground">All company sizes</span>}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sequence</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-xl font-bold">{data.sequence_config.email_count}</p>
                    <p className="text-xs text-muted-foreground">Emails</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-xl font-bold">{data.sequence_config.delay_days_between}d</p>
                    <p className="text-xs text-muted-foreground">Between steps</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-xl font-bold">{data.sending_config.daily_limit}</p>
                    <p className="text-xs text-muted-foreground">Daily limit</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-3">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Campaign will be created as a <strong>Draft</strong>. Activate it from the campaign detail page when ready to start sending.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={step === 0 ? onClose : () => setStep(step - 1)}>
            {step === 0 ? "Cancel" : <><ChevronLeft className="h-4 w-4 mr-1" /> Back</>}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating…" : "Create Campaign"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
