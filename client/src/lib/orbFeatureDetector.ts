/**
 * Region of Interest (ROI) Manager with ORB Feature Detection
 * 
 * Manages regions of interest for the drawing canvas and performs
 * ORB feature extraction and tracking within each ROI.
 */

import { DrawingPath, Point, RegionOfInterest, CircleROI } from './types';
import { 
  extractORBFeatures, 
  matchFeatures, 
  ORBFeature, 
  TrackingResult,
  saveReferenceFeatures,
  referenceFeatures 
} from './orbTracking';
import { getVideoFrame } from './cameraManager';
import { EventType, dispatch } from './eventBus';

// Interface to store ROI with its feature information
interface ROIWithFeatures extends RegionOfInterest {
  features?: ORBFeature;
  trackingResult?: TrackingResult;
  lastProcessed?: number;
}

// Interface to store CircleROI with its feature information
interface CircleROIWithFeatures extends CircleROI {
  features?: ORBFeature;
  trackingResult?: TrackingResult;
  lastProcessed?: number;
}

/**
 * ROI manager with ORB feature tracking
 */
export class ROIManager {
  private static instance: ROIManager;
  private activeROIs: ROIWithFeatures[] = [];
  private activeCircleROIs: CircleROIWithFeatures[] = []; // New array for circle ROIs
  private processingEnabled: boolean = true;
  private lastFrameTime: number = 0;
  private frameInterval: number = 33; // Process at ~30fps for smoother tracking
  
  // Private constructor for singleton
  private constructor() {
    console.log('[ROIManager] Initialized with ORB feature tracking enabled');
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
      // Initialize features and tracking as undefined
      features: undefined,
      trackingResult: undefined,
      lastProcessed: 0
    };
    
    this.activeROIs.push(roi);
    console.log(`[ROIManager] Added new ROI with ID ${id} and ${roi.points.length} points`);
    
    // Attempt to extract features right away from the current frame
    this.extractFeaturesForNewROI(roi);
    
    return id;
  }
  
  /**
   * Extract initial features for a newly created ROI
   * @param roi The ROI to extract features for
   */
  private async extractFeaturesForNewROI(roi: ROIWithFeatures): Promise<void> {
    // Get the current frame to extract features from
    const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
    if (!videoElement || !videoElement.videoWidth) {
      console.warn('[ROIManager] No video feed available for initial feature extraction');
      return;
    }
    
    console.log('[ROIManager] Attempting initial feature extraction for new ROI');
    
    // Extract the ROI image data using the circular mask method from ROIDebugCanvas
    const roiImageData = this.extractROIImageData(roi, videoElement);
    if (!roiImageData) {
      console.warn('[ROIManager] Failed to extract ROI image data for initial feature extraction');
      return;
    }
    
    try {
      // Extract features from the ROI
      const features = await extractORBFeatures(roiImageData, 500);
      if (!features || features.keypoints.size() < 10) {
        console.warn(`[ROIManager] Not enough features detected (${features?.keypoints.size() || 0}), need at least 10`);
        return;
      }
      
      // Save as reference features for this ROI
      saveReferenceFeatures(roi.id, features);
      
      // Update ROI with features information
      roi.features = features;
      roi.lastProcessed = Date.now();
      
      console.log(`[ROIManager] Successfully extracted ${features.keypoints.size()} features for ROI ${roi.id}`);
      
      // Notify that features were extracted
      dispatch(EventType.LOG, {
        message: `Extracted ${features.keypoints.size()} features for tracking ROI`,
        type: 'success'
      });
      
    } catch (error) {
      console.error('[ROIManager] Error extracting initial features:', error);
    }
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
   * Remove a ROI by ID
   * @param id The ID of the ROI to remove
   */
  public removeROI(id: string): void {
    this.activeROIs = this.activeROIs.filter(roi => roi.id !== id);
    console.log(`[ROIManager] Removed ROI ${id}`);
  }
  
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
      console.log(`[ROIManager] Circle ROI ${id} already exists, skipping add`);
      return id; // Return the existing ID if already added
    }
    
    const roi: CircleROIWithFeatures = {
      ...circleROI,
      id,
      timestamp: Date.now(),
      features: undefined,
      trackingResult: undefined,
      lastProcessed: 0
    };
    
    this.activeCircleROIs.push(roi);
    console.log(`[ROIManager] Added new Circle ROI with ID ${id}, center (${roi.center.x}, ${roi.center.y}), radius ${roi.radius}`);
    
    // Attempt to extract features right away from the current frame
    this.extractFeaturesForNewCircleROI(roi);
    
    return id;
  }
  
  /**
   * Extract initial features for a newly created CircleROI
   * @param roi The CircleROI to extract features for
   */
  private async extractFeaturesForNewCircleROI(roi: CircleROIWithFeatures): Promise<void> {
    // Get the current frame to extract features from
    const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
    if (!videoElement || !videoElement.videoWidth) {
      console.warn('[ROIManager] No video feed available for initial feature extraction');
      return;
    }
    
    console.log('[ROIManager] Attempting initial feature extraction for new Circle ROI');
    
    // Extract the ROI image data using the circular roi directly
    const roiImageData = this.extractCircleROIImageData(roi, videoElement);
    if (!roiImageData) {
      console.warn('[ROIManager] Failed to extract Circle ROI image data for initial feature extraction');
      return;
    }
    
    try {
      // Extract features from the ROI
      const features = await extractORBFeatures(roiImageData, 500);
      if (!features || features.keypoints.size() < 10) {
        console.warn(`[ROIManager] Not enough features detected for Circle ROI (${features?.keypoints.size() || 0}), need at least 10`);
        return;
      }
      
      // Save as reference features for this ROI
      saveReferenceFeatures(roi.id, features);
      
      // Update ROI with features information
      roi.features = features;
      roi.lastProcessed = Date.now();
      
      console.log(`[ROIManager] Successfully extracted ${features.keypoints.size()} features for Circle ROI ${roi.id}`);
      
      // Notify that features were extracted
      dispatch(EventType.LOG, {
        message: `Extracted ${features.keypoints.size()} features for tracking Circle ROI`,
        type: 'success'
      });
      
    } catch (error) {
      console.error('[ROIManager] Error extracting initial features for Circle ROI:', error);
    }
  }
  
  /**
   * Extract image data for a specific CircleROI
   * @param roi The CircleROI to extract image data for
   * @param videoElement Video element to capture from
   * @returns Image data for the ROI or null if extraction failed
   */
  private extractCircleROIImageData(roi: CircleROIWithFeatures, videoElement: HTMLVideoElement): ImageData | null {
    // Create temporary canvases outside try block so we can clean them up in finally
    const tempCanvas = document.createElement('canvas');
    const maskCanvas = document.createElement('canvas');
    
    try {
      // Validate the ROI data
      if (!roi || !roi.center || typeof roi.radius !== 'number' || roi.radius <= 0) {
        console.warn('[ROIManager] Invalid Circle ROI data:', roi);
        return null;
      }
      
      // Get the current video frame
      const frameData = getVideoFrame(videoElement);
      if (!frameData) {
        console.warn('[ROIManager] Failed to get video frame');
        return null;
      }
      
      // Set up temporary canvas
      tempCanvas.width = videoElement.videoWidth;
      tempCanvas.height = videoElement.videoHeight;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) {
        console.warn('[ROIManager] Failed to get temp canvas context');
        return null;
      }
      
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
      
      // Validate display dimensions
      if (displayWidth <= 0 || displayHeight <= 0) {
        console.warn('[ROIManager] Invalid display dimensions:', displayWidth, displayHeight);
        return null;
      }
      
      // Scale the center and radius from display coordinates to video frame coordinates
      const scaleX = videoElement.videoWidth / displayWidth;
      const scaleY = videoElement.videoHeight / displayHeight;
      
      const centerX = roi.center.x * scaleX;
      const centerY = roi.center.y * scaleY;
      const radius = roi.radius * Math.max(scaleX, scaleY); // Use the larger scale to ensure the full circle is captured
      
      // Validate the scaled values
      if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
        console.warn('[ROIManager] Invalid scaled ROI values:', { centerX, centerY, radius });
        return null;
      }
      
      // Log the scaling for debugging
      console.log(`[ROIManager] Display to video scaling: ${scaleX.toFixed(2)}x, ${scaleY.toFixed(2)}y`);
      console.log(`[ROIManager] Circle ROI center: Display (${roi.center.x}, ${roi.center.y}) => Video (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
      console.log(`[ROIManager] Circle ROI radius: Display ${roi.radius} => Video ${radius.toFixed(1)}`);
      
      // Calculate extraction bounds with more careful boundary checking
      // Make sure radius is at least 1 pixel
      const safeRadius = Math.max(radius, 1);
      const extractSize = Math.floor(safeRadius * 2);
      const sourceX = Math.max(0, Math.floor(centerX - safeRadius));
      const sourceY = Math.max(0, Math.floor(centerY - safeRadius));
      
      // Ensure we don't try to extract beyond the video frame boundaries and that extraction area is at least 10x10
      const sourceWidth = Math.max(10, Math.min(extractSize, videoElement.videoWidth - sourceX));
      const sourceHeight = Math.max(10, Math.min(extractSize, videoElement.videoHeight - sourceY));
      
      // Validate final extraction dimensions
      if (sourceWidth <= 0 || sourceHeight <= 0) {
        console.warn('[ROIManager] Invalid extraction dimensions:', { sourceWidth, sourceHeight });
        return null;
      }
      
      // For debugging - more detailed output
      console.log(`[ROIManager] Extracting Circle ROI region:`, {
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight,
        displayCenter: roi.center,
        videoCenter: { x: centerX, y: centerY },
        displayRadius: roi.radius,
        videoRadius: radius
      });
      
      // Extract the square region
      let squareROI;
      try {
        squareROI = tempCtx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);
      } catch (e) {
        console.error('[ROIManager] Error getting square ROI:', e);
        return null;
      }
      
      // Create a new canvas to apply the circular mask
      maskCanvas.width = sourceWidth;
      maskCanvas.height = sourceHeight;
      const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
      
      if (!maskCtx) {
        console.error('[ROIManager] Failed to get mask canvas context');
        return null;
      }
      
      // Put the square image data on the mask canvas
      maskCtx.putImageData(squareROI, 0, 0);
      
      // Create circular clipping path
      maskCtx.globalCompositeOperation = 'destination-in';
      maskCtx.fillStyle = 'white';
      maskCtx.beginPath();
      
      // Use a slightly smaller radius to ensure we stay within bounds
      const maskRadius = Math.min(sourceWidth/2, sourceHeight/2) - 2;
      maskCtx.arc(sourceWidth/2, sourceHeight/2, maskRadius, 0, Math.PI * 2);
      maskCtx.fill();
      
      // Get the circular masked image data
      let maskedImageData;
      try {
        maskedImageData = maskCtx.getImageData(0, 0, sourceWidth, sourceHeight);
        return maskedImageData;
      } catch (e) {
        console.error('[ROIManager] Error getting masked image data:', e);
        return null;
      }
      
    } catch (error) {
      console.error('[ROIManager] Error extracting Circle ROI image data:', error);
      return null;
    } finally {
      // Clean up canvas elements to prevent memory leaks
      // These aren't OpenCV objects but it's still good practice to clean them up
      try {
        if (tempCanvas && tempCanvas.parentNode) {
          tempCanvas.parentNode.removeChild(tempCanvas);
        }
        if (maskCanvas && maskCanvas.parentNode) {
          maskCanvas.parentNode.removeChild(maskCanvas);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
  
  /**
   * Clear all ROIs
   */
  public clearROIs(): void {
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
   * Process video frame to track features in each ROI
   * @param imageData Full frame image data from video
   */
  public async processFrame(imageData: ImageData): Promise<void> {
    // Don't process too many frames - rate limit to avoid performance issues
    const now = Date.now();
    if (now - this.lastFrameTime < this.frameInterval || !this.processingEnabled) {
      return;
    }
    this.lastFrameTime = now;
    
    // Process each Circle ROI first (new simplified method)
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
      
      // Verbose logging to help debug the issue
      console.log(`[ROIManager] Processing Circle ROI ${roi.id} with center (${roi.center.x}, ${roi.center.y}) and radius ${roi.radius}`);
      
      // Extract the ROI image data
      const roiImageData = this.extractCircleROIImageData(roi, videoElement);
      if (!roiImageData) {
        console.warn('[ROIManager] Failed to extract Circle ROI image data');
        continue;
      }
      
      console.log(`[ROIManager] Extracted Circle ROI image data: ${roiImageData.width}x${roiImageData.height}`);
      
      try {
        // Check if we have reference features for this ROI
        if (!referenceFeatures.has(roi.id)) {
          console.log(`[ROIManager] No reference features for Circle ROI ${roi.id}, extracting...`);
          
          // Extract features and save as reference
          console.log('[ROIManager] Calling extractORBFeatures for Circle ROI...');
          const features = await extractORBFeatures(roiImageData, 500);
          
          if (features) {
            console.log(`[ROIManager] Feature extraction result for Circle ROI ${roi.id}:`, {
              success: true,
              keypoints: features.keypoints.size(),
              descriptorSize: features.descriptors.rows
            });
          } else {
            console.warn('[ROIManager] Feature extraction returned null for Circle ROI');
          }
          
          if (features && features.keypoints.size() > 10) {
            saveReferenceFeatures(roi.id, features);
            roi.features = features;
            roi.lastProcessed = now;
            
            // Create a public event to notify other components
            dispatch(EventType.ROI_UPDATED, {
              id: roi.id,
              status: 'reference-captured',
              featureCount: features.keypoints.size(),
              timestamp: now,
              isCircleROI: true, // Flag to identify this as a circle ROI
              center: roi.center,
              radius: roi.radius
            });
            
            console.log(`[ROIManager] Extracted ${features.keypoints.size()} reference features for Circle ROI ${roi.id}`);
          } else {
            console.warn(`[ROIManager] Failed to extract enough features for Circle ROI ${roi.id}. Found: ${features?.keypoints.size() || 0}, needed: 10`);
            
            // Update lastProcessed to avoid hammering with extraction attempts
            roi.lastProcessed = now;
            
            // Create a public event to notify other components
            dispatch(EventType.ROI_UPDATED, {
              id: roi.id,
              status: 'extraction-failed',
              featureCount: features?.keypoints.size() || 0,
              timestamp: now,
              isCircleROI: true,
              center: roi.center,
              radius: roi.radius
            });
          }
          continue;
        }
        
        // Extract current features to match against reference
        const currentFeatures = await extractORBFeatures(roiImageData, 500);
        if (!currentFeatures || currentFeatures.keypoints.size() < 10) {
          console.warn(`[ROIManager] Not enough features in current frame for Circle ROI ${roi.id}. Found: ${currentFeatures?.keypoints.size() || 0}, needed: 10`);
          roi.lastProcessed = now;
          
          // Create a public event to notify other components
          dispatch(EventType.ROI_UPDATED, {
            id: roi.id,
            status: 'tracking-insufficient-features',
            featureCount: currentFeatures?.keypoints.size() || 0,
            timestamp: now,
            isCircleROI: true,
            center: roi.center,
            radius: roi.radius
          });
          
          continue;
        }
        
        // Match current features with reference features
        console.log(`[ROIManager] Matching ${currentFeatures.keypoints.size()} features against reference for Circle ROI ${roi.id}`);
        const trackingResult = await matchFeatures(roi.id, currentFeatures);
        
        console.log(`[ROIManager] Matching result for Circle ROI ${roi.id}:`, {
          isTracked: trackingResult.isTracked,
          matchCount: trackingResult.matchCount,
          inlierCount: trackingResult.inlierCount,
          confidence: trackingResult.confidence
        });
        
        // Update tracking result
        roi.trackingResult = trackingResult;
        roi.lastProcessed = now;
        
        // Update the ROI center coordinates if tracking is successful
        if (trackingResult.isTracked && trackingResult.center) {
          // Get the scaling factors from video coordinates back to screen coordinates
          const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
          const displayElement = document.querySelector('.camera-view') as HTMLElement;
          
          if (videoElement && displayElement) {
            const scaleX = displayElement.clientWidth / videoElement.videoWidth;
            const scaleY = displayElement.clientHeight / videoElement.videoHeight;
            
            // Update the ROI position with the new tracked position (convert back to screen coordinates)
            const newCenter = {
              x: trackingResult.center.x * scaleX,
              y: trackingResult.center.y * scaleY
            };
            
            console.log(`[ROIManager] Updating Circle ROI ${roi.id} position: (${roi.center.x}, ${roi.center.y}) => (${newCenter.x}, ${newCenter.y})`);
            
            // Update the ROI center coordinates
            roi.center = newCenter;
          }
        }
        
        // Create a public event to notify other components like ROIDebugCanvas
        dispatch(EventType.ROI_UPDATED, {
          id: roi.id,
          status: trackingResult.isTracked ? 'tracking-success' : 'tracking-lost',
          trackingResult: {
            isTracked: trackingResult.isTracked,
            matchCount: trackingResult.matchCount,
            inlierCount: trackingResult.inlierCount,
            confidence: trackingResult.confidence,
            center: trackingResult.center,
            rotation: trackingResult.rotation,
            // Include keypoints and matches for visualization
            keypoints: trackingResult.keypoints,
            matches: trackingResult.matches
          },
          timestamp: now,
          isCircleROI: true,
          center: roi.center, // Send updated center position
          radius: roi.radius
        });
        
        // Clean up OpenCV resources
        currentFeatures.keypoints.delete();
        currentFeatures.descriptors.delete();
        
      } catch (error) {
        console.error(`[ROIManager] Error processing Circle ROI ${roi.id}:`, error);
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
    
    // Process each legacy ROI
    for (const roi of this.activeROIs) {
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
      
      // Verbose logging to help debug the issue
      console.log(`[ROIManager] Processing ROI ${roi.id} with ${roi.points.length} points`);
      
      // Extract the ROI image data
      const roiImageData = this.extractROIImageData(roi, videoElement);
      if (!roiImageData) {
        console.warn('[ROIManager] Failed to extract ROI image data');
        continue;
      }
      
      console.log(`[ROIManager] Extracted ROI image data: ${roiImageData.width}x${roiImageData.height}`);
      
      try {
        // Check if we have reference features for this ROI
        if (!referenceFeatures.has(roi.id)) {
          console.log(`[ROIManager] No reference features for ROI ${roi.id}, extracting...`);
          
          // Extract features and save as reference
          console.log('[ROIManager] Calling extractORBFeatures...');
          const features = await extractORBFeatures(roiImageData, 500);
          
          if (features) {
            console.log(`[ROIManager] Feature extraction result for ROI ${roi.id}:`, {
              success: true,
              keypoints: features.keypoints.size(),
              descriptorSize: features.descriptors.rows
            });
          } else {
            console.warn('[ROIManager] Feature extraction returned null');
          }
          
          if (features && features.keypoints.size() > 10) {
            saveReferenceFeatures(roi.id, features);
            roi.features = features;
            roi.lastProcessed = now;
            
            // Create a public event to notify other components
            dispatch(EventType.ROI_UPDATED, {
              id: roi.id,
              status: 'reference-captured',
              featureCount: features.keypoints.size(),
              timestamp: now
            });
            
            console.log(`[ROIManager] Extracted ${features.keypoints.size()} reference features for ROI ${roi.id}`);
          } else {
            console.warn(`[ROIManager] Failed to extract enough features for ROI ${roi.id}. Found: ${features?.keypoints.size() || 0}, needed: 10`);
            
            // Update lastProcessed to avoid hammering with extraction attempts
            roi.lastProcessed = now;
            
            // Create a public event to notify other components
            dispatch(EventType.ROI_UPDATED, {
              id: roi.id,
              status: 'extraction-failed',
              featureCount: features?.keypoints.size() || 0,
              timestamp: now
            });
          }
          continue;
        }
        
        // Extract current features to match against reference
        const currentFeatures = await extractORBFeatures(roiImageData, 500);
        if (!currentFeatures || currentFeatures.keypoints.size() < 10) {
          console.warn(`[ROIManager] Not enough features in current frame for ROI ${roi.id}. Found: ${currentFeatures?.keypoints.size() || 0}, needed: 10`);
          roi.lastProcessed = now;
          
          // Create a public event to notify other components
          dispatch(EventType.ROI_UPDATED, {
            id: roi.id,
            status: 'tracking-insufficient-features',
            featureCount: currentFeatures?.keypoints.size() || 0,
            timestamp: now
          });
          
          continue;
        }
        
        // Match current features with reference features
        console.log(`[ROIManager] Matching ${currentFeatures.keypoints.size()} features against reference for ROI ${roi.id}`);
        const trackingResult = await matchFeatures(roi.id, currentFeatures);
        
        console.log(`[ROIManager] Matching result for ROI ${roi.id}:`, {
          isTracked: trackingResult.isTracked,
          matchCount: trackingResult.matchCount,
          inlierCount: trackingResult.inlierCount,
          confidence: trackingResult.confidence
        });
        
        // Update tracking result
        roi.trackingResult = trackingResult;
        roi.lastProcessed = now;
        
        // Create a public event to notify other components like ROIDebugCanvas
        dispatch(EventType.ROI_UPDATED, {
          id: roi.id,
          status: trackingResult.isTracked ? 'tracking-success' : 'tracking-lost',
          trackingResult: {
            isTracked: trackingResult.isTracked,
            matchCount: trackingResult.matchCount,
            inlierCount: trackingResult.inlierCount,
            confidence: trackingResult.confidence,
            center: trackingResult.center,
            rotation: trackingResult.rotation,
            // Include keypoints and matches for visualization
            keypoints: trackingResult.keypoints,
            matches: trackingResult.matches
          },
          timestamp: now
        });
        
        // Clean up OpenCV resources
        currentFeatures.keypoints.delete();
        currentFeatures.descriptors.delete();
        
      } catch (error) {
        console.error(`[ROIManager] Error processing ROI ${roi.id}:`, error);
        roi.lastProcessed = now; // Mark as processed even if there was an error
        
        // Create a public event to notify other components
        dispatch(EventType.ROI_UPDATED, {
          id: roi.id,
          status: 'processing-error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: now
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
  public drawFeatures(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Draw each legacy ROI with tracking information
    this.activeROIs.forEach(roi => {
      // Draw ROI outline
      ctx.beginPath();
      
      // Points are already in pixel coordinates from the drawing canvas
      ctx.moveTo(roi.points[0].x, roi.points[0].y);
      for (let i = 1; i < roi.points.length; i++) {
        ctx.lineTo(roi.points[i].x, roi.points[i].y);
      }
      ctx.closePath();
      
      // Style based on tracking status
      if (roi.trackingResult?.isTracked) {
        // Successfully tracked - green
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw confidence level
        const confidence = roi.trackingResult.confidence;
        const confidenceText = `${(confidence * 100).toFixed(0)}%`;
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
        
        // Calculate text position
        const center = this.calculateCenter(roi.points);
        ctx.fillText(confidenceText, center.x + 5, center.y - 5);
        
        // Draw feature points if available
        if (roi.trackingResult.corners && roi.trackingResult.corners.length === 4) {
          ctx.beginPath();
          const corners = roi.trackingResult.corners;
          
          // Draw the transformed corners
          ctx.moveTo(corners[0].x, corners[0].y);
          for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i].x, corners[i].y);
          }
          ctx.closePath();
          ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        // Not tracked or no tracking result - red
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
    
    // Draw each Circle ROI with tracking information
    this.activeCircleROIs.forEach(roi => {
      // Draw Circle ROI outline
      ctx.beginPath();
      ctx.arc(roi.center.x, roi.center.y, roi.radius, 0, Math.PI * 2);
      ctx.closePath();
      
      // Style based on tracking status
      if (roi.trackingResult?.isTracked) {
        // Successfully tracked - green
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw confidence level
        const confidence = roi.trackingResult.confidence;
        const confidenceText = `${(confidence * 100).toFixed(0)}%`;
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
        ctx.fillText(confidenceText, roi.center.x + 5, roi.center.y - 5);
        
        // Draw tracking center point
        if (roi.trackingResult.center) {
          ctx.beginPath();
          ctx.arc(roi.trackingResult.center.x, roi.trackingResult.center.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 200, 255, 0.8)';
          ctx.fill();
          
          // Draw line from original center to tracked center
          ctx.beginPath();
          ctx.moveTo(roi.center.x, roi.center.y);
          ctx.lineTo(roi.trackingResult.center.x, roi.trackingResult.center.y);
          ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        // Not tracked - red
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw ROI ID
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        const shortId = typeof roi.id === 'string' && roi.id.length > 3 
                      ? roi.id.slice(-3) 
                      : roi.id;
        ctx.fillText(`#${shortId}`, roi.center.x - 15, roi.center.y);
      }
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
  
  /**
   * Calculate the center of a set of points
   * @param points Array of points
   * @returns Center point
   */
  private calculateCenter(points: Point[]): Point {
    if (points.length === 0) return { x: 0, y: 0 };
    
    const sum = points.reduce((acc, point) => {
      return { x: acc.x + point.x, y: acc.y + point.y };
    }, { x: 0, y: 0 });
    
    return { x: sum.x / points.length, y: sum.y / points.length };
  }
}

// Export singleton instance
export default ROIManager.getInstance();