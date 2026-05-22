"use client";

import { useEffect, useMemo, useState } from "react";

type SLACountdownProps = {
  createdAt: string;
  slaHours?: number;
};

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function SLACountdown({ createdAt, slaHours = 4 }: SLACountdownProps) {
  const deadline = useMemo(() => {
    return new Date(new Date(createdAt).getTime() + slaHours * 3600 * 1000);
  }, [createdAt, slaHours]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const remainingMs = deadline.getTime() - now;
  const overdue = remainingMs <= 0;
  const warn = remainingMs > 0 && remainingMs < 60 * 60 * 1000;

  const className = overdue
    ? "text-red-600"
    : warn
      ? "text-yellow-600"
      : "text-gray-700";

  return (
    <span className={`text-sm font-medium ${className}`}>
      {overdue ? "Overdue" : formatDuration(remainingMs)}
    </span>
  );
}
