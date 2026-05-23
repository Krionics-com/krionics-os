"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Inbox,
  Zap,
  Building2,
  Activity,
  AlertTriangle,
  Users,
  Settings,
  Sparkles,
  ScrollText,
  BarChart2,
  LineChart,
  UserCircle,
  Mail,
  Globe,
  Bell,
  ClipboardList,
  PhoneCall,
  Sliders,
  Flag,
} from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Review Queue", href: "/dashboard/review", icon: Inbox },
  { name: "Campaigns", href: "/dashboard/campaigns", icon: Zap },
  { name: "Clients", href: "/dashboard/clients", icon: Building2 },
  { name: "Queues", href: "/dashboard/queues", icon: Activity },
  { name: "DLQ", href: "/dashboard/dlq", icon: AlertTriangle },
  { name: "AI Prompts", href: "/dashboard/ai/prompts", icon: Sparkles },
  { name: "AI Logs", href: "/dashboard/ai/logs", icon: ScrollText },
  { name: "AI Analytics", href: "/dashboard/ai/analytics", icon: BarChart2 },
  { name: "Analytics", href: "/dashboard/analytics/operations", icon: LineChart },
  { name: "Alerts", href: "/dashboard/alerts", icon: Bell },
  { name: "Voice Calls", href: "/dashboard/voice", icon: PhoneCall },
  { name: "Audit Log", href: "/dashboard/audit", icon: ClipboardList },
  { name: "Inboxes", href: "/dashboard/infra/inboxes", icon: Mail },
  { name: "Domains", href: "/dashboard/infra/domains", icon: Globe },
  { name: "Operators", href: "/dashboard/admin", icon: Users, adminOnly: true },
  { name: "Features", href: "/dashboard/admin/features", icon: Flag, adminOnly: true },
  { name: "Configuration", href: "/dashboard/admin/config", icon: Sliders, adminOnly: true },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar({ isOpen = true, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  
  const { data: queueData } = useSWR("/api/reply-items?status=PENDING_REVIEW&skip=0&limit=1", fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: true
  });

  const { data: alertsData } = useSWR("/api/dashboard/alerts", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true
  });
  
  const { data: user } = useSWR("/api/auth/me", fetcher);

  const pendingCount = queueData?.total ?? 0;
  const alertsCount = alertsData?.alerts
    ? alertsData.alerts.filter((a: any) => a.status === "new" && (a.severity === "critical" || a.severity === "warning")).length
    : 0;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-200 ease-in-out md:static md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <span className="font-heading text-2xl font-bold text-primary">Krionics</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => {
                if (window.innerWidth < 768 && onClose) onClose();
              }}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <div className="flex items-center">
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-sidebar-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </div>
              {item.name === "Review Queue" && pendingCount > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    isActive
                      ? "bg-white text-primary"
                      : "bg-primary text-white"
                  )}
                >
                  {pendingCount}
                </span>
              )}
              {item.name === "Alerts" && alertsCount > 0 && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-rose-500 text-white animate-pulse"
                >
                  {alertsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <Link href="/dashboard/settings" className="flex items-center gap-3">
          <UserCircle className="h-8 w-8 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.email || "Operator"}</span>
            <span className="text-xs text-muted-foreground capitalize">{user?.role?.replace("_", " ") || "Loading..."}</span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
