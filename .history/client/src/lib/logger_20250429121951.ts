/**
 * Centralized Logging Utility
 * 
 * Provides throttled logging to avoid console spam, with filtering capabilities
 * and debug level control.
 */

import { throttle } from './utils';

// Logging levels
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  NONE = 5
}

// Log sources for filtering
export type LogSource =
  | 'App'
  | 'OpenCV'
  | 'MediaPipe'
  | 'Canvas'
  | 'ROI'
  | 'Performance'
  | 'Worker'
  | 'Contour'
  | 'Other';

// Configuration for the logger
interface LoggerConfig {
  level: LogLevel;
  throttleTime: number;
  groupSimilarLogs: boolean;
  sourceFilter: LogSource[];
  enabled: boolean;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  level: LogLevel.INFO,
  throttleTime: 1000, // 1 second default throttle
  groupSimilarLogs: true,
  sourceFilter: [], // Empty means all sources
  enabled: true
};

// Store for log occurrences (for throttling similar logs)
interface LogOccurrence {
  message: string;
  count: number;
  lastTime: number;
}

// Global config instance
let config: LoggerConfig = { ...defaultConfig };
const logOccurrences: Record<string, LogOccurrence> = {};

/**
 * Configure the logger
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Set the global logging level
 */
export function setLogLevel(level: LogLevel): void {
  config.level = level;
}

/**
 * Enable or disable the logger
 */
export function setLoggerEnabled(enabled: boolean): void {
  config.enabled = enabled;
}

/**
 * Filter logs by source
 * @param sources Array of sources to allow (empty allows all)
 */
export function filterLogSources(sources: LogSource[]): void {
  config.sourceFilter = [...sources];
}

/**
 * Check if a log should be shown based on level and source
 */
function shouldShowLog(level: LogLevel, source: LogSource): boolean {
  if (!config.enabled) return false;
  if (level < config.level) return false;
  if (config.sourceFilter.length > 0 && !config.sourceFilter.includes(source)) return false;
  return true;
}

/**
 * Internal logging implementation
 */
function logImpl(
  level: LogLevel,
  source: LogSource,
  message: string,
  ...args: any[]
): void {
  if (!shouldShowLog(level, source)) return;

  // Create the message key for throttling (source + first 100 chars of message)
  const messageKey = `${source}:${message.substring(0, 100)}`;
  const now = Date.now();

  // Check if this message has been logged before
  if (config.groupSimilarLogs && logOccurrences[messageKey]) {
    const occurrence = logOccurrences[messageKey];
    occurrence.count++;
    
    // Only log again if enough time has passed
    if (now - occurrence.lastTime < config.throttleTime) {
      return;
    }
    
    // Update the last time
    occurrence.lastTime = now;
    
    // If this message has been repeated multiple times, show count
    if (occurrence.count > 1) {
      message = `${message} (repeated ${occurrence.count} times)`;
    }
  } else {
    // First occurrence of this message
    logOccurrences[messageKey] = {
      message,
      count: 1,
      lastTime: now
    };
  }

  // Format the log prefix with source
  const prefix = `[${source}]`;
  
  // Log using the appropriate console method
  switch (level) {
    case LogLevel.TRACE:
    case LogLevel.DEBUG:
      console.debug(prefix, message, ...args);
      break;
    case LogLevel.INFO:
      console.log(prefix, message, ...args);
      break;
    case LogLevel.WARN:
      console.warn(prefix, message, ...args);
      break;
    case LogLevel.ERROR:
      console.error(prefix, message, ...args);
      break;
  }
}

// Create throttled versions of each log level
const throttledLog = throttle(logImpl, 200); // 200ms throttle within same log level & source

/**
 * Log a trace message
 */
export function trace(source: LogSource, message: string, ...args: any[]): void {
  throttledLog(LogLevel.TRACE, source, message, ...args);
}

/**
 * Log a debug message
 */
export function debug(source: LogSource, message: string, ...args: any[]): void {
  throttledLog(LogLevel.DEBUG, source, message, ...args);
}

/**
 * Log an info message
 */
export function info(source: LogSource, message: string, ...args: any[]): void {
  throttledLog(LogLevel.INFO, source, message, ...args);
}

/**
 * Log a warning message
 */
export function warn(source: LogSource, message: string, ...args: any[]): void {
  throttledLog(LogLevel.WARN, source, message, ...args);
}

/**
 * Log an error message
 */
export function error(source: LogSource, message: string, ...args: any[]): void {
  // Errors are important, so we don't throttle them
  logImpl(LogLevel.ERROR, source, message, ...args);
}

// Create a default logger instance
const logger = {
  trace,
  debug,
  info,
  warn,
  error,
  setLogLevel,
  configureLogger,
  setLoggerEnabled,
  filterLogSources
};

export default logger; 