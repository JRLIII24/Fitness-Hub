"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User, UserCircle, Users } from "lucide-react";

interface StepGenderProps {
  selected: "male" | "female" | "prefer_not_to_say" | null;
  onSelect: (gender: "male" | "female" | "prefer_not_to_say") => void;
  onSubmit: () => void;
  loading: boolean;
}

const genderOptions = [
  {
    id: "male" as const,
    label: "Male",
    icon: User,
  },
  {
    id: "female" as const,
    label: "Female",
    icon: UserCircle,
  },
  {
    id: "prefer_not_to_say" as const,
    label: "Prefer not to say",
    icon: Users,
  },
];

export function StepGender({
  selected,
  onSelect,
  onSubmit,
  loading,
}: StepGenderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-24"
    >
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-foreground"
          >
            Almost There! 🌟
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            One last question to personalize your experience
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 gap-4"
        >
          {genderOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <motion.button
                key={option.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(option.id)}
                className={`relative p-6 rounded-[var(--radius-xl)] backdrop-blur-lg bg-white/5 border-2 transition-all ${
                  selected === option.id
                    ? "border-[var(--accent-500)] shadow-lg shadow-[var(--accent-500)]/20 bg-white/10"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-full ${
                      selected === option.id
                        ? "bg-[var(--accent-500)]/20"
                        : "bg-white/5"
                    }`}
                  >
                    <Icon
                      className={`h-6 w-6 ${
                        selected === option.id
                          ? "text-[var(--accent-500)]"
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <p className="text-lg font-semibold flex-1 text-left">
                    {option.label}
                  </p>
                  {selected === option.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-[var(--accent-500)] rounded-full p-1"
                    >
                      <svg
                        className="h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="space-y-4"
        >
          <Button
            onClick={onSubmit}
            size="lg"
            className="w-full text-base font-semibold"
            disabled={!selected || loading}
          >
            {loading ? "Setting up your profile..." : "Complete Setup 🎉"}
          </Button>

          <p className="text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
