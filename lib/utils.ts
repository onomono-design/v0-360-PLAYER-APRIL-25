import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add the formatTime function to format video time display
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) {
    return "0:00"
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  // Pad seconds with a leading zero if needed
  const formattedSeconds = remainingSeconds < 10 ? `0${remainingSeconds}` : `${remainingSeconds}`

  return `${minutes}:${formattedSeconds}`
}
