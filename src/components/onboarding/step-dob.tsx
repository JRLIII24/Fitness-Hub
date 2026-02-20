"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StepDobProps {
  dateOfBirth: Date | null;
  onUpdate: (date: Date | null) => void;
  onNext: () => void;
}

export function StepDob({ dateOfBirth, onUpdate, onNext }: StepDobProps) {
  const today = new Date();

  // Initialize from dateOfBirth or use defaults
  const [month, setMonth] = useState(
    dateOfBirth ? String(dateOfBirth.getMonth() + 1).padStart(2, "0") : ""
  );
  const [day, setDay] = useState(
    dateOfBirth ? String(dateOfBirth.getDate()).padStart(2, "0") : ""
  );
  const [year, setYear] = useState(
    dateOfBirth ? String(dateOfBirth.getFullYear()) : ""
  );

  const handleDateChange = (
    newMonth: string,
    newDay: string,
    newYear: string
  ) => {
    // Only create date if all fields are filled
    if (newMonth && newDay && newYear) {
      const monthNum = parseInt(newMonth, 10);
      const dayNum = parseInt(newDay, 10);
      const yearNum = parseInt(newYear, 10);

      // Validate ranges
      if (
        monthNum >= 1 &&
        monthNum <= 12 &&
        dayNum >= 1 &&
        dayNum <= 31 &&
        yearNum >= 1900 &&
        yearNum <= today.getFullYear()
      ) {
        const date = new Date(yearNum, monthNum - 1, dayNum);
        // Check if date is valid (e.g., Feb 30 would be invalid)
        if (
          date.getMonth() === monthNum - 1 &&
          date.getDate() === dayNum
        ) {
          onUpdate(date);
          return;
        }
      }
    }
    onUpdate(null);
  };

  const handleMonthChange = (value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 2);
    setMonth(sanitized);
    handleDateChange(sanitized, day, year);
  };

  const handleDayChange = (value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 2);
    setDay(sanitized);
    handleDateChange(month, sanitized, year);
  };

  const handleYearChange = (value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 4);
    setYear(sanitized);
    handleDateChange(month, day, sanitized);
  };

  const getAge = () => {
    if (!dateOfBirth) return null;
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
    ) {
      age--;
    }
    return age;
  };

  const canProceed = () => {
    const age = getAge();
    return age !== null && age >= 13 && age <= 120;
  };

  const age = getAge();

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
            When's Your Birthday? 🎂
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            We'll use this for age-appropriate recommendations
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-8 rounded-[var(--radius-xl)] backdrop-blur-lg bg-white/5 border border-white/10 space-y-4"
        >
          <div className="space-y-3">
            <Label className="text-left block">Date of Birth</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="MM"
                  value={month}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  maxLength={2}
                  className="h-14 text-lg font-semibold text-center"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Month</p>
              </div>
              <div className="space-y-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="DD"
                  value={day}
                  onChange={(e) => handleDayChange(e.target.value)}
                  maxLength={2}
                  className="h-14 text-lg font-semibold text-center"
                />
                <p className="text-xs text-muted-foreground">Day</p>
              </div>
              <div className="space-y-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="YYYY"
                  value={year}
                  onChange={(e) => handleYearChange(e.target.value)}
                  maxLength={4}
                  className="h-14 text-lg font-semibold text-center"
                />
                <p className="text-xs text-muted-foreground">Year</p>
              </div>
            </div>
          </div>

          {age !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-lg bg-[var(--accent-500)]/10 border border-[var(--accent-500)]/20"
            >
              <p className="text-sm text-muted-foreground">
                Age:{" "}
                <span className="font-semibold text-foreground">{age}</span>
              </p>
            </motion.div>
          )}

          {age !== null && age < 13 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-lg bg-red-500/10 border border-red-500/20"
            >
              <p className="text-sm text-red-400">
                You must be at least 13 years old to use Fit-Hub.
              </p>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={onNext}
            size="lg"
            className="w-full text-base font-semibold"
            disabled={!canProceed()}
          >
            Continue
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
