"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle2, Zap, ArrowUpRight } from "lucide-react";
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
        className="cursor-pointer border-border/70 bg-card/85 transition-colors hover:bg-accent/40"
        onClick={() => router.push(`/social/${user.id}`)}
      >
        <CardContent className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <UserCircle2 className="size-11 text-muted-foreground" />
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
                  <Badge variant="secondary" className="mt-1 h-5 rounded-full px-2 text-[10px]">
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
                title="Send ping"
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
