"use client";

import React, { useState, useEffect, useRef, Fragment } from "react";
import ReactDOM from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search, FileText, ArrowRight, CornerDownLeft, Command,
  Building, Target, User, MessageSquare, ClipboardList,
  PhoneCall, Sliders, Zap, Bell, Sparkles, ScrollText,
  BarChart2, LineChart, Activity, AlertTriangle, Mail, Globe, Users, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

// Static Navigation shortcuts
const NAV_SHORTCUTS = [
  { name: "Review Queue", href: "/dashboard/review", icon: MessageSquare },
  { name: "Campaigns", href: "/dashboard/campaigns", icon: Target },
  { name: "Clients", href: "/dashboard/clients", icon: Building },
  { name: "Queues", href: "/dashboard/queues", icon: Activity },
  { name: "AI Prompts", href: "/dashboard/ai/prompts", icon: Sparkles },
  { name: "Alerts", href: "/dashboard/alerts", icon: Bell },
  { name: "Voice Calls", href: "/dashboard/voice", icon: PhoneCall },
  { name: "Audit Log", href: "/dashboard/audit", icon: ClipboardList },
  { name: "Features", href: "/dashboard/admin/features", icon: Zap },
  { name: "Configuration", href: "/dashboard/admin/config", icon: Sliders }
];

// Quick Actions
const QUICK_ACTIONS = [
  { name: "Pause Campaign", description: "Quickly navigate to campaign dashboard", action: "> pause campaign [name]", href: "/dashboard/campaigns", icon: Target },
  { name: "Open Client Detail", description: "Direct view of customer specifications", action: "> open client [name]", href: "/dashboard/clients", icon: Building },
  { name: "Approve Draft Review", description: "Instant dispatch of pending response drafts", action: "> approve draft [id]", href: "/dashboard/review", icon: MessageSquare }
];

// Highlight component helper
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${highlight})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-transparent text-primary font-extrabold">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>({ clients: [], campaigns: [], leads: [], replies: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Global listeners
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handleToggleEvent() {
      setIsOpen((prev) => !prev);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("toggle-command-palette", handleToggleEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("toggle-command-palette", handleToggleEvent);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults({ clients: [], campaigns: [], leads: [], replies: [] });
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search query fetching
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults({ clients: [], campaigns: [], leads: [], replies: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error("Search fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Map result list items to navigate with arrow keys
  const isActionQuery = query.startsWith(">");

  const flatItems = React.useMemo(() => {
    const list: any[] = [];

    if (isActionQuery) {
      // Filter quick actions based on typed string
      const sub = query.slice(1).trim().toLowerCase();
      QUICK_ACTIONS.forEach((act) => {
        if (act.action.toLowerCase().includes(sub) || act.name.toLowerCase().includes(sub)) {
          list.push({ ...act, type: "action" });
        }
      });
      return list;
    }

    if (!query) {
      NAV_SHORTCUTS.forEach((n) => list.push({ ...n, type: "nav" }));
      return list;
    }

    results.clients.forEach((c: any) => list.push({ ...c, type: "client" }));
    results.campaigns.forEach((c: any) => list.push({ ...c, type: "campaign" }));
    results.leads.forEach((l: any) => list.push({ ...l, type: "lead" }));
    results.replies.forEach((r: any) => list.push({ ...r, type: "reply" }));

    return list;
  }, [query, results, isActionQuery]);

  // Keyboard navigation helpers
  useEffect(() => {
    setActiveIndex(0);
  }, [flatItems]);

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(flatItems.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatItems.length) % Math.max(flatItems.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = flatItems[activeIndex];
      if (selected) {
        handleSelect(selected);
      }
    }
  }

  // Action Select Handler
  function handleSelect(item: any) {
    setIsOpen(false);
    if (item.type === "nav" || item.type === "action") {
      router.push(item.href);
    } else if (item.type === "client") {
      router.push(`/dashboard/clients/${item.slug}`);
    } else if (item.type === "campaign") {
      router.push(`/dashboard/campaigns/${item.id}`);
    } else if (item.type === "lead") {
      router.push(`/dashboard/review?leadId=${item.id}`);
    } else if (item.type === "reply") {
      router.push(`/dashboard/review/${item.id}`);
    }
  }

  if (!isOpen) return null;

  // Icon mapping resolver helper
  function getIcon(item: any) {
    if (item.icon) return <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
    switch (item.type) {
      case "client": return <Building className="h-4 w-4 shrink-0 text-primary" />;
      case "campaign": return <Target className="h-4 w-4 shrink-0 text-amber-500" />;
      case "lead": return <User className="h-4 w-4 shrink-0 text-emerald-500" />;
      case "reply": return <MessageSquare className="h-4 w-4 shrink-0 text-indigo-500" />;
      default: return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
    }
  }

  // Dynamic overlays portals
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 overflow-hidden select-none">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-all" onClick={() => setIsOpen(false)} />

      {/* Main Palette Modal */}
      <div
        ref={containerRef}
        onKeyDown={handleListKeyDown}
        className="relative max-w-2xl w-full rounded-xl border border-border bg-card/90 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col max-h-[60vh]"
      >
        {/* Search header inputs */}
        <div className="flex items-center gap-3 px-4 border-b border-border/60 h-14 shrink-0">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, campaigns, leads, replies... (use '>' for actions)"
            className="flex-1 h-full bg-transparent border-0 outline-none text-sm placeholder-muted-foreground focus:ring-0"
          />
          {isLoading && <Search className="h-4 w-4 text-primary animate-spin shrink-0" />}
          <div className="flex items-center gap-1 shrink-0 bg-muted/60 px-1.5 py-0.5 rounded border text-[9px] font-bold font-mono">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </div>
        </div>

        {/* Scrollable list content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          
          {flatItems.length === 0 && !isLoading && (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
              <p className="font-bold">No results found</p>
              <p className="opacity-70">Try adjusting your query terms or syntax.</p>
            </div>
          )}

          {/* Rendering items */}
          <div className="space-y-1">
            {isActionQuery && <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 pb-1.5">Action Shortcuts</div>}
            {!query && <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 pb-1.5">Quick Navigation Shortcuts</div>}

            {flatItems.map((item, index) => {
              const isActive = index === activeIndex;
              const hasMatchingQuery = query && !isActionQuery;

              return (
                <div
                  key={index}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all gap-3",
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("p-1.5 rounded-md", isActive ? "bg-primary/20" : "bg-muted")}>
                      {getIcon(item)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate">
                        {item.type === "client" && <HighlightedText text={item.company_name} highlight={query} />}
                        {item.type === "campaign" && <HighlightedText text={item.name} highlight={query} />}
                        {item.type === "lead" && (
                          <HighlightedText text={`${item.first_name || ""} ${item.last_name || ""}`} highlight={query} />
                        )}
                        {item.type === "reply" && (
                          <span>
                            Reply from <HighlightedText text={`${item.first_name || ""} ${item.last_name || ""}`} highlight={query} />
                          </span>
                        )}
                        {item.type === "nav" && item.name}
                        {item.type === "action" && item.name}
                      </span>
                      
                      {/* Secondary descriptors */}
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {item.type === "client" && `Status: ${item.status}`}
                        {item.type === "campaign" && `Client: ${item.client_name} • Status: ${item.status}`}
                        {item.type === "lead" && `${item.email} • Client: ${item.company}`}
                        {item.type === "reply" && `Status: ${item.status} • Intent: ${item.intent || "Unknown"}`}
                        {item.type === "nav" && "Static Navigation Link"}
                        {item.type === "action" && item.description}
                      </span>
                    </div>
                  </div>

                  {/* Hotkey hint indicator */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.type === "action" && (
                      <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border border-border/80 bg-muted/30">
                        {item.action}
                      </span>
                    )}
                    {isActive && (
                      <div className="flex items-center gap-0.5 text-[10px] text-primary font-bold">
                        <span>Go</span>
                        <CornerDownLeft className="h-3 w-3" />
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Footer shortcuts hints bar */}
        <div className="h-9 shrink-0 border-t border-border/40 bg-muted/20 px-4 flex items-center justify-between text-[9.5px] text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="font-mono bg-muted px-1 rounded border">↑↓</span> Move
            </span>
            <span className="flex items-center gap-1">
              <span className="font-mono bg-muted px-1.5 rounded border">Enter</span> Select
            </span>
            <span className="flex items-center gap-1">
              <span className="font-mono bg-muted px-1 rounded border">Esc</span> Close
            </span>
          </div>
          <div>
            <span className="font-semibold text-primary">Krionics OS</span>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
