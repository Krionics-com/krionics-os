"use client";

import Link from "next/link";
import { IntentBadge } from "./intent-badge";
import { SLACountdown } from "./sla-countdown";

export type ReplyQueueItem = {
  id: string;
  lead_email: string;
  company: string | null;
  intent: string | null;
  confidence: number | null;
  reply_subject: string | null;
  body_preview: string;
  created_at: string;
};

type ReplyQueueTableProps = {
  rows: ReplyQueueItem[];
};

export function ReplyQueueTable({ rows }: ReplyQueueTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Lead Email</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Intent</th>
            <th className="px-4 py-3">Confidence</th>
            <th className="px-4 py-3">Reply Preview</th>
            <th className="px-4 py-3">SLA</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link className="text-blue-600 hover:underline" href={`/dashboard/review/${row.id}`}>
                  {row.lead_email}
                </Link>
              </td>
              <td className="px-4 py-3">{row.company ?? "-"}</td>
              <td className="px-4 py-3">
                <IntentBadge intent={row.intent} />
              </td>
              <td className="px-4 py-3">
                {row.confidence !== null && row.confidence !== undefined
                  ? `${Math.round(row.confidence * 100)}%`
                  : "-"}
              </td>
              <td className="px-4 py-3 text-gray-600">{row.body_preview}</td>
              <td className="px-4 py-3">
                <SLACountdown createdAt={row.created_at} />
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(row.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
