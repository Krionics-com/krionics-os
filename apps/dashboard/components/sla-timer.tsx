"use client";

import React, { useEffect, useState } from "react";

interface SlaTimerProps {
  createdAt: string;
  slaHours?: number;
}

export function SlaTimer({ createdAt, slaHours = 24 }: SlaTimerProps) {
  const [displayText, setDisplayText] = useState<string>("Calculating...");
  const [colorClass, setColorClass] = useState<string>("bg-gray-100 text-gray-800");

  useEffect(() => {
    function updateTimer() {
      const createdTime = new Date(createdAt).getTime();
      const deadline = createdTime + slaHours * 60 * 60 * 1000;
      const now = Date.now();
      const diffMs = deadline - now;

      if (diffMs <= 0) {
        const overdueHrs = Math.floor(Math.abs(diffMs) / (60 * 60 * 1000));
        setDisplayText(overdueHrs === 0 ? "Overdue" : `Overdue by ${overdueHrs}h`);
        setColorClass("bg-red-100 text-red-800 font-semibold px-2.5 py-1 rounded-full text-xs");
      } else {
        const totalMinutes = Math.floor(diffMs / (60 * 1000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours >= 2) {
          setDisplayText(`${hours}h ${minutes}m left`);
          setColorClass("bg-green-100 text-green-800 font-semibold px-2.5 py-1 rounded-full text-xs");
        } else if (hours >= 1) {
          setDisplayText(`${hours}h ${minutes}m left`);
          setColorClass("bg-green-100 text-green-800 font-semibold px-2.5 py-1 rounded-full text-xs");
        } else {
          setDisplayText(`< 1h — ${minutes}m left`);
          setColorClass("bg-yellow-100 text-yellow-800 font-semibold px-2.5 py-1 rounded-full text-xs");
        }
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // update every 60s
    return () => clearInterval(interval);
  }, [createdAt, slaHours]);

  return <span className={colorClass}>{displayText}</span>;
}
