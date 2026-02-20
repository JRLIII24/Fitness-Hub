"use client";

import { useRouter } from "next/navigation";
import { Plus, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePods } from "@/hooks/use-pods";

export default function PodsPage() {
  const router = useRouter();
  const { pods, loading, error } = usePods();

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-5 pb-28 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-5 pb-28">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-5 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pods</h1>
          <p className="text-sm text-muted-foreground">Accountability groups for consistency</p>
        </div>
        <Button onClick={() => router.push("/pods/create")} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
      </div>

      {/* Empty State */}
      {pods.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">No pods yet</p>
              <p className="text-sm text-muted-foreground">
                Create or join a pod to stay accountable
              </p>
            </div>
            <Button onClick={() => router.push("/pods/create")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Pod
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Pod List */
        <div className="space-y-3">
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
              <CardContent className="space-y-3">
                {pod.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {pod.description}
                  </p>
                )}

                {/* Member avatars */}
                <div className="flex items-center gap-2">
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
                  <span className="text-xs text-muted-foreground">
                    {pod.members.map(m => m.display_name || m.username).slice(0, 2).join(", ")}
                    {pod.member_count > 2 && ` +${pod.member_count - 2} more`}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Stay consistent together</p>
              <p className="text-muted-foreground">
                Set weekly workout goals, track progress, and encourage your pod members
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
