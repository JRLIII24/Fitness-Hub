"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRatingInput } from "./star-rating-input";
import type { TemplateReview } from "@/types/pods";

// ── helpers ────────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
    if (!name) return "?";
    return name
        .split(" ")
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diffMs / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    return `${mo}mo ago`;
}

// ── Bar chart for star distribution ──────────────────────────────────────────

function DistributionBar({ label, count, total }: { label: number; count: number; total: number }) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="flex items-center gap-2">
            <span className="w-3 text-right text-[10px] font-semibold text-muted-foreground">{label}</span>
            <div className="relative flex-1 h-1.5 rounded-full overflow-hidden bg-border/40">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                />
            </div>
            <span className="w-5 text-right text-[10px] text-muted-foreground">{count}</span>
        </div>
    );
}

// ── Single review card ────────────────────────────────────────────────────────

function ReviewCard({ review, index }: { review: TemplateReview; index: number }) {
    const name = review.reviewer?.display_name ?? "Anonymous";
    const ini = initials(name);

    return (
        <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04 }}
            className={cn(
                "rounded-xl border border-border/50 p-3.5",
                review.is_own
                    ? "bg-primary/5 border-primary/20"
                    : "bg-card/40"
            )}
        >
            <div className="flex items-start gap-2.5">
                {/* Avatar */}
                <Avatar className="size-7 shrink-0">
                    {review.reviewer?.avatar_url && (
                        <AvatarImage src={review.reviewer.avatar_url} alt={name} />
                    )}
                    <AvatarFallback
                        className="text-[9px] font-bold"
                        style={{
                            background: "rgba(200,255,0,0.1)",
                            borderColor: "rgba(200,255,0,0.25)",
                            color: "hsl(var(--primary))",
                        }}
                    >
                        {ini}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-semibold text-foreground truncate">{name}</span>
                        {review.is_own && (
                            <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5">
                                You
                            </span>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                            {relativeTime(review.created_at)}
                        </span>
                    </div>
                    <StarRatingInput value={review.rating} readonly size="sm" className="mb-1.5" />
                    {review.comment && (
                        <p className="text-[12px] text-muted-foreground leading-relaxed">{review.comment}</p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── Main ReviewsSection ───────────────────────────────────────────────────────

interface ReviewsSectionProps {
    templateId: string;
    currentUserId?: string;
    isOwn: boolean;
    /** Pass in pre-fetched avg_rating and review_count from the template object */
    avgRating?: number | null;
    reviewCount?: number;
}

export function ReviewsSection({
    templateId,
    currentUserId,
    isOwn,
    avgRating: initialAvg,
    reviewCount: initialCount,
}: ReviewsSectionProps) {
    const [reviews, setReviews] = useState<TemplateReview[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    // Derived live averages (override with live data once loaded)
    const [liveAvg, setLiveAvg] = useState<number>(initialAvg ?? 0);
    const [liveCount, setLiveCount] = useState<number>(initialCount ?? 0);

    // Form state
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const myReview = reviews.find((r) => r.is_own);
    const isLoggedIn = !!currentUserId;

    // Distribution counts
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: reviews.filter((r) => r.rating === star).length,
    }));

    // ── Fetch reviews ──────────────────────────────────────────────────────────
    const fetchReviews = useCallback(async () => {
        try {
            const res = await fetch(`/api/templates/${templateId}/reviews`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            const list: TemplateReview[] = data.reviews ?? [];
            setReviews(list);

            // Compute live stats from fetched data
            if (list.length > 0) {
                const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
                setLiveAvg(Math.round(avg * 10) / 10);
                setLiveCount(list.length);
            } else {
                setLiveAvg(0);
                setLiveCount(0);
            }
        } catch {
            // Silently degrade — rating stats from the card are still visible
        } finally {
            setLoadingReviews(false);
        }
    }, [templateId]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    // Pre-populate form when user's existing review loads
    useEffect(() => {
        if (myReview) {
            setRating(myReview.rating);
            setComment(myReview.comment ?? "");
        }
    }, [myReview?.id]); // only re-run when the review identity changes

    // ── Submit review ──────────────────────────────────────────────────────────
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (rating === 0) {
            toast.error("Please choose a star rating first");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`/api/templates/${templateId}/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error ?? "Failed");
            }

            const data = await res.json();
            const submittedReview = data.review as TemplateReview;

            // Optimistic update: immediately compute updated stats from the submitted review
            // before fetching the full list. This prevents stale values from showing while
            // the network request is in flight.
            const allReviews = myReview
                ? reviews.map(r => r.id === myReview.id ? submittedReview : r)
                : [...reviews, submittedReview];

            if (allReviews.length > 0) {
                const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
                setLiveAvg(Math.round(avg * 10) / 10);
                setLiveCount(allReviews.length);
            }

            toast.success(myReview ? "Review updated!" : "Review submitted!");
            await fetchReviews();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to submit review");
        } finally {
            setSubmitting(false);
        }
    }

    // ── Delete review ──────────────────────────────────────────────────────────
    async function handleDelete() {
        setDeleting(true);
        try {
            const res = await fetch(`/api/templates/${templateId}/reviews`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("Review removed");
            setRating(0);
            setComment("");
            await fetchReviews();
        } catch {
            toast.error("Failed to delete review");
        } finally {
            setDeleting(false);
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">
            {/* ── Section header ────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Ratings & Reviews
                </span>
            </div>

            {/* ── Rating summary ─────────────────────────────────────────────────── */}
            {liveCount > 0 && (
                <div className="flex gap-4 rounded-xl border border-border/50 bg-card/40 px-4 py-4">
                    {/* Big number */}
                    <div className="flex flex-col items-center justify-center pr-4 border-r border-border/40 shrink-0">
                        <span className="text-[38px] font-black leading-none text-foreground tabular-nums">
                            {liveAvg > 0 ? liveAvg.toFixed(1) : "—"}
                        </span>
                        <StarRatingInput value={liveAvg} readonly size="sm" className="mt-1.5" />
                        <span className="mt-1 text-[10px] text-muted-foreground">{liveCount} ratings</span>
                    </div>

                    {/* Distribution bars */}
                    <div className="flex-1 flex flex-col justify-center gap-1.5">
                        {distribution.map(({ star, count }) => (
                            <DistributionBar key={star} label={star} count={count} total={liveCount} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Write a review (non-owners, logged in) ──────────────────────────── */}
            {!isOwn && isLoggedIn && (
                <div className="rounded-xl border border-border/50 bg-card/40 px-4 py-4 space-y-3">
                    <p className="text-[12px] font-semibold text-foreground">
                        {myReview ? "Your Review" : "Write a Review"}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-3">
                        {/* Star picker */}
                        <div className="flex items-center gap-3">
                            <StarRatingInput value={rating} onChange={setRating} size="md" />
                            {rating > 0 && (
                                <motion.span
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="text-[12px] text-primary font-semibold"
                                >
                                    {["", "Poor", "Fair", "Good", "Great", "Amazing"][rating]}
                                </motion.span>
                            )}
                        </div>

                        {/* Comment textarea */}
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Share your experience with this template… (optional)"
                            rows={3}
                            className="w-full resize-none rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                        />

                        {/* Actions */}
                        <div className="flex gap-2">
                            <motion.button
                                whileTap={{ scale: 0.96 }}
                                type="submit"
                                disabled={submitting || rating === 0}
                                className={cn(
                                    "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5",
                                    "text-[13px] font-bold transition-all duration-200",
                                    "bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(200,255,0,0.2)]",
                                    (submitting || rating === 0) && "opacity-60 cursor-not-allowed"
                                )}
                            >
                                <Send className="h-3.5 w-3.5" />
                                {submitting ? "Saving…" : myReview ? "Update Review" : "Submit Review"}
                            </motion.button>

                            {myReview && (
                                <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5",
                                        "text-[12px] font-bold text-rose-400 transition-all duration-200",
                                        deleting && "opacity-60 cursor-not-allowed"
                                    )}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {deleting ? "…" : "Delete"}
                                </motion.button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* ── Owner message ──────────────────────────────────────────────────── */}
            {isOwn && liveCount === 0 && (
                <p className="text-center text-[12px] text-muted-foreground py-2">
                    No ratings yet — share your template to get feedback!
                </p>
            )}

            {/* ── Reviews list ──────────────────────────────────────────────────── */}
            {loadingReviews ? (
                <div className="space-y-2">
                    {[1, 2].map((i) => (
                        <div
                            key={i}
                            className="h-16 rounded-xl border border-border/50 bg-card/40 animate-pulse"
                        />
                    ))}
                </div>
            ) : reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card/40">
                        <MessageSquare className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <p className="text-[13px] font-semibold text-foreground mb-1">No reviews yet</p>
                    {!isOwn && isLoggedIn && (
                        <p className="text-[12px] text-muted-foreground">Be the first to rate this template!</p>
                    )}
                </div>
            ) : (
                <AnimatePresence>
                    <div className="flex flex-col gap-2">
                        {reviews.map((r, i) => (
                            <ReviewCard key={r.id} review={r} index={i} />
                        ))}
                    </div>
                </AnimatePresence>
            )}
        </div>
    );
}
