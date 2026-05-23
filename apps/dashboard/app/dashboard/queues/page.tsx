"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Activity, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type QueueInfo = {
  name: string;
  pending: number;
  active: number;
  failed: number;
  delayed: number;
  oldestAgeMinutes: number;
  isPaused: boolean;
};

function getStatusVariant(q: QueueInfo): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (q.failed > 10 || q.pending > 200) return { label: "Critical", variant: "destructive" };
  if (q.pending >= 50 || q.failed > 0) return { label: "Warning", variant: "secondary" };
  return { label: "Healthy", variant: "default" };
}

function getStatusColor(q: QueueInfo): string {
  if (q.failed > 10 || q.pending > 200) return "bg-red-500";
  if (q.pending >= 50 || q.failed > 0) return "bg-yellow-500";
  return "bg-green-500";
}

const QUEUE_LABELS: Record<string, string> = {
  "reply-ingest": "Ingest",
  "reply-classification": "Classification",
  "reply-draft_generation": "Draft Generation",
  "reply-review_dispatch": "Review Dispatch",
  "reply-scheduled-send": "Scheduled Send",
};

export default function QueuesPage() {
  const { data, error, isLoading, mutate } = useSWR<{
    queues: QueueInfo[];
    updatedAt: string;
  }>("/api/dashboard/queues", fetcher, { refreshInterval: 10000 });

  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [flushConfirm, setFlushConfirm] = useState<string | null>(null);

  async function queueAction(name: string, action: string) {
    setActionLoading(`${name}-${action}`);
    try {
      const res = await fetch(`/api/dashboard/queues/${name}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success(`Queue "${name}" — ${action} successful`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="mx-auto max-w-xl mt-12">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Failed to load queue data</p>
          <p className="text-sm text-muted-foreground mt-1">{error?.message || "Unknown error"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Queue Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time RICR pipeline queue health • Last updated{" "}
            {new Date(data.updatedAt).toLocaleTimeString()}
          </p>
        </div>
        <Activity className="h-8 w-8 text-primary" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Pending</p>
            <p className="text-2xl font-bold mt-1">
              {data.queues.reduce((s, q) => s + q.pending, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Active</p>
            <p className="text-2xl font-bold mt-1">
              {data.queues.reduce((s, q) => s + q.active, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Failed</p>
            <p className="text-2xl font-bold text-destructive mt-1">
              {data.queues.reduce((s, q) => s + q.failed, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Paused</p>
            <p className="text-2xl font-bold mt-1">
              {data.queues.filter((q) => q.isPaused).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Queue table */}
      <Card>
        <CardHeader>
          <CardTitle>RICR Queues</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Oldest (min)</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.queues.map((q) => {
                const status = getStatusVariant(q);
                const statusColor = getStatusColor(q);
                return (
                  <TableRow key={q.name}>
                    <TableCell>
                      <Link
                        href={`/dashboard/queues/${q.name}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {QUEUE_LABELS[q.name] ?? q.name}
                      </Link>
                      {q.isPaused && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Paused
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{q.pending}</TableCell>
                    <TableCell className="text-right font-mono">{q.active}</TableCell>
                    <TableCell className="text-right font-mono">{q.failed}</TableCell>
                    <TableCell className="text-right font-mono">
                      {q.oldestAgeMinutes > 0 ? `${q.oldestAgeMinutes}m` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {q.isPaused ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionLoading === `${q.name}-resume`}
                              onClick={() => queueAction(q.name, "resume")}
                              title="Resume"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionLoading === `${q.name}-pause`}
                              onClick={() => queueAction(q.name, "pause")}
                              title="Pause"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionLoading === `${q.name}-retry-failed` || q.failed === 0}
                            onClick={() => queueAction(q.name, "retry-failed")}
                            title="Retry Failed"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <>
                              {flushConfirm === q.name ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={actionLoading === `${q.name}-flush`}
                                    onClick={() => {
                                      queueAction(q.name, "flush");
                                      setFlushConfirm(null);
                                    }}
                                  >
                                    Confirm
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setFlushConfirm(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setFlushConfirm(q.name)}
                                  title="Flush Queue"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
