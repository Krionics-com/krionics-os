"use client";

import useSWR from "swr";
import { ReplyQueueTable, type ReplyQueueItem } from "@/components/reply-queue-table";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ReviewQueuePage() {
  const { data, error } = useSWR(
    "/api/reply-items?status=PENDING_REVIEW&skip=0&limit=20",
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: true, shouldRetryOnError: false }
  );

  if (error) {
    return <div className="text-red-600">Failed to load queue.</div>;
  }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review Queue</h1>
          <p className="text-sm text-gray-500">Pending replies awaiting approval.</p>
        </div>
      </div>
      <ReplyQueueTable rows={rows} />
    </div>
  );
}
