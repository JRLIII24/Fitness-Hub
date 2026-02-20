"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Target, MessageSquare, Trash2, LogOut, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { usePodDetail } from "@/hooks/use-pods";
import { InviteMemberDialog } from "@/components/pods/invite-member-dialog";
import { SetCommitmentDialog } from "@/components/pods/set-commitment-dialog";
import { SendMessageDialog } from "@/components/pods/send-message-dialog";
import { createClient } from "@/lib/supabase/client";

interface PageProps {
  params: Promise<{ podId: string }>;
}

export default function PodDetailPage({ params }: PageProps) {
  const { podId } = use(params);
  const router = useRouter();
  const { pod, loading, error, refetch, inviteMember, setCommitment, sendMessage, leavePod, deletePod } = usePodDetail(podId);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);

  // Get current user ID
  useState(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  });

  const isCreator = pod && currentUserId && pod.creator_id === currentUserId;
  const currentUserProgress = pod?.members_progress.find((m) => m.user_id === currentUserId);

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this pod?")) return;
    const success = await leavePod();
    if (success) {
      router.push("/pods");
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this pod? This cannot be undone.")) return;
    const success = await deletePod(podId);
    if (success) {
      router.push("/pods");
    }
  }

  async function handleInvite(username: string) {
    const result = await inviteMember(username);
    if (result.success) {
      alert(result.message);
      setInviteOpen(false);
    } else {
      alert(result.message);
    }
  }

  async function handleSetCommitment(workouts: number) {
    const success = await setCommitment(workouts);
    if (success) {
      setCommitmentOpen(false);
    }
  }

  async function handleSendMessage(message: string, recipientId?: string) {
    const success = await sendMessage(message, recipientId);
    if (success) {
      setMessageOpen(false);
      setSelectedRecipient(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-5 pb-28 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error || !pod) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-5 pb-28">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error || "Pod not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-5 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {isCreator ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave
            </Button>
          )}
        </div>
      </div>

      {/* Pod Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{pod.name}</CardTitle>
              {pod.description && (
                <p className="text-sm text-muted-foreground mt-1">{pod.description}</p>
              )}
            </div>
            <Badge variant="secondary">{pod.member_count} / 8</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setCommitmentOpen(true)} className="flex-1">
              <Target className="h-4 w-4 mr-2" />
              {currentUserProgress && currentUserProgress.commitment > 0
                ? `${currentUserProgress.commitment}x/week`
                : "Set Goal"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMessageOpen(true)} className="flex-1">
              <MessageSquare className="h-4 w-4 mr-2" />
              Encourage
            </Button>
            {isCreator && (
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Member Progress */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">This Week's Progress</h2>
        {pod.members_progress.map((member) => {
          const isCurrentUser = member.user_id === currentUserId;
          return (
            <Card key={member.user_id} className={isCurrentUser ? "border-primary" : ""}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">
                      {member.display_name || member.username || "Unknown"}
                      {isCurrentUser && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
                    </p>
                    {member.commitment > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {member.completed} / {member.commitment} workouts
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No goal set yet</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {member.streak > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        🔥 {member.streak} week{member.streak !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {!isCurrentUser && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedRecipient(member.user_id);
                          setMessageOpen(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {member.commitment > 0 && (
                  <div className="space-y-1">
                    <Progress
                      value={member.progress_percentage}
                      className={member.is_on_track ? "[&>div]:bg-green-500" : ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      {member.is_on_track ? "On track 💪" : `${member.commitment - member.completed} to go`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Messages */}
      {pod.recent_messages.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent Messages</h2>
          <div className="space-y-2">
            {pod.recent_messages.map((msg) => (
              <Card key={msg.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {(msg.sender_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold">{msg.sender_name}</p>
                        {msg.recipient_id && (
                          <span className="text-xs text-muted-foreground">
                            → {msg.recipient_name}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(msg.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{msg.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      {isCreator && (
        <InviteMemberDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          onInvite={handleInvite}
        />
      )}

      <SetCommitmentDialog
        open={commitmentOpen}
        onClose={() => setCommitmentOpen(false)}
        onSetCommitment={handleSetCommitment}
        currentCommitment={currentUserProgress?.commitment}
      />

      <SendMessageDialog
        open={messageOpen}
        onClose={() => {
          setMessageOpen(false);
          setSelectedRecipient(null);
        }}
        onSendMessage={handleSendMessage}
        members={pod.members}
        recipientId={selectedRecipient}
      />
    </div>
  );
}
