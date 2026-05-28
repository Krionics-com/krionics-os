"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Zap, RefreshCw, Save, ShieldAlert, Check,
  ToggleLeft, ToggleRight, Settings, Info, Lock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type FeatureFlag = {
  feature_key: string;
  enabled: boolean;
  description: string;
  updated_at: string;
};

export default function FeatureFlagsPage() {
  const { data: user, isLoading: isUserLoading } = useSWR("/api/auth/me", fetcher);
  const { data, error, isLoading, mutate } = useSWR("/api/dashboard/settings/features", fetcher, {
    refreshInterval: 30000, // 30s polling
  });

  const [localFlags, setLocalFlags] = useState<FeatureFlag[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Sync loaded database enums flags to state
  useEffect(() => {
    if (data?.flags) {
      setLocalFlags(data.flags);
    }
  }, [data]);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Toggle switch handler
  function handleToggle(key: string) {
    setLocalFlags((prev) =>
      prev.map((f) => (f.feature_key === key ? { ...f, enabled: !f.enabled } : f))
    );
  }

  // Handle Save
  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: localFlags.map((f) => ({
            feature_key: f.feature_key,
            enabled: f.enabled,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save feature configurations");
      }

      toast.success("Feature flags saved successfully!");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Error saving feature configurations");
    } finally {
      setIsSaving(false);
    }
  }

  if (isUserLoading || (isLoading && localFlags.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // 403 Forbidden Premium Gate Layout
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[460px] p-6">
        <Card className="max-w-md w-full border-destructive/20 shadow-2xl relative overflow-hidden select-none">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-destructive"></div>
          <CardContent className="p-8 text-center space-y-6">
            <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-heading text-foreground">Access Restricted (403)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Global settings configuration dashboards are only accessible to administrators or super admin operators. Contact your workspace manager to elevate permissions.
              </p>
            </div>
            <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/5 font-mono text-[10px]">
              ROLE_REQUIRED: ADMIN_OR_SUPER
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-primary animate-pulse" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Global System Feature Flags</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Control live operational toggles, integrations triggers, and duplicate message prevention boundaries.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" size="sm" className="h-9" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-9 font-bold flex items-center gap-1.5" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save Configurations
          </Button>
        </div>
      </div>

      {/* Flag Grid Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {localFlags.map((flag) => {
          const displayName = flag.feature_key
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

          return (
            <Card
              key={flag.feature_key}
              className={cn(
                "transition-all relative border overflow-hidden",
                flag.enabled
                  ? "bg-primary/[0.01] border-primary/20 shadow-sm"
                  : "bg-muted/10 border-border"
              )}
            >
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm leading-tight block">{displayName}</span>
                    {flag.enabled ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-wider">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed h-[42px] overflow-hidden">
                    {flag.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground font-mono whitespace-nowrap">
                    Last update: {new Date(flag.updated_at).toLocaleDateString()}
                  </span>
                  
                  {/* Premium styled click toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggle(flag.feature_key)}
                    className="hover:scale-105 transition-all text-primary shrink-0"
                  >
                    {flag.enabled ? (
                      <ToggleRight className="h-8 w-8 text-primary" />
                    ) : (
                      <ToggleLeft className="h-8 w-8 text-muted-foreground/60" />
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
