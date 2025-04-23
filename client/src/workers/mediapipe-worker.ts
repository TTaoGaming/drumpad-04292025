/**
 * MediaPipe Hand Tracking Worker
 * 
 * This worker offloads MediaPipe hand tracking processing from the main thread.
 * Handles initialization, processing frames, and sending results back to the main thread.
 */

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

type WorkerOutMessage = InitResultMessage | ProcessResultMessage | ErrorMessage;

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
    return;
  }

  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    try {
      // Import MediaPipe libraries
      const mpHands = await import('@mediapipe/hands');
      
      // Initialize MediaPipe Hands with CDN - using version we know works
      hands = new mpHands.Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
        }
      });
      
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
  
  processing = true;
  lastFrameTime = timestamp;
  
  // Create a canvas to draw the image data
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    processing = false;
    throw new Error('Could not get 2D context from canvas');
  }
  
  // Put image data on canvas
  ctx.putImageData(imageData, 0, 0);
  
  // Process with MediaPipe (results will be handled in the onResults callback)
  await hands.send({image: canvas});
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