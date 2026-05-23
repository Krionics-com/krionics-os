"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DLQJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const { data, error, isLoading, mutate } = useSWR(
    `/api/dashboard/dlq/${jobId}`,
    fetcher
  );
  const { data: user } = useSWR("/api/auth/me", fetcher);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function jobAction(action: string) {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/dashboard/dlq/${jobId}/${action}`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success(
        action === "retry"
          ? "Job queued for retry"
          : "Job discarded"
      );
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function escalate() {
    setActionLoading("escalate");
    try {
      const webhookUrl = process.env.NEXT_PUBLIC_SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        toast.error("No Slack webhook configured");
        return;
      }
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 DLQ Job Escalated\nJob: ${jobId}\nQueue: ${data?.originalQueue}\nError: ${data?.failedReason?.slice(0, 200)}`,
        }),
      });
      toast.success("Escalated to Slack");
    } catch {
      toast.error("No Slack webhook configured");
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
          <p className="text-destructive font-medium">Job not found</p>
          <Link href="/dashboard/dlq">
            <Button variant="ghost" size="sm" className="mt-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to DLQ
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/dlq">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold">DLQ Job Detail</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            {data.id}
          </p>
        </div>
        <Badge variant="outline">{data.originalQueue}</Badge>
      </div>

      {/* Actions */}
      {isAdmin && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={actionLoading === "retry"}
            onClick={() => jobAction("retry")}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            {actionLoading === "retry" ? "Retrying..." : "Retry Job"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={actionLoading === "discard"}
            onClick={() => jobAction("discard")}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {actionLoading === "discard" ? "Discarding..." : "Discard Job"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={actionLoading === "escalate"}
            onClick={escalate}
          >
            <Send className="h-4 w-4 mr-1" />
            Escalate to Admin
          </Button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Job payload */}
        <Card>
          <CardHeader>
            <CardTitle>Job Payload</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto">
              {JSON.stringify(data.data, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {/* Right: Error details */}
        <Card>
          <CardHeader>
            <CardTitle>Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Error Message
                </p>
                <p className="text-sm text-destructive font-medium">
                  {data.failedReason || data.data?.error?.message || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Stack Trace
                </p>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-[300px] overflow-y-auto">
                  {data.stacktrace?.join("\n") ||
                    data.data?.error?.stack ||
                    "No stack trace available"}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retry history */}
      <Card>
        <CardHeader>
          <CardTitle>Job Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Attempts Made
              </p>
              <p className="text-lg font-bold mt-1">{data.attemptsMade}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Created
              </p>
              <p className="text-sm mt-1">
                {data.timestamp
                  ? new Date(data.timestamp).toLocaleString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Processed
              </p>
              <p className="text-sm mt-1">
                {data.processedOn
                  ? new Date(data.processedOn).toLocaleString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Finished
              </p>
              <p className="text-sm mt-1">
                {data.finishedOn
                  ? new Date(data.finishedOn).toLocaleString()
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
