import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidUUID(id: string | undefined | null): boolean {
  return !!id && /^[0-9a-f-]{36}$/i.test(id);
}
