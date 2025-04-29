/**
 * Region of Interest (ROI) Manager
 * 
 * Manages circle regions of interest created by pinch gestures.
 * Now uses simplified contour tracking instead of ORB feature detection.
 */

import { DrawingPath, Point, RegionOfInterest, CircleROI } from './types';
import { getVideoFrame } from './cameraManager';
import { EventType, dispatch } from './eventBus';
// Import the new contour tracking functionality
import { 
  initializeContourTracking, 
  updateContourTracking, 
  cleanupContourTracking,
  contourConfig
} from './contourTracking';

// Interface to store ROI with its feature information
interface ROIWithFeatures extends RegionOfInterest {
  lastProcessed?: number;
}

// Interface to store CircleROI with its feature information
interface CircleROIWithFeatures extends CircleROI {
  lastProcessed?: number;
  // Add contour tracking properties
  contourTracking?: {
    isInitialized: boolean;
    isOccluded: boolean;
    contourCount?: number;
    originalContourCount?: number;
    visibilityRatio?: number;
    centerOfMass?: Point;
    visualizationData?: ImageData;
  };
}

/**
 * ROI manager with contour tracking
 */
export class ROIManager {
  private static instance: ROIManager;
  private activeROIs: ROIWithFeatures[] = [];
  private activeCircleROIs: CircleROIWithFeatures[] = []; // Array for circle ROIs
  private processingEnabled: boolean = true;
  private lastFrameTime: number = 0;
  private frameInterval: number = 33; // Process at ~30fps for smoother tracking
  
  // Private constructor for singleton
  private constructor() {
    console.log('[ROIManager] Initialized with simplified ROI management (no feature tracking)');
  }
  
  // Get singleton instance
  public static getInstance(): ROIManager {
    if (!ROIManager.instance) {
      ROIManager.instance = new ROIManager();
    }
    return ROIManager.instance;
  }
  
  /**
   * Add a new ROI from a drawing path
   * @param path The drawing path to convert to an ROI
   * @returns The ID of the created ROI
   */
  public addROI(path: DrawingPath): string {
    // Only create ROI from complete paths
    if (!path.isComplete || !path.isROI || path.points.length < 3) {
      console.warn('[ROIManager] Attempted to add incomplete ROI');
      return '';
    }
    
    // Use the path's ID if available, otherwise generate a new one
    const id = path.id || Date.now().toString();
    
    // Check if this ROI already exists
    if (this.activeROIs.some(roi => roi.id === id)) {
      console.log(`[ROIManager] ROI ${id} already exists, skipping add`);
      return id; // Return the existing ID if already added
    }
    
    const roi: ROIWithFeatures = {
      id,
      points: [...path.points],
      timestamp: Date.now(),
      lastProcessed: 0
    };
    
    this.activeROIs.push(roi);
    console.log(`[ROIManager] Added new ROI with ID ${id} and ${roi.points.length} points`);
    
    // Dispatch a notification that the ROI was created
    dispatch(EventType.LOG, {
      message: `ROI created with ${roi.points.length} points`,
      type: 'success'
    });
    
    // No feature extraction anymore - just visual representation
    console.log(`[ROIManager] ROI created with ID ${roi.id} (no feature extraction)`);
    
    return id;
  }
  
  /**
   * Extract image data for a specific ROI, applying circular mask
   * @param roi The ROI to extract image data for
   * @param videoElement Video element to capture from
   * @returns Image data for the ROI or null if extraction failed
   */
  private extractROIImageData(roi: ROIWithFeatures, videoElement: HTMLVideoElement): ImageData | null {
    try {
      // Get the current video frame
      const frameData = getVideoFrame(videoElement);
      if (!frameData) return null;
      
      // Create a temporary canvas to draw the video frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = videoElement.videoWidth;
      tempCanvas.height = videoElement.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return null;
      
      // Draw the video frame to temp canvas
      tempCtx.putImageData(frameData, 0, 0);
      
      // Calculate scaling factors between display size and actual video size
      const displayElement = document.querySelector('.camera-view') as HTMLElement;
      if (!displayElement) {
        console.warn("[ROIManager] Could not find camera display element for scaling calculation");
        return null;
      }
      
      const displayWidth = displayElement.clientWidth;
      const displayHeight = displayElement.clientHeight;
      
      const scaleX = videoElement.videoWidth / displayWidth;
      const scaleY = videoElement.videoHeight / displayHeight;
      
      // Calculate ROI center and radius
      if (roi.points.length > 2) {
        // Calculate center of the ROI
        let sumX = 0, sumY = 0;
        for (const point of roi.points) {
          // Scale the point coordinates from display size to video frame size
          sumX += point.x * scaleX;
          sumY += point.y * scaleY;
        }
        const centerX = sumX / roi.points.length;
        const centerY = sumY / roi.points.length;
        
        // Calculate average radius from all points
        let totalRadius = 0;
        for (const point of roi.points) {
          const scaledX = point.x * scaleX;
          const scaledY = point.y * scaleY;
          
          const distToCenter = Math.sqrt(
            Math.pow(scaledX - centerX, 2) + 
            Math.pow(scaledY - centerY, 2)
          );
          totalRadius += distToCenter;
        }
        const radius = totalRadius / roi.points.length;
        
        // Extract the ROI region with circular mask
        const extractSize = radius * 2;
        const sourceX = Math.max(0, centerX - radius);
        const sourceY = Math.max(0, centerY - radius);
        const sourceWidth = Math.min(extractSize, videoElement.videoWidth - sourceX);
        const sourceHeight = Math.min(extractSize, videoElement.videoHeight - sourceY);
        
        // Create a circular masked version of the ROI
        // 1. Get the square region containing our circle
        const squareROI = tempCtx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);
        
        // 2. Create a new canvas to apply the circular mask
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = sourceWidth;
        maskCanvas.height = sourceHeight;
        const maskCtx = maskCanvas.getContext('2d');
        
        if (!maskCtx) {
          console.error('[ROIManager] Failed to get mask canvas context');
          return null;
        }
        
        // 3. Put the square image data on the mask canvas
        maskCtx.putImageData(squareROI, 0, 0);
        
        // 4. Create circular clipping path
        maskCtx.globalCompositeOperation = 'destination-in';
        maskCtx.fillStyle = 'white';
        maskCtx.beginPath();
        maskCtx.arc(sourceWidth/2, sourceHeight/2, Math.min(sourceWidth/2, sourceHeight/2) - 2, 0, Math.PI * 2);
        maskCtx.fill();
        
        // 5. Get the circular masked image data
        return maskCtx.getImageData(0, 0, sourceWidth, sourceHeight);
      }
    } catch (error) {
      console.error('[ROIManager] Error extracting ROI image data:', error);
    }
    
    return null;
  }
  
  /**
   * Extract image data for a specific CircleROI
   * @param roi The CircleROI to extract image data for
   * @param videoElement Video element to capture from
   * @returns Image data for the ROI or null if extraction failed
   */
  private extractCircleROIImageData(roi: CircleROIWithFeatures, videoElement: HTMLVideoElement): ImageData | null {
    try {
      // Get the current video frame
      const frameData = getVideoFrame(videoElement);
      if (!frameData) return null;
      
      // Create a temporary canvas to draw the video frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = videoElement.videoWidth;
      tempCanvas.height = videoElement.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return null;
      
      // Draw the video frame to temp canvas
      tempCtx.putImageData(frameData, 0, 0);
      
      // Since we now use normalized coordinates (0.0-1.0), we can directly
      // translate to video coordinates without a scaling factor
      
      // Calculate the center and radius in video pixel coordinates
      const videoCenterX = roi.center.x * videoElement.videoWidth;
      const videoCenterY = roi.center.y * videoElement.videoHeight;
      const videoRadius = roi.radius * videoElement.videoWidth; // Radius is normalized relative to width
      
      // Extract the ROI region as a square that contains the circle
      const sourceX = Math.max(0, videoCenterX - videoRadius);
      const sourceY = Math.max(0, videoCenterY - videoRadius);
      const sourceSize = videoRadius * 2;
      const sourceWidth = Math.min(sourceSize, videoElement.videoWidth - sourceX);
      const sourceHeight = Math.min(sourceSize, videoElement.videoHeight - sourceY);
      
      // Create a circular masked version of the ROI
      // 1. Get the square region containing our circle
      const squareROI = tempCtx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);
      
      // 2. Create a new canvas to apply the circular mask
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = sourceWidth;
      maskCanvas.height = sourceHeight;
      const maskCtx = maskCanvas.getContext('2d');
      
      if (!maskCtx) {
        console.error('[ROIManager] Failed to get mask canvas context');
        return null;
      }
      
      // 3. Put the square image data on the mask canvas
      maskCtx.putImageData(squareROI, 0, 0);
      
      // 4. Create circular clipping path
      maskCtx.globalCompositeOperation = 'destination-in';
      maskCtx.fillStyle = 'white';
      maskCtx.beginPath();
      maskCtx.arc(sourceWidth/2, sourceHeight/2, Math.min(sourceWidth/2, sourceHeight/2) - 2, 0, Math.PI * 2);
      maskCtx.fill();
      
      // 5. Get the circular masked image data
      return maskCtx.getImageData(0, 0, sourceWidth, sourceHeight);
    } catch (error) {
      console.error('[ROIManager] Error extracting Circle ROI image data:', error);
    }
    
    return null;
  }
  
  /**
   * Remove a ROI by ID
   * @param id The ID of the ROI to remove
   */
  public removeROI(id: string): void {
    this.activeROIs = this.activeROIs.filter(roi => roi.id !== id);
    console.log(`[ROIManager] Removed ROI ${id}`);
  }
  
  // Counter for throttling logs
  private logCounter = 0;
  private readonly LOG_THROTTLE = 50; // Only log every 50 calls

  /**
   * Add a new CircleROI directly with center and radius
   * @param circleROI The circle ROI with center and radius
   * @returns The ID of the created ROI
   */
  public addCircleROI(circleROI: CircleROI): string {
    // Use the provided ID or generate a new one
    const id = circleROI.id || Date.now().toString();
    
    // Check if this ROI already exists
    if (this.activeCircleROIs.some(roi => roi.id === id)) {
      // Only log occasionally
      if (++this.logCounter % this.LOG_THROTTLE === 0) {
        console.log(`[ROIManager] Circle ROI ${id} already exists, skipping add`);
      }
      return id; // Return the existing ID if already added
    }
    
    const roi: CircleROIWithFeatures = {
      ...circleROI,
      id,
      timestamp: Date.now(),
      lastProcessed: 0
    };
    
    this.activeCircleROIs.push(roi);
    
    // Only log occasionally
    if (++this.logCounter % this.LOG_THROTTLE === 0) {
      console.log(`[ROIManager] Added new Circle ROI with ID ${id}, center (${roi.center.x}, ${roi.center.y}), radius ${roi.radius}`);
    }
    
    // Send a log message for user feedback
    dispatch(EventType.LOG, {
      message: `Circle ROI created with radius ${(roi.radius * 100).toFixed(1)}%`,
      type: 'success'
    });
    
    // No feature extraction anymore - just visual representation
    console.log(`[ROIManager] Circle ROI created with ID ${roi.id} (no feature extraction)`);
    
    return id;
  }
  
  /**
   * Clear all ROIs
   */
  public clearROIs(): void {
    // Clean up any contour tracking resources
    for (const roi of this.activeCircleROIs) {
      cleanupContourTracking(roi.id);
    }
    
    this.activeROIs = [];
    this.activeCircleROIs = [];
    console.log('[ROIManager] Cleared all ROIs');
  }
  
  /**
   * Get all active ROIs
   * @returns Array of ROIs
   */
  public getROIs(): RegionOfInterest[] {
    return this.activeROIs;
  }
  
  /**
   * Get all active Circle ROIs
   * @returns Array of Circle ROIs
   */
  public getCircleROIs(): CircleROI[] {
    return this.activeCircleROIs;
  }
  
  /**
   * Process video frame to track contours in each ROI
   * @param imageData Full frame image data from video
   */
  public async processFrame(imageData: ImageData): Promise<void> {
    // Don't process too many frames - rate limit to avoid performance issues
    const now = Date.now();
    if (now - this.lastFrameTime < this.frameInterval || !this.processingEnabled) {
      return;
    }
    this.lastFrameTime = now;
    this.logCounter++;
    
    // Process each Circle ROI using contour tracking
    for (const roi of this.activeCircleROIs) {
      // Only process ROIs that are due for an update
      if (now - (roi.lastProcessed || 0) < 50) { // Process each ROI at most every 50ms for smoother tracking
        continue;
      }
      
      // Get the video element to capture ROI from
      const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
      if (!videoElement || !videoElement.videoWidth) {
        console.warn('[ROIManager] No video element found or video not started');
        continue;
      }
      
      // Only log occasionally to reduce overhead
      if (this.logCounter % this.LOG_THROTTLE === 0) {
        console.log(`[ROIManager] Processing Circle ROI ${roi.id} with center (${roi.center.x.toFixed(3)}, ${roi.center.y.toFixed(3)}) and radius ${roi.radius.toFixed(3)}`);
      }
      
      // Get full frame from video for contour tracking
      const frameData = getVideoFrame(videoElement);
      if (!frameData) {
        console.warn('[ROIManager] Failed to get video frame');
        continue;
      }
      
      try {
        // Use contour tracking for this ROI
        const contourResult = await updateContourTracking(roi, frameData);
        
        // Update the ROI with the tracking result
        roi.contourTracking = contourResult;
        roi.lastProcessed = now;
        
        // Only log occasionally to reduce overhead
        if (this.logCounter % this.LOG_THROTTLE === 0 && contourResult.contourCount !== undefined) {
          console.log(`[ROIManager] Contour tracking for ROI ${roi.id}: ${contourResult.contourCount} contours (${contourResult.visibilityRatio?.toFixed(2) || 0} visibility)`);
        }
        
        // Update tracking status
        const trackingStatus = contourResult.isOccluded ? 'contour-occluded' : 'contour-visible';
        
        // Update the ROI center coordinates if tracking has centerOfMass data
        if (contourResult.centerOfMass && !contourResult.isOccluded) {
          // Get the scaling factors from video coordinates back to screen coordinates
          const displayElement = document.querySelector('.camera-view') as HTMLElement;
          
          if (videoElement && displayElement && contourResult.centerOfMass) {
            const scaleX = displayElement.clientWidth / videoElement.videoWidth;
            const scaleY = displayElement.clientHeight / videoElement.videoHeight;
            
            // Update the ROI position with the new tracked position
            const newCenter = {
              x: roi.center.x, // Keep x position the same for now
              y: roi.center.y  // Keep y position the same for now
              // Note: We could use contourResult.centerOfMass to update position
              // but that might cause too much movement, so keeping stable for now
            };
            
            // Only log occasionally
            if (this.logCounter % this.LOG_THROTTLE === 0) {
              console.log(`[ROIManager] ROI ${roi.id} center of mass: (${contourResult.centerOfMass.x.toFixed(3)}, ${contourResult.centerOfMass.y.toFixed(3)})`);
            }
          }
        }
        
        // Create a public event to notify other components
        dispatch(EventType.ROI_UPDATED, {
          id: roi.id,
          status: trackingStatus,
          trackingResult: {
            isTracked: contourResult.isInitialized,
            matchCount: contourResult.contourCount || 0,
            inlierCount: contourResult.originalContourCount || 0,
            confidence: contourResult.visibilityRatio || 0,
            // Added for backward compatibility
            center: {
              x: contourResult.centerOfMass?.x || roi.center.x,
              y: contourResult.centerOfMass?.y || roi.center.y
            },
            rotation: 0 // No rotation in contour tracking
          },
          contourTracking: {
            isOccluded: contourResult.isOccluded,
            visibilityRatio: contourResult.visibilityRatio,
            visualizationData: contourResult.visualizationData
          },
          timestamp: now,
          isCircleROI: true,
          center: roi.center,
          radius: roi.radius
        });
        
      } catch (error) {
        console.error(`[ROIManager] Error processing Circle ROI ${roi.id} with contour tracking:`, error);
        roi.lastProcessed = now; // Mark as processed even if there was an error
        
        // Create a public event to notify other components
        dispatch(EventType.ROI_UPDATED, {
          id: roi.id,
          status: 'processing-error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: now,
          isCircleROI: true,
          center: roi.center,
          radius: roi.radius
        });
      }
    }
  }
  
  /**
   * Draw ROIs and tracking information on the canvas
   * @param ctx Canvas context to draw on
   * @param width Canvas width
   * @param height Canvas height
   */
  public drawROIs(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Increment log counter
    this.logCounter++;
    
    // Draw all polygon ROIs
    this.activeROIs.forEach(roi => {
      ctx.beginPath();
      
      // Draw the polygon
      if (roi.points.length > 0) {
        ctx.moveTo(roi.points[0].x, roi.points[0].y);
        
        for (let i = 1; i < roi.points.length; i++) {
          ctx.lineTo(roi.points[i].x, roi.points[i].y);
        }
        
        // Close the path back to the first point
        ctx.lineTo(roi.points[0].x, roi.points[0].y);
      }
      
      // Style based on tracking status
      if (roi.lastProcessed) {
        ctx.strokeStyle = 'rgba(0, 200, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Not yet processed - yellow
        ctx.strokeStyle = 'rgba(200, 200, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
    // Draw all circular ROIs
    this.activeCircleROIs.forEach(roi => {
      // Calculate center and radius in display coordinates
      const centerX = roi.center.x * width;
      const centerY = roi.center.y * height;
      const radius = roi.radius * width; // Radius is normalized relative to width
      
      // Draw circle outline
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      
      // Style based on tracking status (using the contour tracking results)
      if (roi.contourTracking) {
        if (roi.contourTracking.isOccluded) {
          // Occluded - orange
          ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
        } else if (roi.contourTracking.isInitialized) {
          // Tracked - green
          ctx.strokeStyle = 'rgba(0, 200, 0, 0.8)';
          
          // Draw tracking status visualization
          if (roi.contourTracking.visibilityRatio !== undefined) {
            const confidenceLevel = Math.min(1, Math.max(0, roi.contourTracking.visibilityRatio));
            
            // Draw an arc that shows the visibility ratio
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2 * confidenceLevel);
            ctx.strokeStyle = `rgba(0, ${Math.round(255 * confidenceLevel)}, ${Math.round(255 * (1 - confidenceLevel))}, 0.9)`;
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        } else {
          // Initialized but not yet tracked - yellow
          ctx.strokeStyle = 'rgba(200, 200, 0, 0.8)';
        }
      } else {
        // Not yet processed - gray
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
      }
      
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw ROI ID in small font
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'center';
      const shortId = typeof roi.id === 'string' && roi.id.length > 3 
                    ? roi.id.slice(-3) 
                    : roi.id;
      
      // Add a background for better readability
      const textMetrics = ctx.measureText(`#${shortId}`);
      const textWidth = textMetrics.width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(centerX - textWidth/2 - 2, centerY - 10, textWidth + 4, 14);
      
      // Draw text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(`#${shortId}`, centerX, centerY);
    });
  }
  
  /**
   * Toggle feature processing on/off
   * @param enabled Whether processing should be enabled
   */
  public setProcessingEnabled(enabled: boolean): void {
    this.processingEnabled = enabled;
    console.log(`[ROIManager] Feature processing ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Export singleton instance
export default ROIManager.getInstance();