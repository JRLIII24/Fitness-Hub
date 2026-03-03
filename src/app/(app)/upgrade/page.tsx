"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Lock, LineChart, ShieldCheck, Sparkles, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const features = [
  {
    icon: LineChart,
    title: "Advanced PR Trajectory",
    description: "AI-powered strength forecasting that predicts your next personal record 4\u20138 weeks out based on your training patterns.",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    icon: ShieldCheck,
    title: "Pod Pressure Index",
    description: "Real-time accountability score that shows how your consistency ranks within your pod and triggers motivational nudges.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
  },
  {
    icon: Sparkles,
    title: "Adaptive Fueling",
    description: "Dynamic macro targets that adjust daily based on your workout intensity, recovery score, and weekly training load.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleJoinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("pro_waitlist_email", email.trim());
    }
    setJoined(true);
    toast.success("You're on the list! We'll notify you when Pro launches.");
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-5 space-y-5">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-6"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col items-center text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Coming Soon</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Pro Performance Layer</h1>
            <p className="mt-2 text-[13px] text-muted-foreground max-w-[300px] leading-relaxed">
              Coaching-grade analytics and AI systems built on top of your existing training data.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Feature cards */}
      <div className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <p className="text-[13px] font-bold text-foreground">What&apos;s included</p>
        </div>
        <div className="divide-y divide-border/30">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex items-start gap-3 px-5 py-4"
              >
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${f.bg} ${f.border}`}>
                  <Icon className={`h-4 w-4 ${f.color}`} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground">{f.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{f.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Waitlist */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-border/60 bg-card/30 p-5 space-y-4"
      >
        {joined ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <p className="text-[14px] font-bold text-foreground">You&apos;re on the list!</p>
            <p className="text-[12px] text-muted-foreground">We&apos;ll email you at <span className="text-foreground font-medium">{email}</span> when Pro launches.</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-[13px] font-bold text-foreground">Join the Waitlist</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Be first to access Pro when it launches.</p>
            </div>
            <form onSubmit={handleJoinWaitlist} className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-9 h-10 text-sm"
                />
              </div>
              <Button type="submit" size="sm" className="h-10 px-4 motion-press">
                Join
              </Button>
            </form>
          </>
        )}
      </motion.div>

      {/* Footer */}
      <p className="text-center text-[11px] text-muted-foreground">
        Questions? Ping us at{" "}
        <span className="text-foreground font-medium">hello@fit-hub.app</span>
      </p>
    </div>
  );
}
