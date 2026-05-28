"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const INTENTS = ["POSITIVE", "BOOKING_INTENT", "OBJECTION", "FAQ", "NURTURE", "UNSUBSCRIBE", "NOT_RELEVANT", "BOUNCE_OOO", "HOSTILE", "UNKNOWN"];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore",
  "Australia/Sydney", "UTC",
];

interface RuleRowEdit {
  intent: string;
  delay_min_minutes: number;
  delay_max_minutes: number;
  enforce_business_hours: boolean;
  business_hours_start: string;
  business_hours_end: string;
  timezone: string;
  send_in_prospect_timezone: boolean;
}

const EMPTY_EDIT: RuleRowEdit = {
  intent: "POSITIVE",
  delay_min_minutes: 15,
  delay_max_minutes: 60,
  enforce_business_hours: true,
  business_hours_start: "07:00",
  business_hours_end: "22:00",
  timezone: "America/New_York",
  send_in_prospect_timezone: true,
};

function fmtDelay(min: number, max: number): string {
  if (min === 0 && max === 0) return "Instant";
  const fmtMin = min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}m` : ""}`;
  const fmtMax = max < 60 ? `${max}m` : `${Math.floor(max / 60)}h${max % 60 > 0 ? ` ${max % 60}m` : ""}`;
  return `${fmtMin} – ${fmtMax}`;
}

export function TimingRulesTab({ clientSlug, isAdmin }: { clientSlug: string; isAdmin: boolean }) {
  const { data, isLoading, mutate } = useSWR(
    `/api/dashboard/clients/${clientSlug}/timing-rules`,
    fetcher
  );
  const [editingIntent, setEditingIntent] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<RuleRowEdit>(EMPTY_EDIT);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDraft, setNewDraft] = useState<RuleRowEdit>(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);

  const rules: any[] = data?.rules ?? [];
  const usedIntents = new Set(rules.map((r: any) => r.intent));
  const availableIntents = INTENTS.filter((i) => !usedIntents.has(i));

  function startEdit(rule: any) {
    setEditingIntent(rule.intent);
    setEditDraft({
      intent: rule.intent,
      delay_min_minutes: rule.delay_min_minutes,
      delay_max_minutes: rule.delay_max_minutes,
      enforce_business_hours: rule.enforce_business_hours,
      business_hours_start: rule.business_hours_start?.slice(0, 5) ?? "07:00",
      business_hours_end: rule.business_hours_end?.slice(0, 5) ?? "22:00",
      timezone: rule.timezone ?? "America/New_York",
      send_in_prospect_timezone: rule.send_in_prospect_timezone ?? true,
    });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${clientSlug}/timing-rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editDraft,
          delay_min_minutes: Number(editDraft.delay_min_minutes),
          delay_max_minutes: Number(editDraft.delay_max_minutes),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      setEditingIntent(null);
      toast.success("Timing rule updated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveNew() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${clientSlug}/timing-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newDraft,
          delay_min_minutes: Number(newDraft.delay_min_minutes),
          delay_max_minutes: Number(newDraft.delay_max_minutes),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      setShowNewForm(false);
      setNewDraft(EMPTY_EDIT);
      toast.success("Timing rule created");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(intent: string) {
    if (!confirm(`Delete timing rule for intent "${intent}"?`)) return;
    try {
      const res = await fetch(`/api/dashboard/clients/${clientSlug}/timing-rules?intent=${encodeURIComponent(intent)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      toast.success("Timing rule deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    }
  }

  if (isLoading) return <div className="animate-pulse h-40 rounded-md bg-muted" />;

  function RuleForm({ draft, onChange, intentsAvailable }: { draft: RuleRowEdit; onChange: (d: RuleRowEdit) => void; intentsAvailable: string[] }) {
    return (
      <div className="grid gap-3 p-4 rounded-lg border border-border bg-muted/30">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Intent</label>
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={draft.intent}
              onChange={(e) => onChange({ ...draft, intent: e.target.value })}
            >
              {intentsAvailable.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Min Delay (min)</label>
            <input
              type="number" min={0} step={5}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={draft.delay_min_minutes}
              onChange={(e) => onChange({ ...draft, delay_min_minutes: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Max Delay (min)</label>
            <input
              type="number" min={0} step={5}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={draft.delay_max_minutes}
              onChange={(e) => onChange({ ...draft, delay_max_minutes: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Timezone</label>
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={draft.timezone}
              onChange={(e) => onChange({ ...draft, timezone: e.target.value })}
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Business Hours Start</label>
            <input
              type="time"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={draft.business_hours_start}
              onChange={(e) => onChange({ ...draft, business_hours_start: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Business Hours End</label>
            <input
              type="time"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={draft.business_hours_end}
              onChange={(e) => onChange({ ...draft, business_hours_end: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <button
              type="button"
              role="switch"
              aria-checked={draft.enforce_business_hours}
              onClick={() => onChange({ ...draft, enforce_business_hours: !draft.enforce_business_hours })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${draft.enforce_business_hours ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${draft.enforce_business_hours ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <label className="text-xs font-medium text-muted-foreground">Enforce Hours</label>
          </div>
          <div className="flex items-end gap-2 pb-1">
            <button
              type="button"
              role="switch"
              aria-checked={draft.send_in_prospect_timezone}
              onClick={() => onChange({ ...draft, send_in_prospect_timezone: !draft.send_in_prospect_timezone })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${draft.send_in_prospect_timezone ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${draft.send_in_prospect_timezone ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <label className="text-xs font-medium text-muted-foreground">Prospect TZ</label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Response Timing Rules</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Define delay windows and business hours constraints per intent.</p>
        </div>
        {isAdmin && !showNewForm && (
          <Button size="sm" variant="outline" onClick={() => {
            setNewDraft({ ...EMPTY_EDIT, intent: availableIntents[0] ?? "POSITIVE" });
            setShowNewForm(true);
          }} disabled={availableIntents.length === 0}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
          </Button>
        )}
      </div>

      {showNewForm && (
        <div className="space-y-2">
          <RuleForm draft={newDraft} onChange={setNewDraft} intentsAvailable={availableIntents} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>Cancel</Button>
            <Button size="sm" onClick={saveNew} disabled={saving}><Check className="h-3.5 w-3.5 mr-1" /> Save</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Intent</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Delay Window</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Business Hours</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Timezone</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Prospect TZ</th>
              {isAdmin && <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No timing rules configured. Defaults apply.</td></tr>
            )}
            {rules.map((rule: any) => (
              <>
                <tr key={rule.intent} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs font-medium">{rule.intent}</td>
                  <td className="px-3 py-2.5 text-xs">{fmtDelay(rule.delay_min_minutes, rule.delay_max_minutes)}</td>
                  <td className="px-3 py-2.5">
                    {rule.enforce_business_hours ? (
                      <span className="text-xs">{rule.business_hours_start?.slice(0, 5)} – {rule.business_hours_end?.slice(0, 5)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Any time</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{rule.timezone}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${rule.send_in_prospect_timezone ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                      {rule.send_in_prospect_timezone ? "Yes" : "No"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        {editingIntent === rule.intent ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEdit} disabled={saving}><Check className="h-3.5 w-3.5 text-emerald-500" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingIntent(null)}><X className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(rule)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteRule(rule.intent)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {editingIntent === rule.intent && (
                  <tr key={`${rule.intent}-edit`}>
                    <td colSpan={6} className="px-3 py-2">
                      <RuleForm draft={editDraft} onChange={setEditDraft} intentsAvailable={[rule.intent]} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
