"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain } from "lucide-react";
import { AI_COACH_ENABLED } from "@/lib/features";
import { CoachChatSheet } from "./coach-chat-sheet";
import { T, orbColors } from "@/lib/coach-tokens";
import type { OrbState } from "@/lib/coach-tokens";
import type { CoachContext } from "@/lib/coach/types";

interface CoachFabProps {
  /** Pre-built coach context — caller constructs from stores/props. */
  context: CoachContext;
  /** Current APEX orb state — lifted from wrapper so the orb reflects the coach's live state. */
  orbState: OrbState;
  /** Callback to push live state changes back up to the wrapper. */
  onOrbStateChange: (s: OrbState) => void;
}

export function CoachFab({ context, orbState, onOrbStateChange }: CoachFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>();
  const [miniWaveHeights, setMiniWaveHeights] = useState([4, 8, 4, 8, 4]);

  // Animate waveform bars when speaking
  useEffect(() => {
    if (orbState === "speaking") {
      const interval = setInterval(() => {
        setMiniWaveHeights([4, 6, 8, 6, 4].map((base) => base + Math.random() * 6));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setMiniWaveHeights([4, 8, 4, 8, 4]);
    }
  }, [orbState]);

  const handleOpen = useCallback((message?: string) => {
    if (message) setInitialMessage(message);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setInitialMessage(undefined);
  }, []);

  if (!AI_COACH_ENABLED) return null;

  const orbColor = orbColors[orbState];

  // Box shadow per state — breathing array for idle, steady glow for active states
  const boxShadow =
    orbState === "idle"
      ? [`0 0 0px ${orbColor}00`, `0 0 22px ${orbColor}45`, `0 0 0px ${orbColor}00`]
      : orbState === "listening"
        ? `0 0 28px ${T.sky}90, 0 0 56px ${T.sky}25`
        : orbState === "thinking"
          ? `0 0 24px ${T.violet}70`
          : /* speaking */ `0 0 32px ${orbColor}95, 0 0 64px ${orbColor}28`;

  return (
    <>
      {/* Outer container — provides positioning context for rings and chip */}
      <div style={{ position: "relative", width: 48, height: 48 }}>

        {/* Pulsing ring — always visible, adapts speed + color to orbState */}
        <motion.div
          key={`ring-${orbState}`}
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: orbState === "listening" ? 1.3 : 1.45, opacity: 0 }}
          transition={{
            duration: orbState === "listening" ? 0.85 : orbState === "idle" ? 2.2 : 1.6,
            repeat: Infinity,
            ease: "easeOut",
          }}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 64,
            height: 64,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: `1.5px solid ${orbColor}`,
            pointerEvents: "none",
          }}
        />

        {/* APEX identity chip — floats above orb when coach is active */}
        <AnimatePresence>
          {orbState !== "idle" && (
            <motion.div
              key="apex-chip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              style={{
                position: "absolute",
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                marginBottom: 8,
                background: `${T.glassElevated}`,
                border: `1px solid ${T.border2}`,
                borderRadius: T.rFull,
                padding: "3px 10px",
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: orbColor,
                  boxShadow: `0 0 6px ${orbColor}`,
                }}
              />
              <span
                style={{
                  fontFamily: T.fontDisplay,
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.text1,
                  letterSpacing: "0.06em",
                }}
              >
                APEX
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D Orb button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpen()}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: `1.5px solid ${orbColor}50`,
            background: `radial-gradient(circle at 32% 32%, ${orbColor}E8, ${orbColor}70 55%, ${orbColor}18)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            cursor: "pointer",
            outline: "none",
            position: "relative",
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            boxShadow: boxShadow,
          }}
          transition={{
            scale: { type: "spring", stiffness: 400, damping: 25 },
            opacity: { duration: 0.3 },
            boxShadow:
              orbState === "idle"
                ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.4 },
          }}
        >
          {/* Inner shimmer ring — spins only when thinking */}
          {orbState === "thinking" ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute",
                inset: "20%",
                borderRadius: "50%",
                border: `1px solid ${orbColor}35`,
                pointerEvents: "none",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: "20%",
                borderRadius: "50%",
                border: `1px solid ${orbColor}35`,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Brain icon */}
          <Brain
            size={18}
            color={T.text1}
            style={{ position: "relative", zIndex: 1, flexShrink: 0 }}
          />

          {/* Speaking waveform bars */}
          {orbState === "speaking" && (
            <div
              style={{
                display: "flex",
                gap: 2,
                alignItems: "center",
                position: "relative",
                zIndex: 1,
              }}
            >
              {miniWaveHeights.map((h, i) => (
                <motion.div
                  key={i}
                  animate={{ height: h }}
                  transition={{ duration: 0.1, ease: "easeOut" }}
                  style={{
                    width: 2,
                    height: h,
                    borderRadius: 99,
                    background: T.text1,
                  }}
                />
              ))}
            </div>
          )}
        </motion.button>
      </div>

      {/* Chat sheet — renders via portal to document.body */}
      <CoachChatSheet
        isOpen={isOpen}
        onClose={handleClose}
        initialMessage={initialMessage}
        context={context}
        onOrbStateChange={onOrbStateChange}
      />
    </>
  );
}
