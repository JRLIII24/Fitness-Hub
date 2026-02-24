'use client';

import { useState } from 'react';
import { usePodLeaderboard } from '@/hooks/use-pod-leaderboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Flame, Route } from 'lucide-react';
import type { ChallengeLeaderboard, LeaderboardEntry } from '@/types/pods';

interface PodLeaderboardProps {
    podId: string;
}

export function PodLeaderboard({ podId }: PodLeaderboardProps) {
    const { leaderboards, loading, error } = usePodLeaderboard(podId);
    const [activeTab, setActiveTab] = useState<'volume' | 'consistency' | 'distance'>('volume');

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
    const distanceLeaderboard = leaderboards.distance;

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
                <Tabs defaultValue="volume" value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="volume" className="flex items-center gap-1.5">
                            <Trophy className="h-4 w-4" />
                            <span className="hidden sm:inline">Volume</span>
                        </TabsTrigger>
                        <TabsTrigger value="consistency" className="flex items-center gap-1.5">
                            <Flame className="h-4 w-4" />
                            <span className="hidden sm:inline">Consistency</span>
                        </TabsTrigger>
                        <TabsTrigger value="distance" className="flex items-center gap-1.5">
                            <Route className="h-4 w-4" />
                            <span className="hidden sm:inline">Distance</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="volume" className="mt-0">
                        <LeaderboardList
                            leaderboard={volumeLeaderboard}
                            emptyMessage="No Volume challenge active or no data yet."
                            icon={<Trophy className="h-4 w-4 text-primary" />}
                        />
                    </TabsContent>
                    <TabsContent value="consistency" className="mt-0">
                        <LeaderboardList
                            leaderboard={consistencyLeaderboard}
                            emptyMessage="No Consistency challenge active or no data yet."
                            icon={<Flame className="h-4 w-4 text-orange-500" />}
                        />
                    </TabsContent>
                    <TabsContent value="distance" className="mt-0">
                        <LeaderboardList
                            leaderboard={distanceLeaderboard}
                            emptyMessage="No Distance challenge active or no data yet."
                            icon={<Route className="h-4 w-4 text-blue-500" />}
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

function LeaderboardList({
    leaderboard,
    emptyMessage,
    icon
}: {
    leaderboard: ChallengeLeaderboard | null;
    emptyMessage: string;
    icon: React.ReactNode;
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
                    />
                ))}
            </div>
        </ScrollArea>
    );
}

function LeaderboardRow({ entry, unit }: { entry: LeaderboardEntry; unit: string }) {
    const isTop3 = entry.rank <= 3;

    const getRankBadgeContent = (rank: number) => {
        switch (rank) {
            case 1:
                return '🥇 1st';
            case 2:
                return '🥈 2nd';
            case 3:
                return '🥉 3rd';
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
        <div className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-muted/50 \${isTop3 ? getRankColorClasses(entry.rank) : 'bg-background border-border/40'}`}>
            <div className="flex items-center gap-4">
                <div className="w-12 text-center font-bold text-sm">
                    {isTop3 ? (
                        <Badge variant={getRankBadgeVariant(entry.rank)} className={`whitespace-nowrap \${entry.rank === 1 ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}>
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
                        <span className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                            <span>{entry.workouts_cnt} workouts</span>
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            <span>{entry.runs_cnt} runs</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-end">
                <span className={`font-bold text-lg leading-none \${entry.rank === 1 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                    {entry.score.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                    {unit}
                </span>
            </div>
        </div>
    );
}
