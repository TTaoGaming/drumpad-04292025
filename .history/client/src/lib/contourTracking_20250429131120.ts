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
import logger from './logger';

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
  huMoments?: number[]; // Shape descriptor using Hu moments
  shapeSignature?: number[]; // Optional shape signature for more detailed matching
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
  
  // Shape matching
  useShapeMatching: true, // Whether to use shape matching to maintain identity
  huMatchThreshold: 0.8,  // Similarity threshold for Hu moments matching (0-1, higher is more strict)
  
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
  
  logger.info('Contour', 'OpenCV not ready, loading...');
  try {
    await loadOpenCV();
    logger.info('Contour', 'OpenCV loaded successfully');
    return true;
  } catch (err) {
    logger.error('Contour', 'Failed to load OpenCV:', err);
    return false;
  }
}

/**
 * Calculate Hu Moments for a contour
 * These are shape descriptors that are invariant to translation, rotation, and scale
 * @param contour OpenCV contour
 * @returns Array of 7 Hu moments
 */
function calculateHuMoments(contour: any): number[] {
  try {
    // Calculate moments
    const moments = cv.moments(contour);
    
    // Calculate Hu moments - returns a Mat with 7 moments
    const huMat = new cv.Mat();
    cv.HuMoments(moments, huMat);
    
    // Convert to array and take logarithm for better comparison
    const huArray: number[] = [];
    for (let i = 0; i < 7; i++) {
      // Use log to handle the large dynamic range of the moments
      // We use abs since some moments can be negative
      huArray.push(Math.log(Math.abs(huMat.doubleAt(i, 0)) + 1e-10));
    }
    
    // Clean up
    huMat.delete();
    
    return huArray;
  } catch (error) {
    console.error('[contourTracking] Error calculating Hu moments:', error);
    return [0, 0, 0, 0, 0, 0, 0]; // Return default values on error
  }
}

/**
 * Compare two sets of Hu moments to determine shape similarity
 * @param huMoments1 First set of Hu moments
 * @param huMoments2 Second set of Hu moments
 * @returns Similarity score (0-1, where 1 is identical)
 */
function compareHuMoments(huMoments1: number[], huMoments2: number[]): number {
  if (!huMoments1 || !huMoments2 || huMoments1.length !== 7 || huMoments2.length !== 7) {
    return 0;
  }
  
  try {
    // Calculate a weighted distance between the moment sets
    // First moments are more stable, so we weight them higher
    const weights = [2.0, 1.5, 1.0, 1.0, 0.8, 0.8, 0.5];
    let distance = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < 7; i++) {
      distance += weights[i] * Math.abs(huMoments1[i] - huMoments2[i]);
      totalWeight += weights[i];
    }
    
    // Normalize distance (0-1, lower is more similar)
    const normalizedDistance = distance / totalWeight;
    
    // Convert to similarity score (0-1, higher is more similar)
    // Exponential function to make small differences less significant
    const similarity = Math.exp(-3 * normalizedDistance);
    
    return similarity;
  } catch (error) {
    console.error('[contourTracking] Error comparing Hu moments:', error);
    return 0;
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
          // Calculate Hu moments for shape matching
          const huMoments = calculateHuMoments(contour);
          
          validContours.push({
            index: i,
            area: area,
            huMoments: huMoments
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
      
      // Return the filtered contours with shape descriptors
      return {
        contours: filteredContours,
        hierarchy: hierarchy,
        contourCount: filteredContours.size(),
        centerOfMass: centerOfMass,
        shapeDescriptors: topContours.map(c => c.huMoments)
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

import { getCanvas, getContext, returnCanvas } from './canvasPool';

/**
 * Create a visual debug image showing the contours
 * @param imageData Original image data
 * @param contourResult Result from detectContours
 * @returns New ImageData with contours drawn, or null if error
 */
export function createContourVisualization(imageData: ImageData, contourResult: any): ImageData | null {
  if (!contourResult || !contourConfig.drawContours) return null;
  
  try {
    // Create a new transparent Mat instead of cloning the source
    const width = imageData.width;
    const height = imageData.height;
    const dst = new cv.Mat(height, width, cv.CV_8UC4, new cv.Scalar(0, 0, 0, 0));
    
    try {
      // Draw contours on the transparent image with increased line thickness for better visibility
      const defaultColor = new cv.Scalar(0, 255, 0, 255); // Green for normal contours
      const matchedColor = new cv.Scalar(0, 0, 255, 255); // Blue for shape-matched contour
      const centerColor = new cv.Scalar(255, 0, 0, 255); // Red center point
      
      // Check if we have a shape-matched contour index
      let matchedContourIndex = -1;
      if (contourResult.bestMatchIndex !== undefined) {
        matchedContourIndex = contourResult.bestMatchIndex;
      }
      
      // Draw all contours with thicker lines for better visibility
      for (let i = 0; i < contourResult.contours.size(); i++) {
        // Use different color for the matched contour
        const color = (i === matchedContourIndex) ? matchedColor : defaultColor;
        
        // Draw this contour with thicker lines (increase from 2 to 3)
        const contourArray = new cv.MatVector();
        contourArray.push_back(contourResult.contours.get(i));
        cv.drawContours(dst, contourArray, 0, color, 3);
        contourArray.delete();
      }
      
      // Draw the center of mass with larger radius for better visibility
      const center = contourResult.centerOfMass;
      cv.circle(dst, new cv.Point(center.x, center.y), 6, centerColor, -1);
      
      // Add text for shape match confidence if available
      if (contourResult.shapeSimilarity !== undefined && contourResult.shapeSimilarity > 0) {
        const text = `Shape: ${(contourResult.shapeSimilarity * 100).toFixed(0)}%`;
        const textColor = contourResult.shapeSimilarity >= contourConfig.huMatchThreshold ? 
                         new cv.Scalar(0, 0, 255, 255) : // Blue for good match
                         new cv.Scalar(255, 165, 0, 255); // Orange for poor match
        
        cv.putText(
          dst, 
          text, 
          new cv.Point(10, imageData.height - 10),
          cv.FONT_HERSHEY_SIMPLEX,
          0.6, // Slightly larger font size
          textColor,
          2 // Thicker text for better visibility
        );
      }
      
      // Convert back to ImageData using canvas pool
      const tempCanvas = getCanvas(imageData.width, imageData.height);
      const ctx = getContext(tempCanvas);
      if (!ctx) return null;
      
      // Put the contour image on canvas and read back as ImageData
      cv.imshow(tempCanvas, dst);
      const resultImageData = ctx.getImageData(0, 0, imageData.width, imageData.height);
      
      // Return the canvas to the pool
      returnCanvas(tempCanvas);
      
      return resultImageData;
    } finally {
      // Clean up resources (no src to delete in this modification)
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
    
    // Calculate Hu moments for largest contour for shape matching
    let huMoments = null;
    if (contourResult.contours.size() > 0 && contourResult.shapeDescriptors.length > 0) {
      huMoments = contourResult.shapeDescriptors[0]; // Use the largest contour's moments
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
      huMoments: huMoments
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
    
    // Variables to track if we found the correct contour by shape
    let foundMatchingContour = false;
    let bestMatchScore = 0;
    let bestMatchIndex = -1;
    
    // Try to match contours by shape to maintain identity
    if (contourConfig.useShapeMatching && initialData.huMoments && 
        currentContours.shapeDescriptors && currentContours.shapeDescriptors.length > 0) {
      
      // Compare shape descriptors of each contour with our original ROI
      for (let i = 0; i < currentContours.shapeDescriptors.length; i++) {
        const similarity = compareHuMoments(initialData.huMoments, currentContours.shapeDescriptors[i]);
        
        if (similarity > bestMatchScore) {
          bestMatchScore = similarity;
          bestMatchIndex = i;
        }
      }
      
      // If we found a good match by shape
      if (bestMatchScore >= contourConfig.huMatchThreshold) {
        foundMatchingContour = true;
        
        // Only log occasionally to avoid console spam
        if (Math.random() < 0.05) {
          console.log(`[contourTracking] Found matching contour by shape with similarity: ${bestMatchScore.toFixed(3)}`);
        }
      } else if (bestMatchIndex >= 0) {
        // We found a best match, but it's below our threshold
        if (Math.random() < 0.05) {
          console.log(`[contourTracking] Best contour match has insufficient similarity: ${bestMatchScore.toFixed(3)}`);
        }
      }
    }
    
    // Calculate the contour visibility ratio (current contours / initial contours)
    const visibilityRatio = currentContours.contourCount / initialData.contourCount;
    const now = Date.now();
    
    // Determine if the contours are occluded
    let isCurrentlyOccluded = visibilityRatio < contourConfig.occlusionThreshold;
    
    // If we're using shape matching and didn't find a matching contour,
    // consider it occluded even if there are other contours present
    if (contourConfig.useShapeMatching && !foundMatchingContour && currentContours.contourCount > 0) {
      isCurrentlyOccluded = true;
      if (Math.random() < 0.05) {
        console.log(`[contourTracking] No matching contour found by shape, considering occluded`);
      }
    }
    
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
    const visualization = createContourVisualization(roiImageData, {
      ...currentContours,
      bestMatchIndex: bestMatchIndex,
      shapeSimilarity: bestMatchScore
    });
    
    // Get region information stored during extraction
    const roiInfo = (roi as any)._roiRegion;
    
    // Adjust center of mass to global image coordinates if region info exists
    let globalCenterOfMass = currentContours.centerOfMass;
    
    // If using shape matching and we found a matching contour,
    // use the best matching contour's center instead of all contours' average
    if (foundMatchingContour && bestMatchIndex >= 0 && bestMatchIndex < currentContours.contours.size()) {
      const bestContour = currentContours.contours.get(bestMatchIndex);
      const M = cv.moments(bestContour);
      
      if (M.m00 !== 0) {
        // Use the matching contour's center
        globalCenterOfMass = {
          x: M.m10 / M.m00,
          y: M.m01 / M.m00
        };
        
        if (Math.random() < 0.05) {
          console.log(`[contourTracking] Using shape-matched contour center: (${globalCenterOfMass.x.toFixed(1)}, ${globalCenterOfMass.y.toFixed(1)})`);
        }
      }
    }
    
    if (roiInfo) {
      // Calculate global coordinates by adding the ROI offset to the center position
      // We need to convert from the ROI's local coordinate system to global normalized coordinates
      globalCenterOfMass = {
        x: (globalCenterOfMass.x + roiInfo.x) / roiInfo.imageWidth,
        y: (globalCenterOfMass.y + roiInfo.y) / roiInfo.imageHeight
      };
      
      // Only log occasionally to avoid flooding the console
      if (Math.random() < 0.05) { // Log approximately 5% of the time
        console.log(`[contourTracking] Adjusted center of mass: 
          local (${currentContours.centerOfMass.x.toFixed(1)}, ${currentContours.centerOfMass.y.toFixed(1)}) 
          ROI offset (${roiInfo.x}, ${roiInfo.y})
          → global (${globalCenterOfMass.x.toFixed(3)}, ${globalCenterOfMass.y.toFixed(3)})
          Shape match: ${foundMatchingContour ? bestMatchScore.toFixed(3) : "Not found"}
        `);
      }
    }
    
    // Prepare tracking result data
    const trackingResult = {
      isInitialized: true,
      isOccluded: !initialData.isVisible,
      contourCount: currentContours.contourCount,
      originalContourCount: initialData.contourCount,
      visibilityRatio,
      centerOfMass: globalCenterOfMass,
      visualizationData: visualization,
      shapeMatched: foundMatchingContour,
      shapeSimilarity: bestMatchScore
    };
    
    // Import marker state manager if available
    try {
      // Dynamic import to avoid circular dependencies
      const markerStateManager = (await import('./markerStateManager')).default;
      
      // Update marker state based on tracking results
      const markerState = markerStateManager.updateMarkerState(roi.id, trackingResult);
      
      // Add state information to result
      return {
        ...trackingResult,
        markerState: markerState.state,
        stateCode: markerState.stateCode
      };
    } catch (err) {
      console.warn('[contourTracking] MarkerStateManager not available:', err);
      return trackingResult;
    }
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
 * Uses canvas pooling for better performance
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
    // Round to integers to avoid fractional pixel issues
    const x = Math.max(0, Math.round(centerX - radius));
    const y = Math.max(0, Math.round(centerY - radius));
    const size = Math.min(
      Math.round(radius * 2),
      imageData.width - x,
      imageData.height - y
    );
    
    // Store ROI region information for coordinate transformation
    // Include all relevant metrics for precise alignment during visualization
    (roi as any)._roiRegion = { 
      x, 
      y, 
      size, 
      centerX,
      centerY,
      radius,
      extractedDiameter: size,
      imageWidth: imageData.width, 
      imageHeight: imageData.height 
    };
    
    // Check for valid size
    if (size <= 0) {
      console.warn('[contourTracking] Invalid ROI size');
      return null;
    }
    
    // Create a new ImageData directly (more efficient for small regions)
    // We'll do a direct pixel copy without an intermediate canvas
    const roiData = new ImageData(size, size);
    
    // Manual pixel copy loop - more efficient than using multiple canvases for small regions
    const srcData = imageData.data;
    const dstData = roiData.data;
    const srcWidth = imageData.width;
    
    // Direct pixel copying (4 bytes per pixel - RGBA)
    for (let j = 0; j < size; j++) {
      const srcRowOffset = ((y + j) * srcWidth + x) * 4;
      const dstRowOffset = j * size * 4;
      
      // Copy entire row at once using TypedArray.set for better performance
      // This is much faster than copying pixel by pixel
      dstData.set(
        srcData.subarray(srcRowOffset, srcRowOffset + size * 4),
        dstRowOffset
      );
    }
    
    if (Math.random() < 0.01) {
      console.log(`[contourTracking] Extracted ROI from (${x}, ${y}) with size ${size}px`);
    }
    
    return roiData;
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