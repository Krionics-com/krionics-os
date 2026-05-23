import { DashboardShell } from "@/components/dashboard-shell";
import { SessionManager } from "@/components/session-manager";
import CommandPalette from "@/components/command-palette";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <SessionManager>
        {children}
        <CommandPalette />
      </SessionManager>
    </DashboardShell>
  );
}
