export const CLIP_CATEGORIES = [
  { value: "upper_body", label: "Upper Body" },
  { value: "lower_body", label: "Lower Body" },
  { value: "full_body",  label: "Full Body"  },
  { value: "physique",   label: "Physique"   },
  { value: "posing",     label: "Posing"     },
  { value: "cardio",     label: "Cardio"     },
  { value: "mobility",   label: "Mobility"   },
  { value: "other",      label: "Other"      },
] as const;

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CLIP_CATEGORIES.map((c) => [c.value, c.label])
);
