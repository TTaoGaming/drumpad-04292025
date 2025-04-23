/**
 * Media Pipeline Web Worker
 * 
 * This worker performs the CPU-intensive calculations for the hand tracking
 * pipeline, including landmark filtering, angle calculations, and other
 * processing tasks. This keeps the main thread free for rendering and UI work.
 */

const mpCtx: Worker = self as any;

/**
 * CONSTANTS
 */

// MediaPipe hand connections
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1, 0], [1, 2, 0], [2, 3, 0], [3, 4, 0],
  // Index finger
  [0, 5, 1], [5, 6, 1], [6, 7, 1], [7, 8, 1],
  // Middle finger
  [0, 9, 2], [9, 10, 2], [10, 11, 2], [11, 12, 2],
  // Ring finger
  [0, 13, 3], [13, 14, 3], [14, 15, 3], [15, 16, 3],
  // Pinky
  [0, 17, 4], [17, 18, 4], [18, 19, 4], [19, 20, 4],
  // Palm
  [5, 9, 5], [9, 13, 5], [13, 17, 5], [0, 5, 5], [0, 17, 5]
];

// Rainbow colors for visualization
const RAINBOW_COLORS = [
  '#FF0000', // Red (thumb)
  '#FF7F00', // Orange (index)
  '#FFFF00', // Yellow (middle)
  '#00FF00', // Green (ring)
  '#0000FF', // Blue (pinky)
  '#4B0082', // Indigo (palm connections)
  '#9400D3'  // Violet (wrist)
];

/**
 * STATE AND CONFIGURATION
 */

// Filter settings
interface FilterOptions {
  minCutoff: number;
  beta: number;
  dcutoff: number;
}

const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  minCutoff: 0.001, // Lower values remove more jitter but add lag (0.001-1.0)
  beta: 0.1,        // Higher values remove lag but might overshoot (0.0-1.0)
  dcutoff: 1.0      // Higher values reduce lag in fast motions (0.1-2.0)
};

let filterOptions: FilterOptions = { ...DEFAULT_FILTER_OPTIONS };
let pipelineReady = false;
let landmarkFilteringEnabled = true;

// Finger flexion settings  
let fingerFlexionSettings = {
  enabled: false,
  showStateIndicators: false,
  enabledFingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  thresholds: {
    thumb: { flex: { min: 20, max: 45 } },
    index: { flex: { min: 20, max: 45 } },
    middle: { flex: { min: 20, max: 45 } },
    ring: { flex: { min: 20, max: 45 } },
    pinky: { flex: { min: 20, max: 45 } }
  }
};

// Performance tracking
const performanceMetrics: Map<string, MPModulePerformance> = new Map();

/**
 * LOW PASS FILTERING
 */

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
      return value;
    }
    
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

class OneEuroFilter {
  private options: FilterOptions;
  private x: LowPassFilter = new LowPassFilter();
  private dx: LowPassFilter = new LowPassFilter();
  private lastTime: number | null = null;
  private rate: number = 1.0; // Default sample rate (s)

  constructor(options: Partial<FilterOptions> = {}) {
    this.options = { ...DEFAULT_FILTER_OPTIONS, ...options };
  }

  private computeAlpha(cutoff: number): number {
    // Compute the alpha value for the low-pass filter
    // based on the cutoff frequency and the sampling rate
    const te = 1.0 / this.rate;
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  public filter(value: number, timestamp?: number): number {
    if (timestamp && this.lastTime) {
      this.rate = 1.0 / ((timestamp - this.lastTime) / 1000.0);
    }
    
    if (!this.lastTime) {
      this.lastTime = timestamp || performance.now();
      this.x.setAlpha(1.0); // Initialize directly with first value
      return this.x.filter(value);
    }
    
    this.lastTime = timestamp || performance.now();
    
    // Estimate the current variation per second
    const dvalue = (value - this.x.value) * this.rate;
    
    // Filter the derivative
    const edvalue = this.dx.filter(dvalue);
    
    // Use it to compute the cutoff frequency for the main filter
    const cutoff = this.options.minCutoff + this.options.beta * Math.abs(edvalue);
    
    // Compute alpha and filter value using the low pass filter
    const alpha = this.computeAlpha(cutoff);
    this.x.setAlpha(alpha);
    
    return this.x.filter(value);
  }

  public updateOptions(options: Partial<FilterOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public reset(): void {
    this.x.reset();
    this.dx.reset();
    this.lastTime = null;
  }
}

class OneEuroFilterArray {
  private filters: OneEuroFilter[] = [];
  private dimensions: number;

  constructor(dimensions: number, options: Partial<FilterOptions> = {}) {
    this.dimensions = dimensions;
    for (let i = 0; i < dimensions; i++) {
      this.filters.push(new OneEuroFilter(options));
    }
  }

  public filter(values: number[], timestamp?: number): number[] {
    if (values.length !== this.dimensions) {
      console.error('Mismatch in filter dimensions');
      return values;
    }
    
    return values.map((val, idx) => this.filters[idx].filter(val, timestamp));
  }

  public updateOptions(options: Partial<FilterOptions>): void {
    this.filters.forEach(filter => filter.updateOptions(options));
  }

  public reset(): void {
    this.filters.forEach(filter => filter.reset());
  }
}

// Array of hand filters
// Each hand has multiple landmark points, each with x, y, z coordinates
const handFilters: OneEuroFilterArray[][] = [];

/**
 * PERFORMANCE TRACKING
 */

interface MPModulePerformance {
  moduleId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

function mpLog(message: string): void {
  mpCtx.postMessage({
    type: 'log',
    message: message
  });
}

function mpUpdateStatus(ready: boolean): void {
  pipelineReady = ready;
  mpCtx.postMessage({
    type: 'status-update',
    ready: ready
  });
}

function mpStartTiming(moduleId: string): void {
  performanceMetrics.set(moduleId, {
    moduleId,
    startTime: performance.now()
  });
}

function mpEndTiming(moduleId: string): number {
  const metric = performanceMetrics.get(moduleId);
  if (!metric) return 0;
  
  metric.endTime = performance.now();
  metric.duration = metric.endTime - metric.startTime;
  
  return metric.duration;
}

function mpGetPerformanceMetrics(): Record<string, number> {
  const result: Record<string, number> = {};
  
  // Convert to array first to avoid iteration issues in older JS engines
  Array.from(performanceMetrics).forEach(([id, metric]) => {
    if (metric.duration !== undefined) {
      result[id] = metric.duration;
    }
  });
  
  return result;
}

function mpInitMediaPipeline(): void {
  mpLog('Initializing media pipeline...');
  
  // Create filters for 2 hands, 21 landmarks per hand, 3 coordinates per landmark (x, y, z)
  for (let h = 0; h < 2; h++) {
    const handLandmarkFilters: OneEuroFilterArray[] = [];
    
    for (let l = 0; l < 21; l++) {
      // Each landmark has x, y, z coordinates
      handLandmarkFilters.push(new OneEuroFilterArray(3, filterOptions));
    }
    
    handFilters.push(handLandmarkFilters);
  }
  
  mpUpdateStatus(true);
  mpLog('Media pipeline initialized and ready');
}

function mpApplyFilter(landmarks: any, handIndex: number, timestamp: number): any {
  // Skip filtering if disabled
  if (!landmarkFilteringEnabled) return landmarks;
  
  // Make sure we have filters for this hand
  if (handIndex >= handFilters.length) return landmarks;
  
  const handLandmarkFilters = handFilters[handIndex];
  const filteredLandmarks = [];
  
  // Process each landmark point (MediaPipe returns 21 landmarks per hand)
  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    
    // Make sure we have a filter for this landmark
    if (i >= handLandmarkFilters.length) {
      filteredLandmarks.push(landmark);
      continue;
    }
    
    // Get the filter for this landmark
    const filter = handLandmarkFilters[i];
    
    // Apply filter to x, y, z coordinates
    const filteredCoords = filter.filter([landmark.x, landmark.y, landmark.z], timestamp);
    
    // Create new filtered landmark point
    filteredLandmarks.push({
      x: filteredCoords[0],
      y: filteredCoords[1],
      z: filteredCoords[2]
    });
  }
  
  return filteredLandmarks;
}

function mpCalculateAngle(p1: any, p2: any, p3: any): number {
  // Calculate the angle between three 3D points
  // We only use x and y coordinates for 2D angles in the camera plane
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  
  // Calculate dot product
  const dotProduct = v1.x * v2.x + v1.y * v2.y;
  
  // Calculate magnitudes
  const v1Mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const v2Mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  // Calculate the cosine of the angle
  const cosAngle = dotProduct / (v1Mag * v2Mag);
  
  // Convert to degrees
  const angleDegrees = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
  
  return angleDegrees;
}

function mpCalculateFingerAngles(landmarks: any, enabledFingers?: {thumb: boolean, index: boolean, middle: boolean, ring: boolean, pinky: boolean}) {
  if (!landmarks) return null;
  
  const enabled = enabledFingers || {
    thumb: true,
    index: true,
    middle: true,
    ring: true,
    pinky: true
  };
  
  const angles = {
    thumb: { flex: 0 },
    index: { flex: 0 },
    middle: { flex: 0 },
    ring: { flex: 0 },
    pinky: { flex: 0 }
  };
  
  // Only calculate angles for enabled fingers
  if (enabled.thumb) {
    // Thumb has a different structure - use CMC-MCP-IP angle (0-1-2 vs 2-3-4)
    angles.thumb.flex = mpCalculateAngle(landmarks[0], landmarks[2], landmarks[4]);
  }
  
  if (enabled.index) {
    // For other fingers, use the PIP joint angle (0-5-6 vs 6-7-8 for index)
    angles.index.flex = mpCalculateAngle(landmarks[0], landmarks[6], landmarks[8]);
  }
  
  if (enabled.middle) {
    angles.middle.flex = mpCalculateAngle(landmarks[0], landmarks[10], landmarks[12]);
  }
  
  if (enabled.ring) {
    angles.ring.flex = mpCalculateAngle(landmarks[0], landmarks[14], landmarks[16]);
  }
  
  if (enabled.pinky) {
    angles.pinky.flex = mpCalculateAngle(landmarks[0], landmarks[18], landmarks[20]);
  }
  
  return angles;
}

function mpProcessHandLandmarks(landmarks: any[]): any {
  // Process landmarks to extract useful features
  // This is a placeholder for more advanced landmark processing
  
  // For now, just return a simplified version with key points
  const simulatedLandmarks = landmarks.map(lm => {
    return {
      x: lm.x,
      y: lm.y,
      z: lm.z || 0
    };
  });
  
  return simulatedLandmarks;
}

// Process a frame through the media pipeline
function mpProcessFrame(frameData: any): void {
  if (!pipelineReady) {
    mpLog('Media pipeline not ready yet, skipping frame processing');
    return;
  }
  
  // Start timing overall frame processing
  mpStartTiming('totalFrame');
  
  // Check if we're receiving a command from the main thread
  if (frameData.command === 'process-frame' && frameData.data) {
    // Process the landmark data received from the main thread
    const { rawLandmarks, timestamp, filterOptions: newFilterOptions, fingerFlexionSettings: newFlexionSettings, landmarkFilteringEnabled: newLandmarkFilteringEnabled } = frameData.data;
    
    // Update settings if provided
    if (newFilterOptions) {
      mpUpdateFilterSettings(newFilterOptions);
    }
    
    // Update flexion settings if provided
    if (newFlexionSettings) {
      mpUpdateFlexionSettings(newFlexionSettings);
    }
    
    // Update landmark filtering flag if provided
    if (newLandmarkFilteringEnabled !== undefined) {
      landmarkFilteringEnabled = newLandmarkFilteringEnabled;
    }
    
    const now = timestamp || performance.now();
    
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
  } else {
    // Legacy frame processing mode (raw image data rather than landmarks)
    mpLog('Received raw frame data, not yet implemented');
    mpCtx.postMessage({
      type: 'frame-received'
    });
    
    // End timing overall frame processing
    const totalFrameTime = mpEndTiming('totalFrame');
  }
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
  // Instead of replacing the entire object, update properties individually
  if (settings.enabled !== undefined) {
    fingerFlexionSettings.enabled = settings.enabled;
  }
  
  if (settings.showStateIndicators !== undefined) {
    fingerFlexionSettings.showStateIndicators = settings.showStateIndicators;
  }
  
  if (settings.enabledFingers) {
    fingerFlexionSettings.enabledFingers = {
      ...fingerFlexionSettings.enabledFingers,
      ...settings.enabledFingers
    };
  }
  
  if (settings.thresholds) {
    fingerFlexionSettings.thresholds = {
      ...fingerFlexionSettings.thresholds,
      ...settings.thresholds
    };
  }
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
