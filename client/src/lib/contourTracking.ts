/**
 * Enhanced Contour Tracking System
 * 
 * A contour detection and tracking system that works
 * with the Circle ROI created by pinch gestures.
 * 
 * This implementation identifies specific shapes (squares, rectangles)
 * and provides real-world measurements using knuckle ruler calibration.
 */

import { CircleROI, Point } from './types';
import { isOpenCVReady, loadOpenCV } from './opencvLoader';
import { EventType, dispatch, addListener } from './eventBus';

// Declare OpenCV global
declare const cv: any;

// Define shape types that can be recognized
export type ShapeType = 'square' | 'rectangle' | 'triangle' | 'circle' | 'unknown';

// Interface for marker data (identified shapes)
export interface MarkerData {
  id: string;           // Unique ID for the marker
  label: string;        // User-assigned label (e.g., "marker #1")
  shape: ShapeType;     // Type of shape detected
  area: number;         // Area of the contour in pixels²
  perimeter: number;    // Perimeter of the contour in pixels
  corners: Point[];     // Corner points for polygon shapes
  center: Point;        // Center point of the marker
  sizeInCm?: {          // Real-world size based on knuckle ruler calibration
    width: number;      // Width in cm
    height: number;     // Height in cm
  };
  timestamp: number;    // When the marker was detected
}

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
  markers: MarkerData[]; // Identified markers within this ROI
}

// Storage for contour data
const contourDataMap = new Map<string, ContourData>();

// Configuration for contour detection
const contourConfig = {
  // Preprocessing options
  blurSize: 5,
  cannyThreshold1: 50,
  cannyThreshold2: 150,
  
  // High-contrast mode settings
  highContrastMode: true,   // Enable by default for marker detection
  thresholdValue: 120,      // Threshold value for binary image (0-255)
  
  // Contour options
  minContourArea: 100,      // Minimum contour area to consider
  maxContours: 10,          // Maximum number of contours to track
  
  // Marker detection settings
  prioritizeSquares: true,  // Prioritize square/rectangle shapes
  
  // Size calibration
  pixelToCmRatio: 0.025,    // Default pixels to cm ratio (will be updated based on knuckle ruler)
  
  // Occlusion detection
  occlusionThreshold: 0.5,  // If contour count falls below this percentage of initial, consider occluded
  occlusionDelayMs: 300,    // Delay before triggering occlusion event (reduces false positives)
  reappearanceDelayMs: 300, // Delay before triggering reappearance event
  
  // Persistence settings for marker tracking
  trackMarkersBetweenFrames: true, // Enable tracking markers across frames
  markerMatchThreshold: 0.2,       // Position change threshold for identifying same marker
  
  // Debug visualization
  drawContours: true,             // Draw contour outlines
  showMarkerLabels: true,         // Show marker labels and measurements
  showMarkerMeasurements: true,   // Show real-world measurements
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
 * @param highContrastMode Enable optimization for high-contrast markers on white background
 * @returns Array of contours, or null if processing failed
 */
export async function detectContours(
  imageData: ImageData, 
  highContrastMode: boolean = true
): Promise<any | null> {
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
      
      if (highContrastMode) {
        // For high-contrast markers on white background:
        // 1. Apply threshold to separate dark markers from background
        cv.threshold(gray, gray, 120, 255, cv.THRESH_BINARY_INV);
        
        // 2. Apply morphological operations to clean up noise
        const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
        // Opening operation (erosion followed by dilation) to remove small noise
        cv.morphologyEx(gray, gray, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 1);
        kernel.delete();
      } else {
        // Standard approach for general contour detection
        // Apply gaussian blur to reduce noise
        const blurSize = new cv.Size(contourConfig.blurSize, contourConfig.blurSize);
        cv.GaussianBlur(gray, gray, blurSize, 0, 0, cv.BORDER_DEFAULT);
        
        // Apply Canny edge detection
        cv.Canny(gray, dst, contourConfig.cannyThreshold1, contourConfig.cannyThreshold2);
        // Copy dst to gray for consistent pipeline
        dst.copyTo(gray);
      }
      
      // Find contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(
        gray, // Use processed binary image for high-contrast mode
        contours, 
        hierarchy, 
        cv.RETR_EXTERNAL, 
        cv.CHAIN_APPROX_SIMPLE
      );
      
      // Filter contours by size and keep only the largest ones
      const validContours = [];
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        if (area >= contourConfig.minContourArea) {
          // Approximate the contour to reduce noise and identify shapes better
          const perimeter = cv.arcLength(contour, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, 0.04 * perimeter, true);
          
          // If in high-contrast mode, prioritize shapes with 4 corners (squares/rectangles)
          const vertexCount = approx.rows;
          const isLikelyMarker = highContrastMode ? (vertexCount === 4) : true;
          
          if (isLikelyMarker) {
            validContours.push({
              index: i,
              area: area,
              vertexCount: vertexCount
            });
          }
          
          approx.delete();
        }
      }
      
      // If in high-contrast mode, prioritize 4-sided shapes (squares/rectangles) first
      if (highContrastMode) {
        validContours.sort((a, b) => {
          // Sort 4-sided shapes first, then by area
          if (a.vertexCount === 4 && b.vertexCount !== 4) return -1;
          if (a.vertexCount !== 4 && b.vertexCount === 4) return 1;
          return b.area - a.area; // Then by area (largest first)
        });
      } else {
        // Standard sort by area
        validContours.sort((a, b) => b.area - a.area);
      }
      
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
        highContrastMode: highContrastMode // Include the mode in the result
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
/**
 * Identify the shape of a contour
 * @param contour The contour to analyze
 * @returns Information about the identified shape
 */
export function identifyShape(contour: any): { 
  shape: ShapeType,
  corners: Point[],
  perimeter: number,
  area: number,
  center: Point
} {
  // Calculate basic contour features
  const perimeter = cv.arcLength(contour, true);
  const area = cv.contourArea(contour);
  
  // Calculate moments to find centroid
  const M = cv.moments(contour);
  const center = {
    x: M.m10 / M.m00,
    y: M.m01 / M.m00
  };
  
  // Approximate the contour with fewer points
  const epsilon = 0.04 * perimeter; // Precision parameter (smaller = more precise)
  const approx = new cv.Mat();
  cv.approxPolyDP(contour, approx, epsilon, true);
  
  // Extract the corner points
  const corners: Point[] = [];
  for (let i = 0; i < approx.rows; i++) {
    corners.push({
      x: approx.data32S[i * 2],
      y: approx.data32S[i * 2 + 1]
    });
  }
  
  // Identify shape based on number of corners
  let shape: ShapeType = 'unknown';
  
  if (approx.rows === 3) {
    shape = 'triangle';
  } 
  else if (approx.rows === 4) {
    // Calculate aspect ratio to distinguish between square and rectangle
    // Find min/max X and Y to get width and height
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let maxY = Number.MIN_VALUE;
    
    for (const corner of corners) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    
    // If aspect ratio is close to 1, it's a square
    if (aspectRatio < 1.2) {
      shape = 'square';
    } else {
      shape = 'rectangle';
    }
  } 
  else if (approx.rows >= 8 && approx.rows <= 12) {
    // Calculate circularity to check if it's circular
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    // Circle has circularity close to 1.0
    if (circularity > 0.8) {
      shape = 'circle';
    }
  }
  
  // Clean up the approximation matrix
  approx.delete();
  
  return {
    shape,
    corners,
    perimeter,
    area,
    center
  };
}

/**
 * Generate a unique and consistent marker label
 * @param roiId The ROI ID
 * @param shape The shape type
 * @param index The index of the marker in the ROI
 * @returns A consistent marker label
 */
function generateMarkerLabel(roiId: string, shape: ShapeType, index: number): string {
  return `${shape} #${index + 1}`;
}

/**
 * Create a visual debug image showing the contours and identified shapes
 * @param imageData Original image data
 * @param contourResult Result from detectContours
 * @param markers Optional array of identified markers to visualize
 * @returns New ImageData with contours drawn, or null if error
 */
export function createContourVisualization(
  imageData: ImageData, 
  contourResult: any, 
  markers?: MarkerData[]
): ImageData | null {
  if (!contourResult || !contourConfig.drawContours) return null;
  
  try {
    const src = cv.matFromImageData(imageData);
    const dst = src.clone();
    
    try {
      // Draw contours on the image
      const color = new cv.Scalar(0, 255, 0, 255); // Green contours
      const centerColor = new cv.Scalar(255, 0, 0, 255); // Red center point
      
      cv.drawContours(dst, contourResult.contours, -1, color, 2);
      
      // Draw the center of mass
      const center = contourResult.centerOfMass;
      cv.circle(dst, new cv.Point(center.x, center.y), 5, centerColor, -1);
      
      // Draw identified markers if provided
      if (markers && markers.length > 0) {
        // Draw each marker with its label
        for (const marker of markers) {
          // Different color for each shape type
          let shapeColor;
          switch (marker.shape) {
            case 'square': 
              shapeColor = new cv.Scalar(255, 0, 0, 255); // Red
              break;
            case 'rectangle': 
              shapeColor = new cv.Scalar(0, 0, 255, 255); // Blue
              break;
            case 'triangle': 
              shapeColor = new cv.Scalar(255, 255, 0, 255); // Yellow
              break;
            case 'circle': 
              shapeColor = new cv.Scalar(255, 0, 255, 255); // Magenta
              break;
            default: 
              shapeColor = new cv.Scalar(128, 128, 128, 255); // Gray
          }
          
          // Draw the corners as a polygon
          if (marker.corners.length > 0) {
            const points = new cv.Mat();
            for (const corner of marker.corners) {
              points.push_back(new cv.Mat([corner.x, corner.y], cv.CV_32SC1));
            }
            cv.polylines(dst, [points], true, shapeColor, 3);
            points.delete();
          }
          
          // Draw the center point of the marker
          cv.circle(dst, new cv.Point(marker.center.x, marker.center.y), 4, shapeColor, -1);
          
          // Add a text label with the marker ID
          const fontScale = 0.5;
          const fontColor = new cv.Scalar(255, 255, 255, 255);
          const textPoint = new cv.Point(marker.center.x - 30, marker.center.y - 10);
          
          // Add white background for text
          const textSize = cv.getTextSize(marker.label, cv.FONT_HERSHEY_SIMPLEX, fontScale, 1);
          cv.rectangle(
            dst, 
            new cv.Point(textPoint.x - 2, textPoint.y - textSize.height - 2), 
            new cv.Point(textPoint.x + textSize.width + 2, textPoint.y + 2),
            new cv.Scalar(0, 0, 0, 128),
            cv.FILLED
          );
          
          // Draw the marker label
          cv.putText(
            dst, 
            marker.label, 
            textPoint, 
            cv.FONT_HERSHEY_SIMPLEX, 
            fontScale, 
            fontColor, 
            1
          );
          
          // Draw size in centimeters if available
          if (marker.sizeInCm) {
            const sizeText = `${marker.sizeInCm.width.toFixed(1)}cm × ${marker.sizeInCm.height.toFixed(1)}cm`;
            const sizePoint = new cv.Point(marker.center.x - 40, marker.center.y + 15);
            
            // Add white background for size text
            const sizeTextSize = cv.getTextSize(sizeText, cv.FONT_HERSHEY_SIMPLEX, fontScale, 1);
            cv.rectangle(
              dst, 
              new cv.Point(sizePoint.x - 2, sizePoint.y - sizeTextSize.height - 2), 
              new cv.Point(sizePoint.x + sizeTextSize.width + 2, sizePoint.y + 2),
              new cv.Scalar(0, 0, 0, 128),
              cv.FILLED
            );
            
            // Draw the size text
            cv.putText(
              dst, 
              sizeText, 
              sizePoint, 
              cv.FONT_HERSHEY_SIMPLEX, 
              fontScale, 
              fontColor, 
              1
            );
          }
        }
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
      markers: [] // Initialize empty markers array
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
    
    // Identify specific shapes (markers) in the contours
    const identifiedMarkers: MarkerData[] = [];
    
    // Convert normalized knuckle distance to pixels for this region
    // Get knuckle distance settings from global state (default to 8cm if not available)
    const knuckleDistanceCm = 8.0; // We'll update this with the actual setting later
    
    // Process each contour to identify shapes
    for (let i = 0; i < currentContours.contours.size(); i++) {
      try {
        const contour = currentContours.contours.get(i);
        
        // Skip very small contours
        const area = cv.contourArea(contour);
        if (area < contourConfig.minContourArea) {
          continue;
        }
        
        // Identify the shape
        const shapeInfo = identifyShape(contour);
        
        // We're particularly interested in squares and rectangles (high-contrast markers)
        if (shapeInfo.shape === 'square' || shapeInfo.shape === 'rectangle') {
          // Create a marker entry
          const markerId = `${roi.id}-${shapeInfo.shape}-${i}`;
          
          // Find min/max X and Y to calculate width and height in pixels
          let minX = Number.MAX_VALUE;
          let minY = Number.MAX_VALUE;
          let maxX = Number.MIN_VALUE;
          let maxY = Number.MIN_VALUE;
          
          for (const corner of shapeInfo.corners) {
            minX = Math.min(minX, corner.x);
            minY = Math.min(minY, corner.y);
            maxX = Math.max(maxX, corner.x);
            maxY = Math.max(maxY, corner.y);
          }
          
          const widthPx = maxX - minX;
          const heightPx = maxY - minY;
          
          // Calculate size in centimeters based on knuckle ruler calibration
          // This is a simplified conversion - for a real app, we would need to account for perspective, etc.
          const pixelsToCm = knuckleDistanceCm / (roiImageData.width * 0.25); // Assume knuckle is ~25% of view width
          const widthCm = widthPx * pixelsToCm;
          const heightCm = heightPx * pixelsToCm;
          
          // Create the marker entry
          const marker: MarkerData = {
            id: markerId,
            label: `${shapeInfo.shape} #${i+1}`,
            shape: shapeInfo.shape,
            area: shapeInfo.area,
            perimeter: shapeInfo.perimeter,
            corners: shapeInfo.corners,
            center: shapeInfo.center,
            sizeInCm: {
              width: widthCm,
              height: heightCm
            },
            timestamp: Date.now()
          };
          
          // Add to our list of identified markers
          identifiedMarkers.push(marker);
        }
      } catch (error) {
        console.error(`[contourTracking] Error processing contour ${i}:`, error);
      }
    }
    
    // Update the markers in our data map
    initialData.markers = identifiedMarkers;
    
    // Create contour visualization for debugging with identified markers
    const visualization = createContourVisualization(roiImageData, currentContours, identifiedMarkers);
    
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
    
    // Return tracking result with visualization and marker information
    return {
      isInitialized: true,
      isOccluded: !initialData.isVisible,
      contourCount: currentContours.contourCount,
      originalContourCount: initialData.contourCount,
      visibilityRatio,
      centerOfMass: globalCenterOfMass,
      visualizationData: visualization,
      markers: identifiedMarkers
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

/**
 * Update the pixel-to-cm ratio based on knuckle ruler measurements
 * @param knuckleDistanceCm The actual distance between knuckles in centimeters
 * @param pixelDistance The distance between knuckles in pixels
 */
export function updatePixelToCmRatio(knuckleDistanceCm: number, pixelDistance: number): void {
  if (knuckleDistanceCm <= 0 || pixelDistance <= 0) {
    console.warn('[contourTracking] Invalid knuckle measurements, cannot update pixel-to-cm ratio');
    return;
  }
  
  // Calculate the new ratio
  const newRatio = knuckleDistanceCm / pixelDistance;
  
  // Update the config
  contourConfig.pixelToCmRatio = newRatio;
  
  console.log(`[contourTracking] Updated pixel-to-cm ratio: ${newRatio.toFixed(6)} cm/pixel`);
  console.log(`[contourTracking] Knuckle distance: ${knuckleDistanceCm}cm = ${pixelDistance}px`);
}

/**
 * Convert a measurement in pixels to centimeters using the current calibration
 * @param pixelValue The measurement in pixels
 * @returns The measurement in centimeters
 */
export function pixelsToCm(pixelValue: number): number {
  return pixelValue * contourConfig.pixelToCmRatio;
}

/**
 * Get markers from an ROI by ID
 * @param roiId The ID of the ROI
 * @returns Array of markers, or empty array if none
 */
export function getMarkersFromROI(roiId: string): MarkerData[] {
  const data = contourDataMap.get(roiId);
  if (!data || !data.markers) {
    return [];
  }
  return [...data.markers]; // Return a copy to prevent direct modification
}

/**
 * Initialize listeners for external events that impact contour tracking
 */
function initializeEventListeners(): void {
  // Listen for knuckle ruler updates to calibrate our measurements
  addListener(EventType.SETTINGS_VALUE_CHANGE, (data: any) => {
    if (data.section === 'calibration' && data.setting === 'knuckleRulerRealtime') {
      // Extract knuckle distance measurement data
      const pixelDistance = data.value.pixelDistance;
      // Get the current knuckle distance in cm from configuration
      // In a real implementation, we'd get this from a global settings store
      const knuckleDistanceCm = 8.0; // Default value, should be replaced with actual value
      
      // Update our calibration
      if (pixelDistance > 0) {
        updatePixelToCmRatio(knuckleDistanceCm, pixelDistance);
      }
    }
  });
}

// Set up the event listeners
initializeEventListeners();

// Initialize OpenCV
ensureOpenCV().then(ready => {
  if (ready) {
    console.log('[contourTracking] OpenCV is ready for contour detection');
  }
});

// Export contour configuration for adjustment
export { contourConfig };