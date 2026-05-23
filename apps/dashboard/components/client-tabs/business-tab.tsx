"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Sydney", "Pacific/Auckland",
];

const SERVICE_TYPES = [
  "cold_outbound", "warm_outbound", "inbound", "hybrid", "reactivation",
];

interface BusinessTabProps {
  client: any;
  editing: boolean;
  draft: any;
  onChange: (key: string, value: any) => void;
}

function Field({
  label, id, children,
}: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ViewValue({ value }: { value: any }) {
  return (
    <p className="text-sm py-1 min-h-[2rem] border-b border-transparent">
      {value ?? <span className="text-muted-foreground italic">—</span>}
    </p>
  );
}

export function BusinessTab({ client, editing, draft, onChange }: BusinessTabProps) {
  const d = editing ? draft : client;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Company Name" id="bi-company-name">
        {editing ? (
          <Input id="bi-company-name" value={d.company_name ?? ""} onChange={(e) => onChange("company_name", e.target.value)} />
        ) : <ViewValue value={d.company_name} />}
      </Field>

      <Field label="Contact Name" id="bi-contact-name">
        {editing ? (
          <Input id="bi-contact-name" value={d.contact_name ?? ""} onChange={(e) => onChange("contact_name", e.target.value)} />
        ) : <ViewValue value={d.contact_name} />}
      </Field>

      <Field label="Contact Email" id="bi-contact-email">
        {editing ? (
          <Input id="bi-contact-email" type="email" value={d.contact_email ?? ""} onChange={(e) => onChange("contact_email", e.target.value)} />
        ) : <ViewValue value={d.contact_email} />}
      </Field>

      <Field label="Timezone" id="bi-timezone">
        {editing ? (
          <select id="bi-timezone" value={d.timezone ?? "America/New_York"} onChange={(e) => onChange("timezone", e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        ) : <ViewValue value={d.timezone} />}
      </Field>

      <Field label="Service Type" id="bi-service-type">
        {editing ? (
          <select id="bi-service-type" value={d.service_type ?? ""} onChange={(e) => onChange("service_type", e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
            {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        ) : <ViewValue value={(d.service_type ?? "").replace(/_/g, " ")} />}
      </Field>

      <Field label="Tier" id="bi-tier">
        {editing ? (
          <Input id="bi-tier" value={d.tier ?? ""} onChange={(e) => onChange("tier", e.target.value)} />
        ) : <ViewValue value={d.tier} />}
      </Field>

      <Field label="MRR (USD)" id="bi-mrr">
        {editing ? (
          <Input id="bi-mrr" type="number" value={d.mrr_usd ?? 0} onChange={(e) => onChange("mrr_usd", parseInt(e.target.value) || 0)} />
        ) : <ViewValue value={d.mrr_usd != null ? `$${Number(d.mrr_usd).toLocaleString()}` : undefined} />}
      </Field>

      <Field label="Setup Fee (USD)" id="bi-setup-fee">
        {editing ? (
          <Input id="bi-setup-fee" type="number" value={d.setup_fee_usd ?? 0} onChange={(e) => onChange("setup_fee_usd", parseInt(e.target.value) || 0)} />
        ) : <ViewValue value={d.setup_fee_usd != null ? `$${Number(d.setup_fee_usd).toLocaleString()}` : undefined} />}
      </Field>

      <Field label="Contract Start" id="bi-contract-start">
        {editing ? (
          <Input id="bi-contract-start" type="date" value={d.contract_start?.slice(0, 10) ?? ""} onChange={(e) => onChange("contract_start", e.target.value)} />
        ) : <ViewValue value={d.contract_start?.slice(0, 10)} />}
      </Field>

      <Field label="Contract End" id="bi-contract-end">
        {editing ? (
          <Input id="bi-contract-end" type="date" value={d.contract_end?.slice(0, 10) ?? ""} onChange={(e) => onChange("contract_end", e.target.value)} />
        ) : <ViewValue value={d.contract_end?.slice(0, 10)} />}
      </Field>

      <Field label="Calendly Link" id="bi-calendly">
        {editing ? (
          <Input id="bi-calendly" type="url" value={d.calendly_link ?? ""} onChange={(e) => onChange("calendly_link", e.target.value)} />
        ) : d.calendly_link
            ? <a href={d.calendly_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{d.calendly_link}</a>
            : <ViewValue value={undefined} />}
      </Field>

      <Field label="Sales Lead Name" id="bi-sales-lead">
        {editing ? (
          <Input id="bi-sales-lead" value={d.sales_lead_name ?? ""} onChange={(e) => onChange("sales_lead_name", e.target.value)} />
        ) : <ViewValue value={d.sales_lead_name} />}
      </Field>
    </div>
  );
}
