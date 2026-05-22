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
  const [editOperator, setEditOperator] = useState<OperatorRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    role: "reviewer",
    clientAccess: ""
  });

  const { data, error, isLoading, mutate } = useSWR("/api/operators", fetcher, {
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
    setCreateForm({ email: "", name: "", role: "reviewer", clientAccess: "" });
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

      try {
        const payload = {
          email: createForm.email,
          name: createForm.name,
          role: createForm.role,
          client_access: parseClientAccess(createForm.clientAccess)
        };
        const response = await fetchJsonWithRetry<{ temp_password: string }>("/api/operators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        resetCreateForm();
        setCreateSuccess(`Temporary password: ${response.temp_password}`);
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
        await fetchJsonWithRetry(`/api/operators/${operator.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !operator.is_active })
        });
        await mutate();
      } catch (err) {
        setActionError(getErrorMessage(err, "Failed to update operator"));
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
        await fetchJsonWithRetry(`/api/operators/${operator.id}`, { method: "DELETE" });
        await mutate();
      } catch (err) {
        setActionError(getErrorMessage(err, "Failed to deactivate operator"));
      }
    },
    [mutate]
  );

  const handleEditSave = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!editOperator) {
        return;
      }

      setActionError(null);
      try {
        await fetchJsonWithRetry(`/api/operators/${editOperator.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: editOperator.role })
        });
        setEditOperator(null);
        await mutate();
      } catch (err) {
        setActionError(getErrorMessage(err, "Failed to update role"));
      }
    },
    [editOperator, mutate]
  );

  if (authError) {
    return <ErrorState message={authError} />;
  }

  if (!authChecked) {
    return <LoadingSpinner label="Checking access..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-gray-500">Manage operator accounts and access.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-[44px] rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Create Operator
        </button>
      </div>

      {actionError && <ErrorState message={actionError} onRetry={() => mutate()} />}
      {createSuccess && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {createSuccess}
        </div>
      )}

      {isLoading && <LoadingSpinner label="Loading operators..." />}
      {error && !rows.length && (
        <ErrorState message={getErrorMessage(error, "Failed to load operators")}" onRetry={() => mutate()} />
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-[900px] divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3">{row.role}</td>
                  <td className="px-4 py-3">{row.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditOperator(row)}
                        className="min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Edit Role
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(row)}
                        className="min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        {row.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="min-h-[44px] rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold">Create Operator</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Email
                <input
                  type="email"
                  className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2"
                  value={createForm.email}
                  onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
                  required
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Name
                <input
                  className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2"
                  value={createForm.name}
                  onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                  required
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Role
                <select
                  className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2"
                  value={createForm.role}
                  onChange={(event) => setCreateForm({ ...createForm, role: event.target.value })}
                >
                  <option value="admin">admin</option>
                  <option value="reviewer">reviewer</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Client Access (comma-separated UUIDs)
                <textarea
                  className="mt-1 min-h-[96px] w-full rounded-md border border-gray-300 px-3 py-2"
                  value={createForm.clientAccess}
                  onChange={(event) => setCreateForm({ ...createForm, clientAccess: event.target.value })}
                  placeholder="Leave empty for all clients"
                />
              </label>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="min-h-[44px] rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateError(null);
                  }}
                  className="min-h-[44px] rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOperator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold">Edit Role</h2>
            <form onSubmit={handleEditSave} className="mt-4 space-y-4">
              <div className="text-sm text-gray-600">{editOperator.email}</div>
              <label className="block text-sm font-medium text-gray-700">
                Role
                <select
                  className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2"
                  value={editOperator.role}
                  onChange={(event) =>
                    setEditOperator({ ...editOperator, role: event.target.value })
                  }
                >
                  <option value="admin">admin</option>
                  <option value="reviewer">reviewer</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="min-h-[44px] rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditOperator(null)}
                  className="min-h-[44px] rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
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
