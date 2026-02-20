"use client";

import { useState, useEffect } from "react";
import { Check, X, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PodInvite {
  id: string;
  pod_id: string;
  pod_name: string;
  inviter_name: string | null;
  created_at: string;
}

interface PodInvitesSectionProps {
  onUpdate?: () => void;
}

export function PodInvitesSection({ onUpdate }: PodInvitesSectionProps) {
  const [invites, setInvites] = useState<PodInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    fetchInvites();
  }, []);

  async function fetchInvites() {
    try {
      const res = await fetch("/api/pods/invites");
      if (!res.ok) throw new Error("Failed to load invites");
      const data = await res.json();
      setInvites(data.invites || []);
    } catch (err) {
      console.error("Failed to fetch pod invites:", err);
      toast.error("Failed to load pod invites");
    } finally {
      setLoading(false);
    }
  }

  async function handleResponse(inviteId: string, action: "accept" | "decline") {
    setResponding(inviteId);
    try {
      const res = await fetch(`/api/pods/invites/${inviteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error("Failed to respond");

      const data = await res.json();
      toast.success(data.message ?? "Invite updated");

      // Remove from list
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));

      // Notify parent to update counts
      onUpdate?.();
    } catch (err) {
      console.error("Failed to respond to invite:", err);
      toast.error("Failed to respond to invitation");
    } finally {
      setResponding(null);
    }
  }

  if (loading) {
    return null;
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Pod Invitations</h3>
        <Badge variant="default" className="text-xs">
          {invites.length}
        </Badge>
      </div>

      {invites.map((invite) => (
        <Card key={invite.id} className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{invite.pod_name}</p>
                <p className="text-xs text-muted-foreground">
                  Invited by {invite.inviter_name || "Unknown"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleResponse(invite.id, "accept")}
                  disabled={responding === invite.id}
                  className="h-8 px-3"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleResponse(invite.id, "decline")}
                  disabled={responding === invite.id}
                  className="h-8 px-3"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
