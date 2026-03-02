"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Target, MessageSquare, Trash2, LogOut, Plus, Trophy, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { usePodDetail } from "@/hooks/use-pods";
import { InviteMemberDialog } from "@/components/pods/invite-member-dialog";
import { SetCommitmentDialog } from "@/components/pods/set-commitment-dialog";
import { SendMessageDialog } from "@/components/pods/send-message-dialog";
import { CreateChallengeDialog } from "@/components/pods/create-challenge-dialog";
import { PodLeaderboard } from "@/components/pods/pod-leaderboard";
import { createClient } from "@/lib/supabase/client";
import { POD_CHALLENGES_ENABLED } from "@/lib/features";
import type { PodChallenge } from "@/types/pods";

interface PageProps {
  params: Promise<{ podId: string }>;
}

function formatChallengeDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChallengeTypeIcon({ type }: { type: PodChallenge["challenge_type"] }) {
  if (type === "volume") return <Trophy className="h-3.5 w-3.5" />;
  if (type === "distance") return <span className="text-xs">🏃</span>;
  return <span className="text-xs">🔥</span>;
}

function ChallengesSection({ podId, currentUserId }: { podId: string; currentUserId: string | null }) {
  const [challenges, setChallenges] = useState<(PodChallenge & { is_active: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pods/${podId}/challenges`);
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges ?? []);
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [podId]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  async function handleDelete(challengeId: string) {
    if (!confirm("Delete this challenge?")) return;
    const res = await fetch(`/api/pods/${podId}/challenges/${challengeId}`, { method: "DELETE" });
    if (res.ok) {
      setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    }
  }

  const activeChallenges = challenges.filter((c) => c.is_active);
  const pastChallenges = challenges.filter((c) => !c.is_active);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" />
          Challenges
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          New
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="pt-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
      ) : challenges.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Trophy className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No challenges yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create one to compete with your pod!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeChallenges.map((challenge) => (
            <Card key={challenge.id} className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChallengeTypeIcon type={challenge.challenge_type} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{challenge.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatChallengeDate(challenge.start_date)} – {formatChallengeDate(challenge.end_date)}
                        {challenge.target_value && (
                          <> · target: {challenge.target_value} {challenge.challenge_type === "volume" ? "kg" : challenge.challenge_type === "distance" ? "km" : "sessions"}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-500/20 text-green-600 border-green-500/30">
                      Active
                    </Badge>
                    {currentUserId === challenge.created_by && (
                      <button
                        onClick={() => handleDelete(challenge.id)}
                        className="text-muted-foreground/50 hover:text-destructive transition-colors text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {pastChallenges.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground pl-1">Past challenges</p>
              {pastChallenges.map((challenge) => (
                <Card key={challenge.id} className="opacity-60">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChallengeTypeIcon type={challenge.challenge_type} />
                        <p className="text-sm truncate">{challenge.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          ended {formatChallengeDate(challenge.end_date)}
                        </span>
                        {currentUserId === challenge.created_by && (
                          <button
                            onClick={() => handleDelete(challenge.id)}
                            className="text-muted-foreground/50 hover:text-destructive transition-colors text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <CreateChallengeDialog
        open={createOpen}
        podId={podId}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchChallenges}
      />
    </div>
  );
}

export default function PodDetailPage({ params }: PageProps) {
  const { podId } = use(params);
  const router = useRouter();
  const { pod, loading, error, inviteMember, setCommitment, sendMessage, leavePod, deletePod } = usePodDetail(podId);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const isCreator = pod && currentUserId && pod.creator_id === currentUserId;
  const currentUserProgress = pod?.members_progress.find((m) => m.user_id === currentUserId);

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this pod?")) return;
    const success = await leavePod();
    if (success) router.push("/pods");
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this pod? This cannot be undone.")) return;
    const success = await deletePod(podId);
    if (success) router.push("/pods");
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
    if (success) setCommitmentOpen(false);
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
      <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-28 space-y-4 md:max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error || !pod) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-28 md:max-w-2xl">
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
    <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-28 space-y-4 md:max-w-2xl">
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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCommitmentOpen(true)} className="flex-1 min-w-[120px]">
              <Target className="h-4 w-4 mr-2" />
              {currentUserProgress && currentUserProgress.commitment > 0
                ? `${currentUserProgress.commitment}x/week`
                : "Set Goal"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMessageOpen(true)} className="flex-1 min-w-[120px]">
              <MessageSquare className="h-4 w-4 mr-2" />
              Encourage
            </Button>
            {isCreator && (
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} className="shrink-0">
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Member Progress */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">This Week&apos;s Progress</h2>
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

      {/* Challenges + Live Leaderboard */}
      {POD_CHALLENGES_ENABLED && (
        <>
          <ChallengesSection podId={podId} currentUserId={currentUserId} />
          <PodLeaderboard podId={podId} />
        </>
      )}

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
