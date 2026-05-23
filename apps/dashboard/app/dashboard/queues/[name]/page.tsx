"use client";

import { use } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
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
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const QUEUE_LABELS: Record<string, string> = {
  "reply-ingest": "Reply Ingest",
  "reply-classification": "Reply Classification",
  "reply-draft_generation": "Draft Generation",
  "reply-review_dispatch": "Review Dispatch",
  "reply-scheduled-send": "Scheduled Send",
};

export default function QueueDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/queues/${name}`,
    fetcher,
    { refreshInterval: 10000 }
  );
  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/dashboard/queues/${name}/retry-failed`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success(`Retried ${body.retried} failed jobs`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Retry failed");
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
          <p className="text-destructive font-medium">Failed to load queue details</p>
          <p className="text-sm text-muted-foreground mt-1">{error?.message || "Unknown error"}</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = (data.depthChart ?? []).map((d: any) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/queues">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-3xl font-bold">
            {QUEUE_LABELS[name] ?? name}
          </h1>
          <p className="text-sm text-muted-foreground font-mono">{name}</p>
        </div>
        {data.isPaused && (
          <Badge variant="outline" className="ml-2">
            Paused
          </Badge>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Pending", value: data.counts?.waiting ?? 0 },
          { label: "Active", value: data.counts?.active ?? 0 },
          {
            label: "Completed (24h)",
            value: data.counts?.completed ?? 0,
          },
          {
            label: "Failed (24h)",
            value: data.counts?.failed ?? 0,
            destructive: true,
          },
          {
            label: "Processing Rate",
            value: `${Math.round(
              ((data.counts?.completed ?? 0) /
                Math.max(1, 24)) *
                10
            ) / 10}/hr`,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  stat.destructive ? "text-destructive" : ""
                }`}
              >
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Depth chart */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Depth (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="depth"
                  stroke="#C4521C"
                  fill="#C4521C"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Active jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Jobs</CardTitle>
          <Badge variant="secondary">{data.activeJobs?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent>
          {data.activeJobs?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Elapsed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activeJobs.map((j: any) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">
                      {j.id}
                    </TableCell>
                    <TableCell>{j.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {j.processedOn
                        ? new Date(j.processedOn).toLocaleTimeString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {j.elapsedMs > 0
                        ? `${Math.round(j.elapsedMs / 1000)}s`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No active jobs
            </p>
          )}
        </CardContent>
      </Card>

      {/* Failed jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Failed Jobs</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="destructive">{data.failedJobs?.length ?? 0}</Badge>
            {isAdmin && data.failedJobs?.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => retryJob("all")}
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Retry All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data.failedJobs?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Failed At</TableHead>
                  <TableHead className="text-right">Retries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.failedJobs.map((j: any) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">
                      {j.id}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs text-destructive">
                      {j.failedReason}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {j.finishedOn
                        ? new Date(j.finishedOn).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {j.attemptsMade}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No failed jobs
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
