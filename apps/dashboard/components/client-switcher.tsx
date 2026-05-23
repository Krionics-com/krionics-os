"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ClientSwitcher() {
  const { data: user } = useSWR("/api/auth/me", fetcher);
  // We'll just fetch all clients for the switcher. In a real app we might fetch `/api/clients`.
  // Since we don't have `/api/dashboard/clients` yet, let's just make it graceful if it fails.
  const { data: clients } = useSWR("/api/dashboard/clients", fetcher, { shouldRetryOnError: false });
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  // Super admins see all clients
  const canSeeAllClients = user?.role === "super_admin" || user?.role === "admin";
  const clientList = canSeeAllClients ? clients?.clients || [] : [];

  if (!canSeeAllClients || !clientList.length) {
    return <span className="text-sm text-muted-foreground">All Clients</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3">
        {selectedClient ? clientList.find((c: any) => c.id === selectedClient)?.company_name : "All Clients"}
        <ChevronDown className="ml-2 h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Select Client</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setSelectedClient(null)}>
          All Clients
        </DropdownMenuItem>
        {clientList.map((client: any) => (
          <DropdownMenuItem key={client.id} onClick={() => setSelectedClient(client.id)}>
            {client.company_name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
