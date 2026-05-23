"use client";

import { use, useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft, Sparkles, Save, Play, Eye, CheckCircle, AlertTriangle,
  FileCode, Cpu, Sliders, PlayCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const AVAILABLE_MODELS = [
  { label: "Claude 3.5 Sonnet (Recomended)", value: "claude-3-5-sonnet-20241022" },
  { label: "Claude 3 Haiku (Fast & Cheap)", value: "claude-3-haiku-20240307" },
  { label: "Claude 3 Opus (Complex reasoning)", value: "claude-3-opus-20240229" },
  { label: "Claude 3.5 Haiku", value: "claude-3-5-haiku-20241022" }
];

export default function PromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Fetch SWR
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/ai/prompts/${id}`,
    fetcher
  );

  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const prompt = data?.prompt;

  // Local Form state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userTemplate, setUserTemplate] = useState("");
  const [model, setModel] = useState("claude-3-5-sonnet-20241022");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [saving, setSaving] = useState(false);

  // Variable inputs and previews
  const [variablesInputs, setVariablesInputs] = useState<Record<string, string>>({});
  const [previewActive, setPreviewActive] = useState(false);
  const [testResult, setTestResult] = useState<{
    response: string;
    input_tokens?: number;
    output_tokens?: number;
    latency_ms?: number;
    error?: string;
  } | null>(null);
  const [runningTest, setRunningTest] = useState(false);

  // Initialize form values
  useEffect(() => {
    if (prompt) {
      setSystemPrompt(prompt.system_prompt || "");
      setUserTemplate(prompt.user_template || "");
      setModel(prompt.model || "claude-3-5-sonnet-20241022");
      setTemperature(parseFloat(prompt.temperature) || 0.3);
      setMaxTokens(prompt.max_tokens || 1024);
    }
  }, [prompt]);

  // Derived variable keys parsed directly from Handebars placeholders: {{variable}}
  const parsedVariables = useMemo(() => {
    const regex = /\{\{\s*(\w+)\s*\}\}/g;
    const matches = Array.from(userTemplate.matchAll(regex));
    return Array.from(new Set(matches.map((m) => m[1])));
  }, [userTemplate]);

  // Update variables input defaults if keys change
  useEffect(() => {
    setVariablesInputs((prev) => {
      const next: Record<string, string> = { ...prev };
      parsedVariables.forEach((v) => {
        if (next[v] === undefined) {
          next[v] = "";
        }
      });
      return next;
    });
  }, [parsedVariables]);

  // Preview rendered result
  const renderedPreview = useMemo(() => {
    return userTemplate.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return variablesInputs[key] !== undefined && variablesInputs[key] !== ""
        ? variablesInputs[key]
        : `{{${key}}}`;
    });
  }, [userTemplate, variablesInputs]);

  // Save prompt configs
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/ai/prompts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_template: userTemplate,
          model,
          temperature: parseFloat(temperature.toFixed(2)),
          max_tokens: maxTokens,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success("Prompt saved and version bumped!");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to save prompt settings");
    } finally {
      setSaving(false);
    }
  }

  // Run prompt testing
  async function handleRunTest() {
    setRunningTest(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/dashboard/ai/prompts/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: variablesInputs }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setTestResult(body);
      toast.success("AI invocation test executed successfully");
    } catch (err: any) {
      setTestResult({ response: "", error: err.message });
      toast.error(err.message || "AI invocation test execution failed");
    } finally {
      setRunningTest(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <Card className="mx-auto max-w-xl mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Prompt not found</p>
          <Link href="/dashboard/ai/prompts">
            <Button variant="ghost" size="sm" className="mt-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Prompt list
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header back button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/ai/prompts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading text-2xl font-bold">{prompt.name}</h1>
              <Badge className="font-mono">v{prompt.version}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Type: <span className="font-semibold">{prompt.invocation_type.toUpperCase()}</span> Scope: <span className="font-semibold text-primary">{prompt.client_company_name || "GLOBAL"}</span>
            </p>
          </div>
        </div>

        {isAdmin && (
          <Button disabled={saving} onClick={handleSave}>
            {saving ? <Spinner className="h-4 w-4 mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save changes
          </Button>
        )}
      </div>

      {/* Main split dashboard grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: Prompt Editors */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCode className="h-4.5 w-4.5 text-primary" />
                Prompt Template Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              
              {/* System Prompt Monospace Editor */}
              <div className="space-y-1.5">
                <Label htmlFor="sys-prompt">System Prompt Override</Label>
                <textarea
                  id="sys-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full min-h-[320px] rounded-lg border border-input bg-card p-3 font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="Insert core persona settings, system parameters, or rule structures..."
                />
              </div>

              {/* User template handlebars */}
              <div className="space-y-1.5">
                <Label htmlFor="usr-template">User Prompt template</Label>
                <textarea
                  id="usr-template"
                  value={userTemplate}
                  onChange={(e) => setUserTemplate(e.target.value)}
                  className="w-full min-h-[160px] rounded-lg border border-input bg-card p-3 font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="e.g. Please analyze this message: {{message_body}}"
                />
              </div>

              {/* Parsed Variables Read-Only lists */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template variables found</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsedVariables.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">None detected (insert {"{{variable_name}}"} to add variables)</span>
                  ) : (
                    parsedVariables.map((v) => (
                      <Badge key={v} variant="outline" className="font-mono text-xs bg-muted/40">
                        {v}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prompt configs parameters */}
          <Card>
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sliders className="h-4.5 w-4.5 text-primary" />
                Execution Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Model Selector */}
                <div className="space-y-1.5">
                  <Label htmlFor="model-sel">LLM Model</Label>
                  <select
                    id="model-sel"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs focus:ring-1 focus:ring-primary"
                  >
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* Temperature slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label htmlFor="temp-range">Temperature</Label>
                    <span className="text-xs font-semibold font-mono">{temperature.toFixed(1)}</span>
                  </div>
                  <input
                    id="temp-range"
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer mt-2"
                  />
                </div>

                {/* Max tokens input */}
                <div className="space-y-1.5">
                  <Label htmlFor="max-toks">Max tokens</Label>
                  <Input
                    id="max-toks"
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                  />
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Test Runner Engine */}
        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/[0.01]">
            <CardHeader className="py-4 border-b border-primary/10">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PlayCircle className="h-4.5 w-4.5 text-primary" />
                Prompt Test Runner Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              
              {/* Variable textfields input */}
              {parsedVariables.length > 0 && (
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Enter Test Variables</h4>
                  <div className="space-y-3">
                    {parsedVariables.map((v) => (
                      <div key={v} className="space-y-1">
                        <Label htmlFor={`var-${v}`} className="font-mono text-xs">{v}</Label>
                        <Input
                          id={`var-${v}`}
                          value={variablesInputs[v] || ""}
                          onChange={(e) => setVariablesInputs({ ...variablesInputs, [v]: e.target.value })}
                          placeholder={`Enter mockup value for ${v}`}
                          className="bg-card"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Render preview button & display */}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewActive(!previewActive)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {previewActive ? "Hide Rendered Preview" : "Preview Rendered user Prompt"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={runningTest}
                  onClick={handleRunTest}
                >
                  {runningTest ? (
                    <><Spinner className="h-4 w-4 mr-1" /> Running…</>
                  ) : (
                    <><Play className="h-4 w-4 mr-1" /> Run Invocation Test</>
                  )}
                </Button>
              </div>

              {/* Display user template preview */}
              {previewActive && (
                <div className="space-y-1.5 p-3 rounded-lg bg-card border">
                  <span className="text-[10px] uppercase text-muted-foreground font-semibold">Rendered User template Preview</span>
                  <textarea
                    readOnly
                    value={renderedPreview}
                    className="w-full min-h-[100px] border-0 focus:outline-none text-xs font-mono bg-transparent text-muted-foreground resize-y mt-1.5"
                  />
                </div>
              )}

              {/* AI test runner output response */}
              {testResult && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-4 bg-card">
                    <div className="flex items-center justify-between border-b pb-2 mb-3">
                      <span className="text-xs font-semibold text-primary uppercase flex items-center gap-1.5">
                        <Cpu className="h-4 w-4" /> Output Response
                      </span>
                      {testResult.latency_ms && (
                        <div className="flex gap-3 text-xs text-muted-foreground font-mono">
                          <span>Latency: <strong className="text-foreground">{testResult.latency_ms}ms</strong></span>
                          <span>In/Out Tokens: <strong className="text-foreground">{testResult.input_tokens}/{testResult.output_tokens}</strong></span>
                        </div>
                      )}
                    </div>

                    {testResult.error ? (
                      <p className="text-sm font-mono text-destructive bg-destructive/5 p-3 rounded border border-destructive/20">{testResult.error}</p>
                    ) : (
                      <p className="text-xs font-mono bg-muted/20 p-3 rounded border whitespace-pre-wrap">{testResult.response}</p>
                    )}
                  </div>

                  {/* Validation Checks Panel */}
                  <div className="rounded-lg border p-4 bg-muted/20">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
                      <CheckCircle className="h-4.5 w-4.5 text-primary shrink-0" />
                      Response Validation Checks
                    </h4>
                    
                    <div className="space-y-2 text-xs">
                      {/* Check 1: Length */}
                      <div className="flex justify-between items-center py-1 border-b border-border/50">
                        <span>1. Response Length check (min 20 chars)</span>
                        {!testResult.error && testResult.response.length > 20 ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Passed</span>
                        ) : (
                          <span className="text-rose-500 font-semibold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Failed</span>
                        )}
                      </div>
                      
                      {/* Check 2: Repetition */}
                      <div className="flex justify-between items-center py-1 border-b border-border/50">
                        <span>2. Repeat phrases exclusion verification</span>
                        <span className="text-muted-foreground font-mono">Check skipped</span>
                      </div>

                      {/* Check 3: Tone */}
                      <div className="flex justify-between items-center py-1">
                        <span>3. Tone guidelines conformity review</span>
                        <span className="text-muted-foreground font-mono">Check skipped</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
