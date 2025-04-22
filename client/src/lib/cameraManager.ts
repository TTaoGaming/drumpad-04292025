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
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    console.error("getVideoFrame: Could not get 2D context from canvas");
    return null;
  }
  
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  // Attempt to draw the current frame
  try {
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData;
  } catch (error) {
    console.error("getVideoFrame: Error capturing frame", error);
    return null;
  }
}
