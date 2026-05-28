"use client";

import { use, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Circle, Loader2, Database,
  Mail, Zap, ChevronRight, AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { CampaignCreateWizard } from "@/components/campaign-create-wizard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STEPS = [
  { id: "crm", label: "Verify CRM", icon: Database, description: "Confirm CRM credentials are configured and working." },
  { id: "inboxes", label: "Setup Inboxes", icon: Mail, description: "Link at least one sending inbox to this client." },
  { id: "campaign", label: "Create Campaign", icon: Zap, description: "Set up the first outreach campaign for this client." },
];

export default function OnboardingWizardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { data, isLoading } = useSWR(`/api/dashboard/clients/${slug}`, fetcher);
  const { data: inboxesData } = useSWR("/api/dashboard/infra/inboxes", fetcher);

  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [crmResult, setCrmResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);

  const client = data?.client;
  const inboxes: any[] = inboxesData?.inboxes ?? [];

  async function verifycrm() {
    setVerifying(true);
    try {
      const res = await fetch(`/api/dashboard/onboarding/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-crm" }),
      });
      const json = await res.json();
      setCrmResult(json);
      if (json.ok) {
        setCompleted((s) => new Set([...s, "crm"]));
        toast.success("CRM verification passed");
      } else {
        toast.error(json.message);
      }
    } catch {
      toast.error("CRM verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function complete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/dashboard/onboarding/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Client is now active!");
      router.push(`/dashboard/clients/${slug}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to complete onboarding");
    } finally {
      setCompleting(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!client) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Client not found</p>
          <Link href="/dashboard/onboarding"><Button variant="ghost" size="sm" className="mt-2">Back</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const allDone = completed.size >= 2; // CRM + inboxes acknowledged minimum

  return (
    <>
      {showCampaignWizard && (
        <CampaignCreateWizard
          onClose={() => setShowCampaignWizard(false)}
          onCreated={() => {
            setShowCampaignWizard(false);
            setCompleted((s) => new Set([...s, "campaign"]));
            toast.success("Campaign created");
          }}
        />
      )}

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard/onboarding">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Onboarding</Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-bold">Onboarding: {client.company_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Complete each step to activate this client.</p>
          </div>
        </div>

        {/* Steps sidebar + content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Step list */}
          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const done = completed.has(s.id);
              const active = step === i;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(i)}
                  className={`w-full text-left flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className={`h-5 w-5 shrink-0 ${active ? "text-primary-foreground" : "text-emerald-500"}`} />
                  ) : (
                    <Circle className={`h-5 w-5 shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${active ? "text-primary-foreground" : ""}`}>{s.label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Step content */}
          <div className="md:col-span-2">
            <Card>
              <CardContent className="pt-5 pb-5">
                {/* Step 0: CRM */}
                {step === 0 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-sm">Verify CRM Connection</h3>
                      <p className="text-xs text-muted-foreground mt-1">{STEPS[0].description}</p>
                    </div>

                    <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CRM Type</span>
                        <span className="font-medium capitalize">{client.crm_type ?? "None"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Config Status</span>
                        <span className={client.crm_config && Object.keys(client.crm_config).length > 0 ? "text-emerald-600 font-medium" : "text-amber-600"}>
                          {client.crm_config && Object.keys(client.crm_config).length > 0 ? "Configured" : "Not configured"}
                        </span>
                      </div>
                    </div>

                    {crmResult && (
                      <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${crmResult.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-300" : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-900/10 dark:text-rose-300"}`}>
                        {crmResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                        {crmResult.message}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button size="sm" onClick={verifycrm} disabled={verifying}>
                        {verifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Database className="h-4 w-4 mr-1" />}
                        Verify CRM
                      </Button>
                      {!client.crm_type || client.crm_type === "none" ? (
                        <Button size="sm" variant="outline" onClick={() => { setCompleted((s) => new Set([...s, "crm"])); setStep(1); }}>
                          Skip (No CRM)
                        </Button>
                      ) : (
                        <Link href={`/dashboard/clients/${slug}`}>
                          <Button size="sm" variant="outline">Configure in Client Settings</Button>
                        </Link>
                      )}
                    </div>

                    {completed.has("crm") && (
                      <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                        Next: Setup Inboxes <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                )}

                {/* Step 1: Inboxes */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-sm">Setup Sending Inboxes</h3>
                      <p className="text-xs text-muted-foreground mt-1">{STEPS[1].description}</p>
                    </div>

                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-2">Available inboxes ({inboxes.length})</p>
                      {inboxes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No inboxes found. Add inboxes in the Inboxes section.</p>
                      ) : (
                        <div className="space-y-1">
                          {inboxes.slice(0, 5).map((inbox: any) => (
                            <div key={inbox.inbox_email} className="flex items-center justify-between text-xs">
                              <span className="font-mono">{inbox.inbox_email}</span>
                              <span className={`rounded-full px-1.5 py-0.5 text-xs ${inbox.warmup_status === "Complete" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {inbox.warmup_status ?? "Unknown"}
                              </span>
                            </div>
                          ))}
                          {inboxes.length > 5 && <p className="text-xs text-muted-foreground">+{inboxes.length - 5} more inboxes</p>}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Link href="/dashboard/infra/inboxes">
                        <Button size="sm" variant="outline">
                          <Mail className="h-4 w-4 mr-1" /> Manage Inboxes
                        </Button>
                      </Link>
                      <Button size="sm" onClick={() => { setCompleted((s) => new Set([...s, "inboxes"])); setStep(2); }}>
                        Mark as Done <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Campaign */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-sm">Create First Campaign</h3>
                      <p className="text-xs text-muted-foreground mt-1">{STEPS[2].description}</p>
                    </div>

                    {completed.has("campaign") ? (
                      <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/40 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" /> Campaign created successfully
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setShowCampaignWizard(true)}>
                        <Zap className="h-4 w-4 mr-1" /> Create Campaign
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Complete button */}
            {allDone && (
              <div className="mt-4">
                <Button className="w-full" onClick={complete} disabled={completing}>
                  {completing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Complete Onboarding — Activate Client
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">Client status will change from "onboarding" to "active".</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
