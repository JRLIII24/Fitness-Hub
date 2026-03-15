"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  UserPlus,
  Target,
  Zap,
  X,
  Plus,
  AlertTriangle,
  Loader2,
  Radio,
} from "lucide-react";
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
import { usePodPresence } from "@/hooks/use-pod-presence";
import { Y2K, tierCfg, getPlayerStatus, getCrewPressure } from "@/lib/pods/y2k-tokens";
import { getArenaTier } from "@/types/pods";
import { POD_CHALLENGES_ENABLED } from "@/lib/features";
import { createClient } from "@/lib/supabase/client";
import type { PodChallenge } from "@/types/pods";
import {
  StarGrid,
  Panel,
  HeroPanel,
  TierBadge,
  Y2KTabs,
  PlayerCard,
  CrewBar,
  QuestCard,
  Scoreboard,
  RecapCard,
  FeedItem,
  SendMessage,
} from "@/components/pods/tacx";
import { InviteMemberDialog } from "@/components/pods/invite-member-dialog";
import { SetCommitmentDialog } from "@/components/pods/set-commitment-dialog";
import { CreateChallengeDialog } from "@/components/pods/create-challenge-dialog";
import {
  containerVariants,
  itemVariants,
  tabContentVariants,
} from "@/lib/pods/transitions";

type LoungeTab = "players" | "quests" | "scoreboard" | "feed";

const LOUNGE_TABS = [
  { id: "players" as const, label: "PLAYERS" },
  { id: "quests" as const, label: "QUESTS" },
  { id: "scoreboard" as const, label: "SCOREBOARD" },
  { id: "feed" as const, label: "FEED" },
] as const;

interface PageProps {
  params: Promise<{ podId: string }>;
}

export default function PodDetailPage({ params }: PageProps) {
  const { podId } = use(params);
  const router = useRouter();
  const {
    pod,
    loading,
    error,
    inviteMember,
    setCommitment,
    sendMessage,
    leavePod,
    deletePod,
    refetch,
  } = usePodDetail(podId);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { isInGym, getPresence } = usePodPresence(podId, currentUserId);
  const [activeTab, setActiveTab] = useState<LoungeTab>("players");
  const [commsOpen, setCommsOpen] = useState(false);
  const [commsTargetId, setCommsTargetId] = useState<string | undefined>();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Challenges state
  const [challenges, setChallenges] = useState<(PodChallenge & { is_active: boolean })[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [createChallengeOpen, setCreateChallengeOpen] = useState(false);
  const [deleteChallengeId, setDeleteChallengeId] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) setCurrentUserId(user.id);
      });
  }, []);

  const fetchChallenges = useCallback(async () => {
    if (!POD_CHALLENGES_ENABLED) return;
    setChallengesLoading(true);
    try {
      const res = await fetch(`/api/pods/${podId}/challenges`);
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges ?? []);
      }
    } catch {
      // non-critical
    } finally {
      setChallengesLoading(false);
    }
  }, [podId]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  async function handleDeleteChallenge(challengeId: string) {
    const res = await fetch(`/api/pods/${podId}/challenges/${challengeId}`, {
      method: "DELETE",
    });
    if (res.ok) setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    setDeleteChallengeId(null);
  }

  const isCreator = pod && currentUserId && pod.creator_id === currentUserId;
  const currentUserProgress = pod?.members_progress.find(
    (m) => m.user_id === currentUserId
  );

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
    if (result.success) setInviteOpen(false);
  }
  async function handleSetCommitment(workouts: number, plannedDays?: string[]) {
    const success = await setCommitment(workouts, plannedDays);
    if (success) setCommitmentOpen(false);
  }
  async function handleSendComms(message: string, recipientId?: string) {
    const success = await sendMessage(message, recipientId);
    if (success) {
      setCommsOpen(false);
      setCommsTargetId(undefined);
    }
  }

  if (loading) {
    return (
      <div
        className="relative mx-auto max-w-lg px-4 pt-5 pb-28"
        style={{ minHeight: "100vh", background: Y2K.bg0 }}
      >
        <StarGrid />
        <div
          className="relative flex items-center justify-center"
          style={{ zIndex: 1, padding: "48px 0" }}
        >
          <Loader2
            size={20}
            style={{ color: Y2K.text2, animation: "spin 1s linear infinite" }}
          />
        </div>
      </div>
    );
  }

  if (error || !pod) {
    return (
      <div
        className="relative mx-auto max-w-lg px-4 pt-5 pb-28"
        style={{ minHeight: "100vh", background: Y2K.bg0 }}
      >
        <StarGrid />
        <div className="relative flex flex-col gap-3" style={{ zIndex: 1 }}>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1"
            style={{
              padding: "8px 12px",
              background: "transparent",
              border: "none",
              color: Y2K.text2,
              fontFamily: Y2K.fontDisplay,
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={14} />
            BACK
          </button>
          <Panel accent={Y2K.status.critical.fg}>
            <p style={{ fontFamily: Y2K.fontSans, fontSize: "12px", color: Y2K.status.critical.fg }}>
              {error || "Crew not found"}
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  const tier = getArenaTier(pod.season_score ?? 0);
  const dc = tierCfg(tier);
  const pressure = getCrewPressure(pod.members_progress);
  const criticalCount = pod.members_progress.filter(
    (m) => getPlayerStatus(m) === "critical"
  ).length;
  const warningCount = pod.members_progress.filter(
    (m) => getPlayerStatus(m) === "warning"
  ).length;

  const activeChallenges = challenges.filter((c) => c.is_active);
  const pastChallenges = challenges.filter((c) => !c.is_active);

  return (
    <div
      className="relative mx-auto max-w-lg px-4 pt-5 pb-28"
      style={{ minHeight: "100vh", background: Y2K.bg0 }}
    >
      <StarGrid />

      <motion.div
        className="relative flex flex-col gap-3"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28 }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1"
            style={{
              padding: "8px 12px",
              background: "transparent",
              border: "none",
              color: Y2K.text2,
              fontFamily: Y2K.fontDisplay,
              fontSize: "9px",
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            <ArrowLeft size={14} />
            <span>
              <span style={{ display: "block", color: Y2K.text3, fontSize: "7px" }}>
                LOUNGE
              </span>
              {pod.name.toUpperCase()}
            </span>
          </button>

          <button
            onClick={() => setCommsOpen(true)}
            className="flex items-center gap-1"
            style={{
              padding: "8px 12px",
              borderRadius: Y2K.r8,
              background: Y2K.cyanBg,
              border: `1px solid ${Y2K.cyanBorder}`,
              color: Y2K.cyan,
              fontFamily: Y2K.fontDisplay,
              fontSize: "9px",
              fontWeight: 900,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            <Radio size={12} />
            MESSAGE
          </button>
        </div>

        {/* Hero Banner */}
        <HeroPanel tier={tier}>
          <div className="flex items-start justify-between" style={{ marginBottom: "8px" }}>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "8px",
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  color: Y2K.text3,
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                Season 1 · {pod.member_count}/8 Players
              </span>
              <h1
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "26px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  color: Y2K.text1,
                  margin: "0 0 6px",
                }}
              >
                {pod.name}
              </h1>
              <div className="flex items-center gap-2">
                <TierBadge tier={tier} score={pod.season_score ?? 0} />
                {pod.season_start_date && (
                  <span
                    style={{
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "8px",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: Y2K.text3,
                      textTransform: "uppercase",
                    }}
                  >
                    SINCE{" "}
                    {new Date(pod.season_start_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    }).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Combat score */}
            <div className="flex flex-col items-end">
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "26px",
                  fontWeight: 900,
                  color: dc.fg,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                  textShadow: dc.glow,
                }}
              >
                {pod.season_score ?? 0}
              </span>
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "7px",
                  fontWeight: 900,
                  letterSpacing: "0.10em",
                  color: Y2K.text3,
                }}
              >
                SCORE
              </span>
            </div>
          </div>

          {/* Fireteam bar */}
          <CrewBar members={pod.members_progress} />
        </HeroPanel>

        {/* Action buttons */}
        <div className="grid grid-cols-4 gap-1">
          <ActionBtn
            label="SET GOAL"
            icon={<Target size={14} />}
            onClick={() => setCommitmentOpen(true)}
          />
          <ActionBtn
            label="SEND"
            icon={<Zap size={14} />}
            onClick={() => setCommsOpen(true)}
            accent={Y2K.cyan}
          />
          {isCreator && (
            <ActionBtn
              label="INVITE"
              icon={<UserPlus size={14} />}
              onClick={() => setInviteOpen(true)}
              accent="#00C4E8"
            />
          )}
          <ActionBtn
            label="LEAVE"
            icon={<X size={14} />}
            onClick={() =>
              isCreator ? setDeleteConfirmOpen(true) : setLeaveConfirmOpen(true)
            }
            accent={Y2K.status.critical.fg}
          />
        </div>

        {/* Threat alert */}
        {criticalCount > 0 && (
          <Panel accent={Y2K.status.critical.fg}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={12} style={{ color: Y2K.status.critical.fg }} />
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "9px",
                  fontWeight: 900,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: Y2K.status.critical.fg,
                }}
              >
                {criticalCount} player{criticalCount > 1 ? "s" : ""} ghosting
              </span>
            </div>
          </Panel>
        )}
        {warningCount > 0 && criticalCount === 0 && (
          <Panel accent={Y2K.status.warning.fg}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={12} style={{ color: Y2K.status.warning.fg }} />
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "9px",
                  fontWeight: 900,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: Y2K.status.warning.fg,
                }}
              >
                {warningCount} player{warningCount > 1 ? "s" : ""} slipping
              </span>
            </div>
          </Panel>
        )}

        {/* Section tabs */}
        <Y2KTabs
          tabs={LOUNGE_TABS}
          active={activeTab}
          onChange={setActiveTab}
          accent={dc.fg}
        />

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {activeTab === "players" && (
              <div className="flex flex-col gap-2">
                {/* Section header */}
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "8px",
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                    color: Y2K.text3,
                    textTransform: "uppercase",
                  }}
                >
                  PLAYERS
                </span>

                {/* Current user first, then rest */}
                {[
                  ...pod.members_progress.filter((m) => m.user_id === currentUserId),
                  ...pod.members_progress.filter((m) => m.user_id !== currentUserId),
                ].map((member, i) => (
                  <PlayerCard
                    key={member.user_id}
                    progress={member}
                    tier={tier}
                    isCurrentUser={member.user_id === currentUserId}
                    index={i}
                    isTraining={isInGym(member.user_id)}
                    workoutName={getPresence(member.user_id)?.workout_name}
                    workoutStartedAt={getPresence(member.user_id)?.started_at}
                    onComms={() => {
                      setCommsTargetId(member.user_id);
                      setCommsOpen(true);
                    }}
                  />
                ))}

                {/* AAR Card */}
                <RecapCard podId={podId} tier={tier} />
              </div>
            )}

            {activeTab === "quests" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span
                    style={{
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "8px",
                      fontWeight: 900,
                      letterSpacing: "0.14em",
                      color: Y2K.text3,
                      textTransform: "uppercase",
                    }}
                  >
                    ACTIVE QUESTS
                  </span>
                  <button
                    onClick={() => setCreateChallengeOpen(true)}
                    className="flex items-center gap-1"
                    style={{
                      padding: "4px 8px",
                      borderRadius: Y2K.r8,
                      background: Y2K.cyanBg,
                      border: `1px solid ${Y2K.cyanBorder}`,
                      color: Y2K.cyan,
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "8px",
                      fontWeight: 900,
                      letterSpacing: "0.10em",
                      cursor: "pointer",
                      minHeight: "32px",
                    }}
                  >
                    <Plus size={10} strokeWidth={3} />
                    NEW
                  </button>
                </div>

                {challengesLoading ? (
                  <div className="flex justify-center" style={{ padding: "24px 0" }}>
                    <Loader2 size={16} style={{ color: Y2K.text3, animation: "spin 1s linear infinite" }} />
                  </div>
                ) : activeChallenges.length === 0 && pastChallenges.length === 0 ? (
                  <Panel>
                    <p
                      className="text-center"
                      style={{
                        fontFamily: Y2K.fontSans,
                        fontSize: "12px",
                        color: Y2K.text3,
                        padding: "16px 0",
                      }}
                    >
                      No quests created yet
                    </p>
                  </Panel>
                ) : (
                  <>
                    {activeChallenges.map((c, i) => {
                      const now = new Date();
                      const end = new Date(c.end_date + "T23:59:59");
                      const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
                      return (
                        <QuestCard
                          key={c.id}
                          challenge={c}
                          isActive
                          daysLeft={daysLeft}
                          index={i}
                        />
                      );
                    })}

                    {pastChallenges.length > 0 && (
                      <>
                        <span
                          style={{
                            fontFamily: Y2K.fontDisplay,
                            fontSize: "8px",
                            fontWeight: 900,
                            letterSpacing: "0.14em",
                            color: Y2K.text3,
                            textTransform: "uppercase",
                            marginTop: "8px",
                          }}
                        >
                          COMPLETED QUESTS
                        </span>
                        {pastChallenges.map((c, i) => (
                          <QuestCard key={c.id} challenge={c} isActive={false} index={i} />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "scoreboard" && (
              <Scoreboard
                podId={podId}
                tier={tier}
                seasonScore={pod.season_score}
                seasonStartDate={pod.season_start_date}
              />
            )}

            {activeTab === "feed" && (
              <div className="flex flex-col gap-1">
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "8px",
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                    color: Y2K.text3,
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  MESSAGES
                </span>

                {pod.recent_messages.length === 0 ? (
                  <Panel>
                    <p
                      className="text-center"
                      style={{
                        fontFamily: Y2K.fontSans,
                        fontSize: "12px",
                        color: Y2K.text3,
                        padding: "16px 0",
                      }}
                    >
                      No messages yet
                    </p>
                  </Panel>
                ) : (
                  <Panel noPad style={{ padding: "8px" }}>
                    {pod.recent_messages.map((msg) => (
                      <FeedItem
                        key={msg.id}
                        senderName={msg.sender_name}
                        recipientName={msg.recipient_name}
                        body={msg.message}
                        timestamp={msg.created_at}
                      />
                    ))}
                  </Panel>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* SendComms bottom sheet */}
      <SendMessage
        open={commsOpen}
        onClose={() => {
          setCommsOpen(false);
          setCommsTargetId(undefined);
        }}
        onSend={handleSendComms}
        members={pod.members_progress}
        currentUserId={currentUserId || ""}
        podName={pod.name}
        tier={tier}
      />

      {/* Existing dialogs (keep working) */}
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

      <CreateChallengeDialog
        open={createChallengeOpen}
        podId={podId}
        onClose={() => setCreateChallengeOpen(false)}
        onCreated={fetchChallenges}
      />

      <AlertDialog open={!!deleteChallengeId} onOpenChange={(o) => !o && setDeleteChallengeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quest?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the quest and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteChallengeId && handleDeleteChallenge(deleteChallengeId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this crew?</AlertDialogTitle>
            <AlertDialogDescription>
              You can rejoin by invite if you change your mind.
            </AlertDialogDescription>
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
            <AlertDialogTitle>Delete this crew?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the crew, all players, messages, and quests. Cannot be undone.
            </AlertDialogDescription>
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

      <style jsx global>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.75); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Action button component ───────────────────────────────────────────────────

function ActionBtn({
  label,
  icon,
  onClick,
  accent,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  accent?: string;
}) {
  const color = accent || Y2K.text2;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1"
      style={{
        padding: "8px 4px",
        borderRadius: Y2K.r8,
        background: accent ? `${accent}08` : "rgba(255,255,255,0.03)",
        border: `1px solid ${accent ? `${accent}25` : Y2K.border1}`,
        color,
        cursor: "pointer",
        minHeight: "44px",
      }}
    >
      {icon}
      <span
        style={{
          fontFamily: Y2K.fontDisplay,
          fontSize: "7px",
          fontWeight: 900,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </button>
  );
}
