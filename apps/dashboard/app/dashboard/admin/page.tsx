"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ErrorState } from "@/components/error-state";
import { LoadingSpinner } from "@/components/loading-spinner";
import { fetchJson, fetchJsonWithRetry, getErrorMessage, isRetryableStatus } from "@/lib/http";

type OperatorRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  client_access: string[] | null;
  created_at: string;
};

type OperatorResponse = {
  data: OperatorRow[];
};

type ProfileResponse = {
  operator: {
    role: string;
  };
};

const fetcher = (url: string) => fetchJson<OperatorResponse>(url);

export default function AdminPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    role: "reviewer",
    password: "",
    clientAccess: ""
  });

  const { data, error, isLoading, mutate } = useSWR("/api/admin/operators", fetcher, {
    revalidateOnFocus: true,
    keepPreviousData: true,
    onErrorRetry: (err, _key, _config, revalidate, opts) => {
      if (!isRetryableStatus(err?.status) || opts.retryCount >= 3) {
        return;
      }
      const delay = 1000 * Math.pow(2, opts.retryCount);
      setTimeout(() => revalidate({ retryCount: opts.retryCount + 1 }), delay);
    }
  });

  useEffect(() => {
    let mounted = true;
    async function checkRole() {
      try {
        const profile = await fetchJsonWithRetry<ProfileResponse>("/api/auth/me");
        if (profile.operator.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        if (mounted) {
          setAuthChecked(true);
        }
      } catch (err) {
        if (mounted) {
          setAuthError(getErrorMessage(err, "Unable to verify access"));
        }
      }
    }

    checkRole();

    return () => {
      mounted = false;
    };
  }, [router]);

  const rows = useMemo(() => data?.data ?? [], [data]);

  const resetCreateForm = () => {
    setCreateForm({ email: "", name: "", role: "reviewer", password: "", clientAccess: "" });
  };

  const parseClientAccess = (value: string) => {
    const trimmed = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return trimmed.length > 0 ? trimmed : null;
  };

  const handleCreate = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setCreateError(null);
      setCreateSuccess(null);
      setActionError(null);

      if (createForm.password.length < 8) {
        setCreateError("Password must be at least 8 characters long.");
        return;
      }

      try {
        const payload = {
          email: createForm.email,
          name: createForm.name,
          role: createForm.role,
          password: createForm.password,
          client_access: parseClientAccess(createForm.clientAccess)
        };
        await fetchJsonWithRetry("/api/admin/operators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        resetCreateForm();
        setCreateSuccess("Operator created successfully.");
        setCreateOpen(false);
        await mutate();
      } catch (err) {
        setCreateError(getErrorMessage(err, "Failed to create operator"));
      }
    },
    [createForm, mutate]
  );

  const handleToggleActive = useCallback(
    async (operator: OperatorRow) => {
      setActionError(null);
      try {
        await fetchJsonWithRetry(`/api/admin/operators/${operator.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !operator.is_active })
        });
        await mutate();
      } catch (err) {
        setActionError(getErrorMessage(err, "Failed to update operator status"));
      }
    },
    [mutate]
  );

  const handleDelete = useCallback(
    async (operator: OperatorRow) => {
      if (!window.confirm(`Deactivate ${operator.email}?`)) {
        return;
      }

      setActionError(null);
      try {
        await fetchJsonWithRetry(`/api/admin/operators/${operator.id}`, { method: "DELETE" });
        await mutate();
      } catch (err) {
        setActionError(getErrorMessage(err, "Failed to deactivate operator"));
      }
    },
    [mutate]
  );

  const handleRoleChange = useCallback(
    async (operatorId: string, newRole: string) => {
      setActionError(null);
      try {
        await fetchJsonWithRetry(`/api/admin/operators/${operatorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole })
        });
        await mutate();
      } catch (err) {
        setActionError(getErrorMessage(err, "Failed to update role"));
      }
    },
    [mutate]
  );

  if (authError) {
    return <ErrorState message={authError} />;
  }

  if (!authChecked) {
    return <LoadingSpinner label="Checking access..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Manage operator profiles, role designations, and active access states.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateSuccess(null);
            setCreateError(null);
            setCreateOpen(true);
          }}
          className="flex min-h-[44px] items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-gray-800"
        >
          Create Operator
        </button>
      </div>

      {actionError && <ErrorState message={actionError} onRetry={() => mutate()} />}
      {createSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 animate-fade-in">
          {createSuccess}
        </div>
      )}

      {isLoading && <LoadingSpinner label="Loading operators..." />}
      {error && !rows.length && (
        <ErrorState message={getErrorMessage(error, "Failed to load operators")} onRetry={() => mutate()} />
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
          <table className="w-full min-w-[900px] divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/55 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{row.name}</td>
                  <td className="px-6 py-4 text-gray-600">{row.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={row.role}
                      onChange={(e) => handleRoleChange(row.id, e.target.value)}
                      className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm shadow-xs transition-colors focus:border-gray-900 focus:outline-hidden"
                    >
                      <option value="admin">admin</option>
                      <option value="reviewer">reviewer</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                        row.is_active
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-red-50 text-red-700 ring-red-600/20"
                      }`}
                    >
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(row)}
                        className="flex min-h-[44px] items-center rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        {row.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="flex min-h-[44px] items-center rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl animate-scale-up">
            <h2 className="text-lg font-bold text-gray-900">Create Operator</h2>
            <p className="mt-1 text-sm text-gray-500">Register a new operator with distinct permissions and credentials.</p>
            
            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="operator-name">
                    Name
                  </label>
                  <input
                    id="operator-name"
                    type="text"
                    className="mt-1 flex min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs focus:border-gray-900 focus:outline-hidden"
                    value={createForm.name}
                    onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="operator-email">
                    Email
                  </label>
                  <input
                    id="operator-email"
                    type="email"
                    className="mt-1 flex min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs focus:border-gray-900 focus:outline-hidden"
                    value={createForm.email}
                    onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="operator-role">
                    Role
                  </label>
                  <select
                    id="operator-role"
                    className="mt-1 flex min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white shadow-xs focus:border-gray-900 focus:outline-hidden"
                    value={createForm.role}
                    onChange={(event) => setCreateForm({ ...createForm, role: event.target.value })}
                  >
                    <option value="admin">admin</option>
                    <option value="reviewer">reviewer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="operator-password">
                    Password (min 8 chars)
                  </label>
                  <input
                    id="operator-password"
                    type="password"
                    className="mt-1 flex min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs focus:border-gray-900 focus:outline-hidden"
                    value={createForm.password}
                    onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="operator-client-access">
                  Client Access (comma-separated UUIDs)
                </label>
                <textarea
                  id="operator-client-access"
                  className="mt-1 flex min-h-[96px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs focus:border-gray-900 focus:outline-hidden"
                  value={createForm.clientAccess}
                  onChange={(event) => setCreateForm({ ...createForm, clientAccess: event.target.value })}
                  placeholder="Leave empty for all clients"
                />
              </div>

              {createError && <p className="text-sm text-red-650 animate-fade-in">{createError}</p>}
              
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  className="flex min-h-[44px] items-center justify-center rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateError(null);
                    resetCreateForm();
                  }}
                  className="flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
