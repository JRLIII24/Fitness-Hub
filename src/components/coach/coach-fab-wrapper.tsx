"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AI_COACH_ENABLED, FORM_ANALYSIS_ENABLED } from "@/lib/features";
import { useWorkoutStore } from "@/stores/workout-store";
import { CoachFab } from "./coach-fab";
import { T, orbColors, statusMessages } from "@/lib/coach-tokens";
import type { OrbState } from "@/lib/coach-tokens";
import type { CoachContext } from "@/lib/coach/types";

type MacroSummary = CoachContext["daily_macros"];
type FormReport = CoachContext["latest_form_report"];

/**
 * Thin client wrapper so the server-rendered app layout can mount CoachFab
 * without needing to pass runtime context from the server.
 *
 * Builds a rich CoachContext from:
 *  - useWorkoutStore (active workout detail)
 *  - GET /api/nutrition/today (today's macro consumption vs targets)
 *
 * Also owns orbState so the orb on the FAB reflects the coach's live state.
 */
export function CoachFabWrapper() {
  // All hooks must be called unconditionally — Rules of Hooks
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const [dailyMacros, setDailyMacros] = useState<MacroSummary>(null);
  const [formReport, setFormReport] = useState<FormReport>(null);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [showTooltip, setShowTooltip] = useState(false);

  // Fetch today's macro summary once on mount — only when feature is enabled
  useEffect(() => {
    if (!AI_COACH_ENABLED) return;
    fetch("/api/nutrition/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        // Only set if we have at least one target configured
        if (data.target_calories != null) {
          setDailyMacros(data as MacroSummary);
        }
      })
      .catch(() => undefined);
  }, []);

  // Fetch latest form analysis report — only when form analysis is enabled
  useEffect(() => {
    if (!AI_COACH_ENABLED || !FORM_ANALYSIS_ENABLED) return;
    fetch("/api/form-check/latest")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setFormReport(data as FormReport);
      })
      .catch(() => undefined);
  }, []);

  if (!AI_COACH_ENABLED) return null;

  const context: CoachContext = {
    active_workout: activeWorkout
      ? {
          name: activeWorkout.name,
          exercises: activeWorkout.exercises.map((we) => ({
            name: we.exercise.name,
            muscle_group: we.exercise.muscle_group,
            sets_completed: we.sets.filter((s) => s.completed).length,
            sets_total: we.sets.length,
            sets: we.sets.map((s) => ({
              set_number: s.set_number,
              weight_kg: s.weight_kg,
              reps: s.reps,
              set_type: s.set_type,
              completed: s.completed,
              rpe: s.rpe,
              rir: s.rir,
            })),
          })),
          duration_minutes: Math.round(
            (Date.now() - new Date(activeWorkout.started_at).getTime()) / 60000,
          ),
        }
      : null,
    readiness_score: null,
    readiness_level: null,
    recent_sessions_7d: 0,
    current_streak: 0,
    fitness_goal: null,
    experience_level: null,
    daily_macros: dailyMacros,
    recent_prs: null,
    latest_form_report: formReport,
  };

  const orbColor = orbColors[orbState];

  return (
    <div
      style={{ position: "fixed", right: 16, bottom: 96, zIndex: 50 }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Ambient ground shadow — gives the orb a "floating" illusion */}
      <div
        style={{
          position: "absolute",
          bottom: -12,
          left: "50%",
          transform: "translateX(-50%)",
          width: "70%",
          height: 10,
          background: `radial-gradient(ellipse, ${orbColor}40, transparent 70%)`,
          filter: "blur(6px)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {/* APEX hover tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{
              position: "absolute",
              bottom: "100%",
              right: 0,
              marginBottom: 10,
              background: `${T.bgCard}F2`,
              backdropFilter: "blur(16px)",
              border: `1px solid ${T.border2}`,
              borderRadius: T.r12,
              padding: "8px 12px",
              minWidth: 170,
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: T.volt,
                  boxShadow: `0 0 8px ${T.volt}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: T.fontDisplay,
                  fontSize: 13,
                  fontWeight: 900,
                  color: T.volt,
                  letterSpacing: "0.04em",
                }}
              >
                APEX
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: T.text2,
                  fontFamily: T.fontSans,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                AI Coach
              </span>
            </div>
            <p
              style={{
                fontSize: 11,
                color: T.text1,
                fontFamily: T.fontSans,
                lineHeight: 1.4,
                margin: 0,
                opacity: 0.7,
              }}
            >
              {statusMessages[orbState]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <CoachFab context={context} orbState={orbState} onOrbStateChange={setOrbState} />
    </div>
  );
}
