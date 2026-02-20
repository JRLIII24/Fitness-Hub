"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle2, Loader2 } from "lucide-react";
import type { TemplateSnapshot } from "@/hooks/use-shared-items";

interface Recipient {
  id: string;
  display_name: string | null;
  username: string | null;
}

interface SendTemplateDialogProps {
  open: boolean;
  currentUserId: string | null;
  template: {
    id: string;
    name: string;
    description: string | null;
    exercises: TemplateSnapshot["exercises"];
  } | null;
  onClose: () => void;
  onSend: (recipientId: string, template: SendTemplateDialogProps["template"] & object, message?: string) => Promise<void>;
}

export function SendTemplateDialog({
  open,
  currentUserId,
  template,
  onClose,
  onSend,
}: SendTemplateDialogProps) {
  const supabase = useSupabase();
  const [following, setFollowing] = useState<Recipient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => {
    if (!open || !currentUserId) return;
    setSelectedId(null);
    setMessage("");

    setLoadingFollowing(true);
    supabase
      .from("user_follows")
      .select(`following_id, profiles!user_follows_following_id_fkey(id, display_name, username)`)
      .eq("follower_id", currentUserId)
      .then(({ data }) => {
        if (data) {
          setFollowing(
            data
              .map((f) => f.profiles as unknown as Recipient | null)
              .filter(Boolean) as Recipient[]
          );
        }
        setLoadingFollowing(false);
      });
  }, [open, currentUserId, supabase]);

  async function handleSend() {
    if (!selectedId || !template) return;
    setSending(true);
    try {
      await onSend(selectedId, template, message.trim() || undefined);
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send &ldquo;{template?.name}&rdquo;</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Send to</Label>
            {loadingFollowing ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : following.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You&apos;re not following anyone yet. Follow users from the Social tab first.
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {following.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedId(user.id)}
                    className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                      selectedId === user.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:bg-accent"
                    }`}
                  >
                    <UserCircle2 className="size-5 text-muted-foreground shrink-0" />
                    <span>{user.display_name || user.username || "Anonymous"}</span>
                    {user.username && (
                      <span className="text-muted-foreground text-xs">@{user.username}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="send-msg">Message (optional)</Label>
            <Input
              id="send-msg"
              placeholder="Give them some context…"
              maxLength={100}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={!selectedId || sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
