/**
 * OpenCV Loader
 * 
 * A utility for loading and initializing OpenCV.js in the main thread
 */

let _opencvReady = false;
let _opencvLoadPromise: Promise<void> | null = null;

/**
 * Check if OpenCV is already loaded and available
 */
export function isOpenCVReady(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if the OpenCV library is loaded and key functions are available
  const cv = (window as any).cv;
  const isReady = 
    !!cv && 
    typeof cv.ORB === 'function' &&
    typeof cv.Mat === 'function';
  
  _opencvReady = isReady;
  return isReady;
}

/**
 * Asynchronously load OpenCV.js if not already loaded
 * Returns a promise that resolves when OpenCV is ready to use
 */
export function loadOpenCV(): Promise<void> {
  // If OpenCV is already loaded, return a resolved promise
  if (isOpenCVReady()) {
    console.log('OpenCV already loaded');
    return Promise.resolve();
  }
  
  // If we're already loading, return the existing promise
  if (_opencvLoadPromise) {
    console.log('OpenCV loading already in progress');
    return _opencvLoadPromise;
  }
  
  // Create a new loading promise
  _opencvLoadPromise = new Promise((resolve, reject) => {
    console.log('Starting OpenCV.js load');
    
    // Create a script element to load OpenCV
    const script = document.createElement('script');
    script.setAttribute('async', 'true');
    script.setAttribute('type', 'text/javascript');
    
    // Handle success
    script.onload = () => {
      console.log('OpenCV.js script loaded, waiting for initialization');
      
      // OpenCV will set up a Module object with onRuntimeInitialized callback
      (window as any).Module = {
        ...(window as any).Module,
        onRuntimeInitialized: () => {
          console.log('OpenCV runtime initialized');
          _opencvReady = true;
          document.dispatchEvent(new Event('opencv-ready'));
          resolve();
        }
      };
    };
    
    // Handle failure
    script.onerror = (err) => {
      console.error('Failed to load OpenCV.js', err);
      _opencvLoadPromise = null;
      reject(new Error('Failed to load OpenCV.js'));
    };
    
    // Set script source - try a stable version first
    script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
    
    // Add to document
    document.head.appendChild(script);
    
    // Set a timeout in case initialization callback never fires
    setTimeout(() => {
      if (!_opencvReady) {
        console.warn('OpenCV initialization timeout reached');
        if (isOpenCVReady()) {
          console.log('OpenCV appears to be available but onRuntimeInitialized never fired');
          _opencvReady = true;
          resolve();
        } else {
          _opencvLoadPromise = null;
          reject(new Error('OpenCV initialization timed out'));
        }
      }
    }, 20000); // 20-second timeout
  });
  
  return _opencvLoadPromise;
}

/**
 * Wait for OpenCV to be ready
 * This returns a promise that resolves when OpenCV is ready to use
 * It will attempt to load OpenCV if it's not already loaded
 */
export function waitForOpenCV(): Promise<void> {
  if (isOpenCVReady()) {
    return Promise.resolve();
  }
  return loadOpenCV();
}

// Create an event-based interface for components that prefer event listeners
export function setupOpenCVEventListener(callback: () => void): () => void {
  // If OpenCV is already ready, call the callback immediately
  if (isOpenCVReady()) {
    setTimeout(callback, 0);
    return () => {};
  }
  
  // Otherwise, set up an event listener
  const listener = () => callback();
  document.addEventListener('opencv-ready', listener);
  
  // Start loading if not already loading
  loadOpenCV();
  
  // Return a cleanup function
  return () => {
    document.removeEventListener('opencv-ready', listener);
  };
}