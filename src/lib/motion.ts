export const motionDurations = {
  micro: 0.15,
  toggle: 0.22,
  panel: 0.32,
  celebration: 0.48,
} as const;

export const motionEasings = {
  primary: [0.22, 1, 0.36, 1] as const,
  standard: [0.4, 0, 0.2, 1] as const,
  utility: "easeOut" as const,
};

export const motionVariants = {
  fadeInUp: {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: motionDurations.panel,
        ease: motionEasings.primary,
      },
    },
    exit: {
      opacity: 0,
      y: -6,
      transition: {
        duration: motionDurations.toggle,
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
        duration: motionDurations.toggle,
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
        duration: motionDurations.panel,
        ease: motionEasings.primary,
      },
    },
    exit: {
      opacity: 0,
      y: 10,
      transition: {
        duration: motionDurations.toggle,
        ease: motionEasings.standard,
      },
    },
  },
} as const;
