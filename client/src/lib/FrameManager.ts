/**
 * FrameManager.ts
 * 
 * A singleton class that manages video frame capture and distribution.
 * This class ensures that each video frame is captured only once per animation cycle
 * and shared with all components that need it, improving performance by
 * eliminating redundant frame captures.
 */

import { EventType, dispatch } from './eventBus';

// Type for frame subscribers
type FrameSubscriber = {
  id: string;
  callback: (frameData: ImageData) => void;
  priority: number; // Higher priority gets processed first
};

export class FrameManager {
  private static instance: FrameManager;
  private frameData: ImageData | null = null;
  private lastFrameTime: number = 0;
  private frameInterval: number = 0; // 0 means capture every animation frame
  private isCapturing: boolean = false;
  private subscribers: Map<string, FrameSubscriber> = new Map();
  private animationFrameId: number | null = null;
  private processingLock: boolean = false;
  private frameCount: number = 0;
  private logFrequency: number = 300; // Log every 300 frames (about 5 seconds at 60fps)
  private videoElement: HTMLVideoElement | null = null;
  
  // Private constructor for singleton pattern
  private constructor() {
    console.log('[FrameManager] Initialized');
  }
  
  /**
   * Get the singleton instance of FrameManager
   * @returns The FrameManager instance
   */
  public static getInstance(): FrameManager {
    if (!FrameManager.instance) {
      FrameManager.instance = new FrameManager();
    }
    return FrameManager.instance;
  }
  
  /**
   * Set the video element to capture frames from
   * @param element The video element reference
   */
  public setVideoElement(element: HTMLVideoElement | null): void {
    this.videoElement = element;
    if (element) {
      console.log('[FrameManager] Video element set:', element.videoWidth, 'x', element.videoHeight);
    } else {
      console.log('[FrameManager] Video element cleared');
    }
  }
  
  /**
   * Set the frame capture interval
   * @param interval Milliseconds between frame captures (0 means every animation frame)
   */
  public setFrameInterval(interval: number): void {
    this.frameInterval = interval;
    console.log(`[FrameManager] Frame interval set to ${interval}ms`);
  }
  
  /**
   * Start capturing frames
   */
  public startCapturing(): void {
    if (this.isCapturing) return;
    
    this.isCapturing = true;
    this.captureFrame();
    console.log('[FrameManager] Frame capturing started');
    
    // Notify listeners that frame capturing has started
    dispatch(EventType.LOG, {
      message: 'Frame Manager: Capturing started',
      type: 'info'
    });
  }
  
  /**
   * Stop capturing frames
   */
  public stopCapturing(): void {
    this.isCapturing = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    console.log('[FrameManager] Frame capturing stopped');
    
    // Notify listeners that frame capturing has stopped
    dispatch(EventType.LOG, {
      message: 'Frame Manager: Capturing stopped',
      type: 'info'
    });
  }
  
  /**
   * Subscribe to frame updates
   * @param id Unique identifier for the subscriber
   * @param callback Function to call with new frame data
   * @param priority Processing priority (higher value = processed earlier)
   * @returns Unsubscribe function
   */
  public subscribe(
    id: string, 
    callback: (frameData: ImageData) => void,
    priority: number = 0
  ): () => void {
    this.subscribers.set(id, { id, callback, priority });
    console.log(`[FrameManager] New subscriber: ${id} (priority: ${priority})`);
    
    // Sort subscribers by priority only when it changes
    this.sortSubscribers();
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(id);
      console.log(`[FrameManager] Subscriber removed: ${id}`);
    };
  }
  
  /**
   * Sort subscribers by priority
   */
  private sortSubscribers(): void {
    // Convert the map to an array, sort by priority, and create a new map
    const sortedEntries = Array.from(this.subscribers.entries())
      .sort((a, b) => b[1].priority - a[1].priority);
    
    this.subscribers = new Map(sortedEntries);
  }
  
  /**
   * Get the current frame data
   * @returns The current frame data or null if not available
   */
  public getCurrentFrame(): ImageData | null {
    return this.frameData;
  }
  
  /**
   * The main frame capture function
   */
  private captureFrame(): void {
    if (!this.isCapturing) return;
    
    const now = performance.now();
    
    // Only capture a new frame if the interval has passed
    if (now - this.lastFrameTime >= this.frameInterval && !this.processingLock) {
      this.processingLock = true;
      this.frameCount++;
      
      try {
        // Capture new frame
        if (this.videoElement && this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0) {
          const newFrame = this.getVideoFrame(this.videoElement);
          
          if (newFrame) {
            this.frameData = newFrame;
            
            // Log occasionally to avoid console spam
            if (this.frameCount % this.logFrequency === 0) {
              console.log(`[FrameManager] Frame captured: ${newFrame.width}x${newFrame.height} (frame #${this.frameCount})`);
            }
            
            // Notify all subscribers
            this.notifySubscribers();
          }
        }
      } catch (err) {
        console.error('[FrameManager] Error capturing frame:', err);
      } finally {
        this.processingLock = false;
        this.lastFrameTime = now;
      }
    }
    
    // Schedule the next frame capture
    this.animationFrameId = requestAnimationFrame(() => this.captureFrame());
  }
  
  /**
   * Notify all subscribers of a new frame
   */
  private notifySubscribers(): void {
    if (!this.frameData) return;
    
    // Subscribers are already sorted by priority
    for (const subscriber of this.subscribers.values()) {
      try {
        subscriber.callback(this.frameData);
      } catch (err) {
        console.error(`[FrameManager] Error in subscriber ${subscriber.id}:`, err);
      }
    }
  }
  
  /**
   * Get a video frame from the provided element
   * This is the internal implementation that replaces the global getVideoFrame function
   * @param videoElement Video element to capture from
   * @returns ImageData object containing the frame pixels
   */
  private getVideoFrame(videoElement: HTMLVideoElement): ImageData | null {
    if (!videoElement) {
      console.error("[FrameManager] getVideoFrame: No video element provided");
      return null;
    }
    
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      if (this.frameCount % this.logFrequency === 0) {
        console.warn("[FrameManager] getVideoFrame: Video dimensions not available yet", {
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight,
          readyState: videoElement.readyState
        });
      }
      return null;
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error("[FrameManager] getVideoFrame: Could not get 2D context from canvas");
      return null;
    }
    
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    // Attempt to draw the current frame
    try {
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imageData;
    } catch (error) {
      console.error("[FrameManager] getVideoFrame: Error capturing frame", error);
      return null;
    }
  }
}

// Convenient export of the singleton instance getter
export const getFrameManager = FrameManager.getInstance;

// Export types for components that need them
export type { FrameSubscriber };