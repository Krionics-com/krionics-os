import { DashboardShell } from "@/components/dashboard-shell";
import { SessionManager } from "@/components/session-manager";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <SessionManager>
        {children}
      </SessionManager>
    </DashboardShell>
  );
}
