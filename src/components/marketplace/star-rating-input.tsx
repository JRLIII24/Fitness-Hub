"use client";

import { useState, useRef, useEffect } from "react";
import { Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface StarRatingInputProps {
    value: number;
    onChange?: (n: number) => void;
    readonly?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const SIZE_MAP = {
    sm: { star: 13, gap: 2 },
    md: { star: 18, gap: 4 },
    lg: { star: 24, gap: 5 },
};

// ── Readonly fast-path ──────────────────────────────────────────────────────
// 4 of 5 usages are readonly — skip all motion wrappers and state.

function ReadonlyStars({ value, size = "md", className }: StarRatingInputProps) {
    const { star, gap } = SIZE_MAP[size];
    const primaryColor = "var(--primary)";
    const emptyColor = "hsl(var(--muted-foreground) / 0.25)";
    const outlineColor = "hsl(var(--border))";

    return (
        <div className={cn("flex items-center", className)} style={{ gap }}>
            {[1, 2, 3, 4, 5].map((i) => {
                const filled = value;
                const isFull = i <= Math.floor(filled);
                const frac = filled - Math.floor(filled);
                const isPartial = i === Math.ceil(filled) && frac > 0 && !isFull;
                const partialPct = Math.max(0, Math.min(100, frac * 100));

                if (isPartial) {
                    return (
                        <span key={i} style={{ position: "relative", width: star, height: star, display: "inline-flex" }}>
                            <Star size={star} style={{ color: outlineColor, position: "absolute", inset: 0 }} />
                            <span style={{ position: "absolute", inset: 0, overflow: "hidden", width: `${partialPct}%` }}>
                                <Star size={star} fill={primaryColor} style={{ color: primaryColor }} />
                            </span>
                        </span>
                    );
                }

                return (
                    <span
                        key={i}
                        style={{
                            display: "inline-flex",
                            lineHeight: 0,
                            color: isFull ? primaryColor : emptyColor,
                            textShadow: isFull ? `0 0 6px ${primaryColor}` : "none",
                        }}
                    >
                        <Star size={star} fill={isFull ? primaryColor : "transparent"} />
                    </span>
                );
            })}
        </div>
    );
}

// ── Interactive version ─────────────────────────────────────────────────────

export function StarRatingInput(props: StarRatingInputProps) {
    const { value, onChange, readonly = false, size = "md", className } = props;

    // Fast-path: readonly renders zero motion nodes
    if (readonly) return <ReadonlyStars {...props} />;

    return <InteractiveStars value={value} onChange={onChange} size={size} className={className} />;
}

function InteractiveStars({
    value,
    onChange,
    size = "md",
    className,
}: Omit<StarRatingInputProps, "readonly">) {
    const [hovered, setHovered] = useState(0);
    const [lastClicked, setLastClicked] = useState<number | null>(null);
    const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { star, gap } = SIZE_MAP[size];
    const primaryColor = "var(--primary)";
    const emptyColor = "hsl(var(--muted-foreground) / 0.25)";
    const outlineColor = "hsl(var(--border))";

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (clickTimeout.current) clearTimeout(clickTimeout.current);
        };
    }, []);

    function handleClick(i: number) {
        if (clickTimeout.current) clearTimeout(clickTimeout.current);
        setLastClicked(i);
        onChange?.(i);
        clickTimeout.current = setTimeout(() => setLastClicked(null), 500);
    }

    return (
        <div
            className={cn("flex items-center", className)}
            style={{ gap, touchAction: "manipulation" }}
            onPointerLeave={() => setHovered(0)}
        >
            {[1, 2, 3, 4, 5].map((i) => {
                const filled = hovered || value;
                const isFull = i <= Math.floor(filled);
                const frac = filled - Math.floor(filled);
                const isPartial = i === Math.ceil(filled) && frac > 0 && !isFull;
                const partialPct = Math.max(0, Math.min(100, frac * 100));
                const isActive = hovered >= i || value >= i;

                return (
                    <motion.div
                        key={i}
                        style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        animate={isActive ? { y: -3 } : { y: 0 }}
                        transition={
                            isActive
                                ? { type: "tween", duration: 0.3, delay: i * 0.035, ease: "easeOut" }
                                : { type: "tween", duration: 0.2 }
                        }
                    >
                        <motion.button
                            type="button"
                            aria-label={`Rate ${i + 1} out of 5`}
                            onPointerEnter={() => setHovered(i)}
                            onClick={() => handleClick(i)}
                            animate={hovered >= i ? { scale: 1.15 } : { scale: 1 }}
                            whileTap={{ scale: 0.85 }}
                            transition={{ scale: { type: "tween", duration: 0.2 } }}
                            style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                lineHeight: 0,
                                display: "inline-flex",
                                alignItems: "center",
                            }}
                        >
                            {isPartial ? (
                                <span style={{ position: "relative", width: star, height: star, display: "inline-flex" }}>
                                    <Star size={star} style={{ color: outlineColor, position: "absolute", inset: 0 }} />
                                    <span
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            overflow: "hidden",
                                            width: `${partialPct}%`,
                                        }}
                                    >
                                        <Star size={star} fill={primaryColor} style={{ color: primaryColor }} />
                                    </span>
                                </span>
                            ) : (
                                <motion.span
                                    animate={{
                                        color: isFull ? primaryColor : emptyColor,
                                        scale: lastClicked === i ? 1.4 : 1,
                                    }}
                                    transition={{
                                        color: { duration: 0.15 },
                                        scale: lastClicked === i
                                            ? { type: "spring", stiffness: 350, damping: 12, duration: 0.4 }
                                            : { type: "tween", duration: 0.2 },
                                    }}
                                    style={{
                                        display: "inline-flex",
                                        lineHeight: 0,
                                        textShadow: isFull ? `0 0 6px ${primaryColor}` : "none",
                                    }}
                                >
                                    <Star
                                        size={star}
                                        fill={isFull ? primaryColor : "transparent"}
                                    />
                                </motion.span>
                            )}
                        </motion.button>

                        {/* Click burst ring */}
                        <AnimatePresence>
                            {lastClicked === i && (
                                <motion.span
                                    key="burst"
                                    initial={{ scale: 0.5, opacity: 0.8 }}
                                    animate={{ scale: 2.5, opacity: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ type: "tween", duration: 0.45, ease: "easeOut" }}
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        borderRadius: "50%",
                                        border: `1.5px solid ${primaryColor}`,
                                        pointerEvents: "none",
                                    }}
                                />
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </div>
    );
}
