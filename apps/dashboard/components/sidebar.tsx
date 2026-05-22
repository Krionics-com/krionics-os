"use client";

import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Sidebar({ isOpen = true, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { data } = useSWR("/api/reply-items?status=PENDING_REVIEW&skip=0&limit=1", fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: true
  });

  const pendingCount = data?.total ?? 0;

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white px-4 py-6 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="mb-6 text-xl font-bold">Krionics</div>
      <nav className="flex flex-col gap-2 text-sm">
        <Link className="rounded-md px-3 py-2 hover:bg-gray-100" href="/dashboard">
          Dashboard
        </Link>
        <Link className="rounded-md px-3 py-2 hover:bg-gray-100 md:hidden" href="#" onClick={(e) => { e.preventDefault(); onClose && onClose(); }}>
          Close
        </Link>
        <Link className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-100" href="/dashboard/review">
          <span>Review Queue</span>
          <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
            {pendingCount}
          </span>
        </Link>
        <Link className="rounded-md px-3 py-2 hover:bg-gray-100" href="/dashboard/settings">
          Settings
        </Link>
      </nav>
    </aside>
  );
}
