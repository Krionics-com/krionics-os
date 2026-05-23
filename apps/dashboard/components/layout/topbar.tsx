"use client";

import { useRouter } from "next/navigation";
import { Menu, Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/breadcrumb";
import { ClientSwitcher } from "@/components/client-switcher";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden text-foreground"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:flex items-center gap-6">
          <Breadcrumb />
          <ClientSwitcher />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="text-foreground"
          onClick={() => window.dispatchEvent(new CustomEvent("toggle-command-palette"))}
        >
          <Search className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Alerts" className="text-foreground">
          <Bell className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </div>
    </header>
  );
}
