'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePodLeaderboard } from '@/hooks/use-pod-leaderboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Flame, Shield } from 'lucide-react';
import { kgToLbs } from '@/lib/units';
import { useUnitPreferenceStore } from '@/stores/unit-preference-store';
import { POD_ARENA_ENABLED } from '@/lib/features';
import { getArenaTier, ARENA_TIERS } from '@/types/pods';
import type { ChallengeLeaderboard, LeaderboardEntry, ArenaTier } from '@/types/pods';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';

interface PodLeaderboardProps {
    podId: string;
    arenaLevel?: number;
    seasonScore?: number;
    seasonStartDate?: string;
}

export function PodLeaderboard({ podId, arenaLevel, seasonScore, seasonStartDate }: PodLeaderboardProps) {
    const { leaderboards, loading, error } = usePodLeaderboard(podId);
    const unitPreference = useUnitPreferenceStore((state) => state.preference);

    const showArena = POD_ARENA_ENABLED && arenaLevel !== undefined && seasonScore !== undefined;

    const [activeTab, setActiveTab] = useState<'volume' | 'consistency' | 'arena'>('volume');

    if (loading) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Pod Leaderboard</CardTitle>
                    <CardDescription>Loading rankings...</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="w-full border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive">Pod Leaderboard</CardTitle>
                    <CardDescription>Could not load leaderboard data.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{error}</p>
                </CardContent>
            </Card>
        );
    }

    const volumeLeaderboard = leaderboards.volume;
    const consistencyLeaderboard = leaderboards.consistency;

    return (
        <Card className="w-full shadow-md border-border/50 bg-background/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Pod Leaderboard
                </CardTitle>
                <CardDescription>Real-time rankings for your pod challenges</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs
                    defaultValue="volume"
                    value={activeTab}
                    onValueChange={(v) => {
                        if (v === 'volume' || v === 'consistency' || (v === 'arena' && showArena)) {
                            setActiveTab(v as typeof activeTab);
                        }
                    }}
                >
                    <TabsList className={`grid w-full ${showArena ? 'grid-cols-3' : 'grid-cols-2'} mb-6`}>
                        <TabsTrigger value="volume" className="flex items-center gap-1.5">
                            <Trophy className="h-4 w-4" />
                            <span className="hidden sm:inline">Volume</span>
                        </TabsTrigger>
                        <TabsTrigger value="consistency" className="flex items-center gap-1.5">
                            <Flame className="h-4 w-4" />
                            <span className="hidden sm:inline">Consistency</span>
                        </TabsTrigger>
                        {showArena && (
                            <TabsTrigger value="arena" className="flex items-center gap-1.5">
                                <Shield className="h-4 w-4" />
                                <span className="hidden sm:inline">Arena</span>
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="volume" className="mt-0">
                        <LeaderboardList
                            leaderboard={volumeLeaderboard}
                            emptyMessage="No Volume challenge active or no data yet."
                            icon={<Trophy className="h-4 w-4 text-primary" />}
                            unitPreference={unitPreference}
                        />
                    </TabsContent>
                    <TabsContent value="consistency" className="mt-0">
                        <LeaderboardList
                            leaderboard={consistencyLeaderboard}
                            emptyMessage="No Consistency challenge active or no data yet."
                            icon={<Flame className="h-4 w-4 text-orange-500" />}
                            unitPreference={unitPreference}
                        />
                    </TabsContent>
                    {showArena && (
                        <TabsContent value="arena" className="mt-0">
                            <ArenaTabContent
                                podId={podId}
                                seasonScore={seasonScore!}
                                seasonStartDate={seasonStartDate}
                            />
                        </TabsContent>
                    )}
                </Tabs>
            </CardContent>
        </Card>
    );
}

// ── Arena Tab ────────────────────────────────────────────────────────────────

interface SeasonRecap {
    id: string;
    summary: string;
    highlights: string[];
    recap_date: string;
}

function ArenaTabContent({
    podId,
    seasonScore,
    seasonStartDate,
}: {
    podId: string;
    seasonScore: number;
    seasonStartDate?: string;
}) {
    const tier = getArenaTier(seasonScore);
    const tierInfo = ARENA_TIERS[tier];

    const [recap, setRecap] = useState<SeasonRecap | null>(null);
    const [recapLoading, setRecapLoading] = useState(true);

    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        let cancelled = false;

        async function fetchRecap() {
            setRecapLoading(true);
            const { data } = await supabase
                .from('pod_season_recaps')
                .select('id, summary, highlights, recap_date')
                .eq('pod_id', podId)
                .order('recap_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!cancelled && data) {
                setRecap({
                    id: data.id,
                    summary: data.summary,
                    highlights: Array.isArray(data.highlights)
                        ? (data.highlights as string[])
                        : [],
                    recap_date: data.recap_date,
                });
            }
            if (!cancelled) setRecapLoading(false);
        }

        fetchRecap();
        return () => { cancelled = true; };
    }, [podId, supabase]);

    return (
        <div className="space-y-6">
            <ArenaTierBadge
                tier={tier}
                tierInfo={tierInfo}
                seasonScore={seasonScore}
                seasonStartDate={seasonStartDate}
            />

            {/* Season Recap */}
            <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Season Recap
                </p>

                {recapLoading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : recap ? (
                    <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
                        <p className="text-sm text-foreground leading-relaxed">
                            {recap.summary}
                        </p>
                        {recap.highlights.length > 0 && (
                            <ul className="space-y-1.5">
                                {recap.highlights.map((h, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-2 text-sm text-muted-foreground"
                                    >
                                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                        {h}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {new Date(recap.recap_date).toLocaleDateString('en-US', {
                                month: 'long',
                                year: 'numeric',
                            })}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 rounded-xl border border-dashed border-border/50 bg-muted/20">
                        <div className="rounded-full bg-muted p-3">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            No season recap yet. Keep competing to unlock your first recap.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ArenaTierBadge({
    tier,
    tierInfo,
    seasonScore,
    seasonStartDate,
}: {
    tier: ArenaTier;
    tierInfo: (typeof ARENA_TIERS)[ArenaTier];
    seasonScore: number;
    seasonStartDate?: string;
}) {
    const nextThreshold = tierInfo.next;
    const progressPct =
        nextThreshold !== null
            ? Math.min(
                  100,
                  ((seasonScore - tierInfo.min) / (nextThreshold - tierInfo.min)) * 100,
              )
            : 100;

    return (
        <div className="rounded-xl border border-border/50 bg-card/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${tierInfo.color}20`, borderColor: `${tierInfo.color}40`, borderWidth: 1 }}
                    >
                        <Shield className="h-5 w-5" style={{ color: tierInfo.color }} />
                    </div>
                    <div>
                        <p
                            className="text-[13px] font-bold"
                            style={{ color: tierInfo.color }}
                        >
                            {tierInfo.label}
                        </p>
                        {seasonStartDate && (
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Season started{' '}
                                {new Date(seasonStartDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </p>
                        )}
                    </div>
                </div>

                <motion.span
                    className="tabular-nums text-[26px] font-black leading-none"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                    {seasonScore}
                </motion.span>
            </div>

            {/* Progress bar */}
            {nextThreshold !== null && (
                <div className="space-y-1.5">
                    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: tierInfo.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {tierInfo.label}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {seasonScore} / {nextThreshold}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Existing Leaderboard Components ──────────────────────────────────────────

function LeaderboardList({
    leaderboard,
    emptyMessage,
    icon,
    unitPreference,
}: {
    leaderboard: ChallengeLeaderboard | null;
    emptyMessage: string;
    icon: React.ReactNode;
    unitPreference: "metric" | "imperial";
}) {
    if (!leaderboard || !leaderboard.entries || leaderboard.entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 rounded-lg border border-dashed border-border/50 bg-muted/20">
                <div className="rounded-full bg-muted p-3">
                    {icon}
                </div>
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[350px] pr-4 w-full">
            <div className="space-y-4">
                {leaderboard.entries.map((entry) => (
                    <LeaderboardRow
                        key={entry.user_id}
                        entry={entry}
                        unit={leaderboard.score_unit}
                        unitPreference={unitPreference}
                    />
                ))}
            </div>
        </ScrollArea>
    );
}

function LeaderboardRow({
    entry,
    unit,
    unitPreference,
}: {
    entry: LeaderboardEntry;
    unit: string;
    unitPreference: "metric" | "imperial";
}) {
    const isTop3 = entry.rank <= 3;
    const isImperial = unitPreference === "imperial";

    const convertedScore =
        isImperial && unit === "kg"
            ? kgToLbs(entry.score)
            : entry.score;

    const roundedScore = Math.round(convertedScore * 10) / 10;
    const formattedScore = Number.isInteger(roundedScore)
        ? roundedScore.toLocaleString()
        : roundedScore.toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
          });

    const displayUnit =
        isImperial && unit === "kg"
            ? "lbs"
            : unit;

    const getRankBadgeContent = (rank: number) => {
        switch (rank) {
            case 1:
                return '1st';
            case 2:
                return '2nd';
            case 3:
                return '3rd';
            default:
                return `${rank}th`;
        }
    };

    const getRankBadgeVariant = (rank: number) => {
        switch (rank) {
            case 1:
                return 'default';
            case 2:
                return 'secondary';
            case 3:
                return 'outline';
            default:
                return 'outline';
        }
    };

    const getRankColorClasses = (rank: number) => {
        switch (rank) {
            case 1:
                return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400';
            case 2:
                return 'bg-gray-400/10 border-gray-400/30 text-gray-600 dark:text-gray-300';
            case 3:
                return 'bg-amber-700/10 border-amber-700/30 text-amber-700 dark:text-amber-500';
            default:
                return 'bg-muted/50 border-border/50 text-muted-foreground';
        }
    };

    return (
        <div
            className={`flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-muted/50 ${
                isTop3 ? getRankColorClasses(entry.rank) : 'bg-background border-border/40'
            }`}
        >
            <div className="flex items-center gap-4">
                <div className="w-12 text-center font-bold text-sm">
                    {isTop3 ? (
                        <Badge
                            variant={getRankBadgeVariant(entry.rank)}
                            className={`whitespace-nowrap ${entry.rank === 1 ? 'bg-yellow-500 text-white hover:bg-yellow-600' : ''}`}
                        >
                            {getRankBadgeContent(entry.rank)}
                        </Badge>
                    ) : (
                        <span className="text-muted-foreground">{entry.rank}</span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border/50">
                        <AvatarImage src={entry.avatar_url || ''} alt={entry.display_name || 'User'} />
                        <AvatarFallback>{(entry.display_name || 'U').substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium text-sm leading-none">{entry.display_name || 'Unknown User'}</span>
                        <span className="text-xs text-muted-foreground mt-1.5">
                            {entry.workouts_cnt} workouts
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-end">
                <span className={`font-bold text-lg leading-none ${entry.rank === 1 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                    {formattedScore}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                    {displayUnit}
                </span>
            </div>
        </div>
    );
}
