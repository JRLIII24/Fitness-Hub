"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Dumbbell, Apple, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Dumbbell,
    title: "Intelligent Workout Tracking",
    description: "Log sets, track PRs, and get AI-powered exercise suggestions that adapt to your progress.",
  },
  {
    icon: Apple,
    title: "Precision Nutrition",
    description: "Scan food with AI vision, track macros automatically, and hit your daily targets effortlessly.",
  },
  {
    icon: Users,
    title: "Accountability Pods",
    description: "Train with friends in small groups. Weekly challenges and streak protection keep everyone on track.",
  },
];

export function LandingPage() {
  return (
    <div className="dark min-h-dvh bg-[oklch(0.12_0.01_264)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -left-32 bottom-40 h-[400px] w-[400px] rounded-full bg-primary/6 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
        {/* Nav */}
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-foreground">FitHub</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="volt" size="sm" className="motion-press">
                Get Started
              </Button>
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-20 text-center sm:mt-28"
        >
          <h1
            className="font-display font-black leading-[1.1] tracking-tight text-[#F0F4FF]"
            style={{ fontSize: "clamp(32px, 6vw, 64px)" }}
          >
            Train smarter.
            <br />
            <span className="text-primary">Eat better.</span>
            <br />
            Stay accountable.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-[#94A3B8]">
            The all-in-one fitness platform with AI coaching, precision nutrition tracking,
            and accountability pods to keep you consistent.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup">
              <Button variant="volt" size="lg" className="motion-press gap-2 px-8 text-base">
                Start Training
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Dashboard preview — skewed glass card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-16 flex justify-center"
        >
          <div
            className="glass-surface-hero w-full max-w-2xl rounded-2xl p-8"
            style={{
              transform: "perspective(1200px) rotateX(4deg) rotateY(-2deg)",
              transformStyle: "preserve-3d",
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-[var(--status-positive)]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Live Dashboard Preview
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Streak", value: "12d" },
                  { label: "This Week", value: "4/5" },
                  { label: "Volume", value: "8,420 kg" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="glass-surface rounded-xl px-3 py-4 text-center"
                  >
                    <p className="tabular-nums text-xl font-black text-foreground">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--glass-tint-medium)]">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: "72%" }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Weekly momentum: 72%</p>
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <div className="mt-24 grid gap-4 sm:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
              className="glass-surface shimmer-target rounded-2xl p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-display font-bold text-sm text-[#F0F4FF]">{feature.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#94A3B8]">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Footer CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-24 text-center"
        >
          <p className="text-sm text-[#94A3B8]">
            Ready to transform your training?
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link href="/signup">
              <Button variant="volt" size="lg" className="motion-press gap-2">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/60">
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-muted-foreground">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
