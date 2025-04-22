/**
 * Common types used throughout the application
 */

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export interface FrameData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  timestamp: number;
}

export interface HandLandmark {
  x: number; // Normalized x coordinate (0-1)
  y: number; // Normalized y coordinate (0-1)
  z: number; // Normalized z coordinate (depth)
}

export interface HandConnection {
  start: number; // Index of first landmark
  end: number;   // Index of second landmark
  colorIndex: number; // Index in the colors array
}

export interface HandData {
  landmarks: HandLandmark[];
  connections: HandConnection[];
  colors: string[]; // Rainbow colors for visualization
}

export interface PerformanceMetrics {
  [moduleId: string]: number; // Duration in milliseconds
  totalProcessingMs: number;
  estimatedFps: number;
}

export interface ProcessedFrameResult {
  originalFrame: FrameData;
  processedData: any;
  timestamp: number;
  processingTimeMs: number;
  performance?: PerformanceMetrics;
  handData?: HandData;
}

export interface WorkerMessage<T = any> {
  type: string;
  data?: T;
}

export interface CameraStatus {
  isRunning: boolean;
  resolution?: {
    width: number;
    height: number;
  };
}

export type LogType = 'info' | 'error' | 'success' | 'warning';

export interface LogMessage {
  message: string;
  type: LogType;
}
