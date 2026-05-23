"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface AutomationTabProps {
  client: any;
  editing: boolean;
  draft: any;
  onScalarChange: (key: string, value: any) => void;
  onConfigChange: (path: string[], value: any) => void;
}

function ViewValue({ value }: { value: any }) {
  return (
    <p className="text-sm py-1 min-h-[2rem] border-b border-transparent">
      {value != null ? String(value) : <span className="text-muted-foreground italic">—</span>}
    </p>
  );
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        enabled ? "bg-primary" : "bg-muted"
      } ${disabled ? "opacity-50 cursor-default" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Level 1 — Manual review all",
  2: "Level 2 — Auto-send positives only",
  3: "Level 3 — Fully automated",
};

export function AutomationTab({ client, editing, draft, onScalarChange, onConfigChange }: AutomationTabProps) {
  const d = editing ? draft : client;
  const auto = d.config?.automation_config ?? {};

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="auto-level">Automation Level</Label>
        {editing ? (
          <select
            id="auto-level"
            value={d.automation_level ?? 1}
            onChange={(e) => onScalarChange("automation_level", parseInt(e.target.value))}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value={1}>{LEVEL_DESCRIPTIONS[1]}</option>
            <option value={2}>{LEVEL_DESCRIPTIONS[2]}</option>
            <option value={3}>{LEVEL_DESCRIPTIONS[3]}</option>
          </select>
        ) : (
          <ViewValue value={LEVEL_DESCRIPTIONS[d.automation_level] ?? `Level ${d.automation_level}`} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium">Auto-approve Positive Replies</p>
            <p className="text-xs text-muted-foreground">Skip manual review for positive intent</p>
          </div>
          <Toggle
            enabled={!!auto.auto_approve_positive}
            onChange={(v) => onConfigChange(["automation_config", "auto_approve_positive"], v)}
            disabled={!editing}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium">Auto-suppress Objections</p>
            <p className="text-xs text-muted-foreground">Automatically suppress unsubscribe/objection replies</p>
          </div>
          <Toggle
            enabled={!!auto.auto_suppress_objections}
            onChange={(v) => onConfigChange(["automation_config", "auto_suppress_objections"], v)}
            disabled={!editing}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="auto-escalation">Escalation Email</Label>
          {editing ? (
            <Input
              id="auto-escalation"
              type="email"
              value={auto.escalation_email ?? ""}
              onChange={(e) => onConfigChange(["automation_config", "escalation_email"], e.target.value)}
            />
          ) : <ViewValue value={auto.escalation_email} />}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="auto-sla">SLA Hours</Label>
          {editing ? (
            <Input
              id="auto-sla"
              type="number"
              value={auto.sla_hours ?? ""}
              onChange={(e) => onConfigChange(["automation_config", "sla_hours"], parseInt(e.target.value) || 0)}
            />
          ) : <ViewValue value={auto.sla_hours != null ? `${auto.sla_hours}h` : undefined} />}
        </div>
      </div>
    </div>
  );
}
