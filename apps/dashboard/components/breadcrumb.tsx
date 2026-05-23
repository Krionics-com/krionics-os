"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const pathMap: Record<string, string> = {
  "dashboard": "Dashboard",
  "review": "Review Queue",
  "admin": "Operators",
  "settings": "Settings",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {segments.map((segment, idx) => (
        <div key={segment} className="flex items-center gap-2">
          {idx > 0 && <ChevronRight className="h-4 w-4" />}
          <Link 
            href={`/${segments.slice(0, idx + 1).join("/")}`}
            className="hover:text-foreground"
          >
            {pathMap[segment] || segment}
          </Link>
        </div>
      ))}
    </div>
  );
}
