/**
 * Web Worker for media pipeline processing with MediaPipe hand tracking
 */

// Use self as the worker context
const mpCtx: Worker = self as any;

// Flag to track media pipeline initialization
let pipelineReady = false;
let handsModule: any = null;

// Performance metrics
interface MPModulePerformance {
  moduleId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

// Track performance for different pipeline stages
const mpPerformanceMetrics: Record<string, MPModulePerformance> = {};

// Counter for throttling logs
let logCounter = 0;
const LOG_THROTTLE = 50; // Only send 1 out of every 50 logs

// Send log message to main thread (with throttling)
function mpLog(message: string, forceLog = false): void {
  // Only log critical messages or throttled regular messages
  if (forceLog || ++logCounter % LOG_THROTTLE === 0) {
    mpCtx.postMessage({
      type: 'log',
      message
    });
  }
}

// Send status update to main thread
function mpUpdateStatus(ready: boolean): void {
  mpCtx.postMessage({
    type: 'status',
    ready
  });
}

// Start timing a module's performance
function mpStartTiming(moduleId: string): void {
  mpPerformanceMetrics[moduleId] = {
    moduleId,
    startTime: performance.now()
  };
}

// End timing a module's performance
function mpEndTiming(moduleId: string): number {
  if (mpPerformanceMetrics[moduleId]) {
    const endTime = performance.now();
    const duration = endTime - mpPerformanceMetrics[moduleId].startTime;
    
    mpPerformanceMetrics[moduleId].endTime = endTime;
    mpPerformanceMetrics[moduleId].duration = duration;
    
    return duration;
  }
  return 0;
}

// Get performance metrics as a formatted object
function mpGetPerformanceMetrics(): Record<string, number> {
  const metrics: Record<string, number> = {};
  
  Object.values(mpPerformanceMetrics).forEach(metric => {
    if (metric.duration !== undefined) {
      metrics[metric.moduleId] = Math.round(metric.duration * 100) / 100; // Round to 2 decimal places
    }
  });
  
  // Calculate total processing time and FPS
  let totalTime = 0;
  Object.values(metrics).forEach(time => {
    totalTime += time;
  });
  
  metrics.totalProcessingMs = Math.round(totalTime * 100) / 100;
  metrics.estimatedFps = totalTime > 0 ? Math.round(1000 / totalTime) : 0;
  
  return metrics;
}

// Rainbow colors for hand landmarks
const RAINBOW_COLORS = [
  'red',         // Thumb
  'orange',      // Index finger
  'yellow',      // Middle finger
  'green',       // Ring finger
  'blue',        // Pinky
  'indigo',      // Palm connections
  'violet'       // Wrist
];

// Define hand connections with their color indices
// Each finger is assigned a specific color from the RAINBOW_COLORS array
const HAND_CONNECTIONS = [
  // Thumb (Red)
  [0, 1, 0], [1, 2, 0], [2, 3, 0], [3, 4, 0],
  // Index finger (Orange)  
  [0, 5, 1], [5, 6, 1], [6, 7, 1], [7, 8, 1],
  // Middle finger (Yellow)
  [0, 9, 2], [9, 10, 2], [10, 11, 2], [11, 12, 2],
  // Ring finger (Green)
  [0, 13, 3], [13, 14, 3], [14, 15, 3], [15, 16, 3],
  // Pinky (Blue)
  [0, 17, 4], [17, 18, 4], [18, 19, 4], [19, 20, 4],
  // Palm (Indigo)
  [0, 5, 5], [5, 9, 5], [9, 13, 5], [13, 17, 5],
  // Wrist (Violet)
  [0, 5, 6], [0, 17, 6]
];

// Hand landmark indices for reference
const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
};

// Initialize Media Pipeline (we can't directly use MediaPipe in a worker)
// Instead, we'll get the data from the main thread through message passing
function mpInitMediaPipeline(): void {
  mpStartTiming('initMediaPipeline');
  mpLog('Creating Media Pipeline Worker...');
  
  // No need to simulate initialization anymore
  // We're ready immediately since we're just processing data received from the main thread
  mpLog('Media Pipeline Worker created successfully');
  
  pipelineReady = true;
  mpLog('Media Pipeline initialized and ready');
  mpUpdateStatus(true);
  mpEndTiming('initMediaPipeline');
}

// Process hand landmarks and connections to create visualization data
function mpProcessHandLandmarks(landmarks: any[]): any {
  // Deep copy to avoid modifying the original data
  const handLandmarks = JSON.parse(JSON.stringify(landmarks));
  
  // Just return the provided hand landmarks
  // No need for simulation as we should be receiving real data from MediaPipeHandTracking component
  if (handLandmarks && handLandmarks.length > 0) {
    return handLandmarks;
  } else {
    // If no landmarks provided, return an empty array rather than simulated data
    // This indicates no hands are currently detected
    return [];
  }
}

// Process a frame through the media pipeline
function mpProcessFrame(frameData: any): void {
  if (!pipelineReady) {
    mpLog('Media pipeline not ready yet, skipping frame processing');
    return;
  }
  
  // Start timing overall frame processing
  mpStartTiming('totalFrame');
  
  // Start timing hand detection
  mpStartTiming('handDetection');
  
  // Check if we received hand data from the MediaPipeHandTracking component
  // frameData can contain handLandmarks directly from the tracking component
  let handLandmarks = [];
  
  if (frameData && frameData.handLandmarks) {
    // If we have hand landmarks from the main thread, use them
    handLandmarks = mpProcessHandLandmarks(frameData.handLandmarks);
    mpLog(`Received hand landmarks from main thread: ${handLandmarks.length} points`);
  } else if (frameData && frameData.handData && frameData.handData.landmarks) {
    // Alternative property structure
    handLandmarks = mpProcessHandLandmarks(frameData.handData.landmarks);
    mpLog(`Received hand landmarks from handData: ${handLandmarks.length} points`);
  } else {
    // No landmarks in this frame
    handLandmarks = [];
  }
  
  // End timing hand detection
  const handDetectionTime = mpEndTiming('handDetection');
  
  // Start timing visualization preparation
  mpStartTiming('visualizationPrep');
  
  // Prepare data for visualization
  // Create connections data based on detected landmarks
  const connections = HAND_CONNECTIONS.map(conn => {
    return {
      start: conn[0],
      end: conn[1],
      colorIndex: conn[2]
    };
  });
  
  // End timing visualization preparation
  const visualizationPrepTime = mpEndTiming('visualizationPrep');
  
  // End timing overall frame processing
  const totalFrameTime = mpEndTiming('totalFrame');
  
  // Get complete performance metrics
  const performanceData = mpGetPerformanceMetrics();
  
  // Send processed result back to main thread
  mpCtx.postMessage({
    type: 'processed-frame',
    timestamp: Date.now(),
    processingTimeMs: totalFrameTime,
    performance: performanceData,
    handData: {
      landmarks: handLandmarks,
      connections: connections,
      colors: RAINBOW_COLORS
    }
  });
}

// Handle messages from the main thread
mpCtx.addEventListener('message', (e) => {
  const { command, data } = e.data;
  
  switch (command) {
    case 'init':
      mpInitMediaPipeline();
      break;
    case 'process-frame':
      mpProcessFrame(data);
      break;
    default:
      mpLog(`Unknown command: ${command}`);
  }
});

// Notify that the worker is ready
mpCtx.postMessage({ type: 'worker-ready' });
