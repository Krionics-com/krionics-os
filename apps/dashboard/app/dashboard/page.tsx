import Link from "next/link";
import { sql } from "@/lib/db";

export default async function DashboardPage() {
  const [pending] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count FROM reply_items WHERE status = 'PENDING_REVIEW'
  `;
  const [approvedToday] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count FROM reply_drafts
    WHERE approved_at >= DATE_TRUNC('day', NOW())
  `;
  const [suppressedToday] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count FROM reply_items
    WHERE status = 'SUPPRESSED' AND resolved_at >= DATE_TRUNC('day', NOW())
  `;
  const [sentToday] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count FROM reply_items
    WHERE status = 'SENT' AND resolved_at >= DATE_TRUNC('day', NOW())
  `;

  const cards = [
    { label: "Pending Review", value: pending?.count ?? 0 },
    { label: "Approved Today", value: approvedToday?.count ?? 0 },
    { label: "Suppressed Today", value: suppressedToday?.count ?? 0 },
    { label: "Sent Today", value: sentToday?.count ?? 0 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard Overview</h1>
        <Link
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
          href="/dashboard/review"
        >
          Go to Review Queue →
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">{card.label}</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
