"use client";

import { useState } from "react";
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
    sm: { star: 11, gap: 2 },
    md: { star: 18, gap: 4 },
    lg: { star: 24, gap: 5 },
};

export function StarRatingInput({
    value,
    onChange,
    readonly = false,
    size = "md",
    className,
}: StarRatingInputProps) {
    const [hovered, setHovered] = useState(0);
    // Track which star was last clicked for the burst animation
    const [lastClicked, setLastClicked] = useState<number | null>(null);
    const { star, gap } = SIZE_MAP[size];

    function starFill(index: number): "full" | "partial" | "empty" {
        const filled = readonly ? value : hovered || value;
        if (index <= Math.floor(filled)) return "full";
        const frac = filled - Math.floor(filled);
        if (index === Math.ceil(filled) && frac > 0) return "partial";
        return "empty";
    }

    function handleClick(i: number) {
        if (readonly) return;
        setLastClicked(i);
        onChange?.(i);
        // Reset burst flag after animation ends
        setTimeout(() => setLastClicked(null), 500);
    }

    return (
        <div
            className={cn("flex items-center", className)}
            style={{ gap }}
            onMouseLeave={() => !readonly && setHovered(0)}
        >
            {[1, 2, 3, 4, 5].map((i) => {
                const fill = starFill(i);
                const isFull = fill === "full";
                const isActive = !readonly && (hovered >= i || value >= i);

                return (
                    <motion.div
                        key={i}
                        style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        // Wave bounce on hover: sequential float up using tween (not spring)
                        animate={isActive ? { y: -3 } : { y: 0 }}
                        transition={
                            isActive
                                ? { type: "tween", duration: 0.3, delay: i * 0.035, ease: "easeOut" }
                                : { type: "tween", duration: 0.2 }
                        }
                    >
                        <motion.button
                            type="button"
                            disabled={readonly}
                            onMouseEnter={() => !readonly && setHovered(i)}
                            onClick={() => handleClick(i)}
                            // On hover: scale up smoothly. On tap: shrink briefly (spring with 2 keyframes only)
                            animate={
                                !readonly && hovered >= i
                                    ? { scale: 1.15 }
                                    : { scale: 1 }
                            }
                            whileTap={!readonly ? { scale: 0.85 } : undefined}
                            transition={{
                                scale: {
                                    type: hovered >= i ? "tween" : "spring",
                                    duration: hovered >= i ? 0.25 : undefined,
                                    stiffness: hovered >= i ? undefined : 350,
                                    damping: hovered >= i ? undefined : 15,
                                },
                            }}
                            style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: readonly ? "default" : "pointer",
                                lineHeight: 0,
                                display: "inline-flex",
                                alignItems: "center",
                            }}
                        >
                            {fill === "partial" ? (
                                <span style={{ position: "relative", width: star, height: star, display: "inline-flex" }}>
                                    <Star size={star} style={{ color: "hsl(var(--border))", position: "absolute", inset: 0 }} />
                                    <span
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            overflow: "hidden",
                                            width: `${(value - Math.floor(value)) * 100}%`,
                                        }}
                                    >
                                        <Star size={star} fill="hsl(var(--primary))" style={{ color: "hsl(var(--primary))" }} />
                                    </span>
                                </span>
                            ) : (
                                <motion.span
                                    animate={{
                                        color: isFull ? "hsl(var(--primary))" : "hsl(var(--border))",
                                        // Pop animation on click: scale 1.4 then back to 1 using spring (2 keyframes)
                                        scale: lastClicked === i ? 1.4 : 1,
                                        // Glow effect: fade in/out smoothly for filled stars
                                        filter: isFull && !readonly
                                            ? "drop-shadow(0 0 6px hsl(var(--primary) / 0.8))"
                                            : "drop-shadow(0 0 0px transparent)",
                                    }}
                                    transition={{
                                        color: { duration: 0.15 },
                                        scale: lastClicked === i
                                            ? { type: "spring", stiffness: 350, damping: 12, duration: 0.4 }
                                            : { type: "spring", stiffness: 300, damping: 15 },
                                        filter: { duration: 0.25 },
                                    }}
                                    style={{ display: "inline-flex", lineHeight: 0 }}
                                >
                                    <Star
                                        size={star}
                                        fill={isFull ? "hsl(var(--primary))" : "transparent"}
                                    />
                                </motion.span>
                            )}
                        </motion.button>

                        {/* Click burst ring — expands outward and fades */}
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
                                        border: "1.5px solid hsl(var(--primary) / 0.5)",
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
