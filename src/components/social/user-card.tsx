"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowUpRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { PresenceDot } from "./presence-dot";
import { SendPingDialog } from "./send-ping-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface UserCardUser {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  fitness_goal: string | null;
  isFollowing?: boolean;
}

interface UserCardProps {
  user: UserCardUser;
  onFollow?: (userId: string) => Promise<void>;
  onUnfollow?: (userId: string) => Promise<void>;
  onSendPing: (recipientId: string, message: string) => Promise<void>;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() ?? "?";
}

export function UserCard({ user, onFollow, onUnfollow, onSendPing }: UserCardProps) {
  const router = useRouter();
  const [pingOpen, setPingOpen] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const displayName = user.display_name || user.username || "Anonymous";
  const goalLabel = user.fitness_goal
    ? user.fitness_goal
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : null;

  async function handleFollowToggle() {
    setFollowLoading(true);
    try {
      if (user.isFollowing) {
        await onUnfollow?.(user.id);
      } else {
        await onFollow?.(user.id);
      }
    } catch {
      toast.error("Failed to update follow status");
    } finally {
      setFollowLoading(false);
    }
  }

  return (
    <>
      <Card
        className="cursor-pointer glass-surface shimmer-target transition-colors"
        onClick={() => router.push(`/social/${user.id}`)}
      >
        <CardContent className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <Avatar className="size-11">
                  <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                    {getInitials(user.display_name)}
                  </AvatarFallback>
                </Avatar>
                <PresenceDot
                  userId={user.id}
                  size="sm"
                  className="absolute -bottom-0.5 -right-0.5"
                />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{displayName}</p>
                {user.username && (
                  <p className="text-xs text-muted-foreground truncate">
                    @{user.username}
                  </p>
                )}
                {user.bio && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {user.bio}
                  </p>
                )}
                {goalLabel && (
                  <Badge variant="secondary" className="mt-1 glass-chip h-5 rounded-full px-2 text-[10px]">
                    {goalLabel}
                  </Badge>
                )}
              </div>
            </div>

            <div
              className="flex items-center gap-2 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Send ping"
                onClick={() => setPingOpen(true)}
              >
                <Zap className="size-4 text-yellow-500" />
              </Button>
              {(onFollow || onUnfollow) && (
                <Button
                  size="sm"
                  variant={user.isFollowing ? "outline" : "default"}
                  disabled={followLoading}
                  onClick={handleFollowToggle}
                  className="h-8"
                >
                  {user.isFollowing ? "Unfollow" : "Follow"}
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                title="View profile"
                onClick={() => router.push(`/social/${user.id}`)}
              >
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <SendPingDialog
        open={pingOpen}
        recipientName={displayName}
        onClose={() => setPingOpen(false)}
        onSend={(msg) => onSendPing(user.id, msg)}
      />
    </>
  );
}
