"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateUsernameComplete } from "@/lib/username-validation";
import { Check, X, Loader2 } from "lucide-react";

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  currentUserId?: string;
  onValidationChange?: (isValid: boolean) => void;
}

export function UsernameInput({
  value,
  onChange,
  currentUserId,
  onValidationChange,
}: UsernameInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    // Debounced validation
    const timer = setTimeout(async () => {
      if (!value) {
        setError(null);
        setIsValid(false);
        onValidationChange?.(false);
        return;
      }

      setIsChecking(true);
      const result = await validateUsernameComplete(value, currentUserId);
      setIsChecking(false);

      if (result.isValid) {
        setError(null);
        setIsValid(true);
        onValidationChange?.(true);
      } else {
        setError(result.error || "Invalid username");
        setIsValid(false);
        onValidationChange?.(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [value, currentUserId, onValidationChange]);

  return (
    <div className="space-y-2">
      <Label htmlFor="username">Username</Label>
      <div className="relative">
        <Input
          id="username"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder="your_username"
          className={error ? "border-destructive" : isValid ? "border-green-500" : ""}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isChecking && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {!isChecking && isValid && (
            <Check className="h-4 w-4 text-green-500" />
          )}
          {!isChecking && error && (
            <X className="h-4 w-4 text-destructive" />
          )}
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {!error && value && !isChecking && isValid && (
        <p className="text-sm text-green-600">Username available!</p>
      )}
    </div>
  );
}
