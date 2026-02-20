"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

interface StepDobProps {
  dateOfBirth: Date | null;
  onUpdate: (date: Date | null) => void;
  onNext: () => void;
}

export function StepDob({ dateOfBirth, onUpdate, onNext }: StepDobProps) {
  const canProceed = () => {
    if (!dateOfBirth) return false;
    const age = new Date().getFullYear() - dateOfBirth.getFullYear();
    return age >= 13 && age <= 120;
  };

  const getAge = () => {
    if (!dateOfBirth) return null;
    const today = new Date();
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
          <div className="space-y-2">
            <Label htmlFor="dob" className="text-left block">
              Date of Birth
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="dob"
                  variant="outline"
                  className={`w-full h-14 text-lg justify-start text-left font-normal ${
                    !dateOfBirth && "text-muted-foreground"
                  }`}
                >
                  <CalendarIcon className="mr-2 h-5 w-5" />
                  {dateOfBirth ? (
                    format(dateOfBirth, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateOfBirth || undefined}
                  onSelect={(date) => onUpdate(date || null)}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                  captionLayout="dropdown-buttons"
                  fromYear={1900}
                  toYear={new Date().getFullYear()}
                  defaultMonth={new Date(2000, 0, 1)} // Default to year 2000 for easier selection
                />
              </PopoverContent>
            </Popover>
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
