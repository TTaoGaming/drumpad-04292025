/**
 * Web Worker for OpenCV.js initialization and processing
 */

// Use self as the worker context
const cvCtx: Worker = self as any;

// Flag to track OpenCV loading status
let opencvLoaded = false;

// Performance metrics
interface CVModulePerformance {
  moduleId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

// Track performance for different processing stages
const cvPerformanceMetrics: Record<string, CVModulePerformance> = {};

// Send log message to main thread
function cvLog(message: string): void {
  cvCtx.postMessage({
    type: 'log',
    message
  });
}

// Send status update to main thread
function cvUpdateStatus(ready: boolean): void {
  cvCtx.postMessage({
    type: 'status',
    ready
  });
}

// Start timing a module's performance
function cvStartTiming(moduleId: string): void {
  cvPerformanceMetrics[moduleId] = {
    moduleId,
    startTime: performance.now()
  };
}

// End timing a module's performance
function cvEndTiming(moduleId: string): number {
  if (cvPerformanceMetrics[moduleId]) {
    const endTime = performance.now();
    const duration = endTime - cvPerformanceMetrics[moduleId].startTime;
    
    cvPerformanceMetrics[moduleId].endTime = endTime;
    cvPerformanceMetrics[moduleId].duration = duration;
    
    return duration;
  }
  return 0;
}

// Get performance metrics as a formatted object
function cvGetPerformanceMetrics(): Record<string, number> {
  const metrics: Record<string, number> = {};
  
  Object.values(cvPerformanceMetrics).forEach(metric => {
    if (metric.duration !== undefined) {
      metrics[metric.moduleId] = Math.round(metric.duration * 100) / 100; // Round to 2 decimal places
    }
  });
  
  return metrics;
}

// Initialize OpenCV.js
function cvInitOpenCV(): void {
  cvStartTiming('cvInit');
  cvLog('Loading OpenCV.js...');
  
  // For this MVP, we'll simulate the OpenCV initialization
  // In a real implementation, we would use importScripts to load OpenCV.js
  // but for now we'll simulate the loading process
  
  // Set up the Module for when OpenCV would be loaded
  (self as any).Module = {
    onRuntimeInitialized: cvOnOpenCVReady
  };
  
  // Simulate loading time
  setTimeout(() => {
    cvLog('OpenCV.js loaded successfully');
    setTimeout(() => {
      cvOnOpenCVReady();
      cvEndTiming('cvInit');
    }, 1000);
  }, 2000);
}

// Called when OpenCV is fully loaded and ready
function cvOnOpenCVReady(): void {
  opencvLoaded = true;
  cvLog('OpenCV initialized and ready');
  cvUpdateStatus(true);
}

// Process a frame using OpenCV
function cvProcessFrame(frame: ImageData): void {
  if (!opencvLoaded) {
    cvLog('OpenCV not loaded yet, skipping frame processing');
    return;
  }
  
  // Start timing overall OpenCV processing
  cvStartTiming('cvTotalProcessing');
  
  // Start timing feature detection
  cvStartTiming('cvFeatureDetection');
  
  // In a real implementation, we would use cv.Mat to process the frame
  // This is a placeholder for the actual OpenCV processing
  
  // Example processing workflow:
  // 1. Convert ImageData to cv.Mat
  // 2. Apply image processing operations
  // 3. Convert result back to ImageData
  // 4. Send processed data back to main thread
  
  // Simulate some processing time for feature detection
  setTimeout(() => {
    // End timing feature detection
    const featureDetectionTime = cvEndTiming('cvFeatureDetection');
    
    // Start timing additional processing
    cvStartTiming('cvAdditionalProcessing');
    
    // Simulate additional processing time
    setTimeout(() => {
      // End timing additional processing
      const additionalProcessingTime = cvEndTiming('cvAdditionalProcessing');
      
      // End timing overall OpenCV processing
      const totalProcessingTime = cvEndTiming('cvTotalProcessing');
      
      // Get complete performance metrics
      const performanceData = cvGetPerformanceMetrics();
      
      // Send processed result back
      cvCtx.postMessage({
        type: 'processed-frame',
        timestamp: Date.now(),
        processingTimeMs: totalProcessingTime,
        performance: performanceData
      });
    }, 2);
  }, 8);
}

// Handle messages from the main thread
cvCtx.addEventListener('message', (e) => {
  const { command, data } = e.data;
  
  switch (command) {
    case 'init':
      cvInitOpenCV();
      break;
    case 'process-frame':
      cvProcessFrame(data);
      break;
    default:
      cvLog(`Unknown command: ${command}`);
  }
});

// Notify that the worker is ready
cvCtx.postMessage({ type: 'worker-ready' });
