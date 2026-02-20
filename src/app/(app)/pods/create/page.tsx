"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { usePods } from "@/hooks/use-pods";

export default function CreatePodPage() {
  const router = useRouter();
  const { createPod } = usePods();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (name.trim().length < 2 || name.trim().length > 50) {
      setError("Pod name must be 2-50 characters");
      return;
    }

    if (description.trim().length > 200) {
      setError("Description must be 200 characters or less");
      return;
    }

    setLoading(true);
    setError("");

    const podId = await createPod(name.trim(), description.trim() || undefined);

    if (podId) {
      router.push(`/pods/${podId}`);
    } else {
      setError("Failed to create pod. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-5 pb-28">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create a Pod</CardTitle>
          <p className="text-sm text-muted-foreground">
            Start an accountability group with 2-8 members
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Pod Name */}
            <div className="space-y-2">
              <Label htmlFor="pod-name">Pod Name *</Label>
              <Input
                id="pod-name"
                placeholder="e.g. Morning Crew, Gym Bros, Consistency Squad"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                maxLength={50}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {name.length}/50 characters
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="pod-desc">Description (optional)</Label>
              <Textarea
                id="pod-desc"
                placeholder="What's this pod about? Goals, schedule, vibe..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError("");
                }}
                maxLength={200}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/200 characters
              </p>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Pod"
              )}
            </Button>

            {/* Info */}
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="font-semibold">What happens next?</p>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>You'll be added as the first member</li>
                <li>Invite up to 7 more people</li>
                <li>Set weekly workout goals together</li>
                <li>Send encouragement messages</li>
              </ul>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
