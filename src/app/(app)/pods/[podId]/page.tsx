"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Target, MessageSquare, Trash2, LogOut, Plus, Trophy, Calendar, Flame, Dumbbell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePodDetail } from "@/hooks/use-pods";
import { InviteMemberDialog } from "@/components/pods/invite-member-dialog";
import { SetCommitmentDialog } from "@/components/pods/set-commitment-dialog";
import { SendMessageDialog } from "@/components/pods/send-message-dialog";
import { CreateChallengeDialog } from "@/components/pods/create-challenge-dialog";
import { PodLeaderboard } from "@/components/pods/pod-leaderboard";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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
  return <Flame className="h-3.5 w-3.5" />;
}

function ChallengesSection({ podId, currentUserId }: { podId: string; currentUserId: string | null }) {
  const [challenges, setChallenges] = useState<(PodChallenge & { is_active: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteChallengeId, setDeleteChallengeId] = useState<string | null>(null);

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
    const res = await fetch(`/api/pods/${podId}/challenges/${challengeId}`, { method: "DELETE" });
    if (res.ok) {
      setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    }
    setDeleteChallengeId(null);
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
          className="min-h-[44px] px-3 text-xs"
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
                          <> · target: {challenge.target_value} {challenge.challenge_type === "volume" ? "kg" : "sessions"}</>
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
                        onClick={() => setDeleteChallengeId(challenge.id)}
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
                            onClick={() => setDeleteChallengeId(challenge.id)}
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

      <AlertDialog open={!!deleteChallengeId} onOpenChange={(o) => !o && setDeleteChallengeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete challenge?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the challenge and all its data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteChallengeId && handleDelete(deleteChallengeId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const isCreator = pod && currentUserId && pod.creator_id === currentUserId;
  const currentUserProgress = pod?.members_progress.find((m) => m.user_id === currentUserId);

  async function handleLeave() {
    const success = await leavePod();
    if (success) router.push("/pods");
  }

  async function handleDelete() {
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

  async function handleSetCommitment(workouts: number, plannedDays?: string[]) {
    const success = await setCommitment(workouts, plannedDays);
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
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 min-h-[44px]">
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
        <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {isCreator ? (
            <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setLeaveConfirmOpen(true)}>
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
            <Button size="sm" onClick={() => setCommitmentOpen(true)} className="flex-1 min-w-[120px] min-h-[44px]">
              <Target className="h-4 w-4 mr-2" />
              {currentUserProgress && currentUserProgress.commitment > 0
                ? `${currentUserProgress.commitment}x/week`
                : "Set Goal"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMessageOpen(true)} className="flex-1 min-w-[120px] min-h-[44px]">
              <MessageSquare className="h-4 w-4 mr-2" />
              Encourage
            </Button>
            {isCreator && (
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} className="shrink-0 min-h-[44px]">
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Member Progress */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">This Week&apos;s Progress</h2>
        {pod.members_progress.map((member) => {
          const isCurrentUser = member.user_id === currentUserId;
          const dayLabels: Record<string, string> = { mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S" };
          const allDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
          return (
            <Card key={member.user_id} className={isCurrentUser ? "border-primary/40" : ""}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8 shrink-0">
                      {member.avatar_url && (
                        <AvatarImage src={member.avatar_url} alt={member.display_name || "User"} />
                      )}
                      <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
                        {(member.display_name || member.username || "U").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                    <p className="text-[13px] font-bold text-foreground">
                      {member.display_name || member.username || "Unknown"}
                      {isCurrentUser && <span className="text-[10px] font-medium text-muted-foreground ml-1.5">(You)</span>}
                    </p>
                    {member.commitment > 0 ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {member.completed} / {member.commitment} workouts
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic mt-0.5">No goal set yet</p>
                    )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.streak > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        <Flame className="inline h-3 w-3" /> {member.streak}wk
                      </Badge>
                    )}
                    {!isCurrentUser && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => {
                          setSelectedRecipient(member.user_id);
                          setMessageOpen(true);
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Day dots */}
                {member.planned_days && member.planned_days.length > 0 && (
                  <div className="flex gap-1">
                    {allDays.map((d) => (
                      <div
                        key={d}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold",
                          member.planned_days.includes(d)
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-card/20 text-muted-foreground/30 border border-transparent"
                        )}
                      >
                        {dayLabels[d]}
                      </div>
                    ))}
                  </div>
                )}
                {member.commitment > 0 && (
                  <div className="space-y-1">
                    <Progress
                      value={member.progress_percentage}
                      className={member.is_on_track ? "[&>div]:bg-green-500" : ""}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {member.is_on_track ? <span className="inline-flex items-center gap-1">On track <Dumbbell className="inline h-3 w-3" /></span> : `${member.commitment - member.completed} to go`}
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
          <PodLeaderboard
            podId={podId}
            arenaLevel={pod.arena_level}
            seasonScore={pod.season_score}
            seasonStartDate={pod.season_start_date}
          />
        </>
      )}

      {/* Recent Messages */}
      {pod.recent_messages.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recent Messages</h2>
          <div className="space-y-2">
            {pod.recent_messages.map((msg) => (
              <Card key={msg.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {(msg.sender_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-[13px] font-bold">{msg.sender_name}</p>
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
        currentPlannedDays={currentUserProgress?.planned_days}
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

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this pod?</AlertDialogTitle>
            <AlertDialogDescription>You can rejoin by invite if you change your mind.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this pod?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the pod, all members, messages, and challenges. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
