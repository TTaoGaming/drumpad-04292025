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

export interface ProcessedFrameResult {
  originalFrame: FrameData;
  processedData: any;
  timestamp: number;
  processingTimeMs: number;
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
