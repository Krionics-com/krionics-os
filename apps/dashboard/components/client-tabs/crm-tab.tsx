"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

interface CrmTabProps {
  client: any;
  editing: boolean;
  draft: any;
  onScalarChange: (key: string, value: any) => void;
  onCrmConfigChange: (key: string, value: any) => void;
}

function ViewValue({ value }: { value: any }) {
  return (
    <p className="text-sm py-1 min-h-[2rem] border-b border-transparent">
      {value ?? <span className="text-muted-foreground italic">—</span>}
    </p>
  );
}

const CRM_TYPES = [
  { label: "None", value: "none" },
  { label: "HubSpot", value: "hubspot" },
  { label: "Pipedrive", value: "pipedrive" },
  { label: "Salesforce", value: "salesforce" },
  { label: "GHL", value: "ghl" },
];

export function CrmTab({ client, editing, draft, onScalarChange, onCrmConfigChange }: CrmTabProps) {
  const [showKey, setShowKey] = useState(false);
  const d = editing ? draft : client;
  const crm = d.crm_config ?? {};

  const isConnected = d.crm_type && d.crm_type !== "none" && crm.api_key;

  return (
    <div className="space-y-5">
      {/* Connection status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
        isConnected ? "border-green-200 bg-green-50 text-green-700" : "border-border bg-muted/30 text-muted-foreground"
      }`}>
        <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-muted-foreground"}`} />
        <span className="text-sm font-medium">
          {isConnected ? "Connected" : "Not configured"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="crm-type">CRM Type</Label>
          {editing ? (
            <select
              id="crm-type"
              value={d.crm_type ?? "none"}
              onChange={(e) => onScalarChange("crm_type", e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {CRM_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          ) : <ViewValue value={CRM_TYPES.find((c) => c.value === d.crm_type)?.label ?? d.crm_type} />}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="crm-portal">Portal ID / Workspace</Label>
          {editing ? (
            <Input
              id="crm-portal"
              value={crm.portal_id ?? ""}
              onChange={(e) => onCrmConfigChange("portal_id", e.target.value)}
            />
          ) : <ViewValue value={crm.portal_id} />}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="crm-api-key">API Key</Label>
        {editing ? (
          <div className="relative">
            <Input
              id="crm-api-key"
              type={showKey ? "text" : "password"}
              value={crm.api_key ?? ""}
              onChange={(e) => onCrmConfigChange("api_key", e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <ViewValue value={crm.api_key ? "••••••••••••" : undefined} />
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="crm-field-mappings">Field Mappings (JSON)</Label>
        {editing ? (
          <textarea
            id="crm-field-mappings"
            rows={6}
            value={crm.field_mappings ? JSON.stringify(crm.field_mappings, null, 2) : ""}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onCrmConfigChange("field_mappings", parsed);
              } catch {
                // Allow intermediate invalid JSON while typing
              }
            }}
            placeholder="{}"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-xs font-mono resize-y focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-x-auto max-h-48">
            {crm.field_mappings ? JSON.stringify(crm.field_mappings, null, 2) : "—"}
          </pre>
        )}
      </div>
    </div>
  );
}
