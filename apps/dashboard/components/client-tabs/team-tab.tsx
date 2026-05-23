"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Users } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  admin: "secondary",
  reviewer: "outline",
  viewer: "outline",
};

interface TeamTabProps {
  clientId: string;
}

export function TeamTab({ clientId }: TeamTabProps) {
  const { data, error, isLoading } = useSWR(
    `/api/dashboard/clients/${clientId}/team`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-destructive text-sm py-6 text-center">Failed to load team</p>
    );
  }

  const operators: any[] = data?.operators ?? [];

  if (operators.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-muted-foreground text-sm">No operators found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Operators with access to this client. To manage access, go to{" "}
        <a href="/dashboard/admin" className="text-primary hover:underline">Operators</a>.
      </p>
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {operators.map((op) => {
          const allClients = op.client_access === null;
          const accessCount = Array.isArray(op.client_access) ? op.client_access.length : null;
          return (
            <div key={op.id} className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
              <div>
                <p className="text-sm font-medium">{op.name}</p>
                <p className="text-xs text-muted-foreground">{op.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {allClients ? "Access: All Clients" : `Access: ${accessCount} client${accessCount !== 1 ? "s" : ""}`}
                </span>
                <Badge variant={ROLE_VARIANTS[op.role] ?? "outline"}>
                  {op.role.replace("_", " ")}
                </Badge>
                {!op.is_active && (
                  <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
