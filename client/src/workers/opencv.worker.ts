/**
 * Simplified Web Worker for OpenCV.js initialization only - No ORB feature tracking
 */

// Declare importScripts for TypeScript
declare function importScripts(...urls: string[]): void;

// Use self as the worker context
const cvCtx: Worker = self as any;

// Flag to track OpenCV loading status
let opencvLoaded = false;

// Counter for throttling logs
let cvLogCounter = 0;
const CV_LOG_THROTTLE = 50; // Only send 1 out of every 50 logs

// Send log message to main thread (with throttling)
function cvLog(message: string, forceLog = false): void {
  // Only log critical messages or throttled regular messages
  if (forceLog || ++cvLogCounter % CV_LOG_THROTTLE === 0) {
    cvCtx.postMessage({
      type: 'log',
      message
    });
  }
}

// Send status update to main thread
function cvUpdateStatus(ready: boolean): void {
  cvCtx.postMessage({
    type: 'status',
    ready
  });
}

// Load the actual OpenCV library instead of using mocks
function loadActualOpenCV(): Promise<void> {
  return new Promise((resolve, reject) => {
    cvLog('Trying to load OpenCV.js from CDN');
    
    try {
      // Attempt to load directly from CDN
      importScripts('https://docs.opencv.org/4.7.0/opencv.js');
      cvLog('Successfully loaded OpenCV.js directly via importScripts');
      resolve();
    } catch (err) {
      cvLog(`Failed to load OpenCV directly: ${err}`);
      // If import fails, try alternative loading methods here
      reject(new Error(`Failed to load OpenCV: ${err}`));
    }
  });
}

// Called when OpenCV is fully loaded and ready
function cvOnOpenCVReady(): void {
  opencvLoaded = true;
  cvLog('OpenCV initialized and ready');
  
  // Debug log the actual cv object
  const features = [];
  if ((self as any).cv) {
    const cv = (self as any).cv;
    // Log which critical OpenCV components are available (just basic ones now)
    features.push(
      `Mat: ${typeof cv.Mat === 'function' ? 'Available ✓' : 'Missing ✗'}`,
      `matFromImageData: ${typeof cv.matFromImageData === 'function' ? 'Available ✓' : 'Missing ✗'}`
    );
  }
  
  cvLog(`OpenCV features: ${features.join(', ')}`);
  cvUpdateStatus(true);
  
  // Notify all interested parties that OpenCV is ready with full details
  cvCtx.postMessage({
    type: 'opencv-ready',
    opencvFeatures: features,
    loadTime: performance.now()
  });
}

// Initialize OpenCV.js
function cvInitOpenCV(): void {
  cvLog('Loading OpenCV.js...');
  
  // List of OpenCV URLs to try
  const urls = [
    'https://docs.opencv.org/4.7.0/opencv.js',
    'https://docs.opencv.org/4.5.5/opencv.js',
    'https://docs.opencv.org/4.8.0/opencv.js'
  ];
  
  // Setup Module for OpenCV initialization
  (self as any).Module = {
    onRuntimeInitialized: function() {
      cvLog('OpenCV runtime initialized callback triggered');
      cvOnOpenCVReady();
    }
  };
  
  // Try loading with importScripts
  let loaded = false;
  
  for (const url of urls) {
    if (loaded) break;
    
    try {
      importScripts(url);
      cvLog(`Successfully loaded OpenCV from ${url}`);
      loaded = true;
    } catch (err) {
      cvLog(`Failed to load from ${url}: ${(err as Error).message}`);
    }
  }
  
  // Set a timeout to check if OpenCV is loaded properly
  setTimeout(() => {
    if (!opencvLoaded) {
      cvLog('OpenCV initialization timeout reached');
      
      if ((self as any).cv && typeof (self as any).cv.Mat === 'function') {
        cvLog('OpenCV appears to be loaded but the callback never fired, manually initializing');
        cvOnOpenCVReady();
      }
    }
  }, 5000);
}

// Handle messages from the main thread
cvCtx.addEventListener('message', (e) => {
  const { command } = e.data;
  
  switch (command) {
    case 'init':
      cvInitOpenCV();
      break;
    default:
      cvLog(`Unknown command: ${command}`);
  }
});

// Notify that the worker is ready
cvCtx.postMessage({ type: 'worker-ready' });
