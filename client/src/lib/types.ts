/**
 * Common type definitions for the hand tracking application
 */

// A 2D point with optional Z coordinate for 3D space
export interface Point {
  x: number;
  y: number;
  z?: number;
}

// Path created by drawing on the canvas
export interface DrawingPath {
  id?: string;
  points: Point[];
  isComplete: boolean;
  isROI: boolean;
  colorIndex?: number; // Index of the color in FINGER_COLORS array
}

// Region of Interest for feature detection
export interface RegionOfInterest {
  id: string;
  points: Point[];
  timestamp: number;
}

// MediaPipe hand landmark
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

// Detected hand data with landmarks and metadata
export interface HandData {
  landmarks: HandLandmark[];
  handedness: 'Left' | 'Right';
  timestamp: number;
}

// Performance metrics for tracking runtime performance
export interface PerformanceMetrics {
  fps: number;
  processingTime: number;
  moduleTimings: {
    [moduleId: string]: number;
  };
}

// Finger joint angles
export interface FingerAngles {
  mcp: number | null; // Metacarpophalangeal joint (base)
  pip: number | null; // Proximal interphalangeal joint (middle)
  dip: number | null; // Distal interphalangeal joint (third)
  flex: number | null; // Overall finger flexion
}

// All fingers joint angles
export interface AllFingerAngles {
  thumb: FingerAngles;
  index: FingerAngles;
  middle: FingerAngles;
  ring: FingerAngles;
  pinky: FingerAngles;
}

// Pinch gesture state
export interface PinchState {
  isPinching: boolean;
  distance: number;
  position?: Point;
}

// Notification for user feedback
export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  duration?: number;
  dismissable?: boolean;
}