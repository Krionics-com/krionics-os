"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorState } from "@/components/error-state";
import { fetchJson, fetchJsonWithRetry, getErrorMessage, isRetryableStatus } from "@/lib/http";

type ProfileResponse = {
  operator: {
    id: string;
    email: string;
    name: string;
    role: string;
    client_access: string[] | null;
  };
};

export default function SettingsPage() {
  const { data, error, isLoading, mutate } = useSWR<ProfileResponse>("/api/auth/me", fetchJson, {
    revalidateOnFocus: true,
    onErrorRetry: (err, _key, _config, revalidate, opts) => {
      if (!isRetryableStatus(err?.status) || opts.retryCount >= 3) {
        return;
      }
      const delay = 1000 * Math.pow(2, opts.retryCount);
      setTimeout(() => revalidate({ retryCount: opts.retryCount + 1 }), delay);
    }
  });

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (form.newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setErrorMessage("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchJsonWithRetry("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: form.currentPassword,
          new_password: form.newPassword
        })
      });
      setSuccessMessage("Password changed successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setErrorMessage(getErrorMessage(err, "Failed to change password."));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner label="Loading settings..." />;
  }

  if (error) {
    return <ErrorState message={getErrorMessage(error, "Failed to load settings")} onRetry={() => mutate()} />;
  }

  const profile = data?.operator;

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your profile and security credentials.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Details Card */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
          <h2 className="text-lg font-semibold text-gray-900">Profile Details</h2>
          <p className="mt-1 text-sm text-gray-500">Basic account details for your session.</p>

          <div className="mt-6 space-y-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Name</span>
              <p className="text-sm font-medium text-gray-800">{profile?.name || "N/A"}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Email Address</span>
              <p className="text-sm font-medium text-gray-800">{profile?.email || "N/A"}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Role</span>
              <p className="mt-1">
                <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-500/10 ring-inset uppercase">
                  {profile?.role || "reviewer"}
                </span>
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Client Access</span>
              <p className="text-sm font-medium text-gray-800">
                {profile?.client_access === null
                  ? "Global Access (All Clients)"
                  : `${profile?.client_access.length} Clients`}
              </p>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
          <p className="mt-1 text-sm text-gray-500">Ensure your account is using a secure password.</p>

          <form onSubmit={handlePasswordChange} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="current-password">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                required
                className="mt-1 flex min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs transition-colors focus:border-gray-900 focus:outline-hidden"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="new-password">
                New Password (min 8 chars)
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                className="mt-1 flex min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs transition-colors focus:border-gray-900 focus:outline-hidden"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                className="mt-1 flex min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs transition-colors focus:border-gray-900 focus:outline-hidden"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
            </div>

            {successMessage && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 animate-fade-in">
                {successMessage}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 animate-fade-in">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-all hover:bg-gray-800 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              {submitting ? "Changing Password..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
