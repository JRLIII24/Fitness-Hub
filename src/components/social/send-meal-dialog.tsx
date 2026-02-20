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
import type { MealDaySnapshot } from "@/hooks/use-shared-items";

interface Recipient {
  id: string;
  display_name: string | null;
  username: string | null;
}

interface SendMealDialogProps {
  open: boolean;
  currentUserId: string | null;
  snapshot: MealDaySnapshot | null;
  onClose: () => void;
  onSend: (recipientId: string, snapshot: MealDaySnapshot, message?: string) => Promise<void>;
}

export function SendMealDialog({
  open,
  currentUserId,
  snapshot,
  onClose,
  onSend,
}: SendMealDialogProps) {
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
    if (!selectedId || !snapshot) return;
    setSending(true);
    try {
      await onSend(selectedId, snapshot, message.trim() || undefined);
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share Today&apos;s Meals</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Macro preview */}
          {snapshot && (
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 p-3 text-center text-xs">
              <div>
                <p className="font-semibold">{Math.round(snapshot.totals.calories)}</p>
                <p className="text-muted-foreground">kcal</p>
              </div>
              <div>
                <p className="font-semibold text-blue-400">{Math.round(snapshot.totals.protein_g)}g</p>
                <p className="text-muted-foreground">protein</p>
              </div>
              <div>
                <p className="font-semibold text-yellow-400">{Math.round(snapshot.totals.carbs_g)}g</p>
                <p className="text-muted-foreground">carbs</p>
              </div>
              <div>
                <p className="font-semibold text-pink-400">{Math.round(snapshot.totals.fat_g)}g</p>
                <p className="text-muted-foreground">fat</p>
              </div>
              <div>
                <p className="font-semibold text-emerald-400">{Math.round(snapshot.totals.fiber_g)}g</p>
                <p className="text-muted-foreground">fiber</p>
              </div>
              <div>
                <p className="font-semibold text-rose-400">{Math.round(snapshot.totals.sugar_g ?? 0)}g</p>
                <p className="text-muted-foreground">sugar</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-400">{Math.round(snapshot.totals.sodium_mg ?? 0)}mg</p>
                <p className="text-muted-foreground">sodium</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Send to</Label>
            {loadingFollowing ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : following.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Follow users from the Social tab to share with them.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
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
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meal-msg">Message (optional)</Label>
            <Input
              id="meal-msg"
              placeholder="e.g. Meal prep from Sunday!"
              maxLength={100}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={!selectedId || sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : "Share"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
