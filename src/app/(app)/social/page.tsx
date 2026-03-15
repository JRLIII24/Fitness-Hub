"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Settings,
  Bell,
  Inbox,
  Sparkles,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import { usePresence } from "@/hooks/use-presence";
import { usePings } from "@/hooks/use-pings";
import { useSharedItems } from "@/hooks/use-shared-items";
import { usePods } from "@/hooks/use-pods";
import { trackPodAccountabilityPingOpened } from "@/lib/retention-events";
import { UserCard, type UserCardUser } from "@/components/social/user-card";
import { PingInbox } from "@/components/social/ping-inbox";
import { SharedItemCard } from "@/components/social/shared-item-card";
import { ActivityFeed } from "@/components/social/activity-feed";
import { PodInvitesSection } from "@/components/pods/pod-invites-section";
import { ProfileTabContent } from "@/components/social/profile-tab-content";
import { SOCIAL_FEED_ENABLED } from "@/lib/features";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Y2K, tierCfg, getCrewPressure } from "@/lib/pods/y2k-tokens";
import { getArenaTier, ARENA_TIERS } from "@/types/pods";
import {
  StarGrid,
  Y2KTabs,
  TierBadge,
  CrewBar,
  CrewEmblem,
} from "@/components/pods/tacx";
import { containerVariants, itemVariants } from "@/lib/pods/transitions";
import type { PodWithMembers, MemberProgress } from "@/types/pods";

// ── Types ──────────────────────────────────────────────────────────────────────

type CommandTab = "crews" | "inbox" | "discover" | "profile";

const COMMAND_TABS: readonly { id: CommandTab; label: string }[] = [
  { id: "crews", label: "CREWS" },
  { id: "inbox", label: "INBOX" },
  { id: "discover", label: "DISCOVER" },
  { id: "profile", label: "PROFILE" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function toStubProgress(members: PodWithMembers["members"]): MemberProgress[] {
  return members.map((m) => ({
    user_id: m.user_id,
    display_name: m.display_name,
    username: m.username,
    commitment: 0,
    planned_days: [],
    completed: 0,
    completed_days: [],
    progress_percentage: 0,
    is_on_track: false,
    streak: 0,
    volume_kg: 0,
  }));
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function HubPage() {
  const router = useRouter();
  const supabase = useSupabase();

  // Tab state
  const [activeTab, setActiveTab] = useState<CommandTab>("crews");

  // Auth
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Social state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserCardUser[]>([]);
  const [following, setFollowing] = useState<UserCardUser[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [podInviteCount, setPodInviteCount] = useState(0);
  const loggedInboxOpenRef = useRef<string | null>(null);

  // Presence
  const { isOnline } = usePresence(currentUserId);
  void isOnline;

  // Hooks
  const {
    pings,
    unreadCount: pingsUnread,
    loading: pingsLoading,
    markAllRead: markPingsRead,
    clearRead: clearReadPings,
    sendPing,
    deletePing,
  } = usePings(currentUserId);

  const {
    items: sharedItems,
    unreadCount: sharedUnread,
    loading: sharedLoading,
    markAllRead: markSharedRead,
    clearRead: clearReadShared,
    clearItem: clearSharedItem,
  } = useSharedItems(currentUserId);

  const { pods, loading: podsLoading, refetch: refetchPods } = usePods();

  // Refetch pods when navigating back to this page
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/social") refetchPods();
  }, [pathname, refetchPods]);

  const totalUnread = pingsUnread + sharedUnread + podInviteCount;
  const commsUnread = pingsUnread + sharedUnread;

  // ── Analytics tracking ──
  useEffect(() => {
    if (!currentUserId) return;
    if (activeTab !== "inbox") return;
    const dayKey = new Date().toISOString().slice(0, 10);
    const eventKey = `${currentUserId}:comms:${dayKey}`;
    if (loggedInboxOpenRef.current === eventKey) return;
    loggedInboxOpenRef.current = eventKey;

    void trackPodAccountabilityPingOpened(supabase, currentUserId, {
      tab: "pings",
      pings_unread: pingsUnread,
      shared_unread: sharedUnread,
      pod_invites_unread: podInviteCount,
      total_unread: totalUnread,
    });
  }, [activeTab, currentUserId, pingsUnread, sharedUnread, podInviteCount, totalUnread, supabase]);

  // ── Init: auth + following ──
  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUserId(user.id);

      const { data: followData } = await supabase
        .from("user_follows")
        .select(
          `following_id, profiles!user_follows_following_id_fkey(id, display_name, username, bio, fitness_goal, avatar_url)`
        )
        .eq("follower_id", user.id);

      if (followData) {
        const ids = new Set(followData.map((f) => f.following_id));
        setFollowingIds(ids);

        const users: UserCardUser[] = followData
          .map((f) => {
            const p = f.profiles as unknown as {
              id: string;
              display_name: string | null;
              username: string | null;
              bio: string | null;
              fitness_goal: string | null;
            } | null;
            if (!p) return null;
            return {
              id: p.id,
              display_name: p.display_name,
              username: p.username,
              bio: p.bio,
              fitness_goal: p.fitness_goal,
              isFollowing: true,
            };
          })
          .filter(Boolean) as UserCardUser[];
        setFollowing(users);
      }

      const { count } = await supabase
        .from("pod_invites")
        .select("*", { count: "exact", head: true })
        .eq("invitee_id", user.id)
        .eq("status", "pending");
      setPodInviteCount(count ?? 0);
    }
    void init();
  }, [supabase, router]);

  // ── Search ──
  useEffect(() => {
    if (!searchQuery.trim()) {
      queueMicrotask(() => setSearchResults([]));
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      const q = searchQuery.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username, bio, fitness_goal, avatar_url")
        .eq("is_public", true)
        .neq("id", currentUserId ?? "")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(20);

      if (!error && data) {
        setSearchResults(
          data.map((p) => ({
            ...p,
            isFollowing: followingIds.has(p.id),
          }))
        );
      }
      setSearching(false);
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery, supabase, currentUserId, followingIds]);

  // ── Handlers ──
  const handleInviteUpdate = () => {
    if (!currentUserId) return;
    supabase
      .from("pod_invites")
      .select("*", { count: "exact", head: true })
      .eq("invitee_id", currentUserId)
      .eq("status", "pending")
      .then(({ count }) => setPodInviteCount(count ?? 0));
  };

  async function handleFollow(userId: string) {
    if (!currentUserId) return;
    const { error } = await supabase
      .from("user_follows")
      .insert({ follower_id: currentUserId, following_id: userId });
    if (error) throw error;

    setFollowingIds((prev) => new Set([...prev, userId]));
    setSearchResults((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isFollowing: true } : u))
    );
    const profile = searchResults.find((u) => u.id === userId);
    if (profile) setFollowing((prev) => [...prev, { ...profile, isFollowing: true }]);
    toast.success("Following");
  }

  async function handleUnfollow(userId: string) {
    if (!currentUserId) return;
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", currentUserId)
      .eq("following_id", userId);
    if (error) throw error;

    setFollowingIds((prev) => {
      const s = new Set(prev);
      s.delete(userId);
      return s;
    });
    setSearchResults((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isFollowing: false } : u))
    );
    setFollowing((prev) => prev.filter((u) => u.id !== userId));
    toast.success("Unfollowed");
  }

  async function handleSendPing(recipientId: string, message: string) {
    await sendPing(recipientId, message);
    toast.success("Ping sent");
  }

  // ── Derived ──
  const highestTier = pods.length > 0
    ? pods.reduce((best, pod) => {
        const tier = getArenaTier(pod.season_score ?? 0);
        const order = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
        return order[tier] > order[best] ? tier : best;
      }, getArenaTier(pods[0].season_score ?? 0))
    : ("bronze" as const);

  const dc = tierCfg(highestTier);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 pb-28 pt-5 md:px-6" style={{ minHeight: "100vh" }}>
      {/* Tactical grid at reduced opacity */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.25, pointerEvents: "none", zIndex: 0 }}>
        <StarGrid />
      </div>

      <motion.div
        className="relative flex flex-col gap-4"
        style={{ zIndex: 1 }}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* ── Hero Section: Glass + Tactical ── */}
        <motion.section
          variants={itemVariants}
          className="glass-surface-elevated relative overflow-hidden rounded-3xl p-5 sm:p-6"
        >
          {/* Division glow */}
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl"
            style={{ background: dc.fg, opacity: 0.12 }}
          />
          <div
            className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full blur-3xl"
            style={{ background: dc.fg, opacity: 0.08 }}
          />

          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "9px",
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: dc.fg,
                  }}
                >
                  Season 1 · The Arena
                </p>
                <h1
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "26px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    margin: "2px 0 0",
                  }}
                  className="text-foreground"
                >
                  Hub
                </h1>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/settings")}
                title="Settings"
              >
                <Settings className="size-5" />
              </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="glass-inner rounded-xl px-3 py-3">
                <p
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "8px",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                  className="text-muted-foreground"
                >
                  CREWS
                </p>
                <p className="text-xl font-semibold tabular-nums">{pods.length}</p>
              </div>
              <div className="glass-inner rounded-xl px-3 py-3">
                <p
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "8px",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                  className="text-muted-foreground"
                >
                  INCOMING
                </p>
                <p className="text-xl font-semibold tabular-nums">{totalUnread}</p>
              </div>
              <div className="glass-inner rounded-xl px-3 py-3">
                <p
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "8px",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                  className="text-muted-foreground"
                >
                  FOLLOWING
                </p>
                <p className="text-xl font-semibold tabular-nums">{following.length}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Tactical Tabs ── */}
        <motion.div variants={itemVariants}>
          <Y2KTabs<CommandTab>
            tabs={COMMAND_TABS}
            active={activeTab}
            onChange={setActiveTab}
            accent={dc.fg}
          />
        </motion.div>

        {/* ── Tab Content ── */}

        {/* SQUADS TAB */}
        {activeTab === "crews" && (
          <motion.div
            className="flex flex-col gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            key="squads"
          >
            {/* Activity Feed (if enabled) */}
            {SOCIAL_FEED_ENABLED && (
              <motion.div variants={itemVariants} className="glass-surface rounded-2xl overflow-hidden">
                <ActivityFeed />
              </motion.div>
            )}

            {/* Pod invites */}
            <motion.div variants={itemVariants}>
              <PodInvitesSection onUpdate={handleInviteUpdate} />
            </motion.div>

            {/* Create CTA */}
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between" style={{ marginBottom: "4px" }}>
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                  className="text-muted-foreground"
                >
                  YOUR CREWS
                </span>
                <button
                  onClick={() => router.push("/pods/create")}
                  className="flex items-center gap-1"
                  style={{
                    padding: "6px 12px",
                    borderRadius: "9999px",
                    background: `${dc.fg}15`,
                    border: `1px solid ${dc.fg}40`,
                    color: dc.fg,
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "9px",
                    fontWeight: 900,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    minHeight: "36px",
                  }}
                >
                  <Plus size={12} strokeWidth={3} />
                  NEW CREW
                </button>
              </div>
            </motion.div>

            {/* Loading state */}
            {podsLoading && (
              <motion.div variants={itemVariants}>
                <div className="glass-surface rounded-2xl flex items-center justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {!podsLoading && pods.length === 0 && (
              <motion.div variants={itemVariants}>
                <div
                  className="glass-surface rounded-2xl border-dashed"
                  style={{ padding: "40px 16px", textAlign: "center" }}
                >
                  <div
                    className="mx-auto mb-3 flex items-center justify-center rounded-xl"
                    style={{
                      width: "48px",
                      height: "48px",
                      background: dc.bg,
                      border: `1px solid ${dc.border}`,
                    }}
                  >
                    <Sparkles size={24} style={{ color: dc.fg }} />
                  </div>
                  <p
                    style={{
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "14px",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      margin: "0 0 4px",
                    }}
                    className="text-foreground"
                  >
                    NO ACTIVE CREWS
                  </p>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Start a crew to stay accountable
                  </p>
                  <Button
                    onClick={() => router.push("/pods/create")}
                    className="min-h-[44px] gap-1"
                    style={{
                      background: dc.fg,
                      color: "#000",
                      fontFamily: Y2K.fontDisplay,
                      fontSize: "11px",
                      fontWeight: 900,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                    }}
                  >
                    <Plus size={14} strokeWidth={3} />
                    START FIRST CREW
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Squad cards */}
            {!podsLoading &&
              pods.map((pod) => {
                const tier = getArenaTier(pod.season_score ?? 0);
                const podDc = tierCfg(tier);
                const stubMembers = toStubProgress(pod.members);

                return (
                  <motion.div key={pod.id} variants={itemVariants} initial="hidden" animate="show">
                    <div
                      className="glass-surface cursor-pointer rounded-2xl p-4 transition-all hover:scale-[1.01]"
                      style={{
                        borderTop: `2px solid ${podDc.fg}`,
                      }}
                      onClick={() => router.push(`/pods/${pod.id}`)}
                    >
                      {/* Squad header */}
                      <div className="flex items-start gap-3" style={{ marginBottom: "10px" }}>
                        <CrewEmblem
                          podId={pod.id}
                          tier={tier}
                          memberCount={pod.member_count}
                          size={40}
                        />
                        <div className="flex-1" style={{ minWidth: 0 }}>
                          <h3
                            className="truncate"
                            style={{
                              fontFamily: Y2K.fontDisplay,
                              fontSize: "16px",
                              fontWeight: 900,
                              textTransform: "uppercase",
                              letterSpacing: "0.02em",
                              margin: 0,
                            }}
                          >
                            {pod.name}
                          </h3>
                          <span
                            style={{
                              fontFamily: Y2K.fontDisplay,
                              fontSize: "8px",
                              fontWeight: 900,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                            }}
                            className="text-muted-foreground"
                          >
                            {pod.member_count}/8 PLAYERS
                          </span>
                        </div>
                        <TierBadge tier={tier} score={pod.season_score ?? 0} />
                      </div>

                      {/* Fireteam bar */}
                      <div style={{ marginBottom: "8px" }}>
                        <CrewBar members={stubMembers} />
                      </div>

                      {/* Season progress bar */}
                      {(() => {
                        const score = pod.season_score ?? 0;
                        const tierInfo = ARENA_TIERS[tier];
                        const next = tierInfo.next;
                        const pct =
                          next !== null
                            ? Math.min(100, ((score - tierInfo.min) / (next - tierInfo.min)) * 100)
                            : 100;
                        return (
                          <div
                            className="overflow-hidden rounded-full"
                            style={{ height: "3px", background: "rgba(255,255,255,0.06)" }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: podDc.fg,
                                borderRadius: "1.5px",
                                transition: "width 0.6s ease-out",
                              }}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                );
              })}
          </motion.div>
        )}

        {/* COMMS TAB */}
        {activeTab === "inbox" && (
          <motion.div
            className="flex flex-col gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            key="comms"
          >
            {/* Pod invites in comms too */}
            <motion.div variants={itemVariants}>
              <PodInvitesSection onUpdate={handleInviteUpdate} />
            </motion.div>

            {/* Pings section */}
            <motion.div variants={itemVariants}>
              <div style={{ marginBottom: "4px" }}>
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                  className="text-muted-foreground"
                >
                  PINGS
                  {pingsUnread > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 rounded-full px-1.5 text-[9px]">
                      {pingsUnread}
                    </Badge>
                  )}
                </span>
              </div>
              <div className="glass-surface rounded-2xl overflow-hidden">
                {pingsLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading pings...</div>
                ) : (
                  <PingInbox
                    pings={pings}
                    unreadCount={pingsUnread}
                    onMarkAllRead={markPingsRead}
                    onClearRead={clearReadPings}
                    onDeletePing={deletePing}
                  />
                )}
              </div>
            </motion.div>

            {/* Shared items section */}
            <motion.div variants={itemVariants}>
              <div style={{ marginBottom: "4px" }}>
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                  className="text-muted-foreground"
                >
                  SHARED WITH YOU
                  {sharedUnread > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 rounded-full px-1.5 text-[9px]">
                      {sharedUnread}
                    </Badge>
                  )}
                </span>
              </div>
              <div className="glass-surface rounded-2xl overflow-hidden">
                {sharedLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading shared items...</div>
                ) : sharedItems.length === 0 ? (
                  <div className="flex items-center gap-3 px-4 py-10 text-sm text-muted-foreground">
                    <Inbox className="size-5" />
                    Nothing shared yet.
                  </div>
                ) : (
                  <div className="space-y-0">
                    {(sharedUnread > 0 || sharedItems.some((item) => !!item.read_at)) && (
                      <div className="flex justify-end gap-2 px-4 pt-3">
                        {sharedUnread > 0 && (
                          <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={markSharedRead}>
                            Mark all read
                          </Button>
                        )}
                        {sharedItems.some((item) => !!item.read_at) && (
                          <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={clearReadShared}>
                            Clear read
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="space-y-2 p-3">
                      {sharedItems.map((item) => (
                        <SharedItemCard
                          key={item.id}
                          item={item}
                          currentUserId={currentUserId ?? ""}
                          onClearInboxItem={clearSharedItem}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* NETWORK TAB */}
        {activeTab === "discover" && (
          <motion.div
            className="flex flex-col gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            key="network"
          >
            {/* Search */}
            <motion.div variants={itemVariants}>
              <div className="glass-surface rounded-2xl p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or username"
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>

            {/* Search results */}
            {searching && (
              <motion.div variants={itemVariants}>
                <div className="glass-surface rounded-2xl py-8 text-center text-sm text-muted-foreground">
                  Searching...
                </div>
              </motion.div>
            )}

            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <motion.div variants={itemVariants}>
                <div className="glass-surface rounded-2xl py-10 text-center text-sm text-muted-foreground">
                  No results for &ldquo;{searchQuery}&rdquo;
                </div>
              </motion.div>
            )}

            {!searchQuery.trim() && (
              <motion.div variants={itemVariants}>
                <div className="glass-surface rounded-2xl flex items-center gap-3 px-4 py-8 text-sm text-muted-foreground">
                  <Sparkles className="size-5 text-primary" />
                  Search for people to follow and send pings.
                </div>
              </motion.div>
            )}

            {searchResults.length > 0 && (
              <motion.div variants={itemVariants} className="space-y-2">
                {searchResults.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onFollow={handleFollow}
                    onUnfollow={handleUnfollow}
                    onSendPing={handleSendPing}
                  />
                ))}
              </motion.div>
            )}

            {/* Following */}
            <motion.div variants={itemVariants}>
              <div style={{ margin: "8px 0 4px" }}>
                <span
                  style={{
                    fontFamily: Y2K.fontDisplay,
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                  className="text-muted-foreground"
                >
                  FOLLOWING · {following.length}
                </span>
              </div>
            </motion.div>

            {following.length === 0 ? (
              <motion.div variants={itemVariants}>
                <div className="glass-surface rounded-2xl py-10 text-center">
                  <p className="text-sm text-muted-foreground">No one in your network yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Search above to find and follow people.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div variants={itemVariants} className="space-y-2">
                {following.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onUnfollow={handleUnfollow}
                    onSendPing={handleSendPing}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* DOSSIER TAB */}
        {activeTab === "profile" && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            key="dossier"
          >
            <motion.div variants={itemVariants} className="glass-surface rounded-2xl overflow-hidden">
              <ProfileTabContent />
            </motion.div>
          </motion.div>
        )}
      </motion.div>

      {/* Floating inbox button */}
      <div className="fixed bottom-[calc(6rem+1rem+env(safe-area-inset-bottom,0px))] right-4 z-20 md:right-6">
        {commsUnread > 0 && activeTab !== "inbox" && (
          <Button
            size="sm"
            className="min-h-[44px] gap-1.5 rounded-full px-3 shadow-lg"
            onClick={() => setActiveTab("inbox")}
          >
            <Bell className="size-4" />
            INBOX
            <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
              {commsUnread}
            </Badge>
          </Button>
        )}
      </div>

      {/* Keyframes */}
      <style jsx global>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.75); }
        }
      `}</style>
    </div>
  );
}
