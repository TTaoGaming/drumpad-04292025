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

// Send log message to main thread
function mpLog(message: string): void {
  mpCtx.postMessage({
    type: 'log',
    message
  });
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

// Initialize MediaPipe Hands (we can't directly use the full MP Hands in a worker)
// We'll implement essential processing functionality here
function mpInitMediaPipeline(): void {
  mpStartTiming('initMediaPipeline');
  mpLog('Creating Media Pipeline Worker...');
  
  try {
    // In a worker environment, we can't fully load MediaPipe Hands with its WASM
    // but we can use the data processing and calculation algorithms
    
    // For now, we'll use a simplified version that handles landmark data
    // The main thread will do the actual MediaPipe Hands processing
    
    pipelineReady = true;
    mpLog('Media Pipeline Worker created successfully');
    
    // Set up any internal data structures or models
    setTimeout(() => {
      mpLog('Media Pipeline initialized and ready');
      mpUpdateStatus(true);
      mpEndTiming('initMediaPipeline');
    }, 500);
  } catch (error) {
    mpLog(`Error initializing media pipeline: ${error}`);
    
    // Fallback to simulated mode for development
    setTimeout(() => {
      pipelineReady = true;
      mpLog('Media Pipeline initialized in fallback mode');
      mpUpdateStatus(true);
      mpEndTiming('initMediaPipeline');
    }, 500);
  }
}

// Process hand landmarks and connections to create visualization data
function mpProcessHandLandmarks(landmarks: any[]): any {
  // Deep copy to avoid modifying the original data
  const handLandmarks = JSON.parse(JSON.stringify(landmarks));
  
  // In a real implementation, this would process the landmarks
  // For now, we'll simulate it with random hand positions
  const simulatedLandmarks = [];
  
  // Use either real landmarks (if available) or generate simulated ones
  // for demonstration purposes
  if (handLandmarks && handLandmarks.length > 0) {
    return handLandmarks;
  } else {
    // For testing - create simulated hand landmarks
    // Position them in the center with some random variation
    for (let i = 0; i < 21; i++) {
      // Create a plausible hand shape in the center of the frame
      let x = 0.5; // center of frame
      let y = 0.5; // center of frame
      
      // Adjust based on landmark type to create a hand-like shape
      if (i === 0) { // Wrist
        y += 0.2;
      } else if (i >= 1 && i <= 4) { // Thumb
        x -= 0.05 * (i - 1);
        y += 0.15 - 0.03 * (i - 1);
      } else if (i >= 5 && i <= 8) { // Index finger
        x -= 0.02;
        y += 0.1 - 0.05 * (i - 5);
      } else if (i >= 9 && i <= 12) { // Middle finger
        y += 0.1 - 0.05 * (i - 9);
      } else if (i >= 13 && i <= 16) { // Ring finger
        x += 0.02;
        y += 0.1 - 0.05 * (i - 13);
      } else if (i >= 17 && i <= 20) { // Pinky
        x += 0.04;
        y += 0.1 - 0.05 * (i - 17);
      }
      
      // Add some randomness to make it look more natural
      x += (Math.random() - 0.5) * 0.01;
      y += (Math.random() - 0.5) * 0.01;
      
      simulatedLandmarks.push({
        x: x,
        y: y,
        z: 0
      });
    }
    return simulatedLandmarks;
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
  
  // Process the frame to detect hands
  // In a real implementation, we would use MediaPipe Hands here
  
  // Simulate hand detection
  const handLandmarks = mpProcessHandLandmarks([]);
  
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
