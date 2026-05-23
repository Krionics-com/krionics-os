"use client";

import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";

interface IcpTabProps {
  client: any;
  editing: boolean;
  draft: any;
  onScalarChange: (key: string, value: any) => void;
  onConfigChange: (path: string[], value: any) => void;
}

function ViewValue({ value }: { value: any }) {
  return (
    <p className="text-sm py-1 min-h-[2rem] border-b border-transparent">
      {value ?? <span className="text-muted-foreground italic">—</span>}
    </p>
  );
}

function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function IcpTab({ client, editing, draft, onScalarChange, onConfigChange }: IcpTabProps) {
  const d = editing ? draft : client;
  const icp = d.config?.icp_config ?? {};

  return (
    <div className="space-y-5">
      <Field label="ICP Description" id="icp-desc">
        {editing ? (
          <textarea id="icp-desc" rows={3}
            value={d.icp_description ?? ""}
            onChange={(e) => onScalarChange("icp_description", e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm resize-none focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        ) : <ViewValue value={d.icp_description} />}
      </Field>

      <Field label="Positioning Statement" id="icp-positioning">
        {editing ? (
          <textarea id="icp-positioning" rows={3}
            value={d.positioning_statement ?? ""}
            onChange={(e) => onScalarChange("positioning_statement", e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm resize-none focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        ) : <ViewValue value={d.positioning_statement} />}
      </Field>

      <Field label="Service Description" id="icp-service-desc">
        {editing ? (
          <textarea id="icp-service-desc" rows={3}
            value={d.service_description ?? ""}
            onChange={(e) => onScalarChange("service_description", e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm resize-none focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        ) : <ViewValue value={d.service_description} />}
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Target Industries">
          {editing ? (
            <TagInput
              value={icp.industries ?? []}
              onChange={(tags) => onConfigChange(["icp_config", "industries"], tags)}
            />
          ) : <ViewValue value={(icp.industries ?? []).join(", ") || undefined} />}
        </Field>

        <Field label="Target Titles">
          {editing ? (
            <TagInput
              value={icp.titles ?? []}
              onChange={(tags) => onConfigChange(["icp_config", "titles"], tags)}
            />
          ) : <ViewValue value={(icp.titles ?? []).join(", ") || undefined} />}
        </Field>

        <Field label="Company Size" id="icp-co-size">
          {editing ? (
            <input id="icp-co-size"
              value={icp.company_size ?? ""}
              onChange={(e) => onConfigChange(["icp_config", "company_size"], e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:border-ring" />
          ) : <ViewValue value={icp.company_size} />}
        </Field>

        <Field label="Geographies">
          {editing ? (
            <TagInput
              value={icp.geographies ?? []}
              onChange={(tags) => onConfigChange(["icp_config", "geographies"], tags)}
            />
          ) : <ViewValue value={(icp.geographies ?? []).join(", ") || undefined} />}
        </Field>

        <Field label="Exclusions">
          {editing ? (
            <TagInput
              value={icp.exclusions ?? []}
              onChange={(tags) => onConfigChange(["icp_config", "exclusions"], tags)}
            />
          ) : <ViewValue value={(icp.exclusions ?? []).join(", ") || undefined} />}
        </Field>
      </div>
    </div>
  );
}
