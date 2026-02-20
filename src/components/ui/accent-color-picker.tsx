"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccentColorPickerProps {
  value: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
}

export function AccentColorPicker({
  value,
  disabled,
  onChange,
  onReset,
}: AccentColorPickerProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="accent-color">Custom Accent Color</Label>
      <div className="flex items-center gap-3">
        <input
          id="accent-color"
          type="color"
          value={value ?? "#3e8bff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Pick accent color"
          disabled={disabled}
        />
        <Input
          value={value ?? "Using theme default"}
          readOnly
          className="h-10 font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={!value}
        >
          Reset
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Active only when Color Theme is set to Custom.
      </p>
    </div>
  );
}
