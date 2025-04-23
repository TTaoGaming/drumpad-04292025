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
  
  // Keep track of baseline feature counts for occlusion detection
  private baselineFeatureCounts: Map<string, number> = new Map();
  private baselineEstablished: Map<string, boolean> = new Map();
  private baselineSamples: Map<string, number[]> = new Map();
  private maxBaselineSamples: number = 10;
  
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
  // Track ROI movement between frames using feature matching
  private previousFrame: ImageData | null = null;
  private initialROIFeatures: Map<string, Feature[]> = new Map();
  
  /**
   * Process each frame to update feature detection and tracking
   * @param imageData Current frame image data
   */
  public processFrame(imageData: ImageData): void {
    try {
      // Process each active ROI
      this.activeROIs.forEach(roi => {
        // For new ROIs (first detection)
        if (!this.initialROIFeatures.has(roi.id)) {
          // Detect features using OpenCV's ORB
          this.detectORBFeatures(roi, imageData);
          
          // Store initial features for tracking
          this.initialROIFeatures.set(roi.id, [...roi.features]);
          
          // Update baseline for occlusion detection
          this.updateBaselineFeatures(roi);
        } 
        // For existing ROIs, track and update position
        else {
          // Track ROI position based on feature matching
          this.trackROI(roi, imageData);
          
          // Update baseline counts
          this.updateBaselineFeatures(roi);
        }
      });
      
      // Store current frame for next iteration
      this.previousFrame = imageData;
      
    } catch (error) {
      console.error('Error in frame processing:', error);
      
      // Fallback if ORB detection fails
      this.activeROIs.forEach(roi => {
        roi.features = [];
        this.generatePlaceholderFeatures(roi, imageData.width, imageData.height);
        this.updateBaselineFeatures(roi);
      });
    }
  }
  
  /**
   * Track an existing ROI across frames using feature matching
   * @param roi The ROI to track
   * @param currentFrame Current frame image data
   */
  private trackROI(roi: ROIWithFeatures, currentFrame: ImageData): void {
    // If we don't have a previous frame, just detect features
    if (!this.previousFrame) {
      this.detectORBFeatures(roi, currentFrame);
      return;
    }
    
    try {
      // Get original features for this ROI
      const originalFeatures = this.initialROIFeatures.get(roi.id) || [];
      if (originalFeatures.length === 0) {
        this.detectORBFeatures(roi, currentFrame);
        return;
      }
      
      // 1. Detect new features in current frame
      const currentRoi = { ...roi, features: [] };
      this.detectORBFeatures(currentRoi, currentFrame);
      
      // If no features detected in current frame, keep the previous ROI
      if (currentRoi.features.length === 0) {
        return;
      }
      
      // 2. Match features between original and current to find transformation
      const matchedPairs = this.matchFeatures(originalFeatures, currentRoi.features);
      
      // Need at least 3 pairs to calculate transformation
      if (matchedPairs.length >= 3) {
        // 3. Calculate transformation (translation, rotation, scale)
        const transform = this.estimateTransform(matchedPairs);
        
        // 4. Apply transformation to update ROI position
        this.updateROIPosition(roi, transform);
        
        // 5. Update features
        roi.features = currentRoi.features;
      }
      
    } catch (error) {
      console.error('Error tracking ROI:', error);
    }
  }
  
  /**
   * Match features between two feature sets using descriptor distance
   * @param featuresA First set of features
   * @param featuresB Second set of features
   * @returns Array of matched feature pairs [featureA, featureB]
   */
  private matchFeatures(featuresA: Feature[], featuresB: Feature[]): Array<[Feature, Feature]> {
    const matches: Array<[Feature, Feature]> = [];
    
    // Brute force matching
    featuresA.forEach(featureA => {
      let bestMatch: Feature | null = null;
      let minDistance = Number.MAX_VALUE;
      
      featuresB.forEach(featureB => {
        // Calculate Hamming distance between binary descriptors
        const distance = this.hammingDistance(featureA.descriptor, featureB.descriptor);
        
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = featureB;
        }
      });
      
      // Add match if distance is below threshold
      if (bestMatch && minDistance < 80) {
        matches.push([featureA, bestMatch]);
      }
    });
    
    return matches;
  }
  
  /**
   * Calculate Hamming distance between binary descriptors
   * @param a First binary descriptor
   * @param b Second binary descriptor
   * @returns Hamming distance (number of different bits)
   */
  private hammingDistance(a: Uint8Array, b: Uint8Array): number {
    let distance = 0;
    const len = Math.min(a.length, b.length);
    
    for (let i = 0; i < len; i++) {
      const xor = a[i] ^ b[i];
      
      // Count set bits in XOR result
      let setBits = 0;
      for (let j = 0; j < 8; j++) {
        if ((xor >> j) & 1) {
          setBits++;
        }
      }
      
      distance += setBits;
    }
    
    return distance;
  }
  
  /**
   * Estimate transformation between matched feature pairs
   * @param matches Array of matched feature pairs
   * @returns Transformation object with translation, rotation, scale
   */
  private estimateTransform(matches: Array<[Feature, Feature]>): {
    dx: number;
    dy: number;
    angle: number;
    scale: number;
  } {
    // Calculate centroids of point sets
    let sumX1 = 0, sumY1 = 0, sumX2 = 0, sumY2 = 0;
    
    matches.forEach(([f1, f2]) => {
      sumX1 += f1.x;
      sumY1 += f1.y;
      sumX2 += f2.x;
      sumY2 += f2.y;
    });
    
    const n = matches.length;
    const centroidX1 = sumX1 / n;
    const centroidY1 = sumY1 / n;
    const centroidX2 = sumX2 / n;
    const centroidY2 = sumY2 / n;
    
    // Calculate translation
    const dx = centroidX2 - centroidX1;
    const dy = centroidY2 - centroidY1;
    
    // For simplicity, assume no rotation/scale in this implementation
    // In a full implementation, we'd use a more robust method like RANSAC
    
    return {
      dx,
      dy,
      angle: 0,
      scale: 1
    };
  }
  
  /**
   * Update ROI position based on transformation
   * @param roi ROI to update
   * @param transform Transformation to apply
   */
  private updateROIPosition(roi: ROIWithFeatures, transform: {
    dx: number;
    dy: number;
    angle: number;
    scale: number;
  }): void {
    // Apply translation to all points in the ROI
    roi.points = roi.points.map(point => ({
      x: point.x + transform.dx,
      y: point.y + transform.dy
    }));
    
    // In a more complete implementation, we would also handle rotation and scaling
  }
  
  /**
   * Update baseline feature counts for occlusion detection
   * @param roi The ROI to update baseline for
   */
  private updateBaselineFeatures(roi: ROIWithFeatures): void {
    const id = roi.id;
    const currentFeatureCount = roi.features.length;
    
    // Initialize collections if needed
    if (!this.baselineSamples.has(id)) {
      this.baselineSamples.set(id, []);
      this.baselineEstablished.set(id, false);
    }
    
    // Get current samples array
    const samples = this.baselineSamples.get(id)!;
    
    // If baseline not established yet, collect samples
    if (!this.baselineEstablished.get(id)) {
      // Add current sample
      samples.push(currentFeatureCount);
      
      // If we have enough samples, calculate the baseline
      if (samples.length >= this.maxBaselineSamples) {
        // Calculate average of samples as the baseline
        const sum = samples.reduce((total, count) => total + count, 0);
        const baseline = Math.round(sum / samples.length);
        
        // Store the baseline
        this.baselineFeatureCounts.set(id, baseline);
        this.baselineEstablished.set(id, true);
        
        console.log(`Established baseline of ${baseline} features for ROI ${id}`);
      }
    }
  }
  
  /**
   * Detect ORB features within a Region of Interest using OpenCV
   * @param roi The ROI to detect features in
   * @param imageData The image data from the current frame
   */
  private detectORBFeatures(roi: ROIWithFeatures, imageData: ImageData): void {
    try {
      // Check if OpenCV is available in the global scope
      if (typeof cv === 'undefined') {
        throw new Error('OpenCV is not loaded or available');
      }
      
      // Create OpenCV mat from imageData
      const width = imageData.width;
      const height = imageData.height;
      const src = cv.matFromImageData(imageData);
      
      // Convert to grayscale for feature detection
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Create mask for the ROI
      const mask = cv.Mat.zeros(height, width, cv.CV_8UC1);
      
      // Convert ROI points to contour format
      const contourPoints = roi.points.map(pt => new cv.Point(pt.x, pt.y));
      const contour = new cv.MatVector();
      const contourMat = cv.Mat.zeros(contourPoints.length, 1, cv.CV_32SC2);
      
      // Fill contourMat with points
      for (let i = 0; i < contourPoints.length; i++) {
        contourMat.data32S[i * 2] = contourPoints[i].x;
        contourMat.data32S[i * 2 + 1] = contourPoints[i].y;
      }
      
      contour.push_back(contourMat);
      
      // Fill the ROI in the mask
      cv.drawContours(mask, contour, 0, new cv.Scalar(255), cv.FILLED);
      
      // Create ORB detector
      const orb = new cv.ORB(500, 1.2, 8, 31, 0, 2, cv.ORB_HARRIS_SCORE, 31, 20);
      
      // Detect keypoints with the mask
      const keypoints = new cv.KeyPointVector();
      const descriptors = new cv.Mat();
      orb.detectAndCompute(gray, mask, keypoints, descriptors);
      
      // Clear previous features
      roi.features = [];
      
      // Convert detected keypoints to our Feature format
      for (let i = 0; i < keypoints.size(); i++) {
        const kp = keypoints.get(i);
        
        // Extract descriptor for this keypoint
        const descriptor = new Uint8Array(32);
        if (descriptors.rows > 0) {
          for (let j = 0; j < 32; j++) {
            descriptor[j] = descriptors.data[i * 32 + j];
          }
        }
        
        // Create our feature object
        roi.features.push({
          x: kp.pt.x,
          y: kp.pt.y,
          size: kp.size,
          angle: kp.angle,
          response: kp.response,
          octave: kp.octave,
          descriptor,
          id: this.nextFeatureId++
        });
      }
      
      // Clean up OpenCV objects
      src.delete();
      gray.delete();
      mask.delete();
      contour.delete();
      contourMat.delete();
      orb.delete();
      keypoints.delete();
      descriptors.delete();
      
      console.log(`Detected ${roi.features.length} real ORB features in ROI ${roi.id}`);
      
    } catch (error) {
      console.error('Error detecting ORB features:', error);
      console.log('Using fallback feature detection');
      
      // Fallback to placeholder features if OpenCV fails
      this.generatePlaceholderFeatures(roi, imageData.width, imageData.height);
    }
  }
  
  /**
   * Generate placeholder features for demonstration or fallback
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
      
      // Draw essential information for ROI using a minimal design
      const centroidX = roi.points.reduce((sum, p) => sum + p.x, 0) / roi.points.length;
      const centroidY = roi.points.reduce((sum, p) => sum + p.y, 0) / roi.points.length;
      
      // Calculate feature stats
      const featureCount = roi.features.length;
      
      // Get baseline count or use default if not established yet
      let baselineCount = 50; // Default max features
      let percentageText = '% detected';
      
      // If we have a baseline established, use it for calculating percentage
      if (this.baselineEstablished.get(roi.id)) {
        baselineCount = this.baselineFeatureCounts.get(roi.id) || baselineCount;
        percentageText = '% of baseline';
      }
      
      // Calculate percentage relative to baseline
      const featurePercentage = Math.min(100, Math.round((featureCount / baselineCount) * 100));
      
      // Semi-transparent background for text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(centroidX - 50, centroidY - 30, 100, 60);
      
      // Text for ID and feature info
      ctx.fillStyle = 'white';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // ID line (ID:1 for index finger)
      ctx.fillText(`ID:1`, centroidX, centroidY - 15);
      
      // Feature count and percentage
      ctx.fillText(`${featureCount} features`, centroidX, centroidY + 5);
      ctx.fillText(`${featurePercentage}${percentageText}`, centroidX, centroidY + 25);
    });
  }
}

// Export singleton instance
export default ORBFeatureDetector.getInstance();