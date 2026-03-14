import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] text-sm font-semibold whitespace-nowrap transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[rgba(200,255,0,0.55)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
  {
    variants: {
      variant: {
        // Primary CTA — white glossy (highest visual weight)
        default:
          "bg-gradient-to-b from-[rgba(240,244,255,0.96)] to-[rgba(200,215,245,0.88)] text-[#030213] border-0 shadow-[0_4px_20px_rgba(255,255,255,0.12),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(0,0,0,0.14)] hover:shadow-[0_6px_28px_rgba(255,255,255,0.18),inset_0_1.5px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(0,0,0,0.16)]",
        // Volt CTA — neon accent action
        volt:
          "bg-gradient-to-b from-[#C8FF00] to-[#A8D400] text-[#050507] font-bold border-0 shadow-[var(--bloom-volt),inset_0_1.5px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(0,0,0,0.18)] hover:shadow-[0_12px_36px_rgba(200,255,0,0.48),inset_0_1.5px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.20)]",
        // Ghost Glass — secondary, transparent
        ghost:
          "bg-gradient-to-b from-[rgba(255,255,255,0.07)] to-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.14)] text-[#E2E8F0] backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.22)] hover:bg-[rgba(255,255,255,0.10)] hover:border-[rgba(255,255,255,0.28)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.18),inset_0_1.5px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.20)]",
        // Destructive / Error — red tinted glass
        destructive:
          "bg-gradient-to-b from-[rgba(255,59,92,0.22)] to-[rgba(255,30,70,0.14)] border border-[rgba(255,59,92,0.40)] text-[#FF3B5C] shadow-[0_4px_20px_rgba(255,59,92,0.20),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[rgba(255,59,92,0.30)] hover:shadow-[0_8px_28px_rgba(255,59,92,0.30),inset_0_1px_0_rgba(255,255,255,0.10)]",
        // Outline — glass-bordered
        outline:
          "border border-[rgba(255,255,255,0.14)] bg-transparent text-foreground backdrop-blur-[8px] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.22)]",
        // Secondary — subtle glass fill
        secondary:
          "bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.10)] text-foreground hover:bg-[rgba(255,255,255,0.10)] hover:border-[rgba(255,255,255,0.18)]",
        // Link — no background
        link: "text-primary underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-[var(--radius-sm)] px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-[var(--radius-sm)] px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-[var(--radius-md)] px-6 has-[>svg]:px-4",
        icon: "size-11",
        "icon-xs": "size-6 rounded-[var(--radius-sm)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
