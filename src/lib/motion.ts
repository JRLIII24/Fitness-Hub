export const motionDurations = {
  micro: 0.05,
  fast: 0.15,
  toggle: 0.2,    // backwards compat alias
  quick: 0.2,
  panel: 0.3,     // backwards compat alias
  base: 0.3,
  moderate: 0.4,
  celebration: 0.48, // backwards compat alias
  slow: 0.5,
  shimmer: 0.65,
  ring: 0.8,
  long: 1.0,
} as const;

export const motionEasings = {
  /** General spring — press states, panel reveals */
  primary: [0.22, 1, 0.36, 1] as const,
  /** Bouncy spring — celebrations, level ups */
  bounce: [0.34, 1.56, 0.64, 1] as const,
  /** Smooth standard — opacity, color transitions */
  standard: [0.4, 0, 0.2, 1] as const,
  /** Decelerate — elements entering the screen */
  out: [0, 0, 0.2, 1] as const,
  /** Accelerate — elements leaving the screen */
  in: [0.4, 0, 1, 1] as const,
  /** String-based utility easing */
  utility: "easeOut" as const,
};

export const motionVariants = {
  fadeInUp: {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: motionDurations.base,
        ease: motionEasings.primary,
      },
    },
    exit: {
      opacity: 0,
      y: -6,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasings.standard,
      },
    },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.98 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: motionDurations.quick,
        ease: motionEasings.primary,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: {
        duration: motionDurations.micro,
        ease: motionEasings.standard,
      },
    },
  },
  staggerList: {
    animate: {
      transition: {
        staggerChildren: 0.04,
      },
    },
  },
  sheetEnter: {
    initial: { opacity: 0, y: 14 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: motionDurations.base,
        ease: motionEasings.primary,
      },
    },
    exit: {
      opacity: 0,
      y: 10,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasings.standard,
      },
    },
  },
} as const;

export const glassMotionVariants = {
  glassReveal: {
    initial: { opacity: 0, y: 8, backdropFilter: "blur(0px)" },
    animate: { opacity: 1, y: 0, backdropFilter: "blur(16px)",
      transition: { duration: motionDurations.moderate, ease: motionEasings.primary } },
    exit: { opacity: 0, y: 4, backdropFilter: "blur(0px)",
      transition: { duration: motionDurations.fast, ease: motionEasings.standard } },
  },
  liquidScale: {
    initial: { opacity: 0, scale: 0.96, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)",
      transition: { duration: motionDurations.base, ease: motionEasings.bounce } },
    exit: { opacity: 0, scale: 0.97, filter: "blur(2px)",
      transition: { duration: motionDurations.fast, ease: motionEasings.standard } },
  },
  setComplete: {
    initial: { scale: 1 },
    animate: { scale: [1, 1.04, 0.98, 1],
      transition: { duration: motionDurations.base, ease: motionEasings.primary } },
  },
  listReorder: {
    layout: true,
    transition: { type: "spring", stiffness: 350, damping: 30, mass: 0.8 },
  },
} as const;
