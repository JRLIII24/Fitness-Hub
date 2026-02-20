"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  "💪 Keep it up!",
  "🔥 You got this!",
  "👏 Great work!",
  "🏆 Crushing it!",
  "💯 Keep pushing!",
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

  function handlePresetClick(preset: string) {
    setMessage(preset);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Send Encouragement
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Motivate your pod members
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient Selector */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Send to</Label>
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
              <SelectTrigger id="recipient">
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

          {/* Preset Messages */}
          <div className="space-y-2">
            <Label>Quick messages</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_MESSAGES.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Write a custom message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={280}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/280 characters
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
