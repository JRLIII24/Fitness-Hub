"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Send, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ClipComment } from "@/hooks/use-clips";
import { formatDistanceToNow } from "date-fns";

interface ClipCommentSheetProps {
  clipId: string | null;
  clipOwnerId: string | null;
  currentUserId: string | null;
  onClose: () => void;
  fetchComments: (clipId: string) => Promise<ClipComment[]>;
  postComment: (clipId: string, content: string) => Promise<ClipComment | null>;
}

export function ClipCommentSheet({
  clipId,
  clipOwnerId,
  currentUserId,
  onClose,
  fetchComments,
  postComment,
}: ClipCommentSheetProps) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<ClipComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [canComment, setCanComment] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clipId) {
      setComments([]);
      return;
    }
    setLoading(true);
    fetchComments(clipId).then((data) => {
      setComments(data);
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
    });
  }, [clipId, fetchComments]);

  // Check mutual follow when sheet opens
  useEffect(() => {
    if (!clipId || !currentUserId || !clipOwnerId) {
      setCanComment(null);
      return;
    }
    // Can't comment on your own clip
    if (currentUserId === clipOwnerId) {
      setCanComment(false);
      return;
    }
    (async () => {
      const [{ data: iFollow }, { data: theyFollow }] = await Promise.all([
        supabase
          .from("user_follows")
          .select("id")
          .eq("follower_id", currentUserId)
          .eq("following_id", clipOwnerId)
          .maybeSingle(),
        supabase
          .from("user_follows")
          .select("id")
          .eq("follower_id", clipOwnerId)
          .eq("following_id", currentUserId)
          .maybeSingle(),
      ]);
      setCanComment(!!iFollow && !!theyFollow);
    })();
  }, [clipId, clipOwnerId, currentUserId, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clipId || !text.trim() || submitting) return;
    setSubmitting(true);
    const comment = await postComment(clipId, text.trim());
    if (comment) {
      setComments((prev) => [...prev, comment]);
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
    setSubmitting(false);
  }

  return (
    <Sheet open={!!clipId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[70svh] flex flex-col px-0"
      >
        <SheetHeader className="px-4 pb-2 border-b">
          <SheetTitle className="text-sm">Comments</SheetTitle>
        </SheetHeader>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No comments yet.{canComment ? " Be the first!" : " Mutual followers can comment."}
            </p>
          ) : (
            comments.map((c) => {
              const name =
                c.profiles?.display_name ?? c.profiles?.username ?? "User";
              return (
                <div key={c.id} className="flex items-start gap-3">
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="text-xs bg-muted">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 mt-0.5 break-words">
                      {c.content}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input — only shown for mutual followers */}
        {canComment === false ? (
          <div className="px-4 pt-2 pb-4 border-t text-center">
            <p className="text-xs text-muted-foreground">
              {currentUserId === clipOwnerId
                ? "You can't comment on your own clip."
                : "Follow each other to leave a comment."}
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="px-4 pt-2 pb-4 border-t flex items-center gap-2"
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={canComment ? "Add a comment…" : "Checking follow status…"}
              disabled={!canComment || submitting}
              maxLength={280}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!canComment || !text.trim() || submitting}
              aria-label="Post comment"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
