/**
 * Camera Manager - Handles webcam access and control
 * 
 * This module has been updated to use FrameManager for more efficient frame captures.
 */
import { getFrameManager } from './FrameManager';

// Configuration for camera resolution (480p)
const CAMERA_CONSTRAINTS = {
  video: {
    width: { ideal: 854 },
    height: { ideal: 480 }
  }
};

/**
 * Requests access to the webcam and sets up the video stream
 * @param videoElement The video element to attach the stream to
 * @returns The media stream
 */
export async function startCamera(videoElement?: HTMLVideoElement): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    
    if (videoElement) {
      videoElement.srcObject = stream;
      
      // Register the video element with FrameManager
      getFrameManager().setVideoElement(videoElement);
      
      // Start the frame capturing process when camera starts
      getFrameManager().startCapturing();
    }
    
    return stream;
  } catch (error) {
    console.error('Error accessing camera:', error);
    throw error;
  }
}

/**
 * Stops the camera stream
 * @param videoElement Optional video element to clear
 */
export function stopCamera(videoElement?: HTMLVideoElement): void {
  // Stop frame capturing when camera stops
  getFrameManager().stopCapturing();
  getFrameManager().setVideoElement(null);
  
  if (videoElement) {
    const stream = videoElement.srcObject as MediaStream | null;
    
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoElement.srcObject = null;
    }
  } else {
    // Try to find the video element in the DOM
    const video = document.getElementById('camera-feed') as HTMLVideoElement;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      video.srcObject = null;
    }
  }
}

/**
 * Takes a snapshot from the current camera feed
 * @param videoElement The video element with the camera feed
 * @returns A canvas with the snapshot
 */
export function takeSnapshot(videoElement: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (videoElement && ctx) {
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  }
  
  return canvas;
}

/**
 * Gets a frame from the video as ImageData for processing
 * This is now a wrapper around FrameManager to maintain compatibility
 * with existing code while avoiding redundant frame captures
 * 
 * @param videoElement The video element to capture from
 * @returns ImageData object containing the frame pixels
 */
export function getVideoFrame(videoElement: HTMLVideoElement): ImageData | null {
  // Get the current frame from the FrameManager
  // This will return the cached frame instead of capturing a new one
  return getFrameManager().getCurrentFrame();
}
