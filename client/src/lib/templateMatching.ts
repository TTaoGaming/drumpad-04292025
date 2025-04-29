/**
 * Template Matching Module
 * 
 * A simple and effective approach for tracking objects in frames
 * using OpenCV's template matching algorithm.
 */

import { loadOpenCV, isOpenCVReady } from './opencvLoader';
import { getFrameManager } from './FrameManager';

// TemplateMatcher result interface
export interface TemplateMatchResult {
  isTracked: boolean;    // Whether tracking is successful
  x: number;             // X position of the match (top-left)
  y: number;             // Y position of the match (top-left)
  width: number;         // Width of the template
  height: number;        // Height of the template
  centerX: number;       // Center X position
  centerY: number;       // Center Y position
  confidence: number;    // Matching confidence (0-1)
}

// Keep a cache of templates
const templateCache: Map<string, {
  template: any;         // CV.Mat
  imageData: ImageData;  // Original ImageData
  width: number;         // Template width
  height: number;        // Template height
  timestamp: number;     // When it was captured
}> = new Map();

/**
 * Ensure OpenCV is ready for template matching
 * @returns Promise that resolves when OpenCV is ready
 */
export async function ensureTemplateMatchingReady(): Promise<boolean> {
  if (isOpenCVReady()) {
    return true;
  }
  
  try {
    await loadOpenCV();
    console.log('[TemplateMatcher] OpenCV loaded successfully');
    return true;
  } catch (err) {
    console.error('[TemplateMatcher] Failed to load OpenCV:', err);
    return false;
  }
}

/**
 * Save a template for future matching
 * @param id Unique identifier for the template
 * @param imageData ImageData containing the template
 * @returns True if successful, false otherwise
 */
export function saveTemplate(id: string, imageData: ImageData): boolean {
  if (!isOpenCVReady()) {
    console.warn('[TemplateMatcher] OpenCV not ready, cannot save template');
    return false;
  }
  
  try {
    // First clean up any existing template with this ID
    if (templateCache.has(id)) {
      const oldTemplate = templateCache.get(id);
      if (oldTemplate && oldTemplate.template) {
        oldTemplate.template.delete();
      }
      templateCache.delete(id);
    }
    
    // Create a new OpenCV matrix from the image data
    const cv = (window as any).cv;
    const mat = cv.matFromImageData(imageData);
    
    // We assume template is small enough to not need preprocessing
    // But we could add edge enhancement, contrast boosting, etc.
    
    // Add template to the cache
    templateCache.set(id, {
      template: mat,
      imageData,
      width: imageData.width,
      height: imageData.height,
      timestamp: Date.now()
    });
    
    console.log(`[TemplateMatcher] Saved template ${id} (${imageData.width}x${imageData.height})`);
    return true;
  } catch (error) {
    console.error('[TemplateMatcher] Error saving template:', error);
    return false;
  }
}

/**
 * Clear a saved template
 * @param id Template ID to clear
 */
export function clearTemplate(id: string): void {
  if (templateCache.has(id)) {
    const template = templateCache.get(id);
    if (template && template.template) {
      template.template.delete();
    }
    templateCache.delete(id);
    console.log(`[TemplateMatcher] Cleared template ${id}`);
  }
}

/**
 * Match a template in the given ImageData
 * @param id Template ID to match
 * @param imageData ImageData to search in
 * @param debugCallback Optional callback for debugging visualization
 * @returns Match result or null if template not found/available
 */
export function matchTemplate(
  id: string, 
  imageData: ImageData,
  debugCallback?: (debugData: any) => void
): TemplateMatchResult | null {
  if (!isOpenCVReady()) {
    console.warn('[TemplateMatcher] OpenCV not ready, cannot match template');
    return null;
  }
  
  // Check if we have this template
  if (!templateCache.has(id)) {
    console.warn(`[TemplateMatcher] Template ${id} not found`);
    return null;
  }
  
  try {
    const cv = (window as any).cv;
    const template = templateCache.get(id)!;
    
    // Create matrices for template matching
    const searchMat = cv.matFromImageData(imageData);
    const resultMat = new cv.Mat();
    
    // Determine template matching method
    // TM_CCOEFF_NORMED gives values from -1 to 1 where 1 is perfect match
    const matchMethod = cv.TM_CCOEFF_NORMED;
    
    // Perform template matching
    cv.matchTemplate(searchMat, template.template, resultMat, matchMethod);
    
    // Find best match location
    const result = cv.minMaxLoc(resultMat);
    const maxVal = result.maxVal; // Confidence value (0-1)
    const maxLoc = result.maxLoc; // Location of best match
    
    // Check if match is good enough
    const MATCH_THRESHOLD = 0.5;
    const isTracked = maxVal >= MATCH_THRESHOLD;
    
    // Calculate center position
    const centerX = maxLoc.x + template.width / 2;
    const centerY = maxLoc.y + template.height / 2;
    
    // Template dimensions
    const width = template.width;
    const height = template.height;
    
    // Debug data for visualization
    if (debugCallback) {
      debugCallback({
        method: matchMethod,
        resultMat: resultMat.clone(), // Clone for the callback to use
        maxLoc,
        maxVal,
        threshold: MATCH_THRESHOLD, 
        isTracked
      });
    }
    
    // Clean up
    searchMat.delete();
    resultMat.delete();
    
    // Return match result
    return {
      isTracked,
      x: maxLoc.x,
      y: maxLoc.y,
      width,
      height,
      centerX,
      centerY,
      confidence: maxVal
    };
  } catch (error) {
    console.error('[TemplateMatcher] Error matching template:', error);
    return null;
  }
}

/**
 * Get access to a template's ImageData
 * @param id Template ID
 * @returns The template's original ImageData or null if not found
 */
export function getTemplateImageData(id: string): ImageData | null {
  if (templateCache.has(id)) {
    return templateCache.get(id)!.imageData;
  }
  return null;
}