"use client";

import { useRouter } from "next/navigation";
import { Plus, Users, TrendingUp, Heart, Dumbbell, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePods } from "@/hooks/use-pods";
import { PodInvitesSection } from "./pod-invites-section";

const POD_CATEGORIES = [
  { id: "strength", name: "Strength Training", icon: Dumbbell, color: "text-blue-500" },
  { id: "cardio", name: "Cardio & Running", icon: Zap, color: "text-orange-500" },
  { id: "weight-loss", name: "Weight Loss", icon: TrendingUp, color: "text-green-500" },
  { id: "general", name: "General Fitness", icon: Heart, color: "text-pink-500" },
];

interface PodsTabContentProps {
  onInviteUpdate?: () => void;
}

export function PodsTabContent({ onInviteUpdate }: PodsTabContentProps) {
  const router = useRouter();
  const { pods, loading } = usePods();

  return (
    <div className="space-y-4 mt-4">
      {/* Pending Invitations */}
      <PodInvitesSection onUpdate={onInviteUpdate} />

      {/* Create Pod CTA */}
      <Card className="border-dashed border-2">
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Start an Accountability Pod</p>
              <p className="text-xs text-muted-foreground">
                Form a group of 2-8 members to stay consistent
              </p>
            </div>
            <Button size="sm" onClick={() => router.push("/pods/create")}>
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Your Pods */}
      {!loading && pods.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Your Pods</h3>
          {pods.map((pod) => (
            <Card
              key={pod.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => router.push(`/pods/${pod.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{pod.name}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {pod.member_count} {pod.member_count === 1 ? "member" : "members"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {pod.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {pod.description}
                  </p>
                )}
                {/* Member avatars */}
                <div className="flex -space-x-2">
                  {pod.members.slice(0, 5).map((member, idx) => (
                    <div
                      key={member.user_id}
                      className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-semibold"
                      style={{ zIndex: 5 - idx }}
                    >
                      {(member.display_name || member.username || "?")[0].toUpperCase()}
                    </div>
                  ))}
                  {pod.member_count > 5 && (
                    <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      +{pod.member_count - 5}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pod Categories */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Browse by Category</h3>
        <div className="grid grid-cols-2 gap-3">
          {POD_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Card
                key={category.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => {
                  // Future: navigate to category browse page
                  alert(`${category.name} pods coming soon!`);
                }}
              >
                <CardContent className="pt-6 pb-4">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`w-12 h-12 rounded-full bg-secondary flex items-center justify-center ${category.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold">{category.name}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 pb-4">
          <div className="text-sm space-y-1">
            <p className="font-semibold">How Pods Work</p>
            <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside">
              <li>Create or join groups of 2-8 members</li>
              <li>Set weekly workout commitments together</li>
              <li>Track each other's progress</li>
              <li>Send encouragement messages</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
