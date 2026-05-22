"use client";

import { useRouter } from "next/navigation";

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 md:hidden"
          aria-label="Toggle navigation menu"
        >
          <span className="h-0.5 w-5 bg-current" />
          <span className="h-0.5 w-5 bg-current" />
          <span className="h-0.5 w-5 bg-current" />
        </button>
        <div className="text-base font-semibold md:text-lg">Krionics Operator Dashboard</div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Logout
      </button>
    </header>
  );
}
