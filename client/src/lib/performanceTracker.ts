/**
 * Performance Tracker - Accurate module-level performance monitoring
 * 
 * This utility helps track performance metrics for different modules in the application.
 * It uses high-resolution timestamps to measure execution time and provides detailed
 * breakdowns of where time is being spent.
 */

import { ModuleTiming, PerformanceMetrics } from './types';
import { dispatch, EventType } from './eventBus';

// Active timings currently being measured
const activeTimings: Map<string, { startTime: number }> = new Map();

// Completed module timings for the current frame
let currentFrameModules: ModuleTiming[] = [];

// FPS calculation
let frameCount = 0;
let lastFpsUpdateTime = 0;
let currentFps = 0;

// Frame boundary times
let frameStartTime = 0;
let lastFrameTime = 0;

/**
 * Start tracking time for a specific module
 * @param moduleName The name of the module being timed
 */
export function startTiming(moduleName: string): void {
  // If this is the first module of a new frame, record frame start time
  if (activeTimings.size === 0 && currentFrameModules.length === 0) {
    frameStartTime = performance.now();
  }
  
  // Start timing this module
  activeTimings.set(moduleName, { 
    startTime: performance.now() 
  });
}

/**
 * End timing for a specific module and record its duration
 * @param moduleName The name of the module being timed
 */
export function endTiming(moduleName: string): void {
  const endTime = performance.now();
  const timing = activeTimings.get(moduleName);
  
  if (timing) {
    // Calculate duration and create timing entry
    const duration = endTime - timing.startTime;
    const moduleTiming: ModuleTiming = {
      name: moduleName,
      duration,
      startTime: timing.startTime,
      endTime
    };
    
    // Add to completed modules and remove from active timings
    currentFrameModules.push(moduleTiming);
    activeTimings.delete(moduleName);
    
    // Debug info
    console.log(`Module ${moduleName} took ${duration.toFixed(2)}ms`);
  }
}

/**
 * Mark the end of a frame's processing and publish metrics
 */
export function endFrame(): void {
  // Calculate frame metrics
  const now = performance.now();
  const frameEndTime = now;
  const totalFrameTime = frameEndTime - frameStartTime;
  
  // Update FPS calculation
  frameCount++;
  if (now - lastFpsUpdateTime >= 1000) {
    // Calculate FPS over the last second
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
    frameCount = 0;
    lastFpsUpdateTime = now;
  }
  
  // Create complete metrics object
  const metrics: PerformanceMetrics = {
    fps: currentFps,
    totalFrameTime,
    frameStartTime,
    frameEndTime,
    timestamp: now,
    moduleTimings: [...currentFrameModules]
  };
  
  // Dispatch metrics event
  dispatch(EventType.FRAME_PROCESSED, metrics);
  
  // Reset for next frame
  currentFrameModules = [];
  lastFrameTime = totalFrameTime;
}

/**
 * Reset all performance tracking state
 */
export function resetPerformanceTracking(): void {
  activeTimings.clear();
  currentFrameModules = [];
  frameCount = 0;
  lastFpsUpdateTime = performance.now();
  currentFps = 0;
  frameStartTime = 0;
  lastFrameTime = 0;
}

/**
 * Get the most recently calculated FPS value
 */
export function getCurrentFps(): number {
  return currentFps;
}

/**
 * Get the most recently calculated frame time
 */
export function getLastFrameTime(): number {
  return lastFrameTime;
}