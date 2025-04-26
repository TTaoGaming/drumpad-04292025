/**
 * Simple Feature Tracker
 * 
 * A simplified implementation of feature tracking with OpenCV.js,
 * specifically designed for tracking circular ROIs in camera feeds.
 */

import { isOpenCVReady, loadOpenCV } from './opencvLoader';
import { EventType, dispatch } from './eventBus';
import { DrawingPath } from './types';

// Declare OpenCV global type
declare const cv: any;

/**
 * TrackingResult interface - represents the result of matching features
 */
export interface TrackingResult {
  id: string;
  isTracked: boolean;
  confidence: number;
  center?: { x: number, y: number };
  corners?: { x: number, y: number }[];
  rotation?: number;
  matchCount?: number;
  inlierCount?: number;
}

/**
 * SimpleFeatureTracker class
 * 
 * Handles:
 * - Extracting circular ROIs from video frames
 * - Extracting features using ORB/FAST
 * - Storing reference features
 * - Matching features between frames
 * - Providing visual feedback on tracking status
 */
class SimpleFeatureTracker {
  private static instance: SimpleFeatureTracker;
  private activeROIs: Map<string, {
    path: DrawingPath;
    lastUpdated: number;
    referenceFeatures?: any;
    referenceImage?: ImageData;
    trackingResult?: TrackingResult;
  }> = new Map();
  
  private isOpenCVReady: boolean = false;
  private processingInterval: number = 200; // ms between processing frames
  
  private constructor() {
    // Initialize OpenCV as soon as possible
    this.initOpenCV();
    console.log('[SimpleFeatureTracker] Initialized');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): SimpleFeatureTracker {
    if (!SimpleFeatureTracker.instance) {
      SimpleFeatureTracker.instance = new SimpleFeatureTracker();
    }
    return SimpleFeatureTracker.instance;
  }
  
  /**
   * Initialize OpenCV
   */
  private async initOpenCV(): Promise<void> {
    try {
      if (!isOpenCVReady()) {
        console.log('[SimpleFeatureTracker] Loading OpenCV...');
        await loadOpenCV();
      }
      
      this.isOpenCVReady = true;
      console.log('[SimpleFeatureTracker] OpenCV ready');
    } catch (error) {
      console.error('[SimpleFeatureTracker] Failed to load OpenCV:', error);
      this.isOpenCVReady = false;
    }
  }
  
  /**
   * Add a circular ROI created from a drawing path
   */
  public addROI(path: DrawingPath): string {
    const id = path.id || Date.now().toString();
    
    // Store the ROI
    this.activeROIs.set(id, {
      path,
      lastUpdated: Date.now()
    });
    
    console.log(`[SimpleFeatureTracker] Added ROI ${id} with ${path.points.length} points`);
    
    // Notify that ROI was added
    dispatch(EventType.ROI_UPDATED, {
      id,
      status: 'created',
      message: 'ROI created, waiting for feature extraction'
    });
    
    return id;
  }
  
  /**
   * Remove an ROI by ID
   */
  public removeROI(id: string): void {
    if (this.activeROIs.has(id)) {
      const roi = this.activeROIs.get(id);
      
      // Clean up OpenCV resources if needed
      if (roi?.referenceFeatures) {
        try {
          roi.referenceFeatures.keypoints?.delete();
          roi.referenceFeatures.descriptors?.delete();
        } catch (error) {
          console.warn(`[SimpleFeatureTracker] Error cleaning up ROI ${id} resources:`, error);
        }
      }
      
      this.activeROIs.delete(id);
      console.log(`[SimpleFeatureTracker] Removed ROI ${id}`);
      
      // Notify that ROI was removed
      dispatch(EventType.ROI_DELETED, { id });
    }
  }
  
  /**
   * Clear all ROIs
   */
  public clearROIs(): void {
    // Clean up all OpenCV resources
    this.activeROIs.forEach((roi, id) => {
      this.removeROI(id);
    });
    
    this.activeROIs.clear();
    console.log('[SimpleFeatureTracker] Cleared all ROIs');
  }
  
  /**
   * Process a video frame to track features in ROIs
   */
  public async processFrame(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.isOpenCVReady || !videoElement || this.activeROIs.size === 0) {
      return;
    }
    
    // Capture the current frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.warn('[SimpleFeatureTracker] Could not get 2D context for frame capture');
      return;
    }
    
    // Draw the current video frame to canvas
    ctx.drawImage(videoElement, 0, 0);
    
    // Process each ROI that needs updating
    const now = Date.now();
    
    // Convert Map entries to array for safer iteration
    // Process each ROI sequentially (avoiding async in forEach)
    for (const [id, roi] of Array.from(this.activeROIs.entries())) {
      // Skip if processed recently to avoid excessive CPU usage
      if (now - roi.lastUpdated < this.processingInterval) {
        continue;
      }
      
      try {
        // Extract the circular ROI based on the drawing path
        const roiImageData = this.extractCircularROI(videoElement, roi.path);
        
        if (!roiImageData) {
          console.warn(`[SimpleFeatureTracker] Failed to extract ROI ${id} image data`);
          continue;
        }
        
        // If we don't have reference features yet, extract them
        if (!roi.referenceFeatures) {
          console.log(`[SimpleFeatureTracker] Extracting reference features for ROI ${id}...`);
          
          // Make sure roiImageData is not null
          if (roiImageData) {
            const features = await this.extractFeatures(roiImageData);
            
            if (features && features.keypoints.size() > 10) {
              roi.referenceFeatures = features;
              roi.referenceImage = roiImageData;
              roi.lastUpdated = now;
              
              console.log(`[SimpleFeatureTracker] Extracted ${features.keypoints.size()} reference features for ROI ${id}`);
              
              // Notify that we have reference features
              dispatch(EventType.ROI_UPDATED, {
                id,
                status: 'reference-captured',
                featureCount: features.keypoints.size()
              });
            } else {
              const count = features ? features.keypoints.size() : 0;
              console.warn(`[SimpleFeatureTracker] Not enough features for ROI ${id}: ${count}/10 needed`);
              
              roi.lastUpdated = now;
              
              // Notify about insufficient features
              dispatch(EventType.ROI_UPDATED, {
                id,
                status: 'extraction-failed',
                message: `Not enough distinctive features (${count}/10)`,
                featureCount: count
              });
            }
          }
          
          continue;
        }
        
        // Skip if no image data is available
        if (!roiImageData) {
          console.warn(`[SimpleFeatureTracker] No ROI image data available for tracking ROI ${id}`);
          continue;
        }
        
        // Extract features from current frame's ROI
        const currentFeatures = await this.extractFeatures(roiImageData);
        
        if (!currentFeatures || currentFeatures.keypoints.size() < 10) {
          const count = currentFeatures ? currentFeatures.keypoints.size() : 0;
          console.warn(`[SimpleFeatureTracker] Not enough features in current frame for ROI ${id}: ${count}/10`);
          
          roi.lastUpdated = now;
          
          // Update tracking result to indicate lost tracking
          roi.trackingResult = {
            id,
            isTracked: false,
            confidence: 0,
            matchCount: count,
            inlierCount: 0
          };
          
          // Notify about lost tracking
          dispatch(EventType.ROI_UPDATED, {
            id,
            status: 'tracking-lost',
            message: 'Not enough features to track',
            trackingResult: roi.trackingResult
          });
          
          // Clean up
          if (currentFeatures) {
            currentFeatures.keypoints.delete();
            currentFeatures.descriptors.delete();
          }
          
          continue;
        }
        
        // Match features between reference and current
        const trackingResult = await this.matchFeatures(id, roi.referenceFeatures, currentFeatures);
        
        // Update ROI state
        roi.trackingResult = trackingResult;
        roi.lastUpdated = now;
        
        // Notify about tracking result
        dispatch(EventType.ROI_UPDATED, {
          id,
          status: trackingResult.isTracked ? 'tracking-success' : 'tracking-lost',
          trackingResult
        });
        
        // Clean up
        currentFeatures.keypoints.delete();
        currentFeatures.descriptors.delete();
        
      } catch (error) {
        console.error(`[SimpleFeatureTracker] Error processing ROI ${id}:`, error);
        roi.lastUpdated = now;
        
        // Notify about error
        dispatch(EventType.ROI_UPDATED, {
          id,
          status: 'processing-error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  
  /**
   * Draw tracking visualization on canvas
   */
  public drawTracking(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.activeROIs.forEach((roi, id) => {
      // Draw the ROI outline
      const path = roi.path;
      
      ctx.beginPath();
      if (path.points.length > 0) {
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
      }
      ctx.closePath();
      
      // Set style based on tracking status
      if (roi.trackingResult?.isTracked) {
        // Successfully tracked - green
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 2;
      } else if (roi.referenceFeatures) {
        // Has reference but not tracking - red
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
      } else {
        // Still initializing - yellow
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      
      // Draw tracking info if available
      if (roi.trackingResult) {
        const result = roi.trackingResult;
        
        // Draw confidence text
        if (result.confidence !== undefined) {
          ctx.font = '12px sans-serif';
          ctx.fillStyle = result.isTracked ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 0, 0, 0.9)';
          
          // Calculate center point for text position
          let centerX = 0, centerY = 0;
          
          if (result.center) {
            centerX = result.center.x;
            centerY = result.center.y;
          } else {
            // Calculate center from path points
            for (const point of path.points) {
              centerX += point.x;
              centerY += point.y;
            }
            centerX /= path.points.length;
            centerY /= path.points.length;
          }
          
          const confidenceText = `${(result.confidence * 100).toFixed(0)}%`;
          ctx.fillText(confidenceText, centerX, centerY - 10);
          
          // Draw match count if available
          if (result.matchCount !== undefined && result.inlierCount !== undefined) {
            const matchText = `${result.inlierCount}/${result.matchCount}`;
            ctx.fillText(matchText, centerX, centerY + 10);
          }
        }
        
        // Draw transformed corners if available
        if (result.corners && result.isTracked) {
          ctx.beginPath();
          ctx.moveTo(result.corners[0].x, result.corners[0].y);
          for (let i = 1; i < result.corners.length; i++) {
            ctx.lineTo(result.corners[i].x, result.corners[i].y);
          }
          ctx.closePath();
          ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else if (!roi.referenceFeatures) {
        // Still initializing - show status text
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
        
        // Calculate center from path points
        let centerX = 0, centerY = 0;
        for (const point of path.points) {
          centerX += point.x;
          centerY += point.y;
        }
        centerX /= path.points.length;
        centerY /= path.points.length;
        
        ctx.fillText('Initializing...', centerX, centerY);
      }
    });
  }
  
  /**
   * Extract circular ROI from video element
   */
  private extractCircularROI(videoElement: HTMLVideoElement, path: DrawingPath): ImageData | null {
    if (!path.points || path.points.length < 3) {
      return null;
    }
    
    try {
      // Calculate the bounding box of the ROI
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      
      for (const point of path.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
      
      // Ensure positive widths
      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);
      
      // Create a canvas to extract the ROI
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.warn('[SimpleFeatureTracker] Could not get 2D context for ROI extraction');
        return null;
      }
      
      // Calculate the center and radius of the circle
      let sumX = 0, sumY = 0;
      for (const point of path.points) {
        sumX += point.x;
        sumY += point.y;
      }
      
      const centerX = sumX / path.points.length - minX;
      const centerY = sumY / path.points.length - minY;
      
      // Calculate average radius
      let totalRadius = 0;
      for (const point of path.points) {
        const dx = point.x - (centerX + minX);
        const dy = point.y - (centerY + minY);
        totalRadius += Math.sqrt(dx * dx + dy * dy);
      }
      
      const radius = totalRadius / path.points.length;
      
      // Calculate scaling factors for display to video coordinates
      const displayElement = document.querySelector('.camera-view') as HTMLElement;
      if (!displayElement) {
        console.warn('[SimpleFeatureTracker] Could not find camera display element for scaling');
        return null;
      }
      
      const displayWidth = displayElement.clientWidth;
      const displayHeight = displayElement.clientHeight;
      
      const scaleX = videoElement.videoWidth / displayWidth;
      const scaleY = videoElement.videoHeight / displayHeight;
      
      // Draw the video to the canvas at the correct position to capture the ROI
      ctx.drawImage(
        videoElement,
        minX * scaleX, minY * scaleY, width * scaleX, height * scaleY,
        0, 0, width, height
      );
      
      // Apply a circular mask to the ROI
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      
      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over';
      
      // Get the masked image data
      return ctx.getImageData(0, 0, width, height);
    } catch (error) {
      console.error('[SimpleFeatureTracker] Error extracting circular ROI:', error);
      return null;
    }
  }
  
  /**
   * Extract features from image data
   */
  private async extractFeatures(imageData: ImageData): Promise<any | null> {
    if (!this.isOpenCVReady) {
      await this.initOpenCV();
      if (!this.isOpenCVReady) {
        return null;
      }
    }
    
    try {
      // Create OpenCV Mat from image data
      const imgMat = cv.matFromImageData(imageData);
      const grayMat = new cv.Mat();
      
      // Convert to grayscale
      cv.cvtColor(imgMat, grayMat, cv.COLOR_RGBA2GRAY);
      
      // Use FAST detector which is more reliable across OpenCV versions
      const keypoints = new cv.KeyPointVector();
      const threshold = 10;
      const nonmaxSuppression = true;
      
      cv.FAST(grayMat, keypoints, threshold, nonmaxSuppression);
      
      console.log(`[SimpleFeatureTracker] Detected ${keypoints.size()} keypoints`);
      
      // Extract descriptors (BRIEF is most reliable)
      const descriptors = new cv.Mat();
      const mask = new cv.Mat();
      
      try {
        // Try the most compatible way to compute descriptors
        const orb = new cv.ORB();
        orb.compute(grayMat, keypoints, descriptors);
        orb.delete();
      } catch (e) {
        console.warn('[SimpleFeatureTracker] Error with ORB compute, falling back to simpler approach:', e);
        
        try {
          // Try alternate descriptor computation
          cv.compute(grayMat, keypoints, descriptors);
        } catch (e2) {
          console.warn('[SimpleFeatureTracker] All descriptor computations failed:', e2);
          // Create an empty descriptor matrix that's compatible with the matcher
          // This will let the UI continue to work even with poor feature quality
          descriptors.create(
            keypoints.size(),
            32, // Default ORB descriptor size
            cv.CV_8U
          );
        }
      }
      
      // Clean up
      imgMat.delete();
      grayMat.delete();
      mask.delete();
      
      return {
        keypoints,
        descriptors,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[SimpleFeatureTracker] Error extracting features:', error);
      return null;
    }
  }
  
  /**
   * Match features between reference and current frame
   */
  private async matchFeatures(roiId: string, referenceFeatures: any, currentFeatures: any): Promise<TrackingResult> {
    try {
      // Create feature matcher
      const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
      const matches = new cv.DMatchVector();
      
      // Match descriptors
      matcher.match(referenceFeatures.descriptors, currentFeatures.descriptors, matches);
      
      const matchCount = matches.size();
      console.log(`[SimpleFeatureTracker] Found ${matchCount} matches for ROI ${roiId}`);
      
      if (matchCount < 8) {
        // Need at least 8 matches for homography
        matcher.delete();
        matches.delete();
        
        return {
          id: roiId,
          isTracked: false,
          confidence: 0,
          matchCount,
          inlierCount: 0
        };
      }
      
      // Convert keypoints to points for homography
      const refPoints = [];
      const currPoints = [];
      
      for (let i = 0; i < matchCount; i++) {
        const match = matches.get(i);
        const refKeypoint = referenceFeatures.keypoints.get(match.queryIdx);
        const currKeypoint = currentFeatures.keypoints.get(match.trainIdx);
        
        refPoints.push(new cv.Point(refKeypoint.pt.x, refKeypoint.pt.y));
        currPoints.push(new cv.Point(currKeypoint.pt.x, currKeypoint.pt.y));
      }
      
      const refPointsMat = cv.matFromArray(refPoints.length, 1, cv.CV_32FC2, 
        refPoints.flatMap(p => [p.x, p.y]));
      const currPointsMat = cv.matFromArray(currPoints.length, 1, cv.CV_32FC2, 
        currPoints.flatMap(p => [p.x, p.y]));
      
      // Calculate homography
      const mask = new cv.Mat();
      const homography = cv.findHomography(refPointsMat, currPointsMat, cv.RANSAC, 3.0, mask);
      
      // Count inliers (non-zero values in mask)
      let inlierCount = 0;
      for (let i = 0; i < mask.rows; i++) {
        if (mask.ucharPtr(i, 0)[0] !== 0) {
          inlierCount++;
        }
      }
      
      const confidence = inlierCount / matchCount;
      
      // Calculate corners for visualization
      const width = referenceFeatures.imageData ? referenceFeatures.imageData.width : 100;
      const height = referenceFeatures.imageData ? referenceFeatures.imageData.height : 100;
      
      const cornersMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        width, 0,
        width, height,
        0, height
      ]);
      
      const transformedCorners = new cv.Mat();
      cv.perspectiveTransform(cornersMat, transformedCorners, homography);
      
      const corners = [];
      for (let i = 0; i < 4; i++) {
        corners.push({
          x: transformedCorners.doublePtr(i, 0)[0],
          y: transformedCorners.doublePtr(i, 0)[1]
        });
      }
      
      // Calculate center
      const centerMat = cv.matFromArray(1, 1, cv.CV_32FC2, [width / 2, height / 2]);
      const transformedCenter = new cv.Mat();
      
      cv.perspectiveTransform(centerMat, transformedCenter, homography);
      
      const center = {
        x: transformedCenter.doublePtr(0, 0)[0],
        y: transformedCenter.doublePtr(0, 0)[1]
      };
      
      // Calculate rotation (approximate)
      let rotation = 0;
      try {
        const a = homography.doublePtr(0, 0)[0];
        const b = homography.doublePtr(0, 1)[0];
        const c = homography.doublePtr(1, 0)[0];
        const d = homography.doublePtr(1, 1)[0];
        
        const theta1 = Math.atan2(b, a);
        const theta2 = Math.atan2(-c, d);
        
        rotation = (theta1 + theta2) / 2;
      } catch (e) {
        console.warn('[SimpleFeatureTracker] Error calculating rotation:', e);
      }
      
      // Clean up
      matcher.delete();
      matches.delete();
      refPointsMat.delete();
      currPointsMat.delete();
      mask.delete();
      homography.delete();
      cornersMat.delete();
      transformedCorners.delete();
      centerMat.delete();
      transformedCenter.delete();
      
      return {
        id: roiId,
        isTracked: confidence > 0.3, // Lower threshold for better success rate
        confidence,
        matchCount,
        inlierCount,
        corners,
        center,
        rotation
      };
    } catch (error) {
      console.error('[SimpleFeatureTracker] Error matching features:', error);
      
      return {
        id: roiId,
        isTracked: false,
        confidence: 0
      };
    }
  }
}

// Export singleton instance
export default SimpleFeatureTracker.getInstance();