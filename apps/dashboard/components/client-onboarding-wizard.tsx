"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import useSWR from "swr";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Building2,
  Briefcase,
  Target,
  Server,
  Plug,
  Zap,
  Bot,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Types ───────────────────────────────────────────────────────────────────

interface WizardData {
  // Step 1
  company_name: string;
  slug: string;
  contact_name: string;
  contact_email: string;
  timezone: string;
  tier: string;
  service_type: string;
  // Step 2
  service_description: string;
  positioning_statement: string;
  sales_lead_name: string;
  mrr_usd: string;
  setup_fee_usd: string;
  contract_start: string;
  contract_end: string;
  // Step 3
  icp_description: string;
  target_industries: string;
  target_company_sizes: string;
  target_seniority: string;
  target_geographies: string;
  // Step 4 (infrastructure)
  selected_inbox_emails: string[];
  selected_domain_names: string[];
  // Step 5
  crm_type: string;
  crm_webhook_url: string;
  calcom_link: string;
  slack_webhook_url: string;
  slack_channel_id: string;
  // Step 6
  create_campaign: boolean;
  campaign_name: string;
  campaign_description: string;
  // Step 7
  automation_level: number;
  // Step 8: review only
}

const EMPTY: WizardData = {
  company_name: "",
  slug: "",
  contact_name: "",
  contact_email: "",
  timezone: "America/New_York",
  tier: "growth",
  service_type: "outbound",
  service_description: "",
  positioning_statement: "",
  sales_lead_name: "",
  mrr_usd: "",
  setup_fee_usd: "",
  contract_start: "",
  contract_end: "",
  icp_description: "",
  target_industries: "",
  target_company_sizes: "",
  target_seniority: "",
  target_geographies: "",
  selected_inbox_emails: [],
  selected_domain_names: [],
  crm_type: "none",
  crm_webhook_url: "",
  calcom_link: "",
  slack_webhook_url: "",
  slack_channel_id: "",
  create_campaign: false,
  campaign_name: "",
  campaign_description: "",
  automation_level: 2,
};

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Sydney", "Pacific/Auckland", "UTC",
];

const STEPS = [
  { label: "Client Basics",      icon: Building2,      description: "Company identity and primary contact" },
  { label: "Business Context",   icon: Briefcase,      description: "Service offering, financials, and sales context" },
  { label: "ICP Setup",          icon: Target,         description: "Ideal customer profile for AI targeting" },
  { label: "Infrastructure",     icon: Server,         description: "Assign inboxes and domains" },
  { label: "CRM & Integrations", icon: Plug,           description: "Connect external tools and webhooks" },
  { label: "Campaign Setup",     icon: Zap,            description: "Initialize the first outbound campaign" },
  { label: "AI & Automation",    icon: Bot,            description: "Set automation level and AI behavior" },
  { label: "Review & Activate",  icon: ClipboardCheck, description: "Confirm all details and activate the client" },
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, id, children, hint }: { label: string; id?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SelectField({ label, id, value, onChange, options, hint }: {
  label: string; id: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <Field label={label} id={id} hint={hint}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

function TextArea({ label, id, value, onChange, placeholder, rows = 3 }: {
  label: string; id: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <Field label={label} id={id}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </Field>
  );
}

// ─── Step Components ─────────────────────────────────────────────────────────

function Step1({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Company Name *" id="w-company">
        <Input
          id="w-company"
          value={d.company_name}
          placeholder="Acme Corp"
          onChange={(e) => {
            const val = e.target.value;
            set({ company_name: val, slug: slugify(val) });
          }}
        />
      </Field>
      <Field label="URL Slug *" id="w-slug" hint="Unique identifier used in URLs">
        <Input
          id="w-slug"
          value={d.slug}
          placeholder="acme-corp"
          onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
        />
      </Field>
      <Field label="Contact Name *" id="w-cname">
        <Input id="w-cname" value={d.contact_name} placeholder="Jane Doe" onChange={(e) => set({ contact_name: e.target.value })} />
      </Field>
      <Field label="Contact Email *" id="w-cemail">
        <Input id="w-cemail" type="email" value={d.contact_email} placeholder="jane@acme.com" onChange={(e) => set({ contact_email: e.target.value })} />
      </Field>
      <SelectField
        label="Timezone"
        id="w-tz"
        value={d.timezone}
        onChange={(v) => set({ timezone: v })}
        options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
      />
      <SelectField
        label="Tier"
        id="w-tier"
        value={d.tier}
        onChange={(v) => set({ tier: v })}
        options={[
          { value: "starter", label: "Starter" },
          { value: "growth", label: "Growth" },
          { value: "enterprise", label: "Enterprise" },
        ]}
      />
      <SelectField
        label="Service Type"
        id="w-svc"
        value={d.service_type}
        onChange={(v) => set({ service_type: v })}
        options={[
          { value: "outbound", label: "Outbound" },
          { value: "inbound", label: "Inbound" },
          { value: "hybrid", label: "Hybrid" },
        ]}
      />
    </div>
  );
}

function Step2({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-5">
      <TextArea label="Service Description" id="w-svc-desc" value={d.service_description} onChange={(v) => set({ service_description: v })} placeholder="Describe the service being delivered to this client…" rows={3} />
      <TextArea label="Positioning Statement" id="w-pos" value={d.positioning_statement} onChange={(v) => set({ positioning_statement: v })} placeholder="What makes this client's offering unique in the market?" rows={2} />
      <Field label="Sales Lead Name" id="w-slead">
        <Input id="w-slead" value={d.sales_lead_name} placeholder="Internal owner / AE name" onChange={(e) => set({ sales_lead_name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-5">
        <Field label="MRR (USD)" id="w-mrr">
          <Input id="w-mrr" type="number" min={0} value={d.mrr_usd} placeholder="5000" onChange={(e) => set({ mrr_usd: e.target.value })} />
        </Field>
        <Field label="Setup Fee (USD)" id="w-setup">
          <Input id="w-setup" type="number" min={0} value={d.setup_fee_usd} placeholder="2500" onChange={(e) => set({ setup_fee_usd: e.target.value })} />
        </Field>
        <Field label="Contract Start" id="w-cs">
          <Input id="w-cs" type="date" value={d.contract_start} onChange={(e) => set({ contract_start: e.target.value })} />
        </Field>
        <Field label="Contract End" id="w-ce">
          <Input id="w-ce" type="date" value={d.contract_end} onChange={(e) => set({ contract_end: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function Step3({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-5">
      <TextArea label="ICP Description" id="w-icp" value={d.icp_description} onChange={(v) => set({ icp_description: v })} placeholder="Describe the ideal customer profile in detail. Who are you targeting and why?" rows={4} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Target Industries" id="w-ind" hint="Comma-separated, e.g. SaaS, FinTech, Healthcare">
          <Input id="w-ind" value={d.target_industries} placeholder="SaaS, FinTech, Healthcare" onChange={(e) => set({ target_industries: e.target.value })} />
        </Field>
        <Field label="Company Sizes" id="w-sizes" hint="e.g. 10-50, 50-200, 200-1000">
          <Input id="w-sizes" value={d.target_company_sizes} placeholder="10-50, 50-200" onChange={(e) => set({ target_company_sizes: e.target.value })} />
        </Field>
        <Field label="Target Seniority" id="w-sen" hint="e.g. VP, Director, C-Suite">
          <Input id="w-sen" value={d.target_seniority} placeholder="VP, Director, C-Suite" onChange={(e) => set({ target_seniority: e.target.value })} />
        </Field>
        <Field label="Target Geographies" id="w-geo" hint="e.g. North America, EMEA, APAC">
          <Input id="w-geo" value={d.target_geographies} placeholder="North America, EMEA" onChange={(e) => set({ target_geographies: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function Step4({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  const { data: inboxData, isLoading: inboxLoading } = useSWR("/api/dashboard/infra/inboxes?limit=100", fetcher);
  const { data: domainData, isLoading: domainLoading } = useSWR("/api/dashboard/infra/domains?limit=100", fetcher);

  const inboxes: any[] = inboxData?.inboxes ?? [];
  const domains: any[] = domainData?.domains ?? [];

  const unassignedInboxes = inboxes.filter((i) => !i.client_id || i.client_id === null);
  const unassignedDomains = domains.filter((dom) => !dom.client_id || dom.client_id === null);

  function toggleInbox(email: string) {
    const cur = d.selected_inbox_emails;
    set({ selected_inbox_emails: cur.includes(email) ? cur.filter((e) => e !== email) : [...cur, email] });
  }

  function toggleDomain(name: string) {
    const cur = d.selected_domain_names;
    set({ selected_domain_names: cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold mb-1">Available Inboxes</h4>
        <p className="text-xs text-muted-foreground mb-3">Select inboxes to assign to this client. Only unassigned inboxes are shown.</p>
        {inboxLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg border border-border bg-muted animate-pulse" />)}
          </div>
        ) : unassignedInboxes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No unassigned inboxes available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {unassignedInboxes.map((inbox, idx) => {
              const selected = d.selected_inbox_emails.includes(inbox.email);
              return (
                <button
                  key={inbox.email ?? `inbox-${idx}`}
                  type="button"
                  onClick={() => toggleInbox(inbox.email)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors",
                    selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                  )}
                >
                  <div className={cn("h-4 w-4 rounded border flex items-center justify-center flex-shrink-0", selected ? "bg-primary border-primary" : "border-muted-foreground")}>
                    {selected && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <div>
                    <p className="font-mono text-xs">{inbox.email}</p>
                    <p className="text-xs text-muted-foreground">{inbox.provider ?? "—"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-1">Available Domains</h4>
        <p className="text-xs text-muted-foreground mb-3">Select domains to assign to this client.</p>
        {domainLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg border border-border bg-muted animate-pulse" />)}
          </div>
        ) : unassignedDomains.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No unassigned domains available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {unassignedDomains.map((domain, idx) => {
              const selected = d.selected_domain_names.includes(domain.domain);
              return (
                <button
                  key={domain.domain ?? `domain-${idx}`}
                  type="button"
                  onClick={() => toggleDomain(domain.domain)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors",
                    selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                  )}
                >
                  <div className={cn("h-4 w-4 rounded border flex items-center justify-center flex-shrink-0", selected ? "bg-primary border-primary" : "border-muted-foreground")}>
                    {selected && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <span className="font-mono text-xs">{domain.domain}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Step5({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-5">
      <SelectField
        label="CRM Type"
        id="w-crm"
        value={d.crm_type}
        onChange={(v) => set({ crm_type: v })}
        options={[
          { value: "none", label: "None" },
          { value: "hubspot", label: "HubSpot" },
          { value: "salesforce", label: "Salesforce" },
          { value: "pipedrive", label: "Pipedrive" },
          { value: "other", label: "Other" },
        ]}
      />
      {d.crm_type !== "none" && (
        <Field label="CRM Webhook URL" id="w-crm-wh" hint="Endpoint for CRM sync events">
          <Input id="w-crm-wh" value={d.crm_webhook_url} placeholder="https://…" onChange={(e) => set({ crm_webhook_url: e.target.value })} />
        </Field>
      )}
      <Field label="Cal.com Booking Link" id="w-cal" hint="Booking link embedded in AI replies">
        <Input id="w-cal" value={d.calcom_link} placeholder="https://cal.com/…" onChange={(e) => set({ calcom_link: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Slack Webhook URL" id="w-slack-wh">
          <Input id="w-slack-wh" value={d.slack_webhook_url} placeholder="https://hooks.slack.com/…" onChange={(e) => set({ slack_webhook_url: e.target.value })} />
        </Field>
        <Field label="Slack Channel ID" id="w-slack-ch">
          <Input id="w-slack-ch" value={d.slack_channel_id} placeholder="C0XXXXXXX" onChange={(e) => set({ slack_channel_id: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function Step6({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border p-4 bg-muted">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-sm font-semibold">Create Initial Campaign</p>
            <p className="text-xs text-muted-foreground">Set up the first outbound campaign now, or skip and create it from the Campaigns page later.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={d.create_campaign}
            onClick={() => set({ create_campaign: !d.create_campaign })}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              d.create_campaign ? "bg-primary" : "bg-muted"
            )}
          >
            <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", d.create_campaign ? "translate-x-4" : "translate-x-0.5")} />
          </button>
        </div>
      </div>

      {d.create_campaign && (
        <>
          <Field label="Campaign Name *" id="w-camp-name">
            <Input id="w-camp-name" value={d.campaign_name} placeholder="Q1 2026 Outbound" onChange={(e) => set({ campaign_name: e.target.value })} />
          </Field>
          <TextArea label="Campaign Goal / Description" id="w-camp-desc" value={d.campaign_description} onChange={(v) => set({ campaign_description: v })} placeholder="What is this campaign trying to achieve?" rows={2} />
        </>
      )}
    </div>
  );
}

function Step7({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  const levels = [
    { value: 1, label: "Level 1 — Human Review", desc: "Every AI draft reviewed by a human before sending." },
    { value: 2, label: "Level 2 — AI Draft + Human", desc: "AI drafts replies; human approves before sending." },
    { value: 3, label: "Level 3 — AI Auto-Send", desc: "AI sends replies automatically within configured policy limits." },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose the default automation level. This can be changed at any time from the client's AI Settings tab.</p>
      {levels.map((lvl) => (
        <button
          key={lvl.value}
          type="button"
          onClick={() => set({ automation_level: lvl.value })}
          className={cn(
            "w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
            d.automation_level === lvl.value
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          )}
        >
          <div className={cn("mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0", d.automation_level === lvl.value ? "border-primary" : "border-muted-foreground")}>
            {d.automation_level === lvl.value && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
          <div>
            <p className="text-sm font-semibold">{lvl.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{lvl.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function Step8({ d }: { d: WizardData }) {
  const rows: [string, string][] = [
    ["Company", d.company_name],
    ["Slug", d.slug],
    ["Contact", `${d.contact_name} <${d.contact_email}>`],
    ["Timezone", d.timezone],
    ["Tier", d.tier],
    ["Service Type", d.service_type],
    ["MRR", d.mrr_usd ? `$${d.mrr_usd}` : "—"],
    ["CRM", d.crm_type],
    ["Automation Level", `Level ${d.automation_level}`],
    ["Campaign", d.create_campaign ? d.campaign_name || "(unnamed)" : "Skip — create later"],
    ["Inboxes", d.selected_inbox_emails.length > 0 ? d.selected_inbox_emails.join(", ") : "None selected"],
    ["Domains", d.selected_domain_names.length > 0 ? d.selected_domain_names.join(", ") : "None selected"],
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border overflow-hidden">
        {rows.map(([label, value], i) => (
          <div key={label} className={cn("flex items-start gap-4 px-4 py-2.5 text-sm", i % 2 === 0 ? "bg-muted/20" : "")}>
            <span className="w-36 text-muted-foreground flex-shrink-0">{label}</span>
            <span className="font-medium break-all">{value || "—"}</span>
          </div>
        ))}
      </div>
      {d.icp_description && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">ICP Description</p>
          <p className="text-sm">{d.icp_description}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function ClientOnboardingWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function set(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function validate(): string | null {
    if (step === 0) {
      if (!data.company_name.trim()) return "Company name is required";
      if (!data.slug.trim()) return "Slug is required";
      if (!data.contact_name.trim()) return "Contact name is required";
      if (!data.contact_email.trim()) return "Contact email is required";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email)) return "Enter a valid email address";
    }
    if (step === 5 && data.create_campaign && !data.campaign_name.trim()) {
      return "Campaign name is required when creating a campaign";
    }
    return null;
  }

  function next() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function activate() {
    const err = validate();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create client
      const clientPayload: Record<string, any> = {
        company_name: data.company_name,
        slug: data.slug,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        timezone: data.timezone,
        tier: data.tier,
        service_type: data.service_type,
        service_description: data.service_description || null,
        positioning_statement: data.positioning_statement || null,
        sales_lead_name: data.sales_lead_name || null,
        icp_description: data.icp_description || null,
        mrr_usd: data.mrr_usd ? Number(data.mrr_usd) : null,
        setup_fee_usd: data.setup_fee_usd ? Number(data.setup_fee_usd) : null,
        contract_start: data.contract_start || null,
        contract_end: data.contract_end || null,
        crm_type: data.crm_type !== "none" ? data.crm_type : null,
        crm_config: data.crm_webhook_url ? { webhook_url: data.crm_webhook_url } : null,
        calcom_link: data.calcom_link || null,
        slack_webhook_url: data.slack_webhook_url || null,
        slack_channel_id: data.slack_channel_id || null,
        automation_level: data.automation_level,
        config: {
          target_industries: data.target_industries || null,
          target_company_sizes: data.target_company_sizes || null,
          target_seniority: data.target_seniority || null,
          target_geographies: data.target_geographies || null,
        },
      };

      const clientRes = await fetch("/api/dashboard/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload),
      });
      const clientBody = await clientRes.json();
      if (!clientRes.ok) throw new Error(clientBody.error || "Failed to create client");

      const slug = clientBody.client.slug;

      // 2. Assign infrastructure (fire-and-forget, non-blocking)
      if (data.selected_inbox_emails.length > 0 || data.selected_domain_names.length > 0) {
        fetch(`/api/dashboard/clients/${slug}/assign-infrastructure`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inbox_emails: data.selected_inbox_emails,
            domain_names: data.selected_domain_names,
          }),
        }).catch(() => {});
      }

      // 3. Create campaign if requested
      if (data.create_campaign && data.campaign_name.trim()) {
        const campRes = await fetch("/api/dashboard/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.campaign_name,
            client_id: clientBody.client.id,
            sequence_config: data.campaign_description ? { description: data.campaign_description } : undefined,
          }),
        });
        if (!campRes.ok) {
          toast.warning("Client created but campaign creation failed — create it from the Campaigns page.");
        }
      }

      await mutate("/api/dashboard/clients");
      toast.success(`Client "${data.company_name}" activated`);
      onClose();
      router.push(`/dashboard/clients/${slug}`);
    } catch (e: any) {
      setError(e.message || "Activation failed");
    } finally {
      setSubmitting(false);
    }
  }

  const stepComponents = [
    <Step1 key={0} d={data} set={set} />,
    <Step2 key={1} d={data} set={set} />,
    <Step3 key={2} d={data} set={set} />,
    <Step4 key={3} d={data} set={set} />,
    <Step5 key={4} d={data} set={set} />,
    <Step6 key={5} d={data} set={set} />,
    <Step7 key={6} d={data} set={set} />,
    <Step8 key={7} d={data} />,
  ];

  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-card" onClick={!submitting ? onClose : undefined} />

      {/* Wizard panel */}
      <div className="relative z-10 flex w-full max-w-5xl mx-auto my-6 rounded-2xl border border-border bg-white shadow-2xl overflow-hidden">

        {/* Left step list */}
        <div className="w-64 flex-shrink-0 bg-muted border-r border-border flex flex-col">
          <div className="px-5 py-5 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Client</p>
            <h2 className="font-heading text-lg font-bold mt-0.5">Onboarding Wizard</h2>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-0.5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={i > step}
                  onClick={() => { if (i < step) { setError(null); setStep(i); } }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-colors",
                    active ? "bg-primary text-primary-foreground" :
                    done ? "text-foreground hover:bg-muted cursor-pointer" :
                    "text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0",
                    active ? "bg-white/20" : done ? "bg-primary/10" : "bg-muted"
                  )}>
                    {done ? <Check className={cn("h-3 w-3", active ? "text-white" : "text-primary")} /> : <Icon className="h-3 w-3" />}
                  </div>
                  <span className="text-xs font-medium">{s.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="px-4 pb-4">
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-start justify-between px-8 py-6 border-b border-border">
            <div>
              <h3 className="font-heading text-xl font-bold">{STEPS[step].label}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{STEPS[step].description}</p>
            </div>
            <button
              onClick={!submitting ? onClose : undefined}
              className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {stepComponents[step]}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-8 mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Footer navigation */}
          <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-muted">
            <Button variant="ghost" size="sm" onClick={back} disabled={step === 0 || submitting}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {isLast ? (
              <Button size="sm" onClick={activate} disabled={submitting}>
                {submitting ? (
                  "Activating…"
                ) : (
                  <><Check className="h-4 w-4 mr-1" /> Activate Client</>
                )}
              </Button>
            ) : (
              <Button size="sm" onClick={next}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
