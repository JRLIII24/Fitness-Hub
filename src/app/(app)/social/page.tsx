"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Settings,
  Users,
  Video,
  UsersRound,
  User,
  Bell,
  Inbox,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import { usePresence } from "@/hooks/use-presence";
import { usePings } from "@/hooks/use-pings";
import { useSharedItems } from "@/hooks/use-shared-items";
import { trackPodAccountabilityPingOpened } from "@/lib/retention-events";
import { UserCard, type UserCardUser } from "@/components/social/user-card";
import { PingInbox } from "@/components/social/ping-inbox";
import { SharedItemCard } from "@/components/social/shared-item-card";
import { PodsTabContent } from "@/components/pods/pods-tab-content";
import { PodInvitesSection } from "@/components/pods/pod-invites-section";
import { ProfileTabContent } from "@/components/social/profile-tab-content";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PillSelector } from "@/components/ui/pill-selector";
import { Card, CardContent } from "@/components/ui/card";

type SocialTab = "discover" | "following" | "pings" | "shared" | "pods" | "sets" | "profile";

const PRIMARY_TABS: Array<{ value: SocialTab; label: string }> = [
  { value: "discover", label: "Discover" },
  { value: "following", label: "Following" },
  { value: "pings", label: "Pings" },
  { value: "shared", label: "Shared" },
];

const SECONDARY_TABS: Array<{ value: SocialTab; label: string }> = [
  { value: "pods", label: "Pods" },
  { value: "sets", label: "Sets" },
  { value: "profile", label: "Profile" },
];

export default function SocialPage() {
  const router = useRouter();
  const supabase = useSupabase();

  const [activeTab, setActiveTab] = useState<SocialTab>("discover");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserCardUser[]>([]);
  const [following, setFollowing] = useState<UserCardUser[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [podInviteCount, setPodInviteCount] = useState(0);
  const loggedInboxOpenRef = useRef<string | null>(null);

  const { isOnline } = usePresence(currentUserId);
  void isOnline;

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

  const totalUnread = pingsUnread + sharedUnread + podInviteCount;

  useEffect(() => {
    if (!currentUserId) return;
    if (activeTab !== "pings" && activeTab !== "shared") return;
    const dayKey = new Date().toISOString().slice(0, 10);
    const eventKey = `${currentUserId}:${activeTab}:${dayKey}`;
    if (loggedInboxOpenRef.current === eventKey) return;
    loggedInboxOpenRef.current = eventKey;

    void trackPodAccountabilityPingOpened(supabase, currentUserId, {
      tab: activeTab,
      pings_unread: pingsUnread,
      shared_unread: sharedUnread,
      pod_invites_unread: podInviteCount,
      total_unread: totalUnread,
    });
  }, [
    activeTab,
    currentUserId,
    supabase,
  ]);

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
        .select(`following_id, profiles!user_follows_following_id_fkey(id, display_name, username, bio, fitness_goal)`)
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

  const handleInviteUpdate = () => {
    if (!currentUserId) return;
    supabase
      .from("pod_invites")
      .select("*", { count: "exact", head: true })
      .eq("invitee_id", currentUserId)
      .eq("status", "pending")
      .then(({ count }) => setPodInviteCount(count ?? 0));
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      const q = searchQuery.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username, bio, fitness_goal")
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

  async function handleFollow(userId: string) {
    if (!currentUserId) return;
    const { error } = await supabase
      .from("user_follows")
      .insert({ follower_id: currentUserId, following_id: userId });

    if (error) throw error;

    setFollowingIds((prev) => new Set([...prev, userId]));
    setSearchResults((prev) => prev.map((u) => (u.id === userId ? { ...u, isFollowing: true } : u)));

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
    setSearchResults((prev) => prev.map((u) => (u.id === userId ? { ...u, isFollowing: false } : u)));
    setFollowing((prev) => prev.filter((u) => u.id !== userId));

    toast.success("Unfollowed");
  }

  async function handleSendPing(recipientId: string, message: string) {
    await sendPing(recipientId, message);
    toast.success("Ping sent");
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-28 pt-5 md:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Social Performance</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Train Together</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Discover serious athletes, exchange pings and programming, and keep accountability tight.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} title="Settings">
              <Settings className="size-5" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="border-border/70 bg-card/80">
              <CardContent className="px-3 py-3">
                <p className="text-xs text-muted-foreground">Following</p>
                <p className="text-xl font-semibold tabular-nums">{following.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/80">
              <CardContent className="px-3 py-3">
                <p className="text-xs text-muted-foreground">Unread</p>
                <p className="text-xl font-semibold tabular-nums">{totalUnread}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/80">
              <CardContent className="px-3 py-3">
                <p className="text-xs text-muted-foreground">Pod Invites</p>
                <p className="text-xl font-semibold tabular-nums">{podInviteCount}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <PillSelector value={activeTab} onChange={setActiveTab} options={PRIMARY_TABS} ariaLabel="Primary social tabs" />
            <PillSelector value={activeTab} onChange={setActiveTab} options={SECONDARY_TABS} ariaLabel="Secondary social tabs" />
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SocialTab)}>
        <TabsContent value="discover" className="mt-0 space-y-3">
          <Card className="border-border/70 bg-card/85">
            <CardContent className="pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or username"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {searching ? (
            <Card className="border-border/60 bg-card/70">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Searching athletes...</CardContent>
            </Card>
          ) : null}

          {!searching && searchQuery.trim() && searchResults.length === 0 ? (
            <Card className="border-border/60 bg-card/70">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No public profiles found for &ldquo;{searchQuery}&rdquo;
              </CardContent>
            </Card>
          ) : null}

          {!searchQuery.trim() ? (
            <Card className="border-border/60 bg-card/70">
              <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <Sparkles className="size-5 text-primary" />
                Search for athletes to follow and send pings.
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-2">
            {searchResults.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onFollow={handleFollow}
                onUnfollow={handleUnfollow}
                onSendPing={handleSendPing}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="following" className="mt-0 space-y-2">
          {following.length === 0 ? (
            <Card className="border-border/60 bg-card/70">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">You&apos;re not following anyone yet.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setActiveTab("discover")}>
                  Discover Athletes
                </Button>
              </CardContent>
            </Card>
          ) : (
            following.map((user) => (
              <UserCard key={user.id} user={user} onUnfollow={handleUnfollow} onSendPing={handleSendPing} />
            ))
          )}
        </TabsContent>

        <TabsContent value="pings" className="mt-0 space-y-4">
          <PodInvitesSection onUpdate={handleInviteUpdate} />

          {pingsLoading ? (
            <Card className="border-border/60 bg-card/70">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Loading pings...</CardContent>
            </Card>
          ) : (
            <PingInbox
              pings={pings}
              unreadCount={pingsUnread}
              onMarkAllRead={markPingsRead}
              onClearRead={clearReadPings}
              onDeletePing={deletePing}
            />
          )}
        </TabsContent>

        <TabsContent value="shared" className="mt-0 space-y-3">
          {sharedLoading ? (
            <Card className="border-border/60 bg-card/70">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Loading shared items...</CardContent>
            </Card>
          ) : sharedItems.length === 0 ? (
            <Card className="border-border/60 bg-card/70">
              <CardContent className="py-10 text-center">
                <Inbox className="mx-auto mb-2 size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No shared items yet.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {(sharedUnread > 0 || sharedItems.some((item) => !!item.read_at)) && (
                <div className="flex justify-end gap-2">
                  {sharedUnread > 0 ? (
                    <Button variant="ghost" size="sm" onClick={markSharedRead}>
                      Mark all read
                    </Button>
                  ) : null}
                  {sharedItems.some((item) => !!item.read_at) ? (
                    <Button variant="ghost" size="sm" onClick={clearReadShared}>
                      Clear read
                    </Button>
                  ) : null}
                </div>
              )}
              {sharedItems.map((item) => (
                <SharedItemCard
                  key={item.id}
                  item={item}
                  currentUserId={currentUserId ?? ""}
                  onClearInboxItem={clearSharedItem}
                />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="pods" className="mt-0">
          <PodsTabContent onInviteUpdate={handleInviteUpdate} />
        </TabsContent>

        <TabsContent value="sets" className="mt-0">
          <Card className="overflow-hidden border-border/70 bg-card/85">
            <CardContent className="relative py-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative flex flex-col items-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15">
                  <Video className="size-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Sets Feed</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Watch short training clips, track performance cues, and post your own hard sets.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link href="/sets">
                    <Button className="motion-press gap-1.5">
                      Open Sets
                      <ArrowUpRight className="size-4" />
                    </Button>
                  </Link>
                  <Link href="/sets/upload">
                    <Button variant="outline" className="motion-press">Post a Set</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-0">
          <ProfileTabContent />
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-24 right-4 z-20 md:right-6">
        {(pingsUnread > 0 || sharedUnread > 0) && (
          <Button size="sm" className="h-9 gap-1.5 rounded-full px-3 shadow-lg" onClick={() => setActiveTab("pings")}>
            <Bell className="size-4" />
            Inbox
            <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
              {pingsUnread + sharedUnread}
            </Badge>
          </Button>
        )}
      </div>
    </div>
  );
}
