"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface CampaignDuplicateModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: string | null;
  campaignName: string | null;
}

export function CampaignDuplicateModal({
  open,
  onClose,
  campaignId,
  campaignName,
}: CampaignDuplicateModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (campaignName) {
      setName(`${campaignName} (Copy)`);
    } else {
      setName("");
    }
  }, [campaignName]);

  if (!open || !campaignId) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${campaignId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success("Campaign duplicated successfully");
      onClose();
      router.push(`/dashboard/campaigns/${body.campaign.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate campaign");
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
          <h2 className="font-heading text-xl font-semibold">Duplicate Campaign</h2>
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
            <Label htmlFor="dup-campaign-name">Campaign Name *</Label>
            <Input
              id="dup-campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 Outbound Campaign"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner className="h-4 w-4 mr-1.5" /> Duplicating…
                </>
              ) : (
                "Duplicate"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
