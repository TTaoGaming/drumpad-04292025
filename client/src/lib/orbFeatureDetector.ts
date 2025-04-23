/**
 * Region of Interest (ROI) Manager
 * 
 * Manages regions of interest for the drawing canvas.
 * Simplified version with no feature detection.
 */

import { DrawingPath, Point, RegionOfInterest } from './types';

/**
 * Simple ROI manager for tracking regions of interest
 */
export class ROIManager {
  private static instance: ROIManager;
  private activeROIs: RegionOfInterest[] = [];
  
  // Private constructor for singleton
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): ROIManager {
    if (!ROIManager.instance) {
      ROIManager.instance = new ROIManager();
    }
    return ROIManager.instance;
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
    
    const roi: RegionOfInterest = {
      id,
      points: [...path.points],
      timestamp: Date.now()
    };
    
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
   * Get all active ROIs
   * @returns Array of ROIs
   */
  public getROIs(): RegionOfInterest[] {
    return this.activeROIs;
  }
  
  /**
   * Placeholder method for maintaining API compatibility
   * This method does nothing now as we don't detect features
   */
  public processFrame(_imageData: ImageData): void {
    // No-op - we don't do any frame processing for feature detection
  }
  
  /**
   * Draw ROIs on the canvas
   * @param ctx Canvas context to draw on
   * @param width Canvas width
   * @param height Canvas height
   */
  public drawFeatures(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // This method now only redraws ROI outlines for consistency
    // It doesn't draw any features inside the ROIs
    
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
      
      // We don't draw anything else - the ROI itself is already 
      // drawn by the DrawingCanvas component
    });
  }
}

// Export singleton instance
export default ROIManager.getInstance();