"use client";

import useSWR from "swr";
import { fetchJson } from "@/lib/http";
import { CheckCircle2, AlertCircle, XOctagon, Inbox, Calendar, Flame, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";

type ActivityEvent = {
  id: string;
  type: 'NEW_REPLY' | 'APPROVED' | 'REJECTED' | 'BOOKED' | 'SLA_BREACH' | 'FAILED' | 'BOUNCE' | 'REGENERATED';
  message: string;
  created_at: string;
  status: 'success' | 'warning' | 'error' | 'info';
  link?: { text: string; href: string };
};

const fetcher = (url: string) => fetchJson<{ data: ActivityEvent[] }>(url);

const iconMap = {
  NEW_REPLY: <Inbox className="h-4 w-4 text-blue-500" />,
  APPROVED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  REJECTED: <XOctagon className="h-4 w-4 text-red-500" />,
  BOOKED: <Calendar className="h-4 w-4 text-purple-500" />,
  SLA_BREACH: <AlertCircle className="h-4 w-4 text-orange-500" />,
  FAILED: <Flame className="h-4 w-4 text-red-500" />,
  BOUNCE: <XOctagon className="h-4 w-4 text-orange-500" />,
  REGENERATED: <RefreshCw className="h-4 w-4 text-primary" />,
};

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export function ActivityFeed() {
  const { data, error, isLoading } = useSWR('/api/dashboard/activity', fetcher, {
    refreshInterval: 5000, // 5s polling
  });

  if (isLoading && !data) {
    return <div className="text-sm text-muted-foreground py-4 animate-pulse">Loading activity...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500 py-4 font-medium flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Failed to load activity feed.</div>;
  }

  if (!data?.data || data.data.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">No recent activity.</div>;
  }

  return (
    <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
      {data.data.map((event, idx) => (
        <div key={`${event.id}-${event.created_at}-${idx}`} className="flex gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors border-l-2 border-transparent hover:border-primary">
          <div className="mt-0.5 bg-background p-1.5 rounded-full border border-border shadow-xs">
            {iconMap[event.type] || <Zap className="h-4 w-4 text-gray-500" />}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div className="font-medium text-sm text-foreground leading-snug">{event.message}</div>
              <div className="text-xs font-medium text-muted-foreground whitespace-nowrap ml-4">
                {formatRelativeTime(event.created_at)}
              </div>
            </div>
            {event.link && (
              <Link href={event.link.href} className="text-xs text-primary font-semibold hover:underline mt-1 inline-block">
                {event.link.text}
              </Link>
            )}
          </div>
          <div className="flex items-center">
             {event.status === 'error' && <span title="Error"><XOctagon className="h-4 w-4 text-red-500" /></span>}
             {event.status === 'success' && <span title="Success"><CheckCircle2 className="h-4 w-4 text-green-500" /></span>}
             {event.status === 'warning' && <span title="Warning"><AlertCircle className="h-4 w-4 text-yellow-500" /></span>}
          </div>
        </div>
      ))}
    </div>
  );
}
