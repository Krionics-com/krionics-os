"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE_MS = 60 * 1000; // 1 minute warning before logout

export function SessionManager({ children }: { children: React.ReactNode }) {
  const [lastActivity, setLastActivity] = useState(Date.now());
  const warningShown = useRef(false);
  const router = useRouter();

  const handleActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [handleActivity]);

  useEffect(() => {
    const checkIdle = setInterval(() => {
      const idleTime = Date.now() - lastActivity;
      
      if (idleTime > IDLE_TIMEOUT_MS) {
        // Logout
        fetch("/api/auth/logout", { method: "POST" }).then(() => {
          toast.error("Session expired due to inactivity.");
          router.push("/login?expired=1");
        });
      } else if (idleTime > IDLE_TIMEOUT_MS - WARNING_BEFORE_MS) {
        // Only show warning once
        if (!warningShown.current) {
          warningShown.current = true;
          toast.warning("Your session will expire soon due to inactivity. Move your mouse to stay logged in.");
        }
      } else {
        // Reset warning when user becomes active again
        warningShown.current = false;
      }
    }, 10000); // Check every 10s

    return () => clearInterval(checkIdle);
  }, [lastActivity, router]);

  // Optionally refresh token (e.g. pinging an endpoint every few minutes)
  useEffect(() => {
    const refreshToken = setInterval(() => {
      fetch("/api/auth/refresh", { method: "POST" }).catch(() => {});
    }, 5 * 60 * 1000); // every 5 mins
    return () => clearInterval(refreshToken);
  }, []);

  return <>{children}</>;
}
