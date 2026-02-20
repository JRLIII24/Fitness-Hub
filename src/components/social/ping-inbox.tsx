"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, X } from "lucide-react";
import type { Ping } from "@/hooks/use-pings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PingInboxProps {
  pings: Ping[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onClearRead: () => void;
  onDeletePing: (pingId: string) => Promise<void>;
}

export function PingInbox({
  pings,
  unreadCount,
  onMarkAllRead,
  onClearRead,
  onDeletePing,
}: PingInboxProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const readCount = pings.length - unreadCount;

  async function handleDelete(pingId: string) {
    setDeleting(pingId);
    try {
      await onDeletePing(pingId);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Card className="border-border/70 bg-card/85">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <CardTitle className="text-base">Ping Inbox</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="px-1.5 py-0 text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
                Mark all read
              </Button>
            )}
            {readCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearRead}>
                Clear read
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No pings yet
          </p>
        ) : (
          <ul className="space-y-2">
            {pings.map((ping) => (
              <li
                key={ping.id}
                className={`rounded-xl border p-3 text-sm ${
                  !ping.read_at
                    ? "border-primary/30 bg-primary/10"
                    : "border-border/60 bg-background/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <span className="font-medium">
                          {ping.sender?.display_name ||
                            ping.sender?.username ||
                            "Someone"}
                        </span>
                        <span className="text-muted-foreground"> sent: </span>
                        <span>{ping.message}</span>
                      </div>
                      {!ping.read_at && (
                        <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground/90">
                      {formatDistanceToNow(new Date(ping.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDelete(ping.id)}
                    disabled={deleting === ping.id}
                    title="Delete ping"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
