/**
 * MediaPipe Hand Tracking Worker
 * 
 * This worker offloads MediaPipe hand tracking processing from the main thread.
 * Handles initialization, processing frames, and sending results back to the main thread.
 */

// Debug logging for the worker
function workerDebugLog(message: string, level: 'log' | 'info' | 'warn' | 'error' = 'log'): void {
  // Use console for debugging in the worker context
  switch (level) {
    case 'info':
      console.info(`[Worker][INFO] ${message}`);
      break;
    case 'warn':
      console.warn(`[Worker][WARN] ${message}`);
      break;
    case 'error':
      console.error(`[Worker][ERROR] ${message}`);
      break;
    default:
      console.log(`[Worker][DEBUG] ${message}`);
  }
  
  // Also post the message to the main thread for debugging
  try {
    self.postMessage({
      type: 'debug',
      level,
      message: `[Worker] ${message}`
    });
  } catch (e) {
    // Ignore - just for debug
  }
}

// Define types for messages from the main thread
interface InitMessage {
  type: 'init';
  config: {
    maxNumHands: number;
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  };
}

interface ProcessFrameMessage {
  type: 'process';
  imageData: ImageData;
  timestamp: number;
}

interface UpdateSettingsMessage {
  type: 'updateSettings';
  settings: any;
}

interface DisposeMessage {
  type: 'dispose';
}

type WorkerInMessage = InitMessage | ProcessFrameMessage | UpdateSettingsMessage | DisposeMessage;

// Define types for messages to the main thread
interface InitResultMessage {
  type: 'init-result';
  success: boolean;
  error?: string;
}

interface ProcessResultMessage {
  type: 'process-result';
  results: any;
  processingTime: number;
  timestamp: number;
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

interface DebugMessage {
  type: 'debug';
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
}

type WorkerOutMessage = InitResultMessage | ProcessResultMessage | ErrorMessage | DebugMessage;

// Make TypeScript happy with the worker context
const ctx: Worker = self as any;

// MediaPipe instances
let hands: any = null;
let initialized = false;
let processing = false;
let loadingPromise: Promise<void> | null = null;

// Performance metrics
let lastFrameTime = 0;

// Handle messages from the main thread
ctx.addEventListener('message', async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'init':
        await initializeMediaPipe(msg.config);
        break;
      
      case 'process':
        if (!initialized) {
          throw new Error('MediaPipe not initialized');
        }
        await processFrame(msg.imageData, msg.timestamp);
        break;
      
      case 'updateSettings':
        if (!initialized) {
          throw new Error('MediaPipe not initialized');
        }
        updateSettings(msg.settings);
        break;
      
      case 'dispose':
        disposeMediaPipe();
        break;
    }
  } catch (error: any) {
    ctx.postMessage({
      type: 'error',
      error: error.message || 'Unknown error in MediaPipe worker'
    } as ErrorMessage);
  }
});

/**
 * Initialize MediaPipe Hands
 */
async function initializeMediaPipe(config: InitMessage['config']): Promise<void> {
  if (initialized) {
    workerDebugLog('MediaPipe already initialized, skipping', 'info');
    return;
  }

  if (loadingPromise) {
    workerDebugLog('MediaPipe initialization in progress, waiting', 'info');
    try {
      await loadingPromise;
      workerDebugLog('Existing initialization completed', 'info');
      return;
    } catch (error) {
      workerDebugLog(`Existing initialization failed, retrying: ${error}`, 'error');
      loadingPromise = null;
    }
  }
  
  workerDebugLog('Starting MediaPipe initialization', 'info');

  loadingPromise = (async () => {
    try {
      try {
        // We'll use importScripts to load MediaPipe directly from CDN
        // This is more reliable in a worker context than using ES modules
        workerDebugLog('Loading MediaPipe Hands from CDN', 'info');
        
        // Load from CDN with a specific version we know works
        const cdnBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915';
        
        // Dynamic import doesn't work in module worker, so we'll directly create the Hands class
        // First load the MediaPipe script from CDN
        workerDebugLog('Fetching MediaPipe script', 'info');
        const response = await fetch(`${cdnBase}/hands.js`);
        if (!response.ok) {
          throw new Error(`Failed to fetch MediaPipe script: ${response.status} ${response.statusText}`);
        }
        
        const scriptText = await response.text();
        workerDebugLog('MediaPipe script fetched successfully', 'info');
        
        // Create a blob URL from the script
        const blob = new Blob([scriptText], {type: 'application/javascript'});
        const scriptUrl = URL.createObjectURL(blob);
        
        // Load the script using importScripts (supported in Web Workers)
        workerDebugLog('Loading MediaPipe script using importScripts', 'info');
        try {
          // @ts-ignore - importScripts is available in worker scope
          importScripts(scriptUrl);
          workerDebugLog('MediaPipe script loaded successfully', 'info');
        } catch (err) {
          workerDebugLog(`Error loading script: ${err}`, 'error');
          throw err;
        }
        
        // Now we can create the Hands instance
        workerDebugLog('Creating MediaPipe Hands instance', 'info');
        
        // @ts-ignore - Hands will be available globally after importScripts
        hands = new Hands({
          locateFile: (file: string) => {
            workerDebugLog(`Requesting file from CDN: ${file}`, 'info');
            return `${cdnBase}/${file}`;
          }
        });
        
        workerDebugLog('MediaPipe Hands instance created successfully', 'info');
      } catch (error) {
        workerDebugLog(`Error loading MediaPipe Hands: ${error}`, 'error');
        console.error('[Worker] Error loading MediaPipe Hands:', error);
        throw error;
      }
      
      // Configure Hands
      hands.setOptions({
        selfieMode: false,
        maxNumHands: config.maxNumHands || 2,
        modelComplexity: config.modelComplexity || 1,
        minDetectionConfidence: config.minDetectionConfidence || 0.5,
        minTrackingConfidence: config.minTrackingConfidence || 0.5
      });
      
      // Setup result handler
      hands.onResults((results: any) => {
        if (!processing) return;
        
        const now = performance.now();
        const processingTime = now - lastFrameTime;
        
        // Post results to main thread
        ctx.postMessage({
          type: 'process-result',
          results,
          processingTime,
          timestamp: now
        } as ProcessResultMessage);
        
        processing = false;
      });
      
      initialized = true;
      
      // Let main thread know initialization was successful
      ctx.postMessage({
        type: 'init-result',
        success: true
      } as InitResultMessage);
    } catch (error: any) {
      ctx.postMessage({
        type: 'init-result',
        success: false,
        error: error.message || 'Failed to initialize MediaPipe'
      } as InitResultMessage);
      
      throw error;
    } finally {
      loadingPromise = null;
    }
  })();
  
  await loadingPromise;
}

/**
 * Process a single frame
 */
async function processFrame(imageData: ImageData, timestamp: number): Promise<void> {
  if (processing) {
    return; // Skip if we're still processing the previous frame
  }
  
  if (!initialized || !hands) {
    throw new Error('MediaPipe not initialized');
  }
  
  processing = true;
  lastFrameTime = timestamp;
  
  try {
    // Create a canvas to draw the image data
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    
    // Put image data on canvas
    ctx.putImageData(imageData, 0, 0);
    
    // Process with MediaPipe (results will be handled in the onResults callback)
    await hands.send({image: canvas});
  } catch (error) {
    processing = false;
    console.error('[Worker] Error processing frame:', error);
    throw error;
  }
}

/**
 * Update MediaPipe settings
 */
function updateSettings(settings: any): void {
  if (!hands) return;
  
  if (settings.maxNumHands !== undefined || 
      settings.modelComplexity !== undefined ||
      settings.minDetectionConfidence !== undefined ||
      settings.minTrackingConfidence !== undefined) {
    
    hands.setOptions({
      selfieMode: false,
      ...settings
    });
  }
}

/**
 * Dispose MediaPipe resources
 */
function disposeMediaPipe(): void {
  if (!hands) return;
  
  try {
    hands.close();
    hands = null;
    initialized = false;
  } catch (error) {
    console.error('Error disposing MediaPipe Hands:', error);
  }
}

// Let main thread know the worker has started
ctx.postMessage({ type: 'ready' });