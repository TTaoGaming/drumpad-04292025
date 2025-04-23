import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Throttle a function to limit how often it can be called
 * @param func The function to throttle
 * @param limit The minimum time between calls in ms
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...funcArgs: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  let lastResult: ReturnType<T>;
  
  return function(...args: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now();
    if (now - lastCall < limit) {
      return lastResult;
    }
    lastCall = now;
    lastResult = func(...args);
    return lastResult;
  };
}

/**
 * Debounce a function to delay its execution until after a period of inactivity
 * @param func The function to debounce
 * @param wait The delay in ms
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...funcArgs: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
