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
  referenceImageData?: ImageData; // Reference image taken when hand is away
  referenceHistogram?: number[]; // Histogram of the reference image for comparison
  hasValidReference: boolean; // Whether we have a valid reference image
  timestamp: number;
  isVisible: boolean; // Whether the contours are visible (not occluded)
  occlusionTimestamp?: number; // When the contours became occluded
  centerOfMass: Point; // Center of mass of the contours
  handPresent: boolean; // Whether a hand is currently in the ROI
  handExitTimestamp?: number; // When the hand last exited the ROI
  referenceDelayMs: number; // Delay after hand exit before taking reference image
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
 * @param hasReference Whether this is a reference image
 * @returns New ImageData with contours drawn, or null if error
 */
export function createContourVisualization(
  imageData: ImageData, 
  contourResult: any,
  hasReference: boolean = false
): ImageData | null {
  if (!contourResult || !contourConfig.drawContours) return null;
  
  try {
    const src = cv.matFromImageData(imageData);
    const dst = src.clone();
    
    try {
      // Choose colors based on reference status
      const color = hasReference 
        ? new cv.Scalar(0, 200, 200, 255)  // Cyan for reference contours
        : new cv.Scalar(0, 255, 0, 255);   // Green for regular contours
      
      const centerColor = hasReference
        ? new cv.Scalar(0, 0, 255, 255)    // Blue center for reference
        : new cv.Scalar(255, 0, 0, 255);   // Red center for regular
      
      // Draw contours on the image
      cv.drawContours(dst, contourResult.contours, -1, color, 2);
      
      // Draw the center of mass
      const center = contourResult.centerOfMass;
      cv.circle(dst, new cv.Point(center.x, center.y), 5, centerColor, -1);
      
      // Add a label if this is a reference image
      if (hasReference) {
        // Put a "REF" text in the top-left corner
        const text = "REFERENCE";
        const font = cv.FONT_HERSHEY_SIMPLEX;
        const fontScale = 0.5;
        const thickness = 1;
        const textColor = new cv.Scalar(0, 200, 255, 255);
        
        // Add black background for text
        cv.putText(
          dst, 
          text, 
          new cv.Point(10, 20),
          font,
          fontScale, 
          new cv.Scalar(0, 0, 0, 255), 
          thickness + 2, 
          cv.LINE_AA
        );
        
        // Add text in cyan
        cv.putText(
          dst, 
          text, 
          new cv.Point(10, 20),
          font,
          fontScale, 
          textColor, 
          thickness, 
          cv.LINE_AA
        );
      }
      
      // Convert back to ImageData
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return null;
      
      // Put the contour image on canvas and read back as ImageData
      cv.imshow(tempCanvas, dst);
      return ctx.getImageData(0, 0, imageData.width, imageData.height);
    } finally {
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
      centerOfMass: contourResult.centerOfMass,
      hasValidReference: false,
      handPresent: true, // Assume hand is present during initialization
      referenceDelayMs: 1000 // Wait 1 second after hand exit to take reference
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
    
    const now = Date.now();

    // First, check if we need to update our reference image
    // We'll determine if there's a hand in the ROI based on the contour count
    // A significant increase in contours typically means a hand has entered the frame
    
    // Calculate difference in contour counts 
    const contourCountDifference = currentContours.contourCount - initialData.contourCount;
    const significantIncrease = contourCountDifference > 3; // More than 3 additional contours
    
    // Detect hand entry/exit
    const wasHandPresent = initialData.handPresent;
    const isHandPresent = significantIncrease;
    
    if (!wasHandPresent && isHandPresent) {
      // Hand just entered the ROI
      initialData.handPresent = true;
      initialData.handExitTimestamp = undefined;
      console.log(`[contourTracking] Hand entered ROI ${roi.id}`);
    } 
    else if (wasHandPresent && !isHandPresent) {
      // Hand just left the ROI
      initialData.handPresent = false;
      initialData.handExitTimestamp = now;
      console.log(`[contourTracking] Hand exited ROI ${roi.id}, will capture reference in ${initialData.referenceDelayMs}ms`);
    }
    
    // Check if we should capture a reference image
    if (!initialData.hasValidReference && 
        !initialData.handPresent && 
        initialData.handExitTimestamp && 
        now - initialData.handExitTimestamp > initialData.referenceDelayMs) {
      
      // Hand has been away long enough, capture reference image
      initialData.referenceImageData = roiImageData;
      initialData.hasValidReference = true;
      initialData.contourCount = currentContours.contourCount; // Update the baseline contour count
      
      console.log(`[contourTracking] Captured reference image for ROI ${roi.id} with ${currentContours.contourCount} contours`);
      
      dispatch(EventType.NOTIFICATION, {
        message: `Reference image captured for ROI ${roi.id}`,
        type: 'success'
      });
    }
    
    // Now check for occlusion based on appropriate reference
    let visibilityRatio = 1.0;
    let isCurrentlyOccluded = false;
    
    if (initialData.hasValidReference) {
      // If we have a reference image, compare to that instead of initial contours
      visibilityRatio = currentContours.contourCount / initialData.contourCount;
      
      // Occlusion means we see significantly fewer contours than in the reference state
      isCurrentlyOccluded = visibilityRatio < contourConfig.occlusionThreshold;
      
      // Ensure hand presence doesn't trigger occlusion
      if (initialData.handPresent) {
        isCurrentlyOccluded = false;
      }
    } else {
      // If no reference yet, use basic detection logic
      visibilityRatio = currentContours.contourCount / initialData.contourCount;
      isCurrentlyOccluded = visibilityRatio < contourConfig.occlusionThreshold;
    }
    
    // Handle state changes with delay to prevent flickering
    if (!initialData.isVisible && !isCurrentlyOccluded) {
      // Contours just became visible again
      if (!initialData.occlusionTimestamp || now - initialData.occlusionTimestamp > contourConfig.reappearanceDelayMs) {
        initialData.isVisible = true;
        
        if (!initialData.handPresent) {
          dispatch(EventType.NOTIFICATION, {
            message: `Object reappeared in ROI ${roi.id}`,
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
      }
    } else if (initialData.isVisible && isCurrentlyOccluded) {
      // Contours just became occluded
      if (!initialData.occlusionTimestamp) {
        initialData.occlusionTimestamp = now;
      } else if (now - initialData.occlusionTimestamp > contourConfig.occlusionDelayMs) {
        initialData.isVisible = false;
        
        if (!initialData.handPresent) {
          dispatch(EventType.NOTIFICATION, {
            message: `Object occluded in ROI ${roi.id}`,
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
      }
    } else {
      // Reset occlusion timestamp if state is consistent
      initialData.occlusionTimestamp = undefined;
    }
    
    // Create contour visualization for debugging
    const visualization = createContourVisualization(
      roiImageData, 
      currentContours, 
      initialData.hasValidReference
    );
    
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
      visualizationData: visualization,
      handPresent: initialData.handPresent,
      hasValidReference: initialData.hasValidReference
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