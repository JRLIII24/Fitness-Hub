"use client";

import { useState } from "react";
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

const PRESET_MESSAGES = [
  "💪 Keep it up!",
  "🔥 Great work!",
  "🏆 Crushing it!",
  "👏 Amazing effort!",
];

interface SendPingDialogProps {
  open: boolean;
  recipientName: string;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
}

export function SendPingDialog({
  open,
  recipientName,
  onClose,
  onSend,
}: SendPingDialogProps) {
  const [selected, setSelected] = useState(PRESET_MESSAGES[0]);
  const [custom, setCustom] = useState("");
  const [sending, setSending] = useState(false);

  const message = custom.trim() || selected;

  async function handleSend() {
    setSending(true);
    try {
      await onSend(message);
      setCustom("");
      setSelected(PRESET_MESSAGES[0]);
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Ping to {recipientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESET_MESSAGES.map((msg) => (
              <button
                key={msg}
                type="button"
                onClick={() => { setSelected(msg); setCustom(""); }}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  selected === msg && !custom.trim()
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent"
                }`}
              >
                {msg}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-ping">Custom message (optional)</Label>
            <Input
              id="custom-ping"
              placeholder="Write something encouraging…"
              maxLength={100}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <p className="text-xs text-muted-foreground text-right">
              {custom.length}/100
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send Ping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
