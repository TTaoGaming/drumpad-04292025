/**
 * Performance Tracking Utility
 * 
 * Provides precise measurement of processing times for individual modules
 * and overall frame processing performance.
 */
import { PerformanceMetrics, ModuleTiming } from './types';
import { dispatch, EventType } from './eventBus';

// Active module timings for the current frame
const activeTimings = new Map<string, number>();

// Completed timings for the current frame
const moduleTimings: ModuleTiming[] = [];

// Frame counters
let frameStartTime = 0;
let frameCount = 0;
let lastFpsUpdateTime = 0;
let currentFps = 0;

// Initialize tracker
export function initPerformanceTracker(): void {
  frameStartTime = performance.now();
  frameCount = 0;
  lastFpsUpdateTime = frameStartTime;
  currentFps = 0;
}

/**
 * Start timing a specific module
 * @param moduleId Unique identifier for the module being timed
 */
export function startTiming(moduleId: string): void {
  activeTimings.set(moduleId, performance.now());
}

/**
 * End timing for a specific module and record its duration
 * @param moduleId Unique identifier for the module being timed
 */
export function endTiming(moduleId: string): void {
  const startTime = activeTimings.get(moduleId);
  if (startTime) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Store the timing result
    moduleTimings.push({
      name: moduleId,
      duration,
      startTime,
      endTime
    });
    
    // Remove from active timings
    activeTimings.delete(moduleId);
  }
}

/**
 * Finalizes the frame processing and publishes metrics
 */
export function endFrame(): void {
  // Calculate FPS
  frameCount++;
  const now = performance.now();
  const elapsed = now - frameStartTime;
  
  // Update FPS counter every second
  if (now - lastFpsUpdateTime > 1000) {
    const seconds = (now - lastFpsUpdateTime) / 1000;
    currentFps = Math.round(frameCount / seconds);
    
    // Reset counters
    frameCount = 0;
    lastFpsUpdateTime = now;
  }
  
  // Log module timings for debugging
  console.log('Module timings collected:', moduleTimings);
  
  // Calculate total processing time
  let totalProcessingTime = 0;
  for (const timing of moduleTimings) {
    totalProcessingTime += timing.duration;
  }
  
  // Publish performance metrics via event bus
  const metrics: PerformanceMetrics = {
    fps: currentFps,
    timestamp: now,
    frameTime: elapsed,
    moduleTimings: [...moduleTimings], // Make a copy of the array
    totalTime: totalProcessingTime
  };
  
  // Log metrics before dispatch
  console.log('Performance metrics before dispatch:', metrics);
  
  // Send the metrics to any listeners
  dispatch(EventType.FRAME_PROCESSED, metrics);
  
  // Clear module timings for the next frame
  moduleTimings.length = 0;
}