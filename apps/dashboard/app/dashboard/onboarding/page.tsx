"use client";

import useSWR from "swr";
import Link from "next/link";
import { CheckSquare, Building2, ArrowRight, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OnboardingPage() {
  const { data, isLoading, error, mutate } = useSWR("/api/dashboard/onboarding", fetcher);
  const clients: any[] = data?.clients ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Onboarding</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Complete setup for new clients before they go live.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load onboarding clients</p>
          </CardContent>
        </Card>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckSquare className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No clients in onboarding</p>
            <p className="text-xs text-muted-foreground mt-1">New clients with status "onboarding" will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client: any) => (
            <Card key={client.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{client.company_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{client.slug}</p>
                    </div>
                  </div>
                  <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    onboarding
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Contact</span>
                    <span>{client.contact_name ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CRM</span>
                    <span className="capitalize">{client.crm_type ?? "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Added</span>
                    <span>{new Date(client.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <Link href={`/dashboard/onboarding/${client.slug}`} className="mt-4 block">
                  <Button size="sm" className="w-full">
                    Start Onboarding <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
