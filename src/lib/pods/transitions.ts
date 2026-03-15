/**
 * Framer Motion variants for pods screen transitions.
 */

import { Y2K } from "./y2k-tokens";

/** Stagger children on mount */
export const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: Y2K.stagger } },
};

/** Individual item fade + slide */
export const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: Y2K.spring },
};

/** Tab content swap */
export const tabContentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

/** Page-level view transition */
export const viewEnterVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28 } },
};
