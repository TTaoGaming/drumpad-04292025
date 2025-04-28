/**
 * [PLACEHOLDER] Enhanced Marker Tracking
 * 
 * This is a placeholder for future marker tracking strategies.
 * We have removed the ORB-based tracking to simplify the system
 * and focus only on hand tracking with pinch lasso ROI functionality.
 */

// Declare OpenCV global for type checking
declare const cv: any;

// Import OpenCV loader for initialization (just for loading OpenCV)
import { isOpenCVReady, loadOpenCV } from './opencvLoader';

// Placeholder for marker tracking results
export interface MarkerTrackingResult {
  isTracked: boolean;
  confidence: number;
  timestamp: number;
}

// Keep these interfaces to prevent import errors in other components
export interface ORBFeature {
  keypoints: any;
  descriptors: any;
  imageData?: ImageData;
  timestamp: number;
}

export interface TrackingResult {
  isTracked: boolean;
  homography?: any;
  matchCount: number;
  inlierCount: number;
  confidence: number;
  center?: { x: number, y: number };
  corners?: { x: number, y: number }[];
  rotation?: number;
}

// Reference features map (empty - no longer used for tracking)
export const referenceFeatures: Map<string, ORBFeature> = new Map();

/**
 * Placeholder for future feature extraction method
 * Currently returns null as ORB is removed
 */
export async function extractORBFeatures(imageData: ImageData, maxFeatures: number = 500): Promise<ORBFeature | null> {
  // Just load OpenCV but don't use it for feature extraction
  const ready = await ensureOpenCV();
  
  console.log('[orbTracking] ORB tracking has been removed. Use pinch lasso for ROI only.');
  return null;
}

/**
 * Placeholder to save reference features - does nothing now
 */
export function saveReferenceFeatures(roiId: string, features: ORBFeature): void {
  console.log(`[Placeholder] Reference features for ROI ${roiId} would be saved here in the future`);
}

/**
 * Placeholder to clear reference features - does nothing now
 */
export function clearReferenceFeatures(roiId: string): void {
  console.log(`[Placeholder] Reference features for ROI ${roiId} would be cleared here in the future`);
}

/**
 * Placeholder for future feature matching - returns fixed result with no tracking
 */
export async function matchFeatures(roiId: string, currentFeatures: ORBFeature): Promise<TrackingResult> {
  return {
    isTracked: false,
    matchCount: 0,
    inlierCount: 0,
    confidence: 0
  };
}

// Helper to ensure OpenCV is available (still needed for other components)
async function ensureOpenCV(): Promise<boolean> {
  if (isOpenCVReady()) {
    return true;
  }
  
  console.log('[orbTracking] OpenCV not ready, loading...');
  try {
    await loadOpenCV();
    console.log('[orbTracking] OpenCV loaded successfully');
    return true;
  } catch (err) {
    console.error('[orbTracking] Failed to load OpenCV:', err);
    return false;
  }
}

// Still initialize OpenCV for other components
ensureOpenCV().then(ready => {
  if (ready) {
    console.log('[orbTracking] OpenCV is ready for future marker tracking strategies');
  }
});