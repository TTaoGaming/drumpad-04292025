/**
 * Simple Contour Tracking System
 * 
 * A lightweight contour detection and tracking system that works
 * with the Circle ROI created by pinch gestures.
 * 
 * This implementation avoids complex feature matching and focuses
 * on basic contour detection for performance and simplicity.
 */

import { CircleROI, Point } from './types';
import { isOpenCVReady, loadOpenCV } from './opencvLoader';
import { EventType, dispatch } from './eventBus';

// Declare OpenCV global
declare const cv: any;

// Store initial contours for each ROI
interface ContourData {
  id: string;
  initialContours: any; // cv.MatVector of contours
  initialHierarchy: any; // cv.Mat of hierarchy
  contourCount: number;
  imageData: ImageData;
  timestamp: number;
  isVisible: boolean; // Whether the contours are visible (not occluded)
  occlusionTimestamp?: number; // When the contours became occluded
  centerOfMass: Point; // Center of mass of the contours
}

// Storage for contour data
const contourDataMap = new Map<string, ContourData>();

// Configuration for contour detection
const contourConfig = {
  // Preprocessing options
  blurSize: 5,
  cannyThreshold1: 50,
  cannyThreshold2: 150,
  
  // Contour options
  minContourArea: 100, // Minimum contour area to consider
  maxContours: 10,     // Maximum number of contours to track
  
  // Occlusion detection
  occlusionThreshold: 0.5, // If contour count falls below this percentage of initial, consider occluded
  occlusionDelayMs: 300,   // Delay before triggering occlusion event (reduces false positives)
  reappearanceDelayMs: 300, // Delay before triggering reappearance event
  
  // Debug
  drawContours: true,
};

/**
 * Ensure OpenCV is loaded and ready
 */
async function ensureOpenCV(): Promise<boolean> {
  if (isOpenCVReady()) {
    return true;
  }
  
  console.log('[contourTracking] OpenCV not ready, loading...');
  try {
    await loadOpenCV();
    console.log('[contourTracking] OpenCV loaded successfully');
    return true;
  } catch (err) {
    console.error('[contourTracking] Failed to load OpenCV:', err);
    return false;
  }
}

/**
 * Extract contours from an image using OpenCV
 * @param imageData The image data to process
 * @returns Array of contours, or null if processing failed
 */
export async function detectContours(imageData: ImageData): Promise<any | null> {
  const ready = await ensureOpenCV();
  if (!ready) return null;
  
  try {
    // Create OpenCV matrices
    const src = cv.matFromImageData(imageData);
    const dst = new cv.Mat();
    const gray = new cv.Mat();
    
    try {
      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Apply gaussian blur to reduce noise
      const blurSize = new cv.Size(contourConfig.blurSize, contourConfig.blurSize);
      cv.GaussianBlur(gray, gray, blurSize, 0, 0, cv.BORDER_DEFAULT);
      
      // Apply Canny edge detection
      cv.Canny(gray, dst, contourConfig.cannyThreshold1, contourConfig.cannyThreshold2);
      
      // Find contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      // Filter contours by size and keep only the largest ones
      const validContours = [];
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        if (area >= contourConfig.minContourArea) {
          validContours.push({
            index: i,
            area: area
          });
        }
      }
      
      // Sort by area (largest first)
      validContours.sort((a, b) => b.area - a.area);
      
      // Keep only the top N contours
      const topContours = validContours.slice(0, contourConfig.maxContours);
      
      // Create vectors with only the selected contours
      const filteredContours = new cv.MatVector();
      for (const c of topContours) {
        filteredContours.push_back(contours.get(c.index));
      }
      
      // Calculate center of mass of all contours
      let centerX = 0;
      let centerY = 0;
      let totalArea = 0;
      
      for (const c of topContours) {
        const contour = contours.get(c.index);
        const M = cv.moments(contour);
        if (M.m00 !== 0) {
          centerX += (M.m10 / M.m00) * c.area;
          centerY += (M.m01 / M.m00) * c.area;
          totalArea += c.area;
        }
      }
      
      // Normalize the center coordinates
      const centerOfMass = {
        x: totalArea > 0 ? centerX / totalArea : imageData.width / 2,
        y: totalArea > 0 ? centerY / totalArea : imageData.height / 2,
      };
      
      // Clean up the original contours vector
      contours.delete();
      
      // Return the filtered contours
      return {
        contours: filteredContours,
        hierarchy: hierarchy,
        contourCount: filteredContours.size(),
        centerOfMass: centerOfMass,
      };
    } finally {
      // Clean up OpenCV matrices
      src.delete();
      dst.delete();
      gray.delete();
    }
  } catch (error) {
    console.error('[contourTracking] Error detecting contours:', error);
    return null;
  }
}

/**
 * Create a visual debug image showing the contours
 * @param imageData Original image data
 * @param contourResult Result from detectContours
 * @returns New ImageData with contours drawn, or null if error
 */
export function createContourVisualization(imageData: ImageData, contourResult: any): ImageData | null {
  // Skip visualization if requested or no contours
  if (!contourResult || !contourConfig.drawContours) {
    console.log('[contourTracking] Skipping visualization - drawContours:', contourConfig.drawContours, 'contourResult:', contourResult ? 'exists' : 'missing');
    return null;
  }
  
  try {
    if (!isOpenCVReady()) {
      console.warn('[contourTracking] OpenCV not ready for visualization');
      return null;
    }
    
    // Create OpenCV matrices
    const src = cv.matFromImageData(imageData);
    const dst = src.clone();
    
    try {
      // Draw contours on the image with higher visibility
      const color = new cv.Scalar(0, 255, 0, 255); // Green contours
      const centerColor = new cv.Scalar(255, 0, 0, 255); // Red center point
      
      // Draw all contours with thicker lines for better visibility
      cv.drawContours(dst, contourResult.contours, -1, color, 2);
      
      // Draw the center of mass with a larger circle for visibility
      const center = contourResult.centerOfMass;
      if (center) {
        cv.circle(dst, new cv.Point(center.x, center.y), 5, centerColor, -1);
      }
      
      // Draw a bright outline for better visibility in dark areas
      cv.rectangle(
        dst, 
        new cv.Point(0, 0), 
        new cv.Point(imageData.width - 1, imageData.height - 1),
        new cv.Scalar(255, 255, 255, 128),
        1
      );
      
      // Convert back to ImageData
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) {
        console.warn('[contourTracking] Failed to get canvas context for visualization');
        return null;
      }
      
      // Put the contour image on canvas and read back as ImageData
      cv.imshow(tempCanvas, dst);
      const visualizationData = ctx.getImageData(0, 0, imageData.width, imageData.height);
      
      // Log success occasionally
      if (Math.random() < 0.05) { // 5% chance to log
        console.log(`[contourTracking] Visualization created: ${visualizationData.width}x${visualizationData.height} with data length ${visualizationData.data.length}`);
      }
      
      return visualizationData;
    } finally {
      // Clean up OpenCV resources
      src.delete();
      dst.delete();
    }
  } catch (error) {
    console.error('[contourTracking] Error creating contour visualization:', error);
    return null;
  }
}

/**
 * Initialize contour tracking for a circle ROI
 * Captures the initial contours within the ROI
 * @param roi The CircleROI to track
 * @param imageData The image data containing the ROI
 */
export async function initializeContourTracking(roi: CircleROI, imageData: ImageData): Promise<boolean> {
  try {
    // Extract the region from the image
    const roiImageData = extractROIImageData(roi, imageData);
    if (!roiImageData) {
      console.warn('[contourTracking] Failed to extract ROI image data');
      return false;
    }
    
    // Detect contours in the ROI
    const contourResult = await detectContours(roiImageData);
    if (!contourResult || contourResult.contourCount === 0) {
      console.warn('[contourTracking] No contours detected in ROI');
      return false;
    }
    
    // Store the contour data
    contourDataMap.set(roi.id, {
      id: roi.id,
      initialContours: contourResult.contours,
      initialHierarchy: contourResult.hierarchy,
      contourCount: contourResult.contourCount,
      imageData: roiImageData,
      timestamp: Date.now(),
      isVisible: true,
      centerOfMass: contourResult.centerOfMass
    });
    
    // Send initialization event
    dispatch(EventType.NOTIFICATION, {
      message: `Contour tracking initialized for ROI ${roi.id} with ${contourResult.contourCount} contours`,
      type: 'success'
    });
    
    console.log(`[contourTracking] Initialized tracking for ROI ${roi.id} with ${contourResult.contourCount} contours`);
    return true;
  } catch (error) {
    console.error('[contourTracking] Error initializing contour tracking:', error);
    return false;
  }
}

/**
 * Update contour tracking for a circle ROI
 * Detects contours in the current frame and compares with initial contours
 * @param roi The CircleROI to update
 * @param imageData The new image data
 */
export async function updateContourTracking(roi: CircleROI, imageData: ImageData): Promise<any> {
  // Check if we have initial contour data
  const initialData = contourDataMap.get(roi.id);
  if (!initialData) {
    // Initialize if not already tracked
    const success = await initializeContourTracking(roi, imageData);
    return { isInitialized: success, isOccluded: false };
  }
  
  try {
    // Extract the region from the image
    const roiImageData = extractROIImageData(roi, imageData);
    if (!roiImageData) {
      console.warn('[contourTracking] Failed to extract ROI image data for update');
      return { isInitialized: true, isOccluded: initialData.isVisible ? false : true };
    }
    
    // Detect contours in the current ROI
    const currentContours = await detectContours(roiImageData);
    if (!currentContours) {
      console.warn('[contourTracking] Failed to detect contours in ROI update');
      return { isInitialized: true, isOccluded: initialData.isVisible ? false : true };
    }
    
    // Calculate the contour visibility ratio (current contours / initial contours)
    const visibilityRatio = currentContours.contourCount / initialData.contourCount;
    const now = Date.now();
    
    // Determine if the contours are occluded
    let isCurrentlyOccluded = visibilityRatio < contourConfig.occlusionThreshold;
    
    // Handle state changes with delay to prevent flickering
    if (!initialData.isVisible && !isCurrentlyOccluded) {
      // Contours just became visible again
      if (!initialData.occlusionTimestamp || now - initialData.occlusionTimestamp > contourConfig.reappearanceDelayMs) {
        initialData.isVisible = true;
        dispatch(EventType.NOTIFICATION, {
          message: `Contours reappeared in ROI ${roi.id}`,
          type: 'info'
        });
        
        // Send CONTOUR_VISIBLE event
        dispatch(EventType.SETTINGS_VALUE_CHANGE, {
          section: 'contourTracking',
          setting: 'contourVisible',
          value: {
            roiId: roi.id,
            isVisible: true,
            timestamp: now
          }
        });
      }
    } else if (initialData.isVisible && isCurrentlyOccluded) {
      // Contours just became occluded
      if (!initialData.occlusionTimestamp) {
        initialData.occlusionTimestamp = now;
      } else if (now - initialData.occlusionTimestamp > contourConfig.occlusionDelayMs) {
        initialData.isVisible = false;
        dispatch(EventType.NOTIFICATION, {
          message: `Contours occluded in ROI ${roi.id}`,
          type: 'warning'
        });
        
        // Send CONTOUR_OCCLUDED event
        dispatch(EventType.SETTINGS_VALUE_CHANGE, {
          section: 'contourTracking',
          setting: 'contourOccluded',
          value: {
            roiId: roi.id,
            isVisible: false,
            timestamp: now
          }
        });
      }
    } else {
      // Reset occlusion timestamp if state is consistent
      initialData.occlusionTimestamp = undefined;
    }
    
    // Create contour visualization for debugging
    const visualization = createContourVisualization(roiImageData, currentContours);
    
    // Get region information stored during extraction
    const roiInfo = (roi as any)._roiRegion;
    
    // Adjust center of mass to global image coordinates if region info exists
    let globalCenterOfMass = currentContours.centerOfMass;
    if (roiInfo) {
      // Calculate global coordinates by adding the ROI offset to the center position
      // We need to convert from the ROI's local coordinate system to global normalized coordinates
      globalCenterOfMass = {
        x: (currentContours.centerOfMass.x + roiInfo.x) / roiInfo.imageWidth,
        y: (currentContours.centerOfMass.y + roiInfo.y) / roiInfo.imageHeight
      };
      
      // Only log occasionally to avoid flooding the console
      if (Math.random() < 0.05) { // Log approximately 5% of the time
        console.log(`[contourTracking] Adjusted center of mass: 
          local (${currentContours.centerOfMass.x.toFixed(1)}, ${currentContours.centerOfMass.y.toFixed(1)}) 
          ROI offset (${roiInfo.x}, ${roiInfo.y})
          → global (${globalCenterOfMass.x.toFixed(3)}, ${globalCenterOfMass.y.toFixed(3)})
        `);
      }
    }
    
    // Return tracking result with visualization
    return {
      isInitialized: true,
      isOccluded: !initialData.isVisible,
      contourCount: currentContours.contourCount,
      originalContourCount: initialData.contourCount,
      visibilityRatio,
      centerOfMass: globalCenterOfMass,
      visualizationData: visualization
    };
  } catch (error) {
    console.error('[contourTracking] Error updating contour tracking:', error);
    return { isInitialized: true, isOccluded: initialData.isVisible ? false : true, error: true };
  }
}

/**
 * Clean up resources for an ROI that is no longer needed
 * @param roiId ID of the ROI to clean up
 */
export function cleanupContourTracking(roiId: string): void {
  const data = contourDataMap.get(roiId);
  if (data) {
    // Clean up OpenCV resources
    if (data.initialContours) {
      data.initialContours.delete();
    }
    if (data.initialHierarchy) {
      data.initialHierarchy.delete();
    }
    
    // Remove from map
    contourDataMap.delete(roiId);
    console.log(`[contourTracking] Cleaned up tracking for ROI ${roiId}`);
  }
}

/**
 * Extract the image data from within a circle ROI
 * @param roi The CircleROI
 * @param imageData The full image data
 * @returns Image data for just the ROI area, or null if error
 */
function extractROIImageData(roi: CircleROI, imageData: ImageData): ImageData | null {
  try {
    // Convert normalized coordinates to pixel coordinates
    const centerX = roi.center.x * imageData.width;
    const centerY = roi.center.y * imageData.height;
    const radius = roi.radius * imageData.width; // Radius is normalized relative to width
    
    // Define the square region containing the circle
    const x = Math.max(0, Math.round(centerX - radius));
    const y = Math.max(0, Math.round(centerY - radius));
    const size = Math.min(
      Math.round(radius * 2),
      imageData.width - x,
      imageData.height - y
    );
    
    // Store ROI region information for coordinate transformation
    (roi as any)._roiRegion = { x, y, size, imageWidth: imageData.width, imageHeight: imageData.height };
    
    // Check for valid size
    if (size <= 0) {
      console.warn('[contourTracking] Invalid ROI size');
      return null;
    }
    
    // Create a temporary canvas to extract the region
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[contourTracking] Failed to get canvas context');
      return null;
    }
    
    // Create a temporary canvas for the full image
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = imageData.width;
    fullCanvas.height = imageData.height;
    const fullCtx = fullCanvas.getContext('2d');
    if (!fullCtx) {
      console.warn('[contourTracking] Failed to get full canvas context');
      return null;
    }
    
    // Draw the full image to the canvas
    fullCtx.putImageData(imageData, 0, 0);
    
    // Extract the square region
    ctx.drawImage(
      fullCanvas,
      x, y, size, size,  // Source coordinates
      0, 0, size, size   // Destination coordinates
    );
    
    // Get the image data from the region
    return ctx.getImageData(0, 0, size, size);
  } catch (error) {
    console.error('[contourTracking] Error extracting ROI image data:', error);
    return null;
  }
}

// Initialize OpenCV
ensureOpenCV().then(ready => {
  if (ready) {
    console.log('[contourTracking] OpenCV is ready for contour detection');
  }
});

// Export contour configuration for adjustment
export { contourConfig };