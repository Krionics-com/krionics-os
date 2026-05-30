"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import useSWR from "swr";
import {
  X, ChevronLeft, ChevronRight, Check, Building2, Briefcase,
  Target, Server, Plug, Bot, ClipboardCheck, AlertCircle,
  CheckCircle2, Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Types ───────────────────────────────────────────────────────────────────

interface WizardData {
  // Step 1 — Client Basics
  company_name: string;
  slug: string;
  website_url: string;
  industry: string;
  timezone: string;
  service_type: string;
  tier: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_role: string;
  mrr_usd: string;
  setup_fee_usd: string;
  contract_start: string;
  contract_end: string;
  account_executive: string;
  campaign_manager_s1: string;
  customer_success_owner: string;
  // Step 2 — Business Context
  company_description: string;
  service_description: string;
  positioning_statement: string;
  value_proposition: string;
  common_objections: string;
  competitors: string;
  case_studies: string;
  // Step 3 — ICP Setup
  icp_description: string;
  target_industries: string[];
  target_company_sizes: string[];
  target_titles: string;
  target_seniority: string[];
  target_geographies: string[];
  icp_exclusions: string;
  // Step 4 — Infrastructure
  infrastructure_strategy: "existing" | "setup_required";
  primary_domain: string;
  outbound_domains: string[];
  inboxes: string[];
  mail_provider: string;
  access_checklist: {
    dns_access: boolean;
    mailbox_access: boolean;
  };
  setup_checklist: {
    domains_purchased: boolean;
    dns_access: boolean;
    spf_configured: boolean;
    dkim_configured: boolean;
    dmarc_configured: boolean;
    inboxes_created: boolean;
    warmup_started: boolean;
    warmup_complete: boolean;
  };
  tech_contact_name: string;
  tech_contact_email: string;
  tech_contact_role: string;
  notes: string;
  // Step 5 — Integrations
  hubspot_connected: boolean;
  hubspot_portal_id: string;
  hubspot_sync_enabled: boolean;
  calcom_link: string;
  calcom_event_type: string;
  calcom_meeting_duration: string;
  slack_create_channel: boolean;
  // Step 6 — AI Configuration
  automation_level: 1 | 2 | 3;
  ai_tone: string;
  ai_knowledge_base: string;
  forbidden_claims: string;
}

const EMPTY: WizardData = {
  company_name: "", slug: "", website_url: "", industry: "",
  timezone: "America/New_York", service_type: "outbound", tier: "growth",
  contact_name: "", contact_email: "", contact_phone: "", contact_role: "",
  mrr_usd: "", setup_fee_usd: "", contract_start: "", contract_end: "",
  account_executive: "", campaign_manager_s1: "", customer_success_owner: "",
  company_description: "", service_description: "", positioning_statement: "",
  value_proposition: "", common_objections: "", competitors: "", case_studies: "",
  icp_description: "",
  target_industries: [], target_company_sizes: [], target_titles: "",
  target_seniority: [], target_geographies: [], icp_exclusions: "",
  infrastructure_strategy: "existing",
  primary_domain: "",
  outbound_domains: [],
  inboxes: [],
  mail_provider: "Google Workspace",
  access_checklist: {
    dns_access: false,
    mailbox_access: false,
  },
  setup_checklist: {
    domains_purchased: false,
    dns_access: false,
    spf_configured: false,
    dkim_configured: false,
    dmarc_configured: false,
    inboxes_created: false,
    warmup_started: false,
    warmup_complete: false,
  },
  tech_contact_name: "", tech_contact_email: "", tech_contact_role: "",
  notes: "",
  hubspot_connected: false, hubspot_portal_id: "", hubspot_sync_enabled: false,
  calcom_link: "", calcom_event_type: "", calcom_meeting_duration: "",
  slack_create_channel: false,
  automation_level: 2, ai_tone: "professional", ai_knowledge_base: "", forbidden_claims: "",
};

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Sydney", "Pacific/Auckland", "UTC",
];

const INDUSTRIES = [
  "SaaS", "FinTech", "Healthcare", "E-commerce", "Real Estate", "Insurance",
  "Legal", "Consulting", "Marketing Agency", "Recruiting", "EdTech",
  "Manufacturing", "Logistics", "PropTech", "HR Tech", "DevTools", "Other",
];

const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"];

const SENIORITY_LEVELS = ["Owner", "C-Level", "VP", "Director", "Manager", "Individual Contributor"];

const GEOGRAPHIES = ["United States", "Canada", "United Kingdom", "Australia", "Europe", "APAC", "LATAM", "Global"];


const STEPS = [
  { label: "Client Basics",      icon: Building2,      description: "Company identity, contact, and commercial info" },
  { label: "Business Context",   icon: Briefcase,      description: "What they do, why they win, and how they're different" },
  { label: "ICP Setup",          icon: Target,         description: "Ideal customer profile for AI targeting" },
  { label: "Infrastructure",     icon: Server,         description: "Domains, inboxes, and deliverability setup" },
  { label: "Integrations",       icon: Plug,           description: "HubSpot, Cal.com, and Slack connections" },
  { label: "AI Configuration",   icon: Bot,            description: "Automation level, tone, and knowledge base" },
  { label: "Review & Activate",  icon: ClipboardCheck, description: "Confirm all details and activate the client" },
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Shared field primitives ──────────────────────────────────────────────────

function Field({ label, id, children, hint, required }: {
  label: string; id?: string; children: React.ReactNode; hint?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SField({ label, id, value, onChange, options, hint }: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; hint?: string;
}) {
  return (
    <Field label={label} id={id} hint={hint}>
      <select
        id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

function TA({ label, id, value, onChange, placeholder, rows = 3 }: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <Field label={label} id={id}>
      <textarea
        id={id} rows={rows} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </Field>
  );
}

function MultiChip({ label, hint, options, selected, onChange }: {
  label: string; hint?: string;
  options: string[]; selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt} type="button" onClick={() => toggle(opt)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                on ? "border-primary bg-primary text-primary-foreground"
                   : "border-border bg-background text-foreground hover:border-primary/50"
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, desc }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
          checked ? "bg-primary" : "bg-muted")}
      >
        <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border">
      {children}
    </h4>
  );
}

// ─── Step 1: Client Basics ────────────────────────────────────────────────────

function Step1({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Company Information</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Company Name" id="w-co" required>
            <Input id="w-co" value={d.company_name} placeholder="Acme Corp"
              onChange={(e) => {
                const val = e.target.value;
                set({ company_name: val, slug: slugify(val) });
              }} />
          </Field>
          <Field label="URL Slug" id="w-slug" required hint="Unique identifier used in URLs">
            <Input id="w-slug" value={d.slug} placeholder="acme-corp"
              onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
          </Field>
          <Field label="Website URL" id="w-web">
            <Input id="w-web" value={d.website_url} placeholder="https://acme.com"
              onChange={(e) => set({ website_url: e.target.value })} />
          </Field>
          <Field label="Industry" id="w-ind">
            <select id="w-ind" value={d.industry}
              onChange={(e) => set({ industry: e.target.value })}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Select industry…</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <SField label="Timezone" id="w-tz" value={d.timezone} onChange={(v) => set({ timezone: v })}
            options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))} />
          <SField label="Service Type" id="w-svc" value={d.service_type} onChange={(v) => set({ service_type: v })}
            options={[
              { value: "outbound", label: "Outbound" },
              { value: "inbound", label: "Inbound" },
              { value: "hybrid", label: "Hybrid" },
            ]} />
          <SField label="Tier" id="w-tier" value={d.tier} onChange={(v) => set({ tier: v })}
            options={[
              { value: "starter", label: "Starter" },
              { value: "growth", label: "Growth" },
              { value: "enterprise", label: "Enterprise" },
            ]} />
        </div>
      </div>

      <div>
        <SectionTitle>Primary Contact</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Contact Name" id="w-cn" required>
            <Input id="w-cn" value={d.contact_name} placeholder="Jane Doe"
              onChange={(e) => set({ contact_name: e.target.value })} />
          </Field>
          <Field label="Contact Email" id="w-ce" required>
            <Input id="w-ce" type="email" value={d.contact_email} placeholder="jane@acme.com"
              onChange={(e) => set({ contact_email: e.target.value })} />
          </Field>
          <Field label="Contact Phone" id="w-cp">
            <Input id="w-cp" value={d.contact_phone} placeholder="+1 (555) 000-0000"
              onChange={(e) => set({ contact_phone: e.target.value })} />
          </Field>
          <Field label="Contact Role" id="w-cr">
            <Input id="w-cr" value={d.contact_role} placeholder="CEO, VP Sales…"
              onChange={(e) => set({ contact_role: e.target.value })} />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle>Commercial Information</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="MRR (USD)" id="w-mrr">
            <Input id="w-mrr" type="number" min={0} value={d.mrr_usd} placeholder="5000"
              onChange={(e) => set({ mrr_usd: e.target.value })} />
          </Field>
          <Field label="Setup Fee (USD)" id="w-setup">
            <Input id="w-setup" type="number" min={0} value={d.setup_fee_usd} placeholder="2500"
              onChange={(e) => set({ setup_fee_usd: e.target.value })} />
          </Field>
          <Field label="Contract Start" id="w-cs" required>
            <Input id="w-cs" type="date" value={d.contract_start}
              onChange={(e) => set({ contract_start: e.target.value })} />
          </Field>
          <Field label="Contract End" id="w-ce2">
            <Input id="w-ce2" type="date" value={d.contract_end}
              onChange={(e) => set({ contract_end: e.target.value })} />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle>Internal Ownership</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Account Executive" id="w-ae" required>
            <Input id="w-ae" value={d.account_executive} placeholder="AE name or email"
              onChange={(e) => set({ account_executive: e.target.value })} />
          </Field>
          <Field label="Campaign Manager" id="w-cm-s1">
            <Input id="w-cm-s1" value={d.campaign_manager_s1} placeholder="Optional"
              onChange={(e) => set({ campaign_manager_s1: e.target.value })} />
          </Field>
          <Field label="Customer Success Owner" id="w-cso">
            <Input id="w-cso" value={d.customer_success_owner} placeholder="Optional"
              onChange={(e) => set({ customer_success_owner: e.target.value })} />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Business Context ─────────────────────────────────────────────────

function Step2({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-5">
      <TA label="What does the company do?" id="w-co-desc" value={d.company_description}
        onChange={(v) => set({ company_description: v })}
        placeholder="Describe the company's core business and what they offer…" rows={3} />
      <TA label="What service are we helping them sell?" id="w-svc-desc" value={d.service_description}
        onChange={(v) => set({ service_description: v })}
        placeholder="e.g. AI-powered accounting services for startups" rows={2} />
      <TA label="What makes them different?" id="w-pos" value={d.positioning_statement}
        onChange={(v) => set({ positioning_statement: v })}
        placeholder="Positioning statement — what sets them apart in the market" rows={2} />
      <TA label="Why do customers buy?" id="w-vp" value={d.value_proposition}
        onChange={(v) => set({ value_proposition: v })}
        placeholder="Core value proposition — the primary outcome customers get" rows={2} />
      <TA label="Common Objections" id="w-obj" value={d.common_objections}
        onChange={(v) => set({ common_objections: v })}
        placeholder={"Too expensive\nAlready have SDRs\nNot a priority right now"} rows={3} />
      <TA label="Competitors" id="w-comp" value={d.competitors}
        onChange={(v) => set({ competitors: v })}
        placeholder={"Competitor A\nCompetitor B\nCompetitor C"} rows={3} />
      <TA label="Success Stories / Case Studies" id="w-cs" value={d.case_studies}
        onChange={(v) => set({ case_studies: v })}
        placeholder="Key wins, metrics, customer quotes — used by AI in replies" rows={3} />
    </div>
  );
}

// ─── Step 3: ICP Setup ────────────────────────────────────────────────────────

function Step3({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-5">
      <TA label="ICP Description" id="w-icp" value={d.icp_description}
        onChange={(v) => set({ icp_description: v })}
        placeholder="Describe the ideal customer profile in detail. Who are you targeting and why?" rows={4} />
      <MultiChip label="Target Industries" options={INDUSTRIES}
        selected={d.target_industries} onChange={(v) => set({ target_industries: v })} />
      <MultiChip label="Company Size" options={COMPANY_SIZES}
        selected={d.target_company_sizes} onChange={(v) => set({ target_company_sizes: v })} />
      <Field label="Target Titles" id="w-titles" hint="Comma-separated, e.g. Founder, CEO, VP Sales, Head of Growth">
        <Input id="w-titles" value={d.target_titles} placeholder="Founder, CEO, VP Sales"
          onChange={(e) => set({ target_titles: e.target.value })} />
      </Field>
      <MultiChip label="Target Seniority" options={SENIORITY_LEVELS}
        selected={d.target_seniority} onChange={(v) => set({ target_seniority: v })} />
      <MultiChip label="Target Geographies" options={GEOGRAPHIES}
        selected={d.target_geographies} onChange={(v) => set({ target_geographies: v })} />
      <TA label="Exclusions" id="w-excl" value={d.icp_exclusions}
        onChange={(v) => set({ icp_exclusions: v })}
        placeholder={"Agencies\nRecruiters\nStudents"} rows={3} />
    </div>
  );
}

// ─── Step 4: Infrastructure ───────────────────────────────────────────────────

// ─── Dynamic List Input ──────────────────────────────────────────────────────

import { Plus } from "lucide-react";

interface DynamicListInputProps {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}

function DynamicListInput({ label, placeholder, values, onChange, hint }: DynamicListInputProps) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      toast.error("Already added");
      return;
    }
    onChange([...values, trimmed]);
    setInput("");
  }

  function remove(val: string) {
    onChange(values.filter((v) => v !== val));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1"
        />
        <Button type="button" size="sm" onClick={add} variant="outline" className="px-3">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-muted/20 min-h-[40px] mt-2">
          {values.map((v) => (
            <div
              key={v}
              className="inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground text-xs font-mono font-medium px-2.5 py-1 rounded-full border border-border group"
            >
              <span>{v}</span>
              <button
                type="button"
                onClick={() => remove(v)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Infrastructure ───────────────────────────────────────────────────

const INFRA_SETUP_ITEMS: { key: keyof WizardData["setup_checklist"]; label: string }[] = [
  { key: "domains_purchased", label: "Domains Purchased" },
  { key: "dns_access", label: "DNS Access Granted" },
  { key: "spf_configured", label: "SPF Configured" },
  { key: "dkim_configured", label: "DKIM Configured" },
  { key: "dmarc_configured", label: "DMARC Configured" },
  { key: "inboxes_created", label: "Inboxes Created" },
  { key: "warmup_started", label: "Warmup Started" },
  { key: "warmup_complete", label: "Warmup Complete" },
];

function Step4({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  function toggleAccessChecklist(key: "dns_access" | "mailbox_access") {
    set({
      access_checklist: {
        ...d.access_checklist,
        [key]: !d.access_checklist[key],
      },
    });
  }

  function toggleSetupChecklist(key: keyof WizardData["setup_checklist"]) {
    set({
      setup_checklist: {
        ...d.setup_checklist,
        [key]: !d.setup_checklist[key],
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Strategy selector */}
      <div>
        <SectionTitle>Infrastructure Strategy</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {(["existing", "setup_required"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => set({ infrastructure_strategy: opt })}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors cursor-pointer",
                d.infrastructure_strategy === opt
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  d.infrastructure_strategy === opt ? "border-primary" : "border-muted-foreground"
                )}
              >
                {d.infrastructure_strategy === opt && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {opt === "existing"
                    ? "Client Has Existing Infrastructure"
                    : "Infrastructure Needs Setup"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {opt === "existing"
                    ? "Client already has outbound domains, inboxes, and mail provider setup"
                    : "Client does not have infrastructure yet — track setup progress"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {d.infrastructure_strategy === "existing" ? (
        <div className="space-y-4">
          {/* Primary Domain */}
          <Field label="Primary Domain" id="w-prim-dom" required hint="Example: acme.com">
            <Input
              id="w-prim-dom"
              value={d.primary_domain}
              placeholder="acme.com"
              onChange={(e) => set({ primary_domain: e.target.value })}
            />
          </Field>

          {/* Outbound Domains */}
          <DynamicListInput
            label="Outbound Domains"
            placeholder="getacme.com (type and press Enter or Add)"
            values={d.outbound_domains}
            onChange={(next) => set({ outbound_domains: next })}
            hint="Outbound domains owned by the client (e.g. getacme.com, joinacme.com)"
          />

          {/* Existing Inboxes */}
          <DynamicListInput
            label="Existing Inboxes"
            placeholder="john@getacme.com (type and press Enter or Add)"
            values={d.inboxes}
            onChange={(next) => set({ inboxes: next })}
            hint="Outbound sending mailboxes already set up by the client"
          />

          {/* Mail Provider */}
          <Field label="Mail Provider" id="w-mail-prov">
            <select
              id="w-mail-prov"
              value={d.mail_provider}
              onChange={(e) => set({ mail_provider: e.target.value })}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="Google Workspace">Google Workspace</option>
              <option value="Microsoft 365">Microsoft 365</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          {/* Access Checklist */}
          <div>
            <SectionTitle>Access Checklist</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
              {(["dns_access", "mailbox_access"] as const).map((key) => {
                const checked = d.access_checklist[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAccessChecklist(key)}
                    className="flex items-center gap-3 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-left hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div
                      className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        checked ? "border-primary bg-primary" : "border-muted-foreground"
                      )}
                    >
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span>{key === "dns_access" ? "DNS Access Granted" : "Mailbox Access Granted"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Setup Progress Checklist */}
          <div>
            <SectionTitle>Setup Progress Checklist</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
              {INFRA_SETUP_ITEMS.map(({ key, label }) => {
                const checked = d.setup_checklist[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSetupChecklist(key)}
                    className="flex items-center gap-3 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-left hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div
                      className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        checked ? "border-primary bg-primary" : "border-muted-foreground"
                      )}
                    >
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className={checked ? "line-through text-muted-foreground" : ""}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Planned Outbound Domains */}
          <DynamicListInput
            label="Planned Outbound Domains"
            placeholder="getacme.com (type and press Enter or Add)"
            values={d.outbound_domains}
            onChange={(next) => set({ outbound_domains: next })}
            hint="Outbound domains planned for purchase/provisioning"
          />

          {/* Planned Inboxes */}
          <DynamicListInput
            label="Planned Inboxes"
            placeholder="john@getacme.com (type and press Enter or Add)"
            values={d.inboxes}
            onChange={(next) => set({ inboxes: next })}
            hint="Outbound sending mailboxes planned for setup"
          />

          {/* Notes */}
          <div>
            <Field label="Notes" id="w-infra-notes" hint="Coordination notes for onboarding and provisioning">
              <textarea
                id="w-infra-notes"
                rows={4}
                value={d.notes}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Enter any notes regarding domains purchase, DNS hosting, IT contacts, etc..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
          </div>
        </div>
      )}

      {/* Technical Contact */}
      <div>
        <SectionTitle>Technical Contact</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Field label="Name" id="w-tc-name">
            <Input
              id="w-tc-name"
              value={d.tech_contact_name}
              placeholder="John Smith"
              onChange={(e) => set({ tech_contact_name: e.target.value })}
            />
          </Field>
          <Field label="Email" id="w-tc-email">
            <Input
              id="w-tc-email"
              type="email"
              value={d.tech_contact_email}
              placeholder="john@acme.com"
              onChange={(e) => set({ tech_contact_email: e.target.value })}
            />
          </Field>
          <Field label="Role" id="w-tc-role">
            <Input
              id="w-tc-role"
              value={d.tech_contact_role}
              placeholder="IT Manager, CTO…"
              onChange={(e) => set({ tech_contact_role: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Integrations ─────────────────────────────────────────────────────

function Step5({ d, set, slug }: { d: WizardData; set: (p: Partial<WizardData>) => void; slug: string }) {
  return (
    <div className="space-y-6">
      {/* HubSpot */}
      <div>
        <SectionTitle>HubSpot</SectionTitle>
        <div className="space-y-3 mt-4">
          <Toggle checked={d.hubspot_connected} onChange={(v) => set({ hubspot_connected: v })}
            label="HubSpot Connected" desc="Enable HubSpot CRM sync for this client" />
          {d.hubspot_connected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
              <Field label="Portal ID" id="w-hs-portal" hint="Found in HubSpot Settings → Account Setup">
                <Input id="w-hs-portal" value={d.hubspot_portal_id} placeholder="12345678"
                  onChange={(e) => set({ hubspot_portal_id: e.target.value })} />
              </Field>
              <div className="flex items-end pb-0.5">
                <Toggle checked={d.hubspot_sync_enabled} onChange={(v) => set({ hubspot_sync_enabled: v })}
                  label="Sync Enabled" desc="Push converted leads to HubSpot" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cal.com */}
      <div>
        <SectionTitle>Cal.com</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Booking URL" id="w-cal" hint="Embedded in AI replies for meeting booking">
            <Input id="w-cal" value={d.calcom_link} placeholder="https://cal.com/…"
              onChange={(e) => set({ calcom_link: e.target.value })} />
          </Field>
          <Field label="Event Type" id="w-cal-ev">
            <Input id="w-cal-ev" value={d.calcom_event_type} placeholder="30min-discovery"
              onChange={(e) => set({ calcom_event_type: e.target.value })} />
          </Field>
          <Field label="Meeting Duration (minutes)" id="w-cal-dur">
            <Input id="w-cal-dur" type="number" min={15} step={15} value={d.calcom_meeting_duration}
              placeholder="30"
              onChange={(e) => set({ calcom_meeting_duration: e.target.value })} />
          </Field>
        </div>
      </div>

      {/* Slack */}
      <div>
        <SectionTitle>Slack</SectionTitle>
        <div className="space-y-3 mt-4">
          <Toggle checked={d.slack_create_channel} onChange={(v) => set({ slack_create_channel: v })}
            label="Create Client Slack Channel"
            desc={`System will create #client-${slug || "…"} automatically on activation`} />
        </div>
      </div>
    </div>
  );
}

// ─── Step 6: AI Configuration ─────────────────────────────────────────────────

function Step6({ d, set }: { d: WizardData; set: (p: Partial<WizardData>) => void }) {
  const levels = [
    { value: 1 as const, label: "Level 1 — Human Sends Everything", desc: "AI drafts nothing. Operators write and send all outreach manually." },
    { value: 2 as const, label: "Level 2 — AI Draft, Human Approves", desc: "AI generates drafts for every reply. Humans review and approve before sending." },
    { value: 3 as const, label: "Level 3 — AI Auto-Send", desc: "AI sends replies automatically within configured policy limits. Human review optional." },
  ];

  const tones = ["Professional", "Friendly", "Founder-led", "Enterprise", "Direct", "Conversational"];

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Automation Level</SectionTitle>
        <div className="space-y-3 mt-4">
          {levels.map((lvl) => (
            <button key={lvl.value} type="button" onClick={() => set({ automation_level: lvl.value })}
              className={cn("w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                d.automation_level === lvl.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
              <div className={cn("mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                d.automation_level === lvl.value ? "border-primary" : "border-muted-foreground")}>
                {d.automation_level === lvl.value && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-semibold">{lvl.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{lvl.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>AI Tone</SectionTitle>
        <div className="flex flex-wrap gap-2 mt-4">
          {tones.map((tone) => {
            const on = d.ai_tone === tone.toLowerCase();
            return (
              <button key={tone} type="button" onClick={() => set({ ai_tone: tone.toLowerCase() })}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground"
                     : "border-border bg-background text-foreground hover:border-primary/50")}>
                {tone}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionTitle>AI Knowledge Base</SectionTitle>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          Everything the AI should know about this client. Use this for product details,
          FAQs, talking points, and anything that should inform AI-generated replies.
        </p>
        <TA label="" id="w-kb" value={d.ai_knowledge_base}
          onChange={(v) => set({ ai_knowledge_base: v })}
          placeholder="Enter product details, FAQs, common scenarios, objection handling scripts…"
          rows={8} />
      </div>

      <TA label="Forbidden Claims" id="w-fc" value={d.forbidden_claims}
        onChange={(v) => set({ forbidden_claims: v })}
        placeholder={"Do not mention pricing.\nDo not promise ROI.\nDo not reference competitor names."} rows={4} />
    </div>
  );
}

// ─── Step 7: Review & Activate ───────────────────────────────────────────────

function Step7({ d }: { d: WizardData }) {
  const checks: { label: string; ok: boolean; optional?: boolean }[] = [
    { label: "Company Details", ok: !!(d.company_name && d.contact_email && d.contact_name && d.contract_start) },
    { label: "Business Context", ok: !!(d.service_description || d.company_description), optional: true },
    { label: "ICP", ok: !!(d.icp_description || d.target_industries.length > 0), optional: true },
    { label: "Infrastructure", ok: d.infrastructure_strategy === "existing"
        ? !!d.primary_domain
        : d.outbound_domains.length > 0 || d.inboxes.length > 0, optional: true },
    { label: "HubSpot", ok: d.hubspot_connected, optional: true },
    { label: "Cal.com", ok: !!d.calcom_link, optional: true },
  ];

  const summaryRows: [string, string][] = [
    ["Company", d.company_name],
    ["Website", d.website_url || "—"],
    ["Industry", d.industry || "—"],
    ["Service Type", d.service_type],
    ["Tier", d.tier],
    ["Contact", `${d.contact_name} <${d.contact_email}>`],
    ["Contract Start", d.contract_start || "—"],
    ["MRR", d.mrr_usd ? `$${Number(d.mrr_usd).toLocaleString()}` : "—"],
    ["Automation", `Level ${d.automation_level}`],
    ["AI Tone", d.ai_tone],
    ["Infrastructure", d.infrastructure_strategy === "existing"
      ? `Existing (${d.primary_domain || "no primary domain"}), ${d.inboxes.length} inbox(es), ${d.outbound_domains.length} domain(s)`
      : `Needs Setup: ${d.inboxes.length} planned inbox(es), ${d.outbound_domains.length} planned domain(s)`],
    ["HubSpot", d.hubspot_connected ? `Connected (${d.hubspot_portal_id || "no portal ID"})` : "Not connected"],
    ["Cal.com", d.calcom_link || "—"],
    ["Slack Channel", d.slack_create_channel ? `#client-${d.slug}` : "Not creating"],
    ["Account Executive", d.account_executive || "—"],
  ];

  const requiredOk = checks.filter((c) => !c.optional).every((c) => c.ok);

  return (
    <div className="space-y-6">
      {/* Validation checks */}
      <div>
        <SectionTitle>Validation Checks</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {checks.map(({ label, ok, optional }) => (
            <div key={label} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              ok ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                 : optional ? "border-border bg-muted/30 text-muted-foreground"
                            : "border-destructive/30 bg-destructive/5 text-destructive")}>
              {ok
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                : <Circle className="h-4 w-4 flex-shrink-0" />}
              <span>{label}</span>
              {optional && !ok && <span className="ml-auto text-xs opacity-60">optional</span>}
            </div>
          ))}
        </div>
        {!requiredOk && (
          <p className="text-xs text-destructive mt-2">Company Details must be complete to activate.</p>
        )}
      </div>

      {/* Summary table */}
      <div>
        <SectionTitle>Client Summary</SectionTitle>
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          {summaryRows.map(([label, value], i) => (
            <div key={label} className={cn("flex items-start gap-4 px-4 py-2.5 text-sm",
              i % 2 === 0 ? "bg-muted/30" : "")}>
              <span className="w-36 text-muted-foreground flex-shrink-0 text-xs">{label}</span>
              <span className="font-medium break-all text-xs">{value || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {d.icp_description && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">ICP Description</p>
          <p className="text-sm">{d.icp_description}</p>
        </div>
      )}

      {d.ai_knowledge_base && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">AI Knowledge Base</p>
          <p className="text-sm whitespace-pre-wrap line-clamp-6">{d.ai_knowledge_base}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

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
      if (!data.contract_start) return "Contract start date is required";
      if (!data.account_executive.trim()) return "Account executive is required";
    }
    if (step === 3) {
      if (data.infrastructure_strategy === "existing") {
        if (!data.primary_domain.trim()) return "Primary domain is required for existing infrastructure strategy";
      }
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
    if (!data.company_name || !data.contact_email || !data.contact_name) {
      setError("Company name, contact name, and contact email are required");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      // Build config JSONB payload (ICP targets, team, misc)
      const configPayload = {
        // ICP
        target_industries: data.target_industries.length > 0 ? data.target_industries : null,
        target_company_sizes: data.target_company_sizes.length > 0 ? data.target_company_sizes : null,
        target_titles: data.target_titles || null,
        target_seniority: data.target_seniority.length > 0 ? data.target_seniority : null,
        target_geographies: data.target_geographies.length > 0 ? data.target_geographies : null,
        icp_exclusions: data.icp_exclusions || null,
        // Business context extras
        common_objections: data.common_objections || null,
        competitors: data.competitors || null,
        case_studies: data.case_studies || null,
        // Integrations
        calcom_event_type: data.calcom_event_type || null,
        calcom_meeting_duration: data.calcom_meeting_duration ? Number(data.calcom_meeting_duration) : null,
        slack_channel_name: data.slack_create_channel ? `client-${data.slug}` : null,
      };

      // Derive crm_config from HubSpot data
      const crm_config = data.hubspot_connected && data.hubspot_portal_id
        ? { portal_id: data.hubspot_portal_id, sync_enabled: data.hubspot_sync_enabled }
        : null;

      const clientPayload = {
        company_name: data.company_name,
        slug: data.slug,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone || null,
        contact_role: data.contact_role || null,
        timezone: data.timezone,
        website_url: data.website_url || null,
        industry: data.industry || null,
        service_type: data.service_type,
        tier: data.tier,
        mrr_usd: data.mrr_usd ? Number(data.mrr_usd) : null,
        setup_fee_usd: data.setup_fee_usd ? Number(data.setup_fee_usd) : null,
        contract_start: data.contract_start || null,
        contract_end: data.contract_end || null,
        sales_lead_name: data.account_executive || null,
        company_description: data.company_description || null,
        service_description: data.service_description || null,
        positioning_statement: data.positioning_statement || null,
        value_proposition: data.value_proposition || null,
        icp_description: data.icp_description || null,
        crm_type: data.hubspot_connected ? "hubspot" : null,
        crm_config,
        calcom_link: data.calcom_link || null,
        slack_webhook_url: null,
        slack_channel_id: data.slack_create_channel ? `client-${data.slug}` : null,
        automation_level: data.automation_level,
        ai_tone: data.ai_tone,
        ai_knowledge_base: data.ai_knowledge_base || null,
        forbidden_claims: data.forbidden_claims || null,
        // Infrastructure (New columns mapped directly to API payload)
        infrastructure_strategy: data.infrastructure_strategy,
        primary_domain: data.infrastructure_strategy === "existing" ? data.primary_domain || null : null,
        outbound_domains: data.outbound_domains,
        inboxes: data.inboxes,
        mail_provider: data.infrastructure_strategy === "existing" ? data.mail_provider : null,
        technical_contact: (data.tech_contact_name || data.tech_contact_email) ? {
          name: data.tech_contact_name,
          email: data.tech_contact_email,
          role: data.tech_contact_role,
        } : {},
        access_checklist: data.infrastructure_strategy === "existing" ? data.access_checklist : {},
        setup_checklist: data.infrastructure_strategy === "setup_required" ? data.setup_checklist : {},
        notes: data.infrastructure_strategy === "setup_required" ? data.notes || null : null,
        config: configPayload,
      };

      const clientRes = await fetch("/api/dashboard/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload),
      });
      const clientBody = await clientRes.json();
      if (!clientRes.ok) throw new Error(clientBody.error || "Failed to create client");

      const slug = clientBody.client.slug;

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
    <Step5 key={4} d={data} set={set} slug={data.slug} />,
    <Step6 key={5} d={data} set={set} />,
    <Step7 key={6} d={data} />,
  ];

  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black" onClick={!submitting ? onClose : undefined} />

      {/* Wizard panel */}
      <div className="relative z-10 flex w-full max-w-5xl mx-auto my-6 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* Left step list */}
        <div className="w-64 flex-shrink-0 bg-muted border-r border-border flex flex-col">
          <div className="px-5 py-5 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Client</p>
            <h2 className="font-heading text-lg font-bold mt-0.5">Onboarding Wizard</h2>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <button key={i} type="button" disabled={i > step}
                  onClick={() => { if (i < step) { setError(null); setStep(i); } }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-colors",
                    active ? "bg-primary text-primary-foreground" :
                    done ? "text-foreground hover:bg-muted-foreground/10 cursor-pointer" :
                    "text-muted-foreground cursor-not-allowed"
                  )}>
                  <div className={cn("h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0",
                    active ? "bg-white/20" : done ? "bg-primary/10" : "bg-border")}>
                    {done
                      ? <Check className={cn("h-3 w-3", active ? "text-white" : "text-primary")} />
                      : <Icon className="h-3 w-3" />}
                  </div>
                  <span className="text-xs font-medium">{s.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="px-4 pb-4">
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-h-0 bg-card">
          {/* Header */}
          <div className="flex items-start justify-between px-8 py-6 border-b border-border">
            <div>
              <h3 className="font-heading text-xl font-bold">{STEPS[step].label}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{STEPS[step].description}</p>
            </div>
            <button onClick={!submitting ? onClose : undefined}
              className="text-muted-foreground hover:text-foreground transition-colors mt-0.5" aria-label="Close">
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

          {/* Footer */}
          <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-muted">
            <Button variant="ghost" size="sm" onClick={back} disabled={step === 0 || submitting}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {isLast ? (
              <Button size="sm" onClick={activate} disabled={submitting}>
                {submitting ? "Activating…" : <><Check className="h-4 w-4 mr-1" /> Activate Client</>}
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
