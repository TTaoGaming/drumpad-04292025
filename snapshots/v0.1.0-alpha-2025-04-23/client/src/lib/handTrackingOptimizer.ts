/**
 * Hand Tracking Optimizer
 * 
 * Provides intelligent Region of Interest (ROI) based optimization for hand tracking.
 * Rather than processing the entire frame or skipping frames, this optimizes by:
 * 
 * 1. Creating an adaptive ROI around the last known hand position
 * 2. Predicting hand movement based on velocity
 * 3. Only updating full processing when necessary (based on movement threshold)
 */

import { HandLandmark } from './types';

export interface HandPosition {
  x: number;       // X coordinate in normalized space (0-1)
  y: number;       // Y coordinate in normalized space (0-1)
  timestamp: number; // Timestamp when the position was recorded
}

export interface HandVelocity {
  vx: number;      // X velocity in normalized units per second
  vy: number;      // Y velocity in normalized units per second
}

export interface ROI {
  x: number;       // Top-left X coordinate of ROI in normalized space (0-1)
  y: number;       // Top-left Y coordinate of ROI in normalized space (0-1)
  width: number;   // Width of ROI in normalized space (0-1)
  height: number;  // Height of ROI in normalized space (0-1)
}

export interface OptimizationSettings {
  // Minimum ROI size as percentage of frame (0.1 = 10% of frame width/height)
  minROISize: number;
  
  // Maximum ROI size as percentage of frame (1.0 = entire frame) 
  maxROISize: number;
  
  // How much to expand ROI based on velocity (higher = larger ROI for fast movement)
  velocityMultiplier: number;
  
  // Minimum movement threshold to trigger a full frame update (normalized units)
  movementThreshold: number;
  
  // Maximum time between full frame updates (in ms, 0 = no maximum)
  maxTimeBetweenFullFrames: number;
}

// Default settings tuned for hand tracking
export const DEFAULT_OPTIMIZATION_SETTINGS: OptimizationSettings = {
  minROISize: 0.2,            // 20% of frame minimum
  maxROISize: 0.5,            // 50% of frame maximum 
  velocityMultiplier: 0.5,    // Expand ROI by 0.5x the velocity
  movementThreshold: 0.03,    // Update when hand moves 3% of frame size
  maxTimeBetweenFullFrames: 500 // Full frame update at least every 500ms
};

export class HandTrackingOptimizer {
  private settings: OptimizationSettings;
  private lastPosition: HandPosition | null = null;
  private lastFullFrameTime: number = 0;
  private velocity: HandVelocity = { vx: 0, vy: 0 };
  private predictedPosition: HandPosition | null = null;
  private currentROI: ROI | null = null;
  
  constructor(settings?: Partial<OptimizationSettings>) {
    this.settings = { ...DEFAULT_OPTIMIZATION_SETTINGS, ...settings };
  }
  
  /**
   * Update the optimizer with new hand landmark data
   * @param landmarks Array of hand landmarks from hand tracking
   * @returns True if a full frame update should be performed, false otherwise
   */
  public update(landmarks: HandLandmark[] | null): boolean {
    const now = performance.now();
    
    // If no landmarks, keep using last position but eventually do full frame updates
    if (!landmarks || landmarks.length === 0) {
      // If we've gone too long without a full frame update, do one now
      if (now - this.lastFullFrameTime > this.settings.maxTimeBetweenFullFrames) {
        this.lastFullFrameTime = now;
        return true;
      }
      return false;
    }
    
    // Calculate hand centroid as average of all landmark positions
    const centroid = this.calculateCentroid(landmarks);
    
    // Create current position from centroid
    const currentPosition: HandPosition = {
      x: centroid.x,
      y: centroid.y,
      timestamp: now
    };
    
    // If this is the first position, initialize and do a full frame update
    if (!this.lastPosition) {
      this.lastPosition = currentPosition;
      this.lastFullFrameTime = now;
      this.updateROI(currentPosition);
      return true;
    }
    
    // Calculate time delta in seconds
    const dt = (now - this.lastPosition.timestamp) / 1000;
    
    // Update velocity (with simple smoothing)
    if (dt > 0) {
      // Calculate instantaneous velocity
      const instVx = (currentPosition.x - this.lastPosition.x) / dt;
      const instVy = (currentPosition.y - this.lastPosition.y) / dt; 
      
      // Apply simple exponential smoothing (alpha = 0.3)
      this.velocity.vx = 0.3 * instVx + 0.7 * this.velocity.vx;
      this.velocity.vy = 0.3 * instVy + 0.7 * this.velocity.vy;
    }
    
    // Calculate distance moved since last update (in normalized units)
    const distance = Math.sqrt(
      Math.pow(currentPosition.x - this.lastPosition.x, 2) +
      Math.pow(currentPosition.y - this.lastPosition.y, 2)
    );
    
    // Check if we should do a full frame update
    let shouldDoFullFrameUpdate = false;
    
    // If we've moved beyond threshold, update
    if (distance > this.settings.movementThreshold) {
      shouldDoFullFrameUpdate = true;
    }
    
    // If we've gone too long without a full frame update, do one now
    if (now - this.lastFullFrameTime > this.settings.maxTimeBetweenFullFrames) {
      shouldDoFullFrameUpdate = true;
    }
    
    // Update last position and perform ROI calculation
    this.lastPosition = currentPosition;
    
    // Update prediction and ROI
    this.predictNextPosition(dt);
    this.updateROI(shouldDoFullFrameUpdate ? currentPosition : this.predictedPosition!);
    
    // If doing full update, update the timestamp
    if (shouldDoFullFrameUpdate) {
      this.lastFullFrameTime = now;
    }
    
    return shouldDoFullFrameUpdate;
  }
  
  /**
   * Get the current Region of Interest
   * @returns The current ROI or null if not yet calculated
   */
  public getROI(): ROI | null {
    return this.currentROI;
  }
  
  /**
   * Get the velocity of the hand
   * @returns Object containing x and y velocity components
   */
  public getVelocity(): HandVelocity {
    return { ...this.velocity };
  }
  
  /**
   * Get the last known hand position
   * @returns The last position or null if not yet established
   */
  public getLastPosition(): HandPosition | null {
    return this.lastPosition ? { ...this.lastPosition } : null;
  }
  
  /**
   * Update optimizer settings
   * @param settings New settings to apply (partial)
   */
  public updateSettings(settings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
  
  /**
   * Reset the optimizer state
   */
  public reset(): void {
    this.lastPosition = null;
    this.lastFullFrameTime = 0;
    this.velocity = { vx: 0, vy: 0 };
    this.predictedPosition = null;
    this.currentROI = null;
  }
  
  /**
   * Calculate the centroid (average position) of hand landmarks
   * @param landmarks Array of hand landmarks from hand tracking
   * @returns The average x,y position
   */
  private calculateCentroid(landmarks: HandLandmark[]): { x: number, y: number } {
    let sumX = 0, sumY = 0;
    
    for (const landmark of landmarks) {
      sumX += landmark.x;
      sumY += landmark.y;
    }
    
    return {
      x: sumX / landmarks.length,
      y: sumY / landmarks.length
    };
  }
  
  /**
   * Predict the next position of the hand based on current velocity
   * @param dt Time step for prediction (in seconds)
   */
  private predictNextPosition(dt: number): void {
    if (!this.lastPosition) return;
    
    // Simple linear prediction
    this.predictedPosition = {
      x: this.lastPosition.x + this.velocity.vx * dt,
      y: this.lastPosition.y + this.velocity.vy * dt,
      timestamp: this.lastPosition.timestamp + dt * 1000
    };
    
    // Clamp to [0,1] range
    this.predictedPosition.x = Math.max(0, Math.min(1, this.predictedPosition.x));
    this.predictedPosition.y = Math.max(0, Math.min(1, this.predictedPosition.y));
  }
  
  /**
   * Update the Region of Interest based on position and velocity
   * @param position Position to center the ROI around
   */
  private updateROI(position: HandPosition): void {
    if (!position) return;
    
    // Calculate speed (magnitude of velocity)
    const speed = Math.sqrt(this.velocity.vx * this.velocity.vx + this.velocity.vy * this.velocity.vy);
    
    // Base ROI size is minimum + extra based on speed
    let roiSize = this.settings.minROISize + 
                  Math.min(speed * this.settings.velocityMultiplier,
                          this.settings.maxROISize - this.settings.minROISize);
    
    // Cap at maximum size
    roiSize = Math.min(roiSize, this.settings.maxROISize);
    
    // Calculate ROI with position at center
    let x = position.x - roiSize / 2;
    let y = position.y - roiSize / 2;
    
    // Make sure ROI stays within frame bounds (0-1 normalized space)
    x = Math.max(0, Math.min(1 - roiSize, x));
    y = Math.max(0, Math.min(1 - roiSize, y));
    
    // Set the ROI
    this.currentROI = {
      x,
      y,
      width: roiSize,
      height: roiSize
    };
  }
  
  /**
   * Convert normalized ROI to pixel coordinates
   * @param width Frame width in pixels
   * @param height Frame height in pixels
   * @returns ROI in pixel coordinates or null if no ROI exists
   */
  public getROIInPixels(width: number, height: number): {
    x: number, y: number, width: number, height: number
  } | null {
    if (!this.currentROI) return null;
    
    return {
      x: Math.floor(this.currentROI.x * width),
      y: Math.floor(this.currentROI.y * height),
      width: Math.ceil(this.currentROI.width * width),
      height: Math.ceil(this.currentROI.height * height)
    };
  }
}