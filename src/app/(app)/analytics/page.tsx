import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Zap,
  Target,
  CheckCircle2,
  XCircle,
  Activity
} from "lucide-react";

interface LauncherEvent {
  event_data: {
    action: string;
    confidence?: string;
    template_id?: string;
    time_to_decision_ms?: number;
  };
  created_at: string;
}

interface TemplateStats {
  template_id: string;
  template_name: string;
  shown_count: number;
  accepted_count: number;
  acceptance_rate: number;
}

interface ConfidenceStats {
  confidence: string;
  shown_count: number;
  accepted_count: number;
  acceptance_rate: number;
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch all launcher events
  const { data: events } = await supabase
    .from("workout_events")
    .select("event_data, created_at")
    .eq("user_id", user.id)
    .eq("event_type", "workout_launched")
    .order("created_at", { ascending: false })
    .limit(1000);

  const launcherEvents = (events || []) as LauncherEvent[];

  // Calculate overall stats
  const shownEvents = launcherEvents.filter(e => e.event_data.action === "launcher_shown");
  const acceptedEvents = launcherEvents.filter(e => e.event_data.action === "launcher_accepted");
  const rejectedEvents = launcherEvents.filter(e => e.event_data.action === "launcher_rejected");

  const totalShown = shownEvents.length;
  const totalAccepted = acceptedEvents.length;
  const totalRejected = rejectedEvents.length;
  const overallAcceptanceRate = totalShown > 0 ? (totalAccepted / totalShown) * 100 : 0;

  // Calculate average decision time
  const decisionTimes = acceptedEvents
    .map(e => e.event_data.time_to_decision_ms)
    .filter((t): t is number => typeof t === "number");
  const avgDecisionTimeMs = decisionTimes.length > 0
    ? decisionTimes.reduce((sum, t) => sum + t, 0) / decisionTimes.length
    : 0;
  const avgDecisionTimeSec = Math.round(avgDecisionTimeMs / 1000);

  // Group by template to find most popular
  const templateStats = new Map<string, { shown: number; accepted: number; name: string }>();

  shownEvents.forEach(e => {
    const templateId = e.event_data.template_id;
    if (!templateId) return;

    if (!templateStats.has(templateId)) {
      templateStats.set(templateId, { shown: 0, accepted: 0, name: "Unknown" });
    }
    const stats = templateStats.get(templateId)!;
    stats.shown++;
  });

  acceptedEvents.forEach(e => {
    const templateId = e.event_data.template_id;
    if (!templateId) return;

    if (templateStats.has(templateId)) {
      const stats = templateStats.get(templateId)!;
      stats.accepted++;
    }
  });

  // Fetch template names
  const templateIds = Array.from(templateStats.keys());
  const { data: templates } = await supabase
    .from("workout_templates")
    .select("id, name")
    .in("id", templateIds);

  templates?.forEach(t => {
    if (templateStats.has(t.id)) {
      templateStats.get(t.id)!.name = t.name;
    }
  });

  const topTemplates: TemplateStats[] = Array.from(templateStats.entries())
    .map(([id, stats]) => ({
      template_id: id,
      template_name: stats.name,
      shown_count: stats.shown,
      accepted_count: stats.accepted,
      acceptance_rate: stats.shown > 0 ? (stats.accepted / stats.shown) * 100 : 0
    }))
    .sort((a, b) => b.shown_count - a.shown_count)
    .slice(0, 5);

  // Group by confidence level
  const confidenceStats = new Map<string, { shown: number; accepted: number }>();

  shownEvents.forEach(e => {
    const confidence = e.event_data.confidence || "unknown";
    if (!confidenceStats.has(confidence)) {
      confidenceStats.set(confidence, { shown: 0, accepted: 0 });
    }
    confidenceStats.get(confidence)!.shown++;
  });

  acceptedEvents.forEach(e => {
    const confidence = e.event_data.confidence || "unknown";
    if (confidenceStats.has(confidence)) {
      confidenceStats.get(confidence)!.accepted++;
    }
  });

  const confidenceLevels: ConfidenceStats[] = ["high", "medium", "low"].map(confidence => {
    const stats = confidenceStats.get(confidence) || { shown: 0, accepted: 0 };
    return {
      confidence,
      shown_count: stats.shown,
      accepted_count: stats.accepted,
      acceptance_rate: stats.shown > 0 ? (stats.accepted / stats.shown) * 100 : 0
    };
  });

  const confidenceColors = {
    high: "text-green-500",
    medium: "text-yellow-500",
    low: "text-orange-500"
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-28 pt-6 md:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Launcher Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Performance metrics for your Smart Workout Launcher
        </p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center px-2 py-4">
            <Activity className="mb-1 h-5 w-5 text-primary" />
            <span className="text-2xl font-bold tabular-nums">{totalShown}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-center">
              Times Shown
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center px-2 py-4">
            <CheckCircle2 className="mb-1 h-5 w-5 text-green-500" />
            <span className="text-2xl font-bold tabular-nums">{totalAccepted}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-center">
              Accepted
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center px-2 py-4">
            <XCircle className="mb-1 h-5 w-5 text-red-500" />
            <span className="text-2xl font-bold tabular-nums">{totalRejected}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-center">
              Rejected
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center px-2 py-4">
            <Zap className="mb-1 h-5 w-5 text-yellow-500" />
            <span className="text-2xl font-bold tabular-nums">{avgDecisionTimeSec}s</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-center">
              Avg Decision
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Acceptance Rate */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Overall Acceptance Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold tabular-nums">
              {Math.round(overallAcceptanceRate)}%
            </span>
            <span className="text-sm text-muted-foreground">
              {totalAccepted} / {totalShown} suggestions
            </span>
          </div>
          <Progress value={overallAcceptanceRate} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {overallAcceptanceRate >= 70
              ? "🎯 Excellent! Your launcher is highly accurate."
              : overallAcceptanceRate >= 50
              ? "👍 Good performance. Keep tracking patterns."
              : "📊 Still learning your patterns. More data will improve predictions."
            }
          </p>
        </CardContent>
      </Card>

      {/* Confidence Level Breakdown */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Accuracy by Confidence Level
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {confidenceLevels.map(level => (
            <div key={level.confidence} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={level.confidence === "high" ? "default" : level.confidence === "medium" ? "secondary" : "outline"}
                    className="text-[10px] capitalize"
                  >
                    {level.confidence}
                  </Badge>
                  <span className="text-sm font-medium">
                    {Math.round(level.acceptance_rate)}% accepted
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {level.accepted_count} / {level.shown_count}
                </span>
              </div>
              <Progress value={level.acceptance_rate} className="h-1.5" />
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">
            High confidence predictions should have higher acceptance rates. This validates the algorithm's pattern detection.
          </p>
        </CardContent>
      </Card>

      {/* Top Templates */}
      {topTemplates.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Most Suggested Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topTemplates.map((template, idx) => (
              <div key={template.template_id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-muted-foreground mt-0.5">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{template.template_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Suggested {template.shown_count} times • {template.accepted_count} accepted
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                    {Math.round(template.acceptance_rate)}%
                  </Badge>
                </div>
                <Progress value={template.acceptance_rate} className="h-1" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {totalShown === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No data yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              Use the Smart Launcher on your dashboard to start collecting analytics data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
