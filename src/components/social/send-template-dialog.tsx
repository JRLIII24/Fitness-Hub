"use client";

import { useState, useEffect, useMemo } from "react";
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
import { UserCircle2, Loader2, Search, ChevronDown, ChevronUp, Check, Dumbbell } from "lucide-react";
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
  onSend: (recipientIds: string[], template: NonNullable<SendTemplateDialogProps["template"]>, message?: string) => Promise<void>;
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open || !currentUserId) return;
    setSelectedIds(new Set());
    setSearch("");
    setMessage("");
    setPreviewOpen(false);

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

  const filteredFollowing = useMemo(() => {
    if (!search.trim()) return following;
    const q = search.toLowerCase();
    return following.filter(
      (u) =>
        u.display_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
    );
  }, [following, search]);

  function toggleRecipient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (selectedIds.size === 0 || !template) return;
    setSending(true);
    try {
      await onSend(Array.from(selectedIds), template, message.trim() || undefined);
      onClose();
    } finally {
      setSending(false);
    }
  }

  const sendLabel =
    selectedIds.size <= 1
      ? "Send"
      : `Send to ${selectedIds.size} people`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm max-h-[85dvh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Share &ldquo;{template?.name}&rdquo;</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Preview */}
          {template && template.exercises.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setPreviewOpen(!previewOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Dumbbell className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {template.exercises.length} exercise{template.exercises.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {previewOpen ? (
                  <ChevronUp className="size-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                )}
              </button>
              {previewOpen && (
                <div className="border-t border-border/30 px-3 py-2 space-y-1.5">
                  {template.description && (
                    <p className="text-[11px] text-muted-foreground mb-2">{template.description}</p>
                  )}
                  {template.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-foreground/90 font-medium">{ex.name}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground capitalize">{ex.muscle_group.replace(/_/g, " ")}</span>
                      {ex.sets.length > 0 && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{ex.sets.length} sets</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recipients */}
          <div className="space-y-1.5">
            <Label>Send to</Label>
            {loadingFollowing ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : following.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You&apos;re not following anyone yet. Follow users from the Social tab first.
              </p>
            ) : (
              <>
                {/* Search */}
                {following.length > 4 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                )}
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredFollowing.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">No matches</p>
                  ) : (
                    filteredFollowing.map((user) => {
                      const selected = selectedIds.has(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleRecipient(user.id)}
                          className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border/60 hover:bg-accent"
                          }`}
                        >
                          {selected ? (
                            <div className="flex items-center justify-center size-5 rounded-full bg-primary shrink-0">
                              <Check className="size-3 text-primary-foreground" />
                            </div>
                          ) : (
                            <UserCircle2 className="size-5 text-muted-foreground shrink-0" />
                          )}
                          <span>{user.display_name || user.username || "Anonymous"}</span>
                          {user.username && (
                            <span className="text-muted-foreground text-xs">@{user.username}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Message */}
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
          <Button onClick={handleSend} disabled={selectedIds.size === 0 || sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : sendLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
