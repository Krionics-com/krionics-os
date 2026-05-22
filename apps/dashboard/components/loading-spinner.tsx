"use client";

type LoadingSpinnerProps = {
  label?: string;
};

export function LoadingSpinner({ label = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      <span>{label}</span>
    </div>
  );
}
