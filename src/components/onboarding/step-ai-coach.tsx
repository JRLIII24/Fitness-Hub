"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface OnboardingPlanData {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  fitness_goal: "build_muscle" | "lose_weight" | "maintain" | "improve_endurance";
  rationale: string;
}

interface StepAiCoachProps {
  userStats: {
    height_cm: number;
    weight_kg: number;
    goal_weight_kg: number | null;
    age: number;
    gender: string;
    activity_level: string;
    unit_preference: "metric" | "imperial";
  };
  onPlanGenerated: (plan: OnboardingPlanData) => void;
}

// ── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter(text: string, enabled: boolean, speed = 16) {
  const [displayed, setDisplayed] = useState(enabled ? "" : text);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, enabled, speed]);

  return { displayed, done };
}

// ── Chat message component ──────────────────────────────────────────────────

function ChatBubble({
  message,
  isLatest,
  index,
  totalCount,
}: {
  message: ChatMessage;
  isLatest: boolean;
  index: number;
  totalCount: number;
}) {
  const isUser = message.role === "user";
  const { displayed, done } = useTypewriter(
    message.content,
    !isUser && isLatest,
  );

  const fadeSteps = totalCount - 1 - index;
  const opacity =
    fadeSteps === 0 ? 1 : fadeSteps === 1 ? 0.85 : fadeSteps === 2 ? 0.7 : 0.55;

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity }}
        transition={{ duration: 0.15 }}
        className="flex items-baseline justify-between gap-4"
      >
        <p className="text-[12px] text-muted-foreground/80 font-mono">
          <span className="text-primary/60 mr-1">&gt;</span>
          {message.content}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity }}
      transition={{ duration: 0.25 }}
      className="relative rounded-lg border border-border/40 bg-card/30 pl-3 pr-3 py-2.5 border-l-[3px] border-l-primary/40"
    >
      {isLatest && !done && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
          <div
            className="absolute inset-0 h-full w-1/3"
            style={{
              background:
                "linear-gradient(90deg, transparent, oklch(0.7 0.15 220 / 0.06), transparent)",
              animation: "hud-scan 1.2s linear infinite",
            }}
          />
        </div>
      )}
      <p className="text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {displayed}
        {!done && (
          <span className="inline-block w-[5px] h-[13px] bg-primary/60 ml-0.5 animate-pulse" />
        )}
      </p>
    </motion.div>
  );
}

// ── Main step component ─────────────────────────────────────────────────────

export function StepAiCoach({ userStats, onPlanGenerated }: StepAiCoachProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSentInitial = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message to AI
  const sendMessage = useCallback(
    async (userMessage: string, history: ChatMessage[]) => {
      setIsSending(true);
      setError(null);

      try {
        const res = await fetch("/api/ai/onboarding-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            conversation_history: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            user_stats: userStats,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to get AI response");
        }

        const data = await res.json();
        const aiMessage: ChatMessage = {
          role: "assistant",
          content: data.reply,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, aiMessage]);

        // Check if AI generated a plan
        if (data.action === "generate_plan" && data.plan_data) {
          // Small delay to let the user read the response
          setTimeout(() => {
            onPlanGenerated(data.plan_data);
          }, 2500);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong",
        );
      } finally {
        setIsSending(false);
      }
    },
    [userStats, onPlanGenerated],
  );

  // Auto-send initial greeting
  useEffect(() => {
    if (hasSentInitial.current) return;
    hasSentInitial.current = true;

    const initialMessage = `Hi! I'm setting up my fitness profile. Here are my stats — can you help me set my nutrition goals?`;

    const userMsg: ChatMessage = {
      role: "user",
      content: initialMessage,
      timestamp: Date.now(),
    };

    setMessages([userMsg]);
    sendMessage(initialMessage, []);
  }, [sendMessage]);

  // Handle user submit
  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    sendMessage(trimmed, updatedMessages.slice(0, -1));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-24"
    >
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10"
          >
            <Bot className="h-7 w-7 text-primary" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-foreground"
          >
            Your AI Coach
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-muted-foreground"
          >
            Let&apos;s build your personalized nutrition plan
          </motion.p>
        </div>

        {/* Chat area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-border/40 bg-black/30 backdrop-blur-xl overflow-hidden"
        >
          {/* Messages */}
          <div
            ref={feedRef}
            className="h-[320px] overflow-y-auto p-4 space-y-3 scrollbar-thin"
          >
            <AnimatePresence>
              {messages.map((msg, i) => (
                <ChatBubble
                  key={msg.timestamp}
                  message={msg}
                  isLatest={i === messages.length - 1}
                  index={i}
                  totalCount={messages.length}
                />
              ))}
            </AnimatePresence>

            {/* Thinking indicator */}
            {isSending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 px-3 py-2"
              >
                <div className="relative h-1 w-24 overflow-hidden rounded-full bg-border/30">
                  <div
                    className="absolute inset-0 h-full w-1/3 rounded-full bg-primary/50"
                    style={{ animation: "hud-scan 1.2s linear infinite" }}
                  />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Thinking
                </span>
              </motion.div>
            )}

            {error && (
              <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2">
                <p className="text-[11px] text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/30 bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <span className="text-primary/50 text-sm font-mono">&gt;</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Tell the coach about your goals..."
                disabled={isSending}
                className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isSending}
                className="rounded-lg p-2 text-primary/70 transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-[11px] text-muted-foreground/50"
        >
          The coach will calculate your personalized nutrition targets
        </motion.p>
      </div>
    </motion.div>
  );
}
