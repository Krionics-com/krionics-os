"use client";

import useSWR from "swr";
import { ReplyQueueTable, type ReplyQueueItem } from "@/components/reply-queue-table";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorState } from "@/components/error-state";
import { fetchJson, isRetryableStatus, getErrorMessage } from "@/lib/http";

type ReplyItemResponse = {
  data: any[];
  total: number;
};

const fetcher = (url: string) => fetchJson<ReplyItemResponse>(url);

export default function ReviewQueuePage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/reply-items?status=PENDING_REVIEW&skip=0&limit=20",
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

  if (isLoading && !data) {
    return <LoadingSpinner label="Loading review queue..." />;
  }

  if (error && !data) {
    return <ErrorState message={getErrorMessage(error, "Failed to load queue.")} onRetry={() => mutate()} />;
  }

  const pendingCount = data?.total ?? 0;

  const rows: ReplyQueueItem[] = (data?.data ?? []).map((item: any) => ({
    id: item.id,
    lead_email: item.lead_email,
    company: item.company,
    intent: item.intent,
    confidence: item.confidence,
    reply_subject: item.reply_subject,
    body_preview: (item.body_text ?? item.reply_subject ?? "").slice(0, 60),
    created_at: item.created_at
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Review Queue ({pendingCount} pending)
          </h1>
          <p className="text-sm text-gray-500">Pending replies awaiting approval.</p>
        </div>
      </div>
      <ReplyQueueTable rows={rows} />
    </div>
  );
}
