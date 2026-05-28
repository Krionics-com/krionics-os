"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const INTENTS = ["POSITIVE", "BOOKING_INTENT", "OBJECTION", "FAQ", "NURTURE", "UNSUBSCRIBE", "NOT_RELEVANT", "BOUNCE_OOO", "HOSTILE", "UNKNOWN"];
const ACTIONS = ["human_review", "ai_draft_human_review", "ai_send", "suppress", "escalate"];
const ACTION_LABELS: Record<string, string> = {
  human_review: "Human Review",
  ai_draft_human_review: "AI Draft → Human",
  ai_send: "AI Auto-Send",
  suppress: "Suppress",
  escalate: "Escalate",
};
const ACTION_COLORS: Record<string, string> = {
  human_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ai_draft_human_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  ai_send: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  suppress: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
  escalate: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

function ActionBadge({ action }: { action: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[action] ?? "bg-muted text-muted-foreground"}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

interface PolicyRowEdit {
  intent: string;
  action_level_1: string;
  action_level_2: string;
  action_level_3: string;
  confidence_threshold: number;
  escalation_keywords: string;
  auto_suppress_phrases: string;
}

const EMPTY_EDIT: PolicyRowEdit = {
  intent: "POSITIVE",
  action_level_1: "human_review",
  action_level_2: "ai_draft_human_review",
  action_level_3: "ai_send",
  confidence_threshold: 0.85,
  escalation_keywords: "",
  auto_suppress_phrases: "",
};

export function ReplyPoliciesTab({ clientSlug, isAdmin }: { clientSlug: string; isAdmin: boolean }) {
  const { data, isLoading, mutate } = useSWR(
    `/api/dashboard/clients/${clientSlug}/reply-policies`,
    fetcher
  );
  const [editingIntent, setEditingIntent] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PolicyRowEdit>(EMPTY_EDIT);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDraft, setNewDraft] = useState<PolicyRowEdit>(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);

  const policies: any[] = data?.policies ?? [];
  const usedIntents = new Set(policies.map((p: any) => p.intent));
  const availableIntents = INTENTS.filter((i) => !usedIntents.has(i));

  function startEdit(policy: any) {
    setEditingIntent(policy.intent);
    setEditDraft({
      intent: policy.intent,
      action_level_1: policy.action_level_1,
      action_level_2: policy.action_level_2,
      action_level_3: policy.action_level_3,
      confidence_threshold: policy.confidence_threshold ?? 0.85,
      escalation_keywords: (policy.escalation_keywords ?? []).join(", "),
      auto_suppress_phrases: (policy.auto_suppress_phrases ?? []).join(", "),
    });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${clientSlug}/reply-policies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editDraft,
          confidence_threshold: Number(editDraft.confidence_threshold),
          escalation_keywords: editDraft.escalation_keywords.split(",").map((s) => s.trim()).filter(Boolean),
          auto_suppress_phrases: editDraft.auto_suppress_phrases.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      setEditingIntent(null);
      toast.success("Policy updated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveNew() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${clientSlug}/reply-policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newDraft,
          confidence_threshold: Number(newDraft.confidence_threshold),
          escalation_keywords: newDraft.escalation_keywords.split(",").map((s) => s.trim()).filter(Boolean),
          auto_suppress_phrases: newDraft.auto_suppress_phrases.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      setShowNewForm(false);
      setNewDraft(EMPTY_EDIT);
      toast.success("Policy created");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  async function deletePolicy(intent: string) {
    if (!confirm(`Delete policy for intent "${intent}"? This will revert to system defaults.`)) return;
    try {
      const res = await fetch(`/api/dashboard/clients/${clientSlug}/reply-policies?intent=${encodeURIComponent(intent)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      toast.success("Policy deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    }
  }

  if (isLoading) {
    return <div className="animate-pulse h-40 rounded-md bg-muted" />;
  }

  function PolicyForm({ draft, onChange, intentsAvailable }: { draft: PolicyRowEdit; onChange: (d: PolicyRowEdit) => void; intentsAvailable: string[] }) {
    return (
      <div className="grid gap-3 p-4 rounded-lg border border-border bg-muted/30">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
          {(["action_level_1", "action_level_2", "action_level_3"] as const).map((field, idx) => (
            <div key={field}>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Level {idx + 1}</label>
              <select
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={draft[field]}
                onChange={(e) => onChange({ ...draft, [field]: e.target.value })}
              >
                {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Confidence Threshold</label>
            <input
              type="number"
              min={0} max={1} step={0.01}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={draft.confidence_threshold}
              onChange={(e) => onChange({ ...draft, confidence_threshold: parseFloat(e.target.value) })}
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Escalation Keywords (comma-separated)</label>
            <input
              type="text"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. legal, contract, manager"
              value={draft.escalation_keywords}
              onChange={(e) => onChange({ ...draft, escalation_keywords: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Auto-Suppress Phrases (comma-separated)</label>
            <input
              type="text"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. unsubscribe, remove me"
              value={draft.auto_suppress_phrases}
              onChange={(e) => onChange({ ...draft, auto_suppress_phrases: e.target.value })}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Reply Routing Policies</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configure automation actions per intent and automation level.</p>
        </div>
        {isAdmin && !showNewForm && (
          <Button size="sm" variant="outline" onClick={() => {
            setNewDraft({ ...EMPTY_EDIT, intent: availableIntents[0] ?? "POSITIVE" });
            setShowNewForm(true);
          }} disabled={availableIntents.length === 0}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Policy
          </Button>
        )}
      </div>

      {showNewForm && (
        <div className="space-y-2">
          <PolicyForm
            draft={newDraft}
            onChange={setNewDraft}
            intentsAvailable={availableIntents}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>Cancel</Button>
            <Button size="sm" onClick={saveNew} disabled={saving}>
              <Check className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Intent</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Level 1</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Level 2</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Level 3</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Threshold</th>
              {isAdmin && <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {policies.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No policies configured. Defaults apply.</td></tr>
            )}
            {policies.map((policy: any) => (
              <>
                <tr key={policy.intent} className={`hover:bg-muted/30 transition-colors ${editingIntent === policy.intent ? "bg-muted/20" : ""}`}>
                  <td className="px-3 py-2.5 font-mono text-xs font-medium">{policy.intent}</td>
                  <td className="px-3 py-2.5"><ActionBadge action={policy.action_level_1} /></td>
                  <td className="px-3 py-2.5"><ActionBadge action={policy.action_level_2} /></td>
                  <td className="px-3 py-2.5"><ActionBadge action={policy.action_level_3} /></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{(policy.confidence_threshold * 100).toFixed(0)}%</td>
                  {isAdmin && (
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        {editingIntent === policy.intent ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEdit} disabled={saving}><Check className="h-3.5 w-3.5 text-emerald-500" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingIntent(null)}><X className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(policy)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deletePolicy(policy.intent)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {editingIntent === policy.intent && (
                  <tr key={`${policy.intent}-edit`}>
                    <td colSpan={6} className="px-3 py-2">
                      <PolicyForm
                        draft={editDraft}
                        onChange={setEditDraft}
                        intentsAvailable={[policy.intent]}
                      />
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
