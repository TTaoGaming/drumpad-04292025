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
  isExactROI?: boolean; // Whether the feature is within the exact ROI or in the search area
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
  private isOpenCVLoaded: boolean = false;
  
  // Keep track of baseline feature counts for occlusion detection
  private baselineFeatureCounts: Map<string, number> = new Map();
  private baselineEstablished: Map<string, boolean> = new Map();
  private baselineSamples: Map<string, number[]> = new Map();
  private maxBaselineSamples: number = 10;
  
  // Private constructor for singleton
  private constructor() {
    // Listen for OpenCV ready event
    if (typeof window !== 'undefined') {
      // Check if OpenCV is already available
      if (typeof (window as any).cv !== 'undefined') {
        this.isOpenCVLoaded = true;
        console.log('OpenCV is already loaded');
      } else {
        // Wait for OpenCV to load
        window.addEventListener('opencv-ready', () => {
          this.isOpenCVLoaded = true;
          console.log('OpenCV is now loaded and ready for use');
        });
      }
    }
  }
  
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
   * Check if OpenCV is loaded and ready to use
   * @returns True if OpenCV is loaded and ready
   */
  public isOpenCVReady(): boolean {
    // Always check fresh from the window object
    this.isOpenCVLoaded = typeof (window as any).cv !== 'undefined';
    console.log(`OpenCV ready state: ${this.isOpenCVLoaded}`);
    
    if (this.isOpenCVLoaded) {
      console.log(`OpenCV version: ${(window as any).cv.version || 'unknown'}`);
      // Test if basic OpenCV operations work
      try {
        const testMat = new (window as any).cv.Mat(3, 3, (window as any).cv.CV_8UC1);
        console.log('Created test OpenCV matrix successfully');
        testMat.delete();
      } catch (e) {
        console.error('OpenCV test failed:', e);
        this.isOpenCVLoaded = false;
      }
    }
    
    return this.isOpenCVLoaded;
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
    // Check if OpenCV is loaded
    if (!this.isOpenCVLoaded || typeof (window as any).cv === 'undefined') {
      console.warn('OpenCV not loaded yet, skipping feature detection');
      return;
    }
    
    // Process each active ROI
    this.activeROIs.forEach(roi => {
      try {
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
      } catch (error) {
        // Log the error but don't crash the main frame processing loop
        console.error(`Error processing ROI ${roi.id}:`, error);
        // Make sure the UI shows zero features when detection fails
        roi.features = [];
      }
    });
    
    // Store current frame for next iteration
    this.previousFrame = imageData;
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
    
    // Get original features for this ROI (use previous frame's features for continuous tracking)
    const previousFeatures = [...roi.features]; // Use current features as the "previous" set
    if (previousFeatures.length === 0) {
      console.log("No previous features to track with, detecting new features");
      this.detectORBFeatures(roi, currentFrame);
      return;
    }
    
    // 1. Create a temporary ROI to hold new features in the current frame
    // Start from current position (not original position) to improve tracking
    const currentRoi = { ...roi, features: [] };
    
    // 2. Detect new features at current position
    this.detectORBFeatures(currentRoi, currentFrame);
    
    // If no features detected in current frame, keep the previous ROI
    if (currentRoi.features.length === 0) {
      console.log("No features detected in current frame");
      return;
    }
    
    // 3. Match features between previous frame and current frame
    const matchedPairs = this.matchFeatures(previousFeatures, currentRoi.features);
    console.log(`Matched ${matchedPairs.length} feature pairs for ROI ${roi.id}`);
    
    // Need at least 3 pairs to calculate transformation
    if (matchedPairs.length >= 3) {
      // 4. Calculate transformation (translation, rotation, scale)
      const transform = this.estimateTransform(matchedPairs);
      
      // 5. Apply transformation to update ROI position
      this.updateROIPosition(roi, transform);
      
      // 6. Update features for next tracking iteration
      roi.features = currentRoi.features;
      
      console.log(`Updated ROI position with translation (${transform.dx.toFixed(1)}, ${transform.dy.toFixed(1)})`);
    } else {
      console.log(`Not enough matching features (${matchedPairs.length}) to update position`);
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
    
    // Early exit for empty feature sets
    if (featuresA.length === 0 || featuresB.length === 0) {
      console.log("Empty feature set, cannot match");
      return matches;
    }
    
    console.log(`Matching ${featuresA.length} previous features with ${featuresB.length} current features`);
    
    // Calculate all distances between each pair
    const distances: Array<{distA: number, idxA: number, idxB: number}> = [];
    
    // Brute force matching - calculate all distances
    featuresA.forEach((featureA, idxA) => {
      featuresB.forEach((featureB, idxB) => {
        // Calculate Hamming distance between binary descriptors
        const dist = this.hammingDistance(featureA.descriptor, featureB.descriptor);
        
        // Also consider spatial proximity (weighted less than descriptor)
        const spatialDist = Math.sqrt(
          Math.pow(featureA.x - featureB.x, 2) + 
          Math.pow(featureA.y - featureB.y, 2)
        ) * 0.1; // Weight spatial distance less
        
        // Combined distance (descriptor similarity + spatial proximity)
        const combinedDist = dist + spatialDist;
        
        distances.push({
          distA: combinedDist,
          idxA,
          idxB
        });
      });
    });
    
    // Sort by distance (ascending)
    distances.sort((a, b) => a.distA - b.distA);
    
    // Track which features have been matched
    const usedA = new Set<number>();
    const usedB = new Set<number>();
    
    // Take best matches first, ensuring we don't use a feature twice
    for (const match of distances) {
      if (usedA.has(match.idxA) || usedB.has(match.idxB)) continue;
      
      // Only add if distance is good enough (lower threshold for better matches)
      if (match.distA < 100) {
        matches.push([featuresA[match.idxA], featuresB[match.idxB]]);
        usedA.add(match.idxA);
        usedB.add(match.idxB);
      }
    }
    
    console.log(`Found ${matches.length} good matches between feature sets`);
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
    // Check if OpenCV is available
    if (typeof (window as any).cv === 'undefined') {
      console.error('OpenCV not loaded, cannot detect features');
      return;
    }
    
    // Make cv a local reference for the global object
    const cv = (window as any).cv;
    
    try {
      // Create OpenCV mat from imageData
      const width = imageData.width;
      const height = imageData.height;
      
      // Explicitly create an rgba Uint8ClampedArray for the source image
      const src = new cv.Mat(height, width, cv.CV_8UC4);
      const imgData = new Uint8ClampedArray(imageData.data);
      src.data.set(imgData);
      
      // Convert to grayscale for feature detection
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // For tracking, we want to search for features in a slightly larger area
      // than the ROI to handle marker movement between frames
      
      // Calculate the bounding box of the ROI
      let minX = Number.MAX_VALUE;
      let minY = Number.MAX_VALUE;
      let maxX = Number.MIN_VALUE;
      let maxY = Number.MIN_VALUE;
      
      roi.points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
      
      // Add modest margin to search area (keep it small to avoid memory errors)
      const marginX = (maxX - minX) * 0.1; // Reduced from 30% to 10% margin for tracking
      const marginY = (maxY - minY) * 0.1;
      
      // Ensure margins are within image bounds
      const expandedMinX = Math.max(0, minX - marginX);
      const expandedMinY = Math.max(0, minY - marginY);
      const expandedMaxX = Math.min(width, maxX + marginX);
      const expandedMaxY = Math.min(height, maxY + marginY);
      
      // Create search area mask (expanded from ROI for robust tracking)
      const searchMask = cv.Mat.zeros(height, width, cv.CV_8UC1);
      
      // Create a rectangle for the search area
      const searchRect = new cv.Rect(
        expandedMinX, 
        expandedMinY, 
        expandedMaxX - expandedMinX, 
        expandedMaxY - expandedMinY
      );
      
      // Fill search area in the mask
      searchMask.roi(searchRect).setTo(new cv.Scalar(255));
      
      // Create exact ROI mask for feature filtering later
      const exactMask = cv.Mat.zeros(height, width, cv.CV_8UC1);
      
      // Convert ROI points to contour format
      const contourPoints = roi.points.map(pt => new cv.Point(pt.x, pt.y));
      const contour = new cv.MatVector();
      const contourMat = new cv.Mat(contourPoints.length, 1, cv.CV_32SC2);
      
      // Fill contourMat with points
      for (let i = 0; i < contourPoints.length; i++) {
        contourMat.data32S[i * 2] = contourPoints[i].x;
        contourMat.data32S[i * 2 + 1] = contourPoints[i].y;
      }
      
      contour.push_back(contourMat);
      
      // Fill the exact ROI in the mask
      cv.drawContours(exactMask, contour, 0, new cv.Scalar(255), cv.FILLED);
      
      // Create ORB detector - increase nfeatures for better tracking
      const orb = new cv.ORB(750, 1.2, 8, 31, 0, 2, cv.ORB_HARRIS_SCORE, 31, 20);
      
      // Detect keypoints with the search mask
      const keypoints = new cv.KeyPointVector();
      const descriptors = new cv.Mat();
      orb.detectAndCompute(gray, searchMask, keypoints, descriptors);
      
      // Clear previous features
      roi.features = [];
      
      // Convert detected keypoints to our Feature format
      for (let i = 0; i < keypoints.size(); i++) {
        const kp = keypoints.get(i);
        
        // Check if keypoint is inside the exact ROI mask (for baseline statistics)
        const pointValue = exactMask.ucharPtr(Math.round(kp.pt.y), Math.round(kp.pt.x))[0];
        const isInsideExactROI = pointValue > 0;
        
        // Extract descriptor for this keypoint
        const descriptor = new Uint8Array(32);
        if (descriptors.rows > 0 && i < descriptors.rows) {
          for (let j = 0; j < 32 && j < descriptors.cols; j++) {
            descriptor[j] = descriptors.data[i * descriptors.cols + j];
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
          id: this.nextFeatureId++,
          isExactROI: isInsideExactROI // Track if it's in the exact ROI or expanded area
        });
      }
      
      console.log(`Detected ${roi.features.length} ORB features for ROI ${roi.id} (expanded search area)`);
      
      // Clean up OpenCV objects
      src.delete();
      gray.delete();
      searchMask.delete();
      exactMask.delete();
      contour.delete();
      contourMat.delete();
      orb.delete();
      keypoints.delete();
      descriptors.delete();
    } catch (error) {
      console.error('Error in ORB feature detection:', error);
      // No fallback to placeholder features - expose the actual error
      roi.features = []; // Clear any partial features
      throw new Error(`ORB feature detection failed: ${error}`);
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
          id: this.nextFeatureId++,
          isExactROI: true // All placeholder features are in the exact ROI
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
      ctx.fillStyle = featureCount === 0 ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(centroidX - 50, centroidY - 30, 100, 60);
      
      // Text for ID and feature info
      ctx.fillStyle = 'white';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // ID line (ID:1 for index finger)
      ctx.fillText(`ID:1`, centroidX, centroidY - 15);
      
      // Feature count and percentage
      if (featureCount === 0) {
        ctx.fillText(`NO FEATURES`, centroidX, centroidY + 5);
        ctx.fillText(`DETECTION FAILED`, centroidX, centroidY + 25);
      } else {
        ctx.fillText(`${featureCount} features`, centroidX, centroidY + 5);
        ctx.fillText(`${featurePercentage}${percentageText}`, centroidX, centroidY + 25);
      }
    });
  }
}

// Export singleton instance
export default ORBFeatureDetector.getInstance();