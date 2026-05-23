"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Trash2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const QUEUE_OPTIONS = [
  { label: "All Queues", value: "" },
  { label: "Ingest", value: "reply-ingest" },
  { label: "Classification", value: "reply-classification" },
  { label: "Draft Generation", value: "reply-draft_generation" },
  { label: "Review Dispatch", value: "reply-review_dispatch" },
  { label: "Scheduled Send", value: "reply-scheduled-send" },
];

export default function DLQPage() {
  const [page, setPage] = useState(1);
  const [queueFilter, setQueueFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState<"retry" | "discard" | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/dlq?page=${page}&limit=20`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!data?.jobs) return [];
    return data.jobs.filter((j: any) => {
      if (queueFilter && j.originalQueue !== queueFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchId = j.id?.toLowerCase().includes(term);
        const matchError = (j.failedReason || "").toLowerCase().includes(term);
        if (!matchId && !matchError) return false;
      }
      return true;
    });
  }, [data?.jobs, queueFilter, searchTerm]);

  async function bulkAction(action: "retry" | "discard") {
    setBulkLoading(true);
    try {
      const jobs = data?.jobs ?? [];
      let count = 0;
      for (const job of jobs) {
        const res = await fetch(`/api/dashboard/dlq/${job.id}/${action}`, {
          method: "POST",
        });
        if (res.ok) count++;
      }
      toast.success(`${action === "retry" ? "Retried" : "Discarded"} ${count} jobs`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Bulk action failed");
    } finally {
      setBulkLoading(false);
      setBulkConfirm(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-xl mt-12">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Failed to load DLQ</p>
          <p className="text-sm text-muted-foreground mt-1">{error?.message || "Unknown error"}</p>
        </CardContent>
      </Card>
    );
  }

  const totalJobs = data?.total ?? 0;
  const totalPages = Math.ceil(totalJobs / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <h1 className="font-heading text-3xl font-bold">Dead Letter Queue</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Failed jobs that exhausted all retry attempts
            </p>
          </div>
        </div>
        <Badge variant="destructive" className="text-lg px-3 py-1">
          {totalJobs}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job ID or error message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {QUEUE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {isAdmin && (
              <div className="flex gap-2">
                {bulkConfirm ? (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={bulkLoading}
                      onClick={() => bulkAction(bulkConfirm)}
                    >
                      {bulkLoading ? <Spinner className="h-4 w-4 mr-1" /> : null}
                      Confirm {bulkConfirm === "retry" ? "Retry" : "Discard"} All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBulkConfirm(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setBulkConfirm("retry")}
                      disabled={totalJobs === 0}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Retry All
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setBulkConfirm("discard")}
                      disabled={totalJobs === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Discard All
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Jobs table */}
      <Card>
        <CardContent className="pt-4">
          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Original Queue</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Retries</TableHead>
                  <TableHead>Failed At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((job: any) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/dlq/${job.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {job.id?.slice(0, 12)}...
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {job.originalQueue}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate text-xs text-destructive">
                      {(job.failedReason || "").slice(0, 100)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {job.attemptsMade}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {job.finishedOn
                        ? new Date(job.finishedOn).toLocaleString()
                        : job.timestamp
                        ? new Date(job.timestamp).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">
                {totalJobs === 0
                  ? "No dead letter jobs — all systems operating normally"
                  : "No jobs match your filters"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
