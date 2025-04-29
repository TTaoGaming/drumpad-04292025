/**
 * Logger Initialization
 * 
 * This file initializes the centralized logging utility with the appropriate settings.
 * Import this file in the entry point of the application to set up logging.
 */

import logger, { LogLevel, LogSource } from './logger';

// Default log level based on environment
const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LogLevel.INFO 
  : LogLevel.DEBUG;

// Throttle times in milliseconds
const DEFAULT_THROTTLE_TIME = 1000; // 1 second general throttling
const PERFORMANCE_THROTTLE_TIME = 2000; // 2 seconds for performance logs

// Sources to filter out in production (very verbose)
const PROD_FILTERED_SOURCES: LogSource[] = [
  'Performance',
  'Canvas'
];

// Initialize the logger with appropriate settings
export function initLogger(overrideLogLevel?: LogLevel): void {
  // Use override log level if provided, otherwise use default
  const logLevel = overrideLogLevel !== undefined ? overrideLogLevel : DEFAULT_LOG_LEVEL;
  
  // Set the log level
  logger.setLogLevel(logLevel);
  
  // Configure throttling and other options
  logger.configureLogger({
    throttleTime: DEFAULT_THROTTLE_TIME,
    groupSimilarLogs: true,
    // In production, filter out verbose sources
    sourceFilter: process.env.NODE_ENV === 'production' ? PROD_FILTERED_SOURCES : [],
    enabled: true
  });
  
  // Log initialization
  logger.info('App', `Logger initialized at level: ${LogLevel[logLevel]}`);
  
  // Add to window for debugging in development
  if (process.env.NODE_ENV === 'development') {
    (window as any).logger = logger;
    (window as any).LogLevel = LogLevel;
    logger.debug('App', 'Logger exposed on window object for debugging');
  }
}

// Initialize automatically when imported
initLogger();

export default logger; 