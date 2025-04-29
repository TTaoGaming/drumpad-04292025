/**
 * Camera Manager - Handles webcam access and control
 */

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

import { getCanvas, getContext, returnCanvas } from './canvasPool';

/**
 * Takes a snapshot from the current camera feed
 * Note: Creates a new canvas that the caller is responsible for
 * @param videoElement The video element with the camera feed
 * @returns A canvas with the snapshot
 */
export function takeSnapshot(videoElement: HTMLVideoElement): HTMLCanvasElement {
  // We create a new canvas (not from pool) since this function returns the canvas
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
 * Uses canvas pooling for better performance
 * @param videoElement The video element to capture from
 * @returns ImageData object containing the frame pixels
 */
export function getVideoFrame(videoElement: HTMLVideoElement): ImageData | null {
  if (!videoElement) {
    console.error("getVideoFrame: No video element provided");
    return null;
  }
  
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    console.warn("getVideoFrame: Video dimensions not available yet", {
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight,
      readyState: videoElement.readyState
    });
    return null;
  }
  
  // Get a canvas from the pool instead of creating a new one each time
  const canvas = getCanvas(videoElement.videoWidth, videoElement.videoHeight);
  const ctx = getContext(canvas);
  
  if (!ctx) {
    console.error("getVideoFrame: Could not get 2D context from canvas");
    returnCanvas(canvas); // Return canvas to pool even on error
    return null;
  }
  
  // Attempt to draw the current frame
  try {
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    returnCanvas(canvas); // Return canvas to pool after use
    return imageData;
  } catch (error) {
    console.error("getVideoFrame: Error capturing frame", error);
    returnCanvas(canvas); // Return canvas to pool even on error
    return null;
  }
}
