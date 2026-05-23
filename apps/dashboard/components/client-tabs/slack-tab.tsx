"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { Eye, EyeOff } from "lucide-react";

interface SlackTabProps {
  client: any;
  editing: boolean;
  draft: any;
  onScalarChange: (key: string, value: any) => void;
  onConfigChange: (path: string[], value: any) => void;
}

function ViewValue({ value }: { value: any }) {
  return (
    <p className="text-sm py-1 min-h-[2rem]">
      {value ?? <span className="text-muted-foreground italic">—</span>}
    </p>
  );
}

export function SlackTab({ client, editing, draft, onScalarChange, onConfigChange }: SlackTabProps) {
  const [showWebhook, setShowWebhook] = useState(false);
  const d = editing ? draft : client;
  const slackCfg = d.config?.slack_config ?? {};

  const isConnected = !!d.slack_webhook_url;

  return (
    <div className="space-y-5">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
        isConnected ? "border-green-200 bg-green-50 text-green-700" : "border-border bg-muted/30 text-muted-foreground"
      }`}>
        <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-muted-foreground"}`} />
        <span className="text-sm font-medium">
          {isConnected ? "Connected" : "Not configured"}
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slack-webhook">Webhook URL</Label>
        {editing ? (
          <div className="relative">
            <Input
              id="slack-webhook"
              type={showWebhook ? "text" : "password"}
              value={d.slack_webhook_url ?? ""}
              onChange={(e) => onScalarChange("slack_webhook_url", e.target.value)}
              className="pr-9"
              placeholder="https://hooks.slack.com/…"
            />
            <button
              type="button"
              onClick={() => setShowWebhook((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <ViewValue value={d.slack_webhook_url ? "••••••••••••" : undefined} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="slack-channel-id">Channel ID</Label>
          {editing ? (
            <Input
              id="slack-channel-id"
              value={d.slack_channel_id ?? ""}
              onChange={(e) => onScalarChange("slack_channel_id", e.target.value)}
              placeholder="C01234567"
            />
          ) : <ViewValue value={d.slack_channel_id} />}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slack-escalation">Escalation Channel</Label>
          {editing ? (
            <Input
              id="slack-escalation"
              value={slackCfg.escalation_channel ?? ""}
              onChange={(e) => onConfigChange(["slack_config", "escalation_channel"], e.target.value)}
              placeholder="#escalations"
            />
          ) : <ViewValue value={slackCfg.escalation_channel} />}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Alert Channels</Label>
        {editing ? (
          <TagInput
            value={slackCfg.alert_channels ?? []}
            onChange={(tags) => onConfigChange(["slack_config", "alert_channels"], tags)}
            placeholder="#alerts, #ops…"
          />
        ) : <ViewValue value={(slackCfg.alert_channels ?? []).join(", ") || undefined} />}
      </div>
    </div>
  );
}
