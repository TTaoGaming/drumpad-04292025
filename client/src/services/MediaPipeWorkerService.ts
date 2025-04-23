/**
 * MediaPipe Worker Service
 * 
 * This service manages communication with the MediaPipe web worker,
 * abstracting the worker messaging protocol and providing a clean interface
 * for the main thread.
 */

// Import worker as a module
import MediaPipeWorker from '@/workers/mediapipe-worker.ts?worker';
import { EventType, dispatch } from '@/lib/eventBus';

export interface HandLandmarks {
  x: number;
  y: number;
  z: number;
}

export interface MediaPipeResults {
  multiHandLandmarks?: HandLandmarks[][];
  multiHandedness?: any[];
  image?: ImageBitmap | null;
}

export interface MediaPipeSettings {
  maxNumHands?: number;
  modelComplexity?: number;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

export type ResultCallback = (results: MediaPipeResults, processingTime: number) => void;

class MediaPipeWorkerService {
  private worker: Worker | null = null;
  private initialized: boolean = false;
  private initializing: boolean = false;
  private resultCallback: ResultCallback | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private frameLimiter: number = 0;
  private frameCount: number = 0;
  
  private animationFrame: number | null = null;
  
  constructor() {
    // Worker is created in init() to allow for cleanup and re-creation
  }
  
  /**
   * Initialize the MediaPipe worker
   * @param callback Function to call when results are received
   * @param settings Initial settings for MediaPipe
   * @returns Promise that resolves when initialization is complete
   */
  public async init(
    callback: ResultCallback,
    settings: MediaPipeSettings = {}
  ): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    if (this.initializing) {
      return new Promise<boolean>((resolve) => {
        // Check until initialized or 5 seconds pass
        let attempts = 0;
        const checkInterval = setInterval(() => {
          if (this.initialized) {
            clearInterval(checkInterval);
            resolve(true);
          } else if (attempts > 50) { // 5 seconds (100ms * 50)
            clearInterval(checkInterval);
            resolve(false);
          }
          attempts++;
        }, 100);
      });
    }
    
    this.initializing = true;
    this.resultCallback = callback;
    
    // Create canvas for getting image data
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    try {
      // Create the worker
      this.worker = new MediaPipeWorker();
      
      // Setup message handlers
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      // Wait for the worker to be ready before sending init message
      await new Promise<void>((resolve) => {
        const readyHandler = (event: MessageEvent) => {
          if (event.data.type === 'ready') {
            this.worker?.removeEventListener('message', readyHandler);
            resolve();
          }
        };
        
        this.worker?.addEventListener('message', readyHandler);
      });
      
      // Initialize with settings
      const initResult = await this.sendMessage({
        type: 'init',
        config: {
          maxNumHands: settings.maxNumHands || 2,
          modelComplexity: settings.modelComplexity || 1,
          minDetectionConfidence: settings.minDetectionConfidence || 0.5,
          minTrackingConfidence: settings.minTrackingConfidence || 0.5
        }
      });
      
      if (initResult && initResult.success) {
        this.initialized = true;
        this.initializing = false;
        
        dispatch(EventType.LOG, {
          message: 'MediaPipe worker initialized successfully',
          type: 'success'
        });
        
        return true;
      } else {
        throw new Error(initResult ? initResult.error : 'Failed to initialize MediaPipe worker');
      }
    } catch (error: any) {
      this.initializing = false;
      
      dispatch(EventType.LOG, {
        message: `MediaPipe worker initialization failed: ${error.message || error}`,
        type: 'error'
      });
      
      return false;
    }
  }
  
  /**
   * Start processing frames from a video element
   * @param videoElement The video element to capture frames from
   * @param frameLimiter Process every Nth frame (1 = every frame)
   */
  public startProcessing(videoElement: HTMLVideoElement, frameLimiter: number = 1): void {
    if (!this.initialized || !this.worker) {
      console.warn('MediaPipe worker not initialized, cannot start processing');
      return;
    }
    
    this.videoElement = videoElement;
    this.frameLimiter = frameLimiter;
    this.frameCount = 0;
    
    // Start requestAnimationFrame loop
    this.processNextFrame();
  }
  
  /**
   * Stop processing frames
   */
  public stopProcessing(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
  
  /**
   * Update MediaPipe settings
   * @param settings New settings to apply
   */
  public updateSettings(settings: MediaPipeSettings): void {
    if (!this.initialized || !this.worker) {
      return;
    }
    
    this.worker.postMessage({
      type: 'updateSettings',
      settings
    });
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopProcessing();
    
    if (this.worker) {
      this.worker.postMessage({ type: 'dispose' });
      this.worker.terminate();
      this.worker = null;
    }
    
    this.initialized = false;
    this.initializing = false;
    this.resultCallback = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
  }
  
  /**
   * Process video frames in a requestAnimationFrame loop
   */
  private processNextFrame(): void {
    this.animationFrame = requestAnimationFrame(() => {
      this.frameCount++;
      
      // Process frame if frameCount matches limiter
      if (this.frameCount >= this.frameLimiter) {
        this.frameCount = 0;
        this.processCurrentFrame();
      }
      
      // Continue loop
      this.processNextFrame();
    });
  }
  
  /**
   * Process the current video frame
   */
  private processCurrentFrame(): void {
    if (!this.videoElement || !this.canvas || !this.ctx || !this.worker) {
      return;
    }
    
    // Skip if video isn't playing or ready
    if (this.videoElement.paused || this.videoElement.readyState < 2) {
      return;
    }
    
    // Resize canvas to match video dimensions if needed
    const { videoWidth, videoHeight } = this.videoElement;
    if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
    }
    
    // Draw current frame to canvas
    this.ctx.drawImage(this.videoElement, 0, 0);
    
    // Get image data from canvas
    const imageData = this.ctx.getImageData(0, 0, videoWidth, videoHeight);
    
    // Send to worker for processing
    this.worker.postMessage({
      type: 'process',
      imageData,
      timestamp: performance.now()
    }, [imageData.data.buffer]); // Transfer buffer for better performance
  }
  
  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const message = event.data;
    
    switch (message.type) {
      case 'init-result':
        // Initialization result is handled by the init method
        break;
        
      case 'process-result':
        if (this.resultCallback) {
          // Call the callback with the results
          this.resultCallback(message.results, message.processingTime);
        }
        break;
        
      case 'error':
        console.error('MediaPipe worker error:', message.error);
        dispatch(EventType.LOG, {
          message: `MediaPipe worker error: ${message.error}`,
          type: 'error'
        });
        break;
    }
  }
  
  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('MediaPipe worker error:', error);
    dispatch(EventType.LOG, {
      message: `MediaPipe worker error: ${error.message}`,
      type: 'error'
    });
  }
  
  /**
   * Send a message to the worker and wait for a response
   */
  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }
      
      const messageType = message.type;
      const responseType = `${messageType}-result`;
      
      const handleResponse = (event: MessageEvent) => {
        if (event.data.type === responseType) {
          this.worker?.removeEventListener('message', handleResponse);
          resolve(event.data);
        } else if (event.data.type === 'error') {
          this.worker?.removeEventListener('message', handleResponse);
          reject(new Error(event.data.error));
        }
      };
      
      this.worker.addEventListener('message', handleResponse);
      this.worker.postMessage(message);
      
      // Set timeout to prevent hanging on no response
      setTimeout(() => {
        this.worker?.removeEventListener('message', handleResponse);
        reject(new Error(`Timeout waiting for response to ${messageType}`));
      }, 30000); // 30 second timeout
    });
  }
}

// Export singleton instance
export const mediaPipeWorkerService = new MediaPipeWorkerService();
export default mediaPipeWorkerService;