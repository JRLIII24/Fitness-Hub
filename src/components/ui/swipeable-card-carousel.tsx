"use client";

import { useState, useRef, useCallback, Children } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { cn } from "@/lib/utils";

interface SwipeableCardCarouselProps {
  children: React.ReactNode;
  className?: string;
}

export function SwipeableCardCarousel({ children, className }: SwipeableCardCarouselProps) {
  const items = Children.toArray(children);
  const count = items.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  const getCardWidth = useCallback(() => {
    return containerRef.current?.offsetWidth ?? 320;
  }, []);

  const snapTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, count - 1));
      setActiveIndex(clamped);
      animate(x, -clamped * getCardWidth(), {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    },
    [count, getCardWidth, x]
  );

  if (count <= 1) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)}>
      <motion.div
        className="flex cursor-grab active:cursor-grabbing"
        style={{ x }}
        drag="x"
        dragConstraints={{
          left: -(count - 1) * getCardWidth(),
          right: 0,
        }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          const cardWidth = getCardWidth();
          const threshold = cardWidth * 0.2;
          let newIndex = activeIndex;

          if (info.offset.x < -threshold || info.velocity.x < -500) {
            newIndex = activeIndex + 1;
          } else if (info.offset.x > threshold || info.velocity.x > 500) {
            newIndex = activeIndex - 1;
          }

          snapTo(newIndex);
        }}
      >
        {items.map((child, i) => (
          <div key={i} className="w-full shrink-0">
            {child}
          </div>
        ))}
      </motion.div>

      {/* Dot indicators */}
      <div className="mt-3 flex justify-center gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => snapTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === activeIndex ? "w-5 bg-[var(--phase-current-accent,var(--primary))] shadow-[0_0_6px_var(--phase-current-glow,transparent)]" : "w-1.5 bg-border/60"
            )}
            aria-label={`Go to card ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
