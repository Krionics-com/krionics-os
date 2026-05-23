"use client";

import React, { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchJson, isRetryableStatus } from "@/lib/http";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SlaTimer } from "@/components/sla-timer";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorState } from "@/components/error-state";
import { Filter, Search, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReplyItem = {
  id: string;
  lead: {
    email: string;
    name: string;
    company: string;
    title: string;
  };
  intent: string;
  confidence: number;
  sla_status: "GREEN" | "YELLOW" | "RED";
  sla_expires_at: string;
  assigned_operator: string | null;
  created_at: string;
  reply_preview: string;
};

type ReplyListResponse = {
  data: ReplyItem[];
  total: number;
  page: number;
};

const fetcher = (url: string) => fetchJson<ReplyListResponse>(url);

// Relative time helper
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (60 * 1000));
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["PENDING_REVIEW"]);
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [selectedSlas, setSelectedSlas] = useState<string[]>([]);

  // Construct Query URL
  const queryParams = new URLSearchParams();
  if (selectedStatuses.length > 0) {
    queryParams.set("status", selectedStatuses.join(","));
  } else {
    // If none are checked, we fetch nothing by sending a dummy
    queryParams.set("status", "NONE");
  }
  if (selectedIntents.length > 0) {
    queryParams.set("intent", selectedIntents.join(","));
  }
  if (selectedSlas.length > 0) {
    queryParams.set("sla", selectedSlas.join(","));
  }
  if (search.trim() !== "") {
    queryParams.set("search", search.trim());
  }
  queryParams.set("limit", "50");

  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/review?${queryParams.toString()}`,
    fetcher,
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
      keepPreviousData: true,
      onErrorRetry: (err, _key, _config, revalidate, opts) => {
        if (!isRetryableStatus(err?.status) || opts.retryCount >= 3) {
          return;
        }
        const delay = 1000 * Math.pow(2, opts.retryCount);
        setTimeout(() => revalidate({ retryCount: opts.retryCount + 1 }), delay);
      }
    }
  );

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleIntent = (intent: string) => {
    setSelectedIntents((prev) =>
      prev.includes(intent) ? prev.filter((i) => i !== intent) : [...prev, intent]
    );
  };

  const toggleSla = (sla: string) => {
    setSelectedSlas((prev) =>
      prev.includes(sla) ? prev.filter((s) => s !== sla) : [...prev, sla]
    );
  };

  const resetFilters = () => {
    setSearch("");
    setSelectedStatuses(["PENDING_REVIEW"]);
    setSelectedIntents([]);
    setSelectedSlas([]);
  };

  const columns = [
    {
      accessorKey: "lead",
      header: "Lead",
      cell: ({ row }: any) => {
        const lead = row.original.lead;
        return (
          <div className="flex flex-col">
            <Link
              href={`/dashboard/review/${row.original.id}`}
              className="font-medium text-primary hover:underline"
            >
              {lead.email}
            </Link>
            {lead.name && <span className="text-xs text-muted-foreground">{lead.name}</span>}
          </div>
        );
      }
    },
    {
      accessorKey: "company",
      header: "Company",
      cell: ({ row }: any) => {
        const company = row.original.lead.company;
        return (
          <span className={company === "Unknown" ? "text-muted-foreground italic text-sm" : "text-sm font-medium text-foreground"}>
            {company}
          </span>
        );
      }
    },
    {
      accessorKey: "intent",
      header: "Intent",
      cell: ({ row }: any) => {
        const intent = row.original.intent || "UNKNOWN";
        let colorMap: Record<string, string> = {
          POSITIVE: "bg-green-100 text-green-800 border-green-200",
          BOOKING_INTENT: "bg-blue-100 text-blue-800 border-blue-200",
          OBJECTION: "bg-orange-100 text-orange-800 border-orange-200",
          FAQ: "bg-purple-100 text-purple-800 border-purple-200",
          NURTURE: "bg-gray-100 text-gray-800 border-gray-200"
        };
        const classNames = colorMap[intent] || "bg-gray-100 text-gray-800 border-gray-200";

        return (
          <Badge variant="outline" className={`${classNames} font-semibold`}>
            {intent.replace("_", " ")}
          </Badge>
        );
      }
    },
    {
      accessorKey: "confidence",
      header: "Confidence",
      cell: ({ row }: any) => {
        return <span className="text-sm font-medium">{row.original.confidence}%</span>;
      }
    },
    {
      accessorKey: "sla",
      header: "SLA",
      cell: ({ row }: any) => {
        return <SlaTimer createdAt={row.original.created_at} />;
      }
    },
    {
      accessorKey: "assigned",
      header: "Assigned",
      cell: ({ row }: any) => {
        return (
          <span className="text-sm text-muted-foreground">
            {row.original.assigned_operator || "Unassigned"}
          </span>
        );
      }
    },
    {
      accessorKey: "received",
      header: "Received",
      cell: ({ row }: any) => {
        return (
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(row.original.created_at)}
          </span>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading">
            Review Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage incoming campaign replies, review AI classifications, and approve drafted responses.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden flex items-center gap-2 border-border"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Filters */}
        <div
          className={`${
            sidebarOpen ? "block" : "hidden"
          } lg:block w-full lg:w-64 shrink-0 bg-card rounded-xl border border-border p-5 space-y-6 h-fit`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2 font-heading">
              <Filter className="h-4 w-4 text-primary" /> Filters
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-primary px-2 h-7"
              onClick={resetFilters}
            >
              Reset All
            </Button>
          </div>

          {/* Status Filters */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes("PENDING_REVIEW")}
                  onChange={() => toggleStatus("PENDING_REVIEW")}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                Pending
              </label>
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes("SLA_WARNING")}
                  onChange={() => toggleStatus("SLA_WARNING")}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                SLA Warning
              </label>
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes("OVERDUE")}
                  onChange={() => toggleStatus("OVERDUE")}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                Overdue
              </label>
            </div>
          </div>

          <hr className="border-border" />

          {/* Intent Filters */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Intent
            </h3>
            <div className="space-y-2">
              {["POSITIVE", "BOOKING_INTENT", "OBJECTION", "FAQ", "NURTURE"].map((intent) => (
                <label
                  key={intent}
                  className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedIntents.includes(intent)}
                    onChange={() => toggleIntent(intent)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  {intent.replace("_", " ")}
                </label>
              ))}
            </div>
          </div>

          <hr className="border-border" />

          {/* SLA Health Filters */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              SLA Health
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedSlas.includes("GREEN")}
                  onChange={() => toggleSla("GREEN")}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                Green (&gt; 1h)
              </label>
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedSlas.includes("YELLOW")}
                  onChange={() => toggleSla("YELLOW")}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                Yellow (&lt; 1h)
              </label>
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedSlas.includes("RED")}
                  onChange={() => toggleSla("RED")}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                Red (overdue)
              </label>
            </div>
          </div>
        </div>

        {/* Main Content (Table) */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search lead email, company, or reply keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-card border-border w-full focus-visible:ring-primary"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Table list */}
          {isLoading && !data ? (
            <div className="flex items-center justify-center py-20 bg-card rounded-xl border border-border">
              <LoadingSpinner label="Loading replies inbox..." />
            </div>
          ) : error ? (
            <ErrorState
              message="Failed to load review items."
              onRetry={() => mutate()}
            />
          ) : data?.data.length === 0 ? (
            <EmptyState
              title="No pending replies — queue is clear"
              description="Great job! There are no replies matching your filter criteria right now."
            />
          ) : (
            <div className="bg-card rounded-xl border border-border p-4">
              <DataTable columns={columns} data={data?.data ?? []} pageSize={25} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
