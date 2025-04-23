/**
 * Web Worker for media pipeline processing with MediaPipe hand tracking
 */

// Use self as the worker context
const mpCtx: Worker = self as any;

// Flag to track media pipeline initialization
let pipelineReady = false;
let handsModule: any = null;

// Import our One Euro filter implementation
// Note: In a web worker we need to implement the filtering code directly here
// since we can't import modules the normal way

/**
 * One Euro Filter Implementation - Worker Version
 * Based on the paper "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems"
 */

interface FilterOptions {
  minCutoff: number;
  beta: number;
  dcutoff: number;
}

// Default filter parameters, tuned for hand tracking
const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  minCutoff: 2.0,
  beta: 0.01,
  dcutoff: 1.5
};

// Low pass filter implementation
class LowPassFilter {
  private x: number;
  private alpha: number = 0;
  private initialized: boolean = false;

  constructor() {
    this.x = 0;
  }

  public setAlpha(alpha: number): void {
    this.alpha = alpha;
  }

  public filter(value: number): number {
    if (!this.initialized) {
      this.x = value;
      this.initialized = true;
      return this.x;
    }
    
    // Weighted average between previous value and new value
    this.x = this.alpha * value + (1.0 - this.alpha) * this.x;
    return this.x;
  }

  public get value(): number {
    return this.x;
  }
  
  public reset(): void {
    this.initialized = false;
  }
}

// One Euro Filter implementation for smoothing noisy signals
class OneEuroFilter {
  private options: FilterOptions;
  private x: LowPassFilter = new LowPassFilter();
  private dx: LowPassFilter = new LowPassFilter();
  private lastTime: number | null = null;
  private rate: number = 1.0; // Default sample rate (s)
  
  constructor(options: Partial<FilterOptions> = {}) {
    // Apply default options with any overrides
    this.options = {
      ...DEFAULT_FILTER_OPTIONS,
      ...options
    };
  }
  
  private computeAlpha(cutoff: number): number {
    // Alpha calcuation based on cutoff frequency and timestep
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / this.rate;
    return 1.0 / (1.0 + tau / te);
  }
  
  public filter(value: number, timestamp?: number): number {
    // Use current time if no timestamp provided
    if (timestamp === undefined) {
      timestamp = performance.now() / 1000.0; // Convert to seconds
    }
    
    // Initialize time if this is the first call
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      this.x.setAlpha(1.0); // Pass through first value
      return this.x.filter(value);
    }
    
    // Calculate time delta and update sample rate
    const dt = timestamp - this.lastTime;
    if (dt > 0) this.rate = 1.0 / dt;
    this.lastTime = timestamp;
    
    // Calculate cutoff based on speed (derivative)
    const dvalue = this.dx.value === 0 ? 
      0.0 : (value - this.x.value) * this.rate;
      
    // Apply low-pass filter to derivative with fixed cutoff
    this.dx.setAlpha(this.computeAlpha(this.options.dcutoff));
    const edvalue = this.dx.filter(dvalue);
    
    // Adjust cutoff frequency based on movement speed
    const cutoff = this.options.minCutoff + this.options.beta * Math.abs(edvalue);
    
    // Apply adaptive low-pass filter to the position
    this.x.setAlpha(this.computeAlpha(cutoff));
    return this.x.filter(value);
  }
  
  public updateOptions(options: Partial<FilterOptions>): void {
    this.options = {
      ...this.options,
      ...options
    };
  }
  
  public reset(): void {
    this.x.reset();
    this.dx.reset();
    this.lastTime = null;
  }
}

// Filter Factory for creating/managing multiple filters, such as x,y,z coordinates
class OneEuroFilterArray {
  private filters: OneEuroFilter[] = [];
  private dimensions: number;
  
  constructor(dimensions: number, options: Partial<FilterOptions> = {}) {
    this.dimensions = dimensions;
    
    // Create a filter for each dimension
    for (let i = 0; i < dimensions; i++) {
      this.filters.push(new OneEuroFilter(options));
    }
  }
  
  public filter(values: number[], timestamp?: number): number[] {
    if (values.length !== this.dimensions) {
      throw new Error(`Expected ${this.dimensions} values, got ${values.length}`);
    }
    
    // Apply each filter to its corresponding value
    return values.map((value, i) => this.filters[i].filter(value, timestamp));
  }
  
  public updateOptions(options: Partial<FilterOptions>): void {
    this.filters.forEach(filter => filter.updateOptions(options));
  }
  
  public reset(): void {
    this.filters.forEach(filter => filter.reset());
  }
}

// Store filter instances for each hand
const handFilters = new Map<number, OneEuroFilterArray[]>();
let filterOptions = { ...DEFAULT_FILTER_OPTIONS };

// Performance metrics
interface MPModulePerformance {
  moduleId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

// Track performance for different pipeline stages
const mpPerformanceMetrics: Record<string, MPModulePerformance> = {};

// Finger flexion settings
let fingerFlexionSettings = {
  enabled: false, // Disabled by default
  enabledFingers: {
    thumb: true,
    index: true,
    middle: true,
    ring: false,
    pinky: false
  },
  thresholds: {
    thumb: { flex: { min: 5, max: 30 } },
    index: { flex: { min: 5, max: 30 } },
    middle: { flex: { min: 5, max: 30 } },
    ring: { flex: { min: 5, max: 30 } },
    pinky: { flex: { min: 5, max: 30 } }
  }
};

// Settings for visualization
let landmarkFilteringEnabled = true;

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

// Initialize MediaPipe Hands (we can't directly use it in a worker)
// Instead, we'll process the raw data ourselves
function mpInitMediaPipeline(): void {
  mpStartTiming('initMediaPipeline');
  mpLog('Creating Media Pipeline Worker...');
  
  // In a real implementation, we would load MediaPipe Hands here
  // For now, we'll simulate it with a setTimeout
  setTimeout(() => {
    mpLog('Media Pipeline Worker created successfully');
    
    // Simulate additional setup time
    setTimeout(() => {
      pipelineReady = true;
      mpLog('Media Pipeline initialized and ready');
      mpUpdateStatus(true);
      mpEndTiming('initMediaPipeline');
    }, 1000);
  }, 1000);
}

// Apply the 1€ filter to hand landmarks
function mpApplyFilter(landmarks: any, handIndex: number, timestamp: number): any {
  // Skip filtering if disabled
  if (!landmarkFilteringEnabled) {
    return landmarks;
  }
  
  if (!handFilters.has(handIndex)) {
    // Create new filter array for each landmark (each has x,y,z coordinates)
    const filters: OneEuroFilterArray[] = [];
    for (let i = 0; i < landmarks.length; i++) {
      filters.push(new OneEuroFilterArray(3, filterOptions));
    }
    handFilters.set(handIndex, filters);
  }
  
  const filters = handFilters.get(handIndex)!;
  
  // Apply filter to each landmark
  return landmarks.map((landmark: any, i: number) => {
    const values = [landmark.x, landmark.y, landmark.z];
    const filteredValues = filters[i].filter(values, timestamp / 1000); // Convert to seconds
    
    return {
      x: filteredValues[0],
      y: filteredValues[1],
      z: filteredValues[2]
    };
  });
}

// Calculate the angle between three points in 3D space
function mpCalculateAngle(p1: any, p2: any, p3: any): number {
  // Optimized angle calculation - avoid excessive object creation
  const vec1x = p1.x - p2.x;
  const vec1y = p1.y - p2.y;
  const vec1z = p1.z - p2.z;
  
  const vec2x = p3.x - p2.x;
  const vec2y = p3.y - p2.y;
  const vec2z = p3.z - p2.z;
  
  // Calculate dot product
  const dotProduct = vec1x * vec2x + vec1y * vec2y + vec1z * vec2z;
  
  // Calculate magnitudes
  const mag1 = Math.sqrt(vec1x * vec1x + vec1y * vec1y + vec1z * vec1z);
  const mag2 = Math.sqrt(vec2x * vec2x + vec2y * vec2y + vec2z * vec2z);
  
  // Calculate angle in radians
  // Use Math.max to avoid domain errors with acos due to floating-point imprecision
  const cosVal = Math.max(-1.0, Math.min(1.0, dotProduct / (mag1 * mag2)));
  const angleRad = Math.acos(cosVal);
  
  // Convert to degrees - normalize the range for finger flexion
  // When a finger is straight, this will be close to 180 degrees,
  // so we invert it (180 - angle) to make it more intuitive:
  // 0 degrees = straight, higher values = more bent
  return 180 - (angleRad * (180 / Math.PI));
}

// Calculate finger flexion angles 
function mpCalculateFingerAngles(landmarks: any, enabledFingers?: {thumb: boolean, index: boolean, middle: boolean, ring: boolean, pinky: boolean}) {
  // Ensure we have landmarks
  if (!landmarks || landmarks.length < 21) {
    return null;
  }
  
  // Pre-allocate the angles object with simplified flex measurements
  const angles: {[finger: string]: {flex: number | null}} = {
    thumb: { flex: null },
    index: { flex: null },
    middle: { flex: null },
    ring: { flex: null },
    pinky: { flex: null }
  };
  
  // Only calculate angles for enabled fingers (or all if not specified)
  
  // Thumb - only if enabled
  if (!enabledFingers || enabledFingers.thumb) {
    // Use IP joint as the main measurement for thumb
    angles.thumb.flex = mpCalculateAngle(
      landmarks[2], // MCP
      landmarks[3], // IP
      landmarks[4]  // TIP
    );
  }
  
  // Index finger - only if enabled
  if (!enabledFingers || enabledFingers.index) {
    // Use ONLY the PIP joint angle for index finger (main trigger joint)
    angles.index.flex = mpCalculateAngle(
      landmarks[5], // MCP
      landmarks[6], // PIP
      landmarks[7]  // DIP
    );
  }
  
  // Middle finger - only if enabled
  if (!enabledFingers || enabledFingers.middle) {
    // Use ONLY the PIP joint angle for middle finger
    angles.middle.flex = mpCalculateAngle(
      landmarks[9],  // MCP
      landmarks[10], // PIP
      landmarks[11]  // DIP
    );
  }
  
  // Ring finger - only if enabled
  if (!enabledFingers || enabledFingers.ring) {
    // Use ONLY the PIP joint angle for ring finger
    angles.ring.flex = mpCalculateAngle(
      landmarks[13], // MCP
      landmarks[14], // PIP
      landmarks[15]  // DIP
    );
  }
  
  // Pinky finger - only if enabled
  if (!enabledFingers || enabledFingers.pinky) {
    // Use ONLY the PIP joint angle for pinky finger
    angles.pinky.flex = mpCalculateAngle(
      landmarks[17], // MCP
      landmarks[18], // PIP
      landmarks[19]  // DIP
    );
  }
  
  return angles;
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
  
  // Extract the raw hand landmarks data from the frame data
  const rawLandmarks = frameData.rawLandmarks || [];
  const now = frameData.timestamp || performance.now();
  
  // Start timing filtering operation
  mpStartTiming('landmarkFiltering');
  
  // Apply 1€ filter to landmarks if we have any hand data
  let filteredLandmarks = [];
  if (rawLandmarks && rawLandmarks.length > 0) {
    // Apply the filter to each hand's landmarks
    filteredLandmarks = rawLandmarks.map((handLandmarks: any, handIndex: number) => {
      return mpApplyFilter(handLandmarks, handIndex, now);
    });
  }
  
  // End timing filtering operation
  const filteringTime = mpEndTiming('landmarkFiltering');
  
  // Start timing angle calculation (if enabled)
  mpStartTiming('angleCalculation');
  
  // Calculate finger joint angles if feature is enabled
  let fingerAngles = null;
  if (fingerFlexionSettings.enabled && filteredLandmarks.length > 0) {
    // Get the first detected hand
    const firstHand = filteredLandmarks[0];
    
    // Calculate finger flexion angles
    fingerAngles = mpCalculateFingerAngles(
      firstHand, 
      fingerFlexionSettings.enabledFingers
    );
  }
  
  // End timing angle calculation
  const angleCalcTime = mpEndTiming('angleCalculation');
  
  // Start timing visualization preparation
  mpStartTiming('visualizationPrep');
  
  // Prepare connection data for visualization
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
  
  // Add fps to performance data
  performanceData.fps = Math.round(1000 / totalFrameTime);
  performanceData.filteringTime = filteringTime;
  performanceData.angleCalcTime = angleCalcTime;
  
  // Send processed result back to main thread
  mpCtx.postMessage({
    type: 'processed-frame',
    timestamp: now,
    processingTimeMs: totalFrameTime,
    performance: performanceData,
    handData: {
      landmarks: filteredLandmarks.length > 0 ? filteredLandmarks : null,
      rawLandmarks: rawLandmarks.length > 0 ? rawLandmarks : null,
      connections: connections,
      colors: RAINBOW_COLORS,
      fingerAngles: fingerAngles
    }
  });
}

// Update filter settings
function mpUpdateFilterSettings(options: Partial<FilterOptions>): void {
  filterOptions = {
    ...filterOptions,
    ...options
  };
  
  // Update all existing filters
  handFilters.forEach(filters => {
    filters.forEach(filter => {
      filter.updateOptions(options);
    });
  });
}

// Update flexion settings
function mpUpdateFlexionSettings(settings: any): void {
  fingerFlexionSettings = {
    ...fingerFlexionSettings,
    ...settings
  };
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
    case 'update-filter-settings':
      mpUpdateFilterSettings(data);
      break;
    case 'update-flexion-settings':
      mpUpdateFlexionSettings(data);
      break;
    case 'update-landmark-filtering':
      landmarkFilteringEnabled = data.enabled;
      break;
    default:
      mpLog(`Unknown command: ${command}`);
  }
});

// Notify that the worker is ready
mpCtx.postMessage({ type: 'worker-ready' });
