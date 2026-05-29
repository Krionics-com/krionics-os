"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Sydney", "Pacific/Auckland",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface ClientCreateModalProps {
  open: boolean;
  onClose: () => void;
}

export function ClientCreateModal({ open, onClose }: ClientCreateModalProps) {
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    slug: "",
    contact_name: "",
    contact_email: "",
    timezone: "America/New_York",
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  if (!open) return null;

  function handleCompanyChange(val: string) {
    setForm((f) => ({
      ...f,
      company_name: val,
      slug: slugManuallyEdited ? f.slug : slugify(val),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name || !form.contact_email || !form.contact_name || !form.slug) {
      toast.error("All fields are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success(`Client "${form.company_name}" created`);
      mutate("/api/dashboard/clients");
      onClose();
      setForm({ company_name: "", slug: "", contact_name: "", contact_email: "", timezone: "America/New_York" });
      setSlugManuallyEdited(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create client");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-xl font-semibold">New Client</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cc-company-name">Company Name *</Label>
            <Input
              id="cc-company-name"
              value={form.company_name}
              onChange={(e) => handleCompanyChange(e.target.value)}
              placeholder="Acme Corp"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cc-slug">
              Slug *
              <span className="ml-1 text-xs text-muted-foreground">(used in URLs, must be unique)</span>
            </Label>
            <Input
              id="cc-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }));
              }}
              placeholder="acme-corp"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-contact-name">Contact Name *</Label>
              <Input
                id="cc-contact-name"
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-contact-email">Contact Email *</Label>
              <Input
                id="cc-contact-email"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder="jane@acme.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cc-timezone">Timezone</Label>
            <select
              id="cc-timezone"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create Client"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
