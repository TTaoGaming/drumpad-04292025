/**
 * ORB Feature Tracking Module
 * 
 * This module handles ORB feature extraction and matching for ROI tracking.
 * It enables markers to be tracked as they move or rotate within the camera view.
 */

// OpenCV.js is loaded globally
declare const cv: any;

// Debug helper to check OpenCV availability
function checkOpenCVStatus() {
  const cvObject = typeof window !== 'undefined' ? (window as any).cv : undefined;
  
  console.log('[orbTracking] OpenCV availability check:', {
    time: new Date().toISOString(),
    exists: !!cvObject,
    orb: cvObject ? typeof cvObject.ORB : 'not available',
    mat: cvObject ? typeof cvObject.Mat : 'not available',
    matFromImageData: cvObject ? typeof cvObject.matFromImageData : 'not available',
    source: 'window.cv access'
  });
  
  return !!cvObject && typeof cvObject.ORB === 'function';
}

// Check OpenCV on module load
checkOpenCVStatus();

export interface ORBFeature {
  keypoints: any; // KeyPointVector
  descriptors: any; // Mat
  imageData: ImageData; // Original image data
  timestamp: number;
}

export interface TrackingResult {
  isTracked: boolean;
  homography?: any; // Mat - transformation matrix
  matchCount: number;
  inlierCount: number;
  confidence: number; // 0-1
  center?: { x: number, y: number };
  corners?: { x: number, y: number }[];
  rotation?: number; // In radians
}

// Cache for reference features
export const referenceFeatures: Map<string, ORBFeature> = new Map();

/**
 * Extract ORB features from an image
 * @param imageData The image data to extract features from
 * @param maxFeatures Maximum number of features to extract
 * @returns Object containing keypoints and descriptors
 */
export function extractORBFeatures(imageData: ImageData, maxFeatures: number = 500): ORBFeature | null {
  try {
    // Check if OpenCV is loaded before proceeding
    const isOpenCVAvailable = checkOpenCVStatus();
    if (!isOpenCVAvailable) {
      console.warn('[orbTracking] OpenCV not fully loaded yet. Cannot extract features.');
      return null;
    }
    
    // Double-check cv object has needed methods before continuing
    if (typeof cv === 'undefined' || !cv.matFromImageData) {
      console.warn('[orbTracking] OpenCV exists but matFromImageData is missing. Cannot extract features.');
      return null;
    }
    
    console.log('[orbTracking] Starting feature extraction with image data:', {
      width: imageData.width,
      height: imageData.height,
      maxFeatures: maxFeatures
    });
    
    // Create OpenCV matrices
    const imgMat = cv.matFromImageData(imageData);
    console.log('[orbTracking] Successfully created Mat from ImageData');
    
    const grayMat = new cv.Mat();
    
    // Convert to grayscale for feature detection
    cv.cvtColor(imgMat, grayMat, cv.COLOR_RGBA2GRAY);
    console.log('[orbTracking] Converted to grayscale');
    
    // Create ORB detector
    console.log('[orbTracking] Creating ORB detector...');
    const orb = new cv.ORB(maxFeatures, 1.2, 8, 31, 0, 2, cv.ORB_HARRIS_SCORE, 31, 20);
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();
    
    // Detect keypoints and compute descriptors
    console.log('[orbTracking] Detecting and computing features...');
    const mask = new cv.Mat(); // No mask
    orb.detectAndCompute(grayMat, mask, keypoints, descriptors);
    
    console.log(`[orbTracking] Successfully extracted ${keypoints.size()} ORB features`);
    
    // Clean up
    imgMat.delete();
    grayMat.delete();
    mask.delete();
    
    return {
      keypoints,
      descriptors,
      imageData,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[orbTracking] Error extracting ORB features:', error);
    
    // Log OpenCV availability again if there was an error
    console.log('[orbTracking] OpenCV status check after error:');
    checkOpenCVStatus();
    
    return null;
  }
}

/**
 * Save reference features for an ROI
 * @param roiId The ROI identifier
 * @param features The features to save
 */
export function saveReferenceFeatures(roiId: string, features: ORBFeature): void {
  // Clean up any existing reference features
  if (referenceFeatures.has(roiId)) {
    const oldFeatures = referenceFeatures.get(roiId);
    if (oldFeatures) {
      oldFeatures.keypoints.delete();
      oldFeatures.descriptors.delete();
    }
  }
  
  // Save new reference features
  referenceFeatures.set(roiId, features);
  console.log(`Saved reference features for ROI ${roiId}: ${features.keypoints.size()} keypoints`);
}

/**
 * Clear reference features for an ROI
 * @param roiId The ROI identifier
 */
export function clearReferenceFeatures(roiId: string): void {
  if (referenceFeatures.has(roiId)) {
    const features = referenceFeatures.get(roiId);
    if (features) {
      features.keypoints.delete();
      features.descriptors.delete();
    }
    referenceFeatures.delete(roiId);
    console.log(`Cleared reference features for ROI ${roiId}`);
  }
}

/**
 * Match current features against reference features
 * @param roiId The ROI identifier
 * @param currentFeatures Features from the current frame
 * @returns Tracking result with transformation details
 */
export function matchFeatures(roiId: string, currentFeatures: ORBFeature): TrackingResult {
  try {
    // Check if OpenCV is loaded before proceeding
    if (typeof cv === 'undefined' || !cv.BFMatcher) {
      console.warn('OpenCV is not fully loaded yet. Skipping feature matching.');
      return {
        isTracked: false,
        matchCount: 0,
        inlierCount: 0,
        confidence: 0
      };
    }
    
    // Get reference features
    const referenceFeature = referenceFeatures.get(roiId);
    if (!referenceFeature || currentFeatures.keypoints.size() < 10) {
      return {
        isTracked: false,
        matchCount: 0,
        inlierCount: 0,
        confidence: 0
      };
    }
    
    // Create feature matcher (BF = Brute Force)
    const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
    const matches = new cv.DMatchVector();
    
    // Match descriptors
    matcher.match(referenceFeature.descriptors, currentFeatures.descriptors, matches);
    console.log(`Found ${matches.size()} matches for ROI ${roiId}`);
    
    if (matches.size() < 8) {
      // Need at least 8 matches for homography
      matcher.delete();
      matches.delete();
      return {
        isTracked: false,
        matchCount: matches.size(),
        inlierCount: 0,
        confidence: 0
      };
    }
    
    // Convert keypoints to points for homography calculation
    const refPoints = [];
    const currPoints = [];
    
    for (let i = 0; i < matches.size(); i++) {
      const match = matches.get(i);
      const refKeypoint = referenceFeature.keypoints.get(match.queryIdx);
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
    
    const confidence = inlierCount / matches.size();
    
    // Calculate center point transformation
    const centerX = referenceFeature.imageData.width / 2;
    const centerY = referenceFeature.imageData.height / 2;
    
    const centerMat = cv.matFromArray(1, 1, cv.CV_32FC2, [centerX, centerY]);
    const transformedCenter = new cv.Mat();
    
    cv.perspectiveTransform(centerMat, transformedCenter, homography);
    
    const center = {
      x: transformedCenter.doublePtr(0, 0)[0],
      y: transformedCenter.doublePtr(0, 0)[1]
    };
    
    // Calculate rotation (approximate from homography)
    // This is a simplified approach - real pose estimation would use solvePnP
    const rotation = calculateRotationFromHomography(homography);
    
    // Calculate corners for visualization
    const width = referenceFeature.imageData.width;
    const height = referenceFeature.imageData.height;
    
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
    
    // Clean up
    matcher.delete();
    matches.delete();
    refPointsMat.delete();
    currPointsMat.delete();
    mask.delete();
    centerMat.delete();
    transformedCenter.delete();
    cornersMat.delete();
    transformedCorners.delete();
    
    return {
      isTracked: confidence > 0.4, // At least 40% inliers
      homography,
      matchCount: matches.size(),
      inlierCount: inlierCount,
      confidence,
      center,
      corners,
      rotation
    };
  } catch (error) {
    console.error('Error matching features:', error);
    return {
      isTracked: false,
      matchCount: 0,
      inlierCount: 0,
      confidence: 0
    };
  }
}

/**
 * Extract approximate rotation angle from homography matrix
 * @param homography The homography matrix
 * @returns Rotation angle in radians
 */
function calculateRotationFromHomography(homography: any): number {
  try {
    // The top-left 2x2 sub-matrix of the homography contains rotation and scale
    // We can decompose it to get an approximate rotation angle
    const a = homography.doublePtr(0, 0)[0];
    const b = homography.doublePtr(0, 1)[0];
    const c = homography.doublePtr(1, 0)[0];
    const d = homography.doublePtr(1, 1)[0];
    
    // Average of the two possible rotation angles
    const theta1 = Math.atan2(b, a);
    const theta2 = Math.atan2(-c, d);
    
    // Return the average angle (this is an approximation)
    return (theta1 + theta2) / 2;
  } catch (error) {
    console.error('Error calculating rotation from homography:', error);
    return 0;
  }
}

/**
 * Clean up all OpenCV resources
 */
export function cleanupResources(): void {
  referenceFeatures.forEach((feature, roiId) => {
    clearReferenceFeatures(roiId);
  });
  referenceFeatures.clear();
}