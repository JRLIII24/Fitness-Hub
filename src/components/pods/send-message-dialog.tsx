"use client";

import { useState, useEffect } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Member {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

interface SendMessageDialogProps {
  open: boolean;
  onClose: () => void;
  onSendMessage: (message: string, recipientId?: string) => Promise<void>;
  members: Member[];
  recipientId?: string | null;
}

const PRESET_MESSAGES = [
  "Keep it up!",
  "You got this!",
  "Great work!",
  "Crushing it!",
  "Keep pushing!",
];

export function SendMessageDialog({
  open,
  onClose,
  onSendMessage,
  members,
  recipientId = null,
}: SendMessageDialogProps) {
  const [message, setMessage] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<string>(recipientId || "all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && recipientId) {
      setSelectedRecipient(recipientId);
    }
  }, [open, recipientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length === 0) return;

    setLoading(true);
    await onSendMessage(
      message.trim(),
      selectedRecipient === "all" ? undefined : selectedRecipient
    );
    setLoading(false);
    setMessage("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 mb-1">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg">Send Encouragement</DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            Motivate your pod members
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Send to
            </label>
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
              <SelectTrigger className="bg-card/30 border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole pod</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.display_name || member.username || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick messages */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Quick messages
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_MESSAGES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMessage(preset)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95",
                    message === preset
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/40 bg-card/30 text-muted-foreground hover:border-border/60"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Custom message */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Message
            </label>
            <Textarea
              placeholder="Write a custom message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={280}
              rows={3}
              className="bg-card/30 border-border/40 resize-none"
            />
            <p className="text-[10px] text-muted-foreground tabular-nums text-right">
              {message.length}/280
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || message.trim().length === 0}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
