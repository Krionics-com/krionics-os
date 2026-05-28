"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Check, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  company_name: string;
  slug: string;
}

interface User {
  role: string;
}

interface ClientsResponse {
  clients: Client[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ClientSwitcher() {
  const { data: user } = useSWR<User>("/api/auth/me", fetcher);
  const { data: clientsData, isLoading } = useSWR<ClientsResponse>(
    "/api/dashboard/clients",
    fetcher,
    { shouldRetryOnError: false }
  );
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const canSeeAllClients = user?.role === "super_admin" || user?.role === "admin";
  const clientList = canSeeAllClients ? (clientsData?.clients ?? []) : [];
  const selectedClient = clientList.find((c) => c.id === selectedClientId) ?? null;

  if (!canSeeAllClients) return null;

  if (isLoading) {
    return (
      <div
        aria-label="Loading clients"
        className="h-8 w-36 animate-pulse rounded-md bg-muted"
      />
    );
  }

  if (!clientList.length) {
    return (
      <span className="text-sm text-muted-foreground">All Clients</span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 h-8",
          "text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selectedClient && "bg-accent/50"
        )}
        aria-label={selectedClient ? `Client: ${selectedClient.company_name}` : "All Clients"}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span>{selectedClient?.company_name ?? "All Clients"}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Switch Client
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => setSelectedClientId(null)}
          className="gap-2"
          aria-current={selectedClientId === null ? "true" : undefined}
        >
          <Check
            className={cn("h-4 w-4 shrink-0", selectedClientId !== null && "invisible")}
            aria-hidden
          />
          <span>All Clients</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {clientList.map((client) => (
          <DropdownMenuItem
            key={client.id}
            onClick={() => setSelectedClientId(client.id)}
            className="gap-2"
            aria-current={selectedClientId === client.id ? "true" : undefined}
          >
            <Check
              className={cn("h-4 w-4 shrink-0", selectedClientId !== client.id && "invisible")}
              aria-hidden
            />
            <span>{client.company_name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
