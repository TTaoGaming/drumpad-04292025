/**
 * This file has been removed/deprecated
 * 
 * The ORB feature tracking code has been completely removed
 * in favor of contour detection in contourTracking.ts
 *
 * DO NOT USE THIS FILE - IMPORT FROM contourTracking.ts INSTEAD
 */

// Import OpenCV loader for initialization reference
import { isOpenCVReady, loadOpenCV } from './opencvLoader';

// Include these empty interfaces to prevent import errors in files that haven't been updated yet
export interface MarkerTrackingResult {
  isTracked: boolean;
  confidence: number;
  timestamp: number;
}

export interface ORBFeature {
  keypoints: any;
  descriptors: any;
  imageData?: ImageData;
  timestamp: number;
}

export interface TrackingResult {
  isTracked: boolean;
  matchCount: number;
  inlierCount: number;
  confidence: number;
  center?: { x: number, y: number };
}

// Empty map to prevent null reference errors
export const referenceFeatures: Map<string, any> = new Map();

// All functions now return empty/null results and log warnings

/**
 * @deprecated - Use contour tracking instead
 */
export async function extractORBFeatures(): Promise<null> {
  console.warn('[DEPRECATED] ORB tracking has been removed. Use contour detection instead.');
  return null;
}

/**
 * @deprecated - Use contour tracking instead
 */
export function saveReferenceFeatures(): void {
  console.warn('[DEPRECATED] ORB tracking has been removed. Use contour detection instead.');
}

/**
 * @deprecated - Use contour tracking instead
 */
export function clearReferenceFeatures(): void {
  console.warn('[DEPRECATED] ORB tracking has been removed. Use contour detection instead.');
}

/**
 * @deprecated - Use contour tracking instead
 */
export async function matchFeatures(): Promise<TrackingResult> {
  console.warn('[DEPRECATED] ORB tracking has been removed. Use contour detection instead.');
  return {
    isTracked: false,
    matchCount: 0,
    inlierCount: 0,
    confidence: 0
  };
}