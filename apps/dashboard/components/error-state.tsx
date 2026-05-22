"use client";

import { useRouter } from "next/navigation";

type ErrorStateProps = {
  message: string;
  actionLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({ message, actionLabel = "Retry", onRetry }: ErrorStateProps) {
  const router = useRouter();

  const handleRetry = onRetry ?? (() => router.refresh());

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <div className="font-semibold">Something went wrong</div>
      <div className="mt-1">{message}</div>
      <button
        type="button"
        onClick={handleRetry}
        className="mt-3 min-h-[44px] rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
      >
        {actionLabel}
      </button>
    </div>
  );
}
