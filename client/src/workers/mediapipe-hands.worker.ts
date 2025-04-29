/**
 * Web Worker for MediaPipe Hands processing
 * This worker handles the heavy WebAssembly operations of MediaPipe
 */

// Use self as the worker context
const ctx: Worker = self as any;

// Flag to track initialization status
let isInitialized = false;
let handsModule: any = null;

// Performance tracking
const startTime = performance.now();
let lastFrameTime = 0;
const performanceData: {[key: string]: number} = {};

// Log message to main thread
function log(message: string, level: 'info' | 'error' | 'debug' = 'info'): void {
  ctx.postMessage({
    type: 'log',
    message,
    level
  });
}

// Update status to main thread
function updateStatus(status: string, ready = false): void {
  ctx.postMessage({
    type: 'status',
    status,
    ready
  });
}

// Track timing for operations
function startTiming(operation: string): void {
  performanceData[`${operation}_start`] = performance.now();
}

function endTiming(operation: string): number {
  const end = performance.now();
  const start = performanceData[`${operation}_start`] || end;
  const duration = end - start;
  performanceData[operation] = duration;
  return duration;
}

// Get all performance metrics
function getPerformanceMetrics(): {[key: string]: number} {
  const now = performance.now();
  const metrics = {...performanceData};
  
  // Calculate frame rate
  if (lastFrameTime > 0) {
    metrics.timeBetweenFrames = now - lastFrameTime;
    metrics.fps = 1000 / metrics.timeBetweenFrames;
  }
  lastFrameTime = now;
  
  // Add worker lifetime
  metrics.workerUptime = now - startTime;
  
  return metrics;
}

// Initialize the MediaPipe Hands detector
async function initializeMediaPipe(): Promise<void> {
  try {
    startTiming('init');
    log('Initializing MediaPipe Hands in worker');

    // We need to load the scripts directly in the worker
    // Note: This method depends on your build setup, might need adjustments
    importScripts(
      'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
    );
    
    log('MediaPipe Hands script loaded');
    
    // Create hands object
    // @ts-ignore - We're using the global Hands from the imported script
    handsModule = new self.Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    // Configure with default settings
    handsModule.setOptions({
      selfieMode: false,
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    // Set up results handler
    handsModule.onResults((results: any) => {
      // Process results and send back to main thread
      handleResults(results);
    });

    log('MediaPipe Hands initialized successfully');
    isInitialized = true;
    endTiming('init');
    updateStatus('ready', true);
  } catch (error) {
    log(`Error initializing MediaPipe Hands: ${error}`, 'error');
    updateStatus('error', false);
  }
}

// Process results from MediaPipe
function handleResults(results: any): void {
  startTiming('processResults');
  
  // Extract the hand landmarks
  const handLandmarks = results.multiHandLandmarks || [];
  
  // Process and optimize the data before sending back
  const processedData = {
    landmarks: handLandmarks,
    handedness: results.multiHandedness || [],
    // Include any additional data needed for visualization
  };
  
  endTiming('processResults');
  
  // Send the processed results back to the main thread
  ctx.postMessage({
    type: 'results',
    data: processedData,
    performance: getPerformanceMetrics()
  });
}

// Process an image frame using MediaPipe
async function processFrame(imageData: ImageData | ImageBitmap): Promise<void> {
  if (!isInitialized || !handsModule) {
    log('MediaPipe not initialized yet, skipping frame');
    return;
  }
  
  try {
    startTiming('frameProcessing');
    
    // Convert ImageData to HTML Image element or Canvas
    // This depends on what MediaPipe Hands accepts in worker context
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      if (imageData instanceof ImageData) {
        ctx.putImageData(imageData, 0, 0);
      } else {
        ctx.drawImage(imageData, 0, 0);
      }
      
      // Process the image with MediaPipe Hands
      await handsModule.send({image: canvas});
    }
    
    endTiming('frameProcessing');
  } catch (error) {
    log(`Error processing frame: ${error}`, 'error');
  }
}

// Update MediaPipe settings
function updateSettings(settings: any): void {
  if (!isInitialized || !handsModule) {
    log('Cannot update settings, MediaPipe not initialized');
    return;
  }
  
  try {
    handsModule.setOptions(settings);
    log('MediaPipe settings updated');
  } catch (error) {
    log(`Error updating settings: ${error}`, 'error');
  }
}

// Handle messages from the main thread
ctx.addEventListener('message', async (event) => {
  const {command, data} = event.data;
  
  switch (command) {
    case 'init':
      await initializeMediaPipe();
      break;
      
    case 'process':
      await processFrame(data.frame);
      break;
      
    case 'updateSettings':
      updateSettings(data.settings);
      break;
      
    case 'terminate':
      if (handsModule) {
        try {
          handsModule.close();
        } catch (e) {
          // Ignore errors during shutdown
        }
      }
      break;
      
    default:
      log(`Unknown command: ${command}`, 'error');
  }
});

// Notify that the worker is loaded
ctx.postMessage({
  type: 'loaded',
  message: 'MediaPipe Hands worker loaded'
});