/**
 * ORB Feature Detector
 * 
 * Detects ORB features within specified Regions of Interest (ROIs)
 * and tracks them across frames.
 */

import { DrawingPath, Point, RegionOfInterest } from './types';

// Feature point with descriptors
export interface Feature {
  x: number;
  y: number;
  size: number;
  angle: number;
  response: number;
  octave: number;
  descriptor: Uint8Array; // Binary descriptor (32 bytes for ORB)
  id: number; // Unique identifier
}

// Region of Interest with detected features
export interface ROIWithFeatures extends RegionOfInterest {
  features: Feature[];
}

/**
 * Simple implementation of an ORB feature detector
 * This is a placeholder that will be replaced with OpenCV functionality
 */
export class ORBFeatureDetector {
  private static instance: ORBFeatureDetector;
  private nextFeatureId: number = 0;
  private activeROIs: ROIWithFeatures[] = [];
  
  // Private constructor for singleton
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): ORBFeatureDetector {
    if (!ORBFeatureDetector.instance) {
      ORBFeatureDetector.instance = new ORBFeatureDetector();
    }
    return ORBFeatureDetector.instance;
  }
  
  /**
   * Check if a point is inside a polygon (ROI)
   * @param point The point to check
   * @param polygon Array of points forming the polygon
   * @returns True if the point is inside the polygon
   */
  private isPointInPolygon(point: Point, polygon: Point[]): boolean {
    // Ray casting algorithm
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y))
          && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  
  /**
   * Add a new ROI from a drawing path
   * @param path The drawing path to convert to an ROI
   * @returns The ID of the created ROI
   */
  public addROI(path: DrawingPath): string {
    // Only create ROI from complete paths
    if (!path.isComplete || !path.isROI || path.points.length < 3) {
      return '';
    }
    
    // Use the path's ID if available, otherwise generate a new one
    const id = path.id || Date.now().toString();
    
    // Check if this ROI already exists
    if (this.activeROIs.some(roi => roi.id === id)) {
      return id; // Return the existing ID if already added
    }
    
    const roi: ROIWithFeatures = {
      id,
      points: [...path.points],
      timestamp: Date.now(),
      features: []
    };
    
    // Detect initial features in the ROI
    // This is a placeholder - in real implementation would use OpenCV
    // to detect actual ORB features
    this.activeROIs.push(roi);
    
    return id;
  }
  
  /**
   * Remove a ROI by ID
   * @param id The ID of the ROI to remove
   */
  public removeROI(id: string): void {
    this.activeROIs = this.activeROIs.filter(roi => roi.id !== id);
  }
  
  /**
   * Clear all ROIs
   */
  public clearROIs(): void {
    this.activeROIs = [];
  }
  
  /**
   * Get all active ROIs with their features
   * @returns Array of ROIs with features
   */
  public getROIs(): ROIWithFeatures[] {
    return this.activeROIs;
  }
  
  /**
   * Update feature detection for all ROIs using the current frame
   * @param imageData The current frame
   */
  public processFrame(imageData: ImageData): void {
    // In a real implementation, we would pass the frame to OpenCV
    // for feature detection within each ROI
    
    // For now, add some random features within each ROI as a placeholder
    this.activeROIs.forEach(roi => {
      // Only generate features if we don't have enough
      if (roi.features.length < 10) {
        this.generatePlaceholderFeatures(roi, imageData.width, imageData.height);
      }
    });
  }
  
  /**
   * Generate placeholder features for demonstration
   * @param roi The ROI to generate features for
   * @param width Image width
   * @param height Image height
   */
  private generatePlaceholderFeatures(roi: ROIWithFeatures, width: number, height: number): void {
    // Find bounding box of the ROI
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let maxY = Number.MIN_VALUE;
    
    // Get the bounding box in pixel coordinates
    roi.points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    
    // Add some margin inside the ROI
    const marginX = (maxX - minX) * 0.1;
    const marginY = (maxY - minY) * 0.1;
    
    minX += marginX;
    minY += marginY;
    maxX -= marginX;
    maxY -= marginY;
    
    // Generate random features within the bounding box that are inside the polygon
    // Add more features for larger ROIs
    const areaRatio = ((maxX - minX) * (maxY - minY)) / (width * height);
    const featureCount = Math.max(10, Math.min(50, Math.floor(areaRatio * 2000)));
    
    for (let i = 0; i < featureCount; i++) {
      // Generate a random position within the bounding box
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      
      // Only add points that are inside the polygon
      if (this.isPointInPolygon({x, y}, roi.points)) {
        // Create a random descriptor
        const descriptor = new Uint8Array(32);
        for (let j = 0; j < 32; j++) {
          descriptor[j] = Math.floor(Math.random() * 256);
        }
        
        // Add the feature with reasonable parameters
        roi.features.push({
          x,
          y,
          size: 3 + Math.random() * 5,  // Smaller size for better visualization
          angle: Math.random() * 360,
          response: Math.random(),
          octave: Math.floor(Math.random() * 4),
          descriptor,
          id: this.nextFeatureId++
        });
      }
    }
  }
  
  /**
   * Draw features for all ROIs
   * @param ctx Canvas context to draw on
   * @param width Canvas width
   * @param height Canvas height
   */
  public drawFeatures(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Draw each ROI
    this.activeROIs.forEach(roi => {
      // Draw ROI outline
      ctx.beginPath();
      
      // Points are already in pixel coordinates from the drawing canvas
      ctx.moveTo(roi.points[0].x, roi.points[0].y);
      for (let i = 1; i < roi.points.length; i++) {
        ctx.lineTo(roi.points[i].x, roi.points[i].y);
      }
      ctx.closePath();
      
      // Only draw the feature points, not the entire ROI
      // We've already drawn the ROI from the DrawingCanvas with the proper red color
      
      // Draw features
      roi.features.forEach(feature => {
        // Feature coordinates are in normalized space (0-1)
        // Convert to pixel coordinates
        const pixelX = feature.x;
        const pixelY = feature.y;
        
        // Feature circle
        ctx.beginPath();
        ctx.arc(pixelX, pixelY, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fill();
        
        // Feature orientation line
        const angle = feature.angle * Math.PI / 180;
        const length = feature.size;
        ctx.beginPath();
        ctx.moveTo(pixelX, pixelY);
        ctx.lineTo(
          pixelX + Math.cos(angle) * length,
          pixelY + Math.sin(angle) * length
        );
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      
      // Don't draw feature count text box for cleaner look
      // Features are being detected but we're not showing the count to maintain clean aesthetic
    });
  }
}

// Export singleton instance
export default ORBFeatureDetector.getInstance();