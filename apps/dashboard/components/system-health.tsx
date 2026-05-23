"use client";

import useSWR from "swr";
import { fetchJson } from "@/lib/http";
import { Activity, Server } from "lucide-react";

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'down';
  detail?: string;
}

const fetcher = (url: string) => fetchJson<{ services: ServiceStatus[] }>(url);

export function SystemHealth() {
  const { data, error, isLoading } = useSWR('/api/dashboard/health', fetcher, {
    refreshInterval: 15000,
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 bg-card border border-border rounded-xl p-4 shadow-sm text-sm overflow-x-auto">
      <div className="flex items-center gap-2 font-heading font-bold text-foreground sm:border-r border-border sm:pr-4 whitespace-nowrap">
        <Server className="h-4 w-4 text-primary" />
        System Status
      </div>
      
      {isLoading && !data && <span className="text-muted-foreground animate-pulse font-medium text-xs">Checking services...</span>}
      {error && <span className="text-red-500 font-medium text-xs">Failed to load system health</span>}
      
      <div className="flex flex-wrap items-center gap-6">
        {data?.services.map(svc => (
          <div key={svc.name} className="flex items-center gap-2 whitespace-nowrap">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-20 ${
                svc.status === 'healthy' ? 'bg-green-500' :
                svc.status === 'warning' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                svc.status === 'healthy' ? 'bg-green-500' :
                svc.status === 'warning' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}></span>
            </span>
            <span className="font-semibold text-foreground">{svc.name}</span>
            {svc.detail && <span className="text-muted-foreground text-xs">({svc.detail})</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
