# Centralized Logging System

## Overview

This centralized logging system helps reduce console spam while providing better control over what information is displayed. It provides:

- Log level filtering (TRACE, DEBUG, INFO, WARN, ERROR)
- Source-based filtering (App, OpenCV, MediaPipe, Canvas, etc.)
- Automatic throttling of repetitive logs
- Aggregation of similar messages
- Consistent formatting across the application

## Usage

### Basic Logging

```typescript
import logger from '@/lib/logger';

// Log levels from least to most important
logger.trace('SourceName', 'Very detailed message');
logger.debug('SourceName', 'Useful for debugging');
logger.info('SourceName', 'General information');
logger.warn('SourceName', 'Warning message');
logger.error('SourceName', 'Error occurred', errorObject);
```

### Configuration

The logger is automatically initialized in `initLogger.ts`. You can change settings:

```typescript
import logger, { LogLevel } from '@/lib/logger';

// Change log level
logger.setLogLevel(LogLevel.INFO); // Only show INFO and above

// Enable/disable logger
logger.setLoggerEnabled(false);

// Filter to specific sources
logger.filterLogSources(['App', 'OpenCV']);

// Custom configuration
logger.configureLogger({
  level: LogLevel.DEBUG,
  throttleTime: 1000, // 1 second throttle for repeated logs
  groupSimilarLogs: true,
  sourceFilter: [],
  enabled: true
});
```

## Log Sources

Valid source names are:

- `App` - Main application logs
- `OpenCV` - OpenCV.js related logs
- `MediaPipe` - MediaPipe Hands related logs
- `Canvas` - Canvas and drawing related logs
- `ROI` - Region of Interest related logs
- `Performance` - Performance metrics logs
- `Worker` - Web Worker related logs
- `Contour` - Contour tracking related logs
- `Other` - Other logs

## Log Levels

From lowest to highest priority:

1. `TRACE` - Very detailed logs for tracing execution flow
2. `DEBUG` - Debugging information useful during development
3. `INFO` - General information about application state
4. `WARN` - Warnings that don't prevent operation
5. `ERROR` - Errors that may impact functionality
6. `NONE` - No logs

Only logs at or above the configured level will be shown.

## Throttling and Grouping

The logger automatically throttles repetitive logs to prevent console flooding. When a similar message is logged multiple times within the throttle interval, only one log will be shown with a count of occurrences.

## Development Tip

In development, the logger is exposed on the window object for easy debugging:

```javascript
// In browser console
window.logger.setLogLevel(window.LogLevel.TRACE); // Show all logs
window.logger.setLogLevel(window.LogLevel.ERROR); // Show only errors
``` 