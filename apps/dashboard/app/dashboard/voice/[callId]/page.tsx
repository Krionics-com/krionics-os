"use client";

import { use, useState, useEffect, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  PhoneCall, ArrowLeft, Search, Play, Pause, Volume2, Calendar,
  ShieldAlert, Link2, ClipboardList, Clock, Sparkles, Smile, ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TranscriptLine = {
  timestamp: string;
  speaker: "Agent" | "Lead";
  text: string;
};

export default function CallDetailPage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = use(params);
  const [searchTerm, setSearchTerm] = useState("");

  // Audio Mock Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(142); // default duration matching call
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Voice Call Detail (30s polling)
  const { data, error, isLoading } = useSWR(`/api/dashboard/voice/${callId}`, fetcher, {
    refreshInterval: 30000,
  });

  const call = data?.call;

  // Sync player duration when call loads
  useEffect(() => {
    if (call?.duration_seconds) {
      setDuration(call.duration_seconds);
    }
  }, [call]);

  // Audio Playback simulation logic
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, duration]);

  // Format mm:ss helper
  function formatTime(secs: number) {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining.toString().padStart(2, "0")}`;
  }

  // Highlight matches helper
  function highlightText(text: string, search: string) {
    if (!search || !text) return text;
    const parts = text.split(new RegExp(`(${search})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !call) {
    return (
      <Card className="mx-auto max-w-xl mt-12 border-destructive/20 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">Failed to load Call Detail Page or Call not found</p>
          <Link href="/dashboard/voice">
            <Button size="sm" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const transcript: TranscriptLine[] = call.transcript || [];
  const leadName = call.lead_first_name
    ? `${call.lead_first_name} ${call.lead_last_name || ""}`
    : "Sarah Chen";

  return (
    <div className="space-y-6">
      
      {/* Navigation & Actions Header */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/voice">
          <Button variant="ghost" size="sm" className="h-9 hover:bg-muted">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Call Monitor
          </Button>
        </Link>
        <Link href={`/dashboard/audit?search=${call.id}`}>
          <Button variant="outline" size="sm" className="h-9">
            <ClipboardList className="h-4 w-4 mr-1.5" /> View Audit Trail
          </Button>
        </Link>
      </div>

      {/* Main Header Banner Card */}
      <Card className="border-border/60 bg-gradient-to-r from-muted/20 to-muted/5">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs font-bold border-border uppercase">
                  Call ID: {call.id.slice(0, 18)}...
                </Badge>
                {call.status === "in-progress" ? (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400 animate-pulse font-semibold">
                    IN PROGRESS
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold">
                    COMPLETED
                  </Badge>
                )}
                {call.meeting_booked && (
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-400 font-bold uppercase tracking-wider">
                    🎉 Demo Booked
                  </Badge>
                )}
              </div>
              <h2 className="text-2xl font-bold font-heading">{leadName}</h2>
              <p className="text-xs text-muted-foreground">
                Email: <span className="font-mono">{call.lead_email || "sarah@acme.com"}</span> • Client Account: <span className="font-semibold text-foreground">{call.client_company_name || "Enterprise Client"}</span>
              </p>
            </div>
            <div className="flex items-center gap-6 divide-x divide-border select-none bg-background/50 p-4 rounded-xl border shrink-0">
              <div className="space-y-1 text-center pr-4">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Call Started</span>
                <span className="text-xs font-semibold font-mono block text-slate-700 dark:text-slate-300">
                  {new Date(call.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="space-y-1 text-center pl-6">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Duration</span>
                <span className="text-sm font-extrabold font-mono block text-primary">
                  {formatTime(call.duration_seconds || 0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3-Section Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Transcript Viewer (Left, 5.5 / 10 cols -> 55%) */}
        <Card className="lg:col-span-6 flex flex-col h-[640px]">
          <CardHeader className="py-4 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <PhoneCall className="h-5 w-5 text-primary" /> Live Call Transcript
              </CardTitle>
              {/* Search Within Transcript */}
              <div className="relative w-full sm:w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search keywords..."
                  className="h-8.5 w-full rounded-lg border border-input bg-transparent pl-8 pr-2.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            {transcript.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p>No transcript messages generated yet.</p>
              </div>
            ) : (
              transcript.map((line, index) => {
                const isAgent = line.speaker === "Agent";
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex flex-col space-y-1.5 p-3.5 rounded-xl border transition-all max-w-[85%]",
                      isAgent
                        ? "bg-amber-500/[0.03] border-amber-500/10 text-amber-950 dark:text-amber-300 ml-auto"
                        : "bg-muted/40 border-border text-slate-800 dark:text-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between gap-6 text-[10px] uppercase font-bold text-muted-foreground">
                      <span>{line.speaker}</span>
                      <span className="font-mono text-muted-foreground/60">{line.timestamp}</span>
                    </div>
                    <p className="text-xs leading-relaxed font-medium">
                      {highlightText(line.text, searchTerm)}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Call Insights Panel (Right, 4.5 / 10 cols -> 45%) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Section 1: Audio Playback Mock Player */}
          <Card className="border-border">
            <CardHeader className="py-4 border-b border-border/40 bg-muted/10">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Volume2 className="h-4 w-4 text-primary" /> Audio Recording Playback
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold font-mono text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              {/* Scrubber Progress Bar */}
              <div
                className="h-1.5 w-full bg-muted rounded-full overflow-hidden cursor-pointer relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const fraction = (e.clientX - rect.left) / rect.width;
                  setCurrentTime(Math.floor(fraction * duration));
                }}
              >
                <div
                  className="h-full bg-primary transition-all duration-100"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-center gap-4">
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Sentiment Analysis & Summary */}
          <Card>
            <CardHeader className="py-4 border-b border-border/40">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Sentiment & Summaries
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              
              {/* Overall Sentiment */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Overall sentiment</span>
                <div className="flex items-center gap-1.5">
                  <Smile className={cn(
                    "h-5 w-5",
                    call.sentiment === "positive" ? "text-emerald-500" :
                    call.sentiment === "negative" ? "text-rose-500" : "text-slate-400"
                  )} />
                  <span className="text-sm font-extrabold uppercase font-mono tracking-wider">
                    {call.sentiment || "Neutral"}
                  </span>
                </div>
              </div>

              {/* Sparkline Turn-by-Turn sentiments */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Turn-by-Turn Sentiment Walk</span>
                <div className="flex items-center gap-1 h-8">
                  {/* Mock turns sentiment blocks */}
                  <div className="h-6 w-full rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-700 font-extrabold font-mono" title="Turn 1: positive">+2</div>
                  <div className="h-6 w-full rounded bg-slate-500/20 border border-slate-500/30 flex items-center justify-center text-[10px] text-slate-600 font-extrabold font-mono" title="Turn 2: neutral">0</div>
                  <div className="h-6 w-full rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-700 font-extrabold font-mono" title="Turn 3: positive">+3</div>
                  <div className="h-6 w-full rounded bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center text-[10px] text-emerald-700 font-extrabold font-mono" title="Turn 4: highly positive">+4</div>
                </div>
              </div>

              {/* Auto Generated Summary */}
              <div className="space-y-1.5 pt-3 border-t border-border/40">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Auto-Generated Summary</span>
                <p className="text-xs leading-relaxed font-medium text-slate-700 dark:text-slate-300">
                  {call.summary || "No post-call agent analysis generated yet."}
                </p>
              </div>

            </CardContent>
          </Card>

          {/* Section 3: Escalation Flag & Review Queues Link */}
          {(call.status === "escalated" || call.reply_item_id) && (
            <Card className="border-amber-500/10 bg-amber-500/[0.01]">
              <CardHeader className="py-4 border-b border-border/40">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-500" /> Operational Context
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                
                {/* Escalation Flag */}
                {call.status === "escalated" && (
                  <div className="space-y-1 bg-amber-500/[0.04] p-3 rounded-lg border border-amber-500/20">
                    <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Lead Escalation Reason
                    </span>
                    <p className="text-xs font-semibold leading-relaxed text-amber-900 dark:text-amber-300">
                      {call.escalation_note || "Complex technical question alignment requested by the prospect."}
                    </p>
                  </div>
                )}

                {/* Linked RICR item */}
                {call.reply_item_id && (
                  <div className="pt-2">
                    <Link href={`/dashboard/review/${call.reply_item_id}`}>
                      <Button variant="outline" size="sm" className="w-full text-xs font-bold flex items-center justify-center gap-1.5 h-9">
                        <Link2 className="h-4 w-4" />
                        <span>Navigate Linked RICR Review Item</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}

              </CardContent>
            </Card>
          )}

        </div>

      </div>

    </div>
  );
}
