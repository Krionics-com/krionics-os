"use client";

import { useRouter } from "next/navigation";

export function Navbar() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div className="text-lg font-semibold">Krionics Operator Dashboard</div>
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
