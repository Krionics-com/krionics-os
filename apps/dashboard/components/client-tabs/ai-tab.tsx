"use client";

import { Label } from "@/components/ui/label";

interface AiTabProps {
  client: any;
  editing: boolean;
  draft: any;
  onConfigChange: (path: string[], value: any) => void;
}

function ViewValue({ value }: { value: any }) {
  return (
    <p className="text-sm py-1 min-h-[2rem]">
      {value ?? <span className="text-muted-foreground italic">—</span>}
    </p>
  );
}

const TONES = ["professional", "friendly", "direct", "formal"];
const PERSONALIZATION_DEPTHS = ["minimal", "standard", "deep"];

export function AiTab({ client, editing, draft, onConfigChange }: AiTabProps) {
  const d = editing ? draft : client;
  const ai = d.config?.ai_config ?? {};

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="ai-prompt-override">Prompt Override</Label>
        {editing ? (
          <textarea
            id="ai-prompt-override"
            rows={5}
            value={ai.prompt_override ?? ""}
            onChange={(e) => onConfigChange(["ai_config", "prompt_override"], e.target.value)}
            placeholder="Additional system prompt instructions for this client…"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm resize-none focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          ai.prompt_override
            ? <pre className="text-sm bg-muted rounded-lg p-3 whitespace-pre-wrap font-sans">{ai.prompt_override}</pre>
            : <ViewValue value={undefined} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="ai-tone">Tone</Label>
          {editing ? (
            <select
              id="ai-tone"
              value={ai.tone ?? "professional"}
              onChange={(e) => onConfigChange(["ai_config", "tone"], e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {TONES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          ) : (
            <ViewValue value={ai.tone ? ai.tone.charAt(0).toUpperCase() + ai.tone.slice(1) : undefined} />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-personalization">Personalization Depth</Label>
          {editing ? (
            <select
              id="ai-personalization"
              value={ai.personalization_depth ?? "standard"}
              onChange={(e) => onConfigChange(["ai_config", "personalization_depth"], e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {PERSONALIZATION_DEPTHS.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          ) : (
            <ViewValue value={ai.personalization_depth} />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ai-forbidden">Forbidden Claims</Label>
        <p className="text-xs text-muted-foreground">One claim per line</p>
        {editing ? (
          <textarea
            id="ai-forbidden"
            rows={4}
            value={Array.isArray(ai.forbidden_claims) ? ai.forbidden_claims.join("\n") : (ai.forbidden_claims ?? "")}
            onChange={(e) => onConfigChange(
              ["ai_config", "forbidden_claims"],
              e.target.value.split("\n").filter((l: string) => l.trim())
            )}
            placeholder="We guarantee results&#10;We are the #1 platform&#10;…"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm resize-none focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          Array.isArray(ai.forbidden_claims) && ai.forbidden_claims.length > 0
            ? <ul className="list-disc list-inside text-sm space-y-0.5">
                {ai.forbidden_claims.map((c: string, i: number) => <li key={i}>{c}</li>)}
              </ul>
            : <ViewValue value={undefined} />
        )}
      </div>
    </div>
  );
}
