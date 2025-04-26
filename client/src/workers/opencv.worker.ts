/**
 * Web Worker for OpenCV.js initialization and processing
 */

// Declare importScripts for TypeScript
declare function importScripts(...urls: string[]): void;

// Use self as the worker context
const cvCtx: Worker = self as any;

// Flag to track OpenCV loading status
let opencvLoaded = false;

// Performance metrics
interface CVModulePerformance {
  moduleId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

// Track performance for different processing stages
const cvPerformanceMetrics: Record<string, CVModulePerformance> = {};

// Send log message to main thread
function cvLog(message: string): void {
  cvCtx.postMessage({
    type: 'log',
    message
  });
}

// Send status update to main thread
function cvUpdateStatus(ready: boolean): void {
  cvCtx.postMessage({
    type: 'status',
    ready
  });
}

// Start timing a module's performance
function cvStartTiming(moduleId: string): void {
  cvPerformanceMetrics[moduleId] = {
    moduleId,
    startTime: performance.now()
  };
}

// End timing a module's performance
function cvEndTiming(moduleId: string): number {
  if (cvPerformanceMetrics[moduleId]) {
    const endTime = performance.now();
    const duration = endTime - cvPerformanceMetrics[moduleId].startTime;
    
    cvPerformanceMetrics[moduleId].endTime = endTime;
    cvPerformanceMetrics[moduleId].duration = duration;
    
    return duration;
  }
  return 0;
}

// Get performance metrics as a formatted object
function cvGetPerformanceMetrics(): Record<string, number> {
  const metrics: Record<string, number> = {};
  
  Object.values(cvPerformanceMetrics).forEach(metric => {
    if (metric.duration !== undefined) {
      metrics[metric.moduleId] = Math.round(metric.duration * 100) / 100; // Round to 2 decimal places
    }
  });
  
  return metrics;
}

// Load the actual OpenCV library instead of using mocks
function loadActualOpenCV(): Promise<void> {
  return new Promise((resolve, reject) => {
    cvLog('Trying to load real OpenCV.js instead of mock');
    
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
    // Log which critical OpenCV components are available
    features.push(
      `ORB: ${typeof cv.ORB === 'function' ? 'Available ✓' : 'Missing ✗'}`,
      `BFMatcher: ${typeof cv.BFMatcher === 'function' ? 'Available ✓' : 'Missing ✗'}`,
      `matFromImageData: ${typeof cv.matFromImageData === 'function' ? 'Available ✓' : 'Missing ✗'}`,
      `Mat: ${typeof cv.Mat === 'function' ? 'Available ✓' : 'Missing ✗'}`,
      `findHomography: ${typeof cv.findHomography === 'function' ? 'Available ✓' : 'Missing ✗'}`
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
  cvStartTiming('cvInit');
  cvLog('Loading OpenCV.js...');
  
  // Create a new approach - load through script tag creation
  const loadOpenCVScript = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // We'll use a dynamic script approach since importScripts() has issues in some contexts
      cvLog(`Creating script tag to load OpenCV from: ${url}`);
      
      const script = (self as any).document ? (self as any).document.createElement('script') : null;
      
      // If we can't create a script element (in pure worker context), fall back to importScripts
      if (!script) {
        cvLog('No document available, falling back to importScripts');
        try {
          // @ts-ignore
          self.importScripts(url);
          cvLog(`Successfully loaded OpenCV via importScripts from ${url}`);
          resolve();
        } catch (err) {
          reject(new Error(`ImportScripts failed for ${url}: ${(err as Error).message}`));
        }
        return;
      }
      
      script.async = true;
      script.src = url;
      script.onload = () => {
        cvLog(`Successfully loaded OpenCV via script tag from ${url}`);
        resolve();
      };
      script.onerror = (err: any) => {
        reject(new Error(`Script loading failed for ${url}: ${err}`));
      };
      
      (self as any).document.head.appendChild(script);
    });
  };
  
  // Setup Module for OpenCV initialization
  (self as any).Module = {
    onRuntimeInitialized: function() {
      cvLog('OpenCV runtime initialized callback triggered');
      cvOnOpenCVReady();
    }
  };
  
  // List of OpenCV URLs to try
  const urls = [
    'https://docs.opencv.org/4.7.0/opencv.js',
    'https://docs.opencv.org/4.5.5/opencv.js',
    'https://docs.opencv.org/4.8.0/opencv.js',
    'https://docs.opencv.org/master/opencv.js'
  ];
  
  // Try loading each URL sequentially
  const tryURLs = async () => {
    for (const url of urls) {
      try {
        await loadOpenCVScript(url);
        cvLog(`Successfully loaded OpenCV from ${url}`);
        return true;
      } catch (err) {
        cvLog(`Failed to load from ${url}: ${(err as Error).message}`);
      }
    }
    return false;
  };
  
  // Execute the loading process
  tryURLs()
    .then(success => {
      if (!success) {
        throw new Error('Failed to load OpenCV from any source');
      }
      
      // Set a timeout to check if OpenCV is loaded properly
      setTimeout(() => {
        if (!opencvLoaded) {
          cvLog('OpenCV initialization timeout reached, checking manual initialization');
          
          if ((self as any).cv && typeof (self as any).cv.ORB === 'function') {
            cvLog('OpenCV appears to be loaded but the callback never fired, manually initializing');
            cvOnOpenCVReady();
          } else {
            cvLog('OpenCV still not available after timeout');
            
            // Try one more time with direct loading approach
            cvLog('Attempting to load OpenCV directly as last resort');
            loadActualOpenCV()
              .then(() => {
                cvLog('Successfully loaded OpenCV via direct approach');
                cvOnOpenCVReady();
              })
              .catch(err => {
                cvLog(`Failed to load OpenCV via any method: ${err}`);
                // We'll leave cv as undefined rather than using a mock
              });
          }
        }
      }, 5000);
    })
    .catch(error => {
      cvLog('Error in OpenCV.js loading process: ' + error.message);
      
      // Set timeout to check if OpenCV is loaded despite errors
      setTimeout(() => {
        if ((self as any).cv && typeof (self as any).cv.ORB === 'function') {
          cvLog('OpenCV appears to be available despite errors, manually initializing');
          cvOnOpenCVReady();
        } else {
          // Try one more time with direct loading approach
          cvLog('Attempting direct OpenCV load as final fallback');
          loadActualOpenCV()
            .then(() => {
              cvLog('Successfully loaded OpenCV via direct approach (fallback)');
              cvOnOpenCVReady();
            })
            .catch(err => {
              cvLog(`Failed to load OpenCV via any method: ${err}`);
              // We won't proceed without real OpenCV
            });
        }
        cvEndTiming('cvInit');
      }, 2000);
    });
}

// Process a frame using OpenCV
function cvProcessFrame(frame: ImageData): void {
  if (!opencvLoaded) {
    cvLog('OpenCV not loaded yet, skipping frame processing');
    return;
  }
  
  // Start timing overall OpenCV processing
  cvStartTiming('cvTotalProcessing');
  
  // Start timing feature detection
  cvStartTiming('cvFeatureDetection');
  
  try {
    // Get OpenCV instance
    const cv = (self as any).cv;
    
    // 1. Convert ImageData to cv.Mat
    const sourceMat = cv.matFromImageData(frame);
    
    // Create a matrix for grayscale conversion
    const grayMat = new cv.Mat();
    
    // 2. Convert to grayscale for easier processing
    cv.cvtColor(sourceMat, grayMat, cv.COLOR_RGBA2GRAY);
    
    // 3. Apply a simple Gaussian blur as an example of OpenCV processing
    const blurredMat = new cv.Mat();
    const ksize = new cv.Size(5, 5);
    cv.GaussianBlur(grayMat, blurredMat, ksize, 0, 0, cv.BORDER_DEFAULT);
    
    // End timing feature detection
    const featureDetectionTime = cvEndTiming('cvFeatureDetection');
    
    // Start timing additional processing
    cvStartTiming('cvAdditionalProcessing');
    
    // 4. Optional: Find edges using Canny
    const edgesMat = new cv.Mat();
    cv.Canny(blurredMat, edgesMat, 50, 150, 3, false);
    
    // End timing additional processing
    const additionalProcessingTime = cvEndTiming('cvAdditionalProcessing');
    
    // Cleanup matrices
    sourceMat.delete();
    grayMat.delete();
    blurredMat.delete();
    edgesMat.delete();
    
    // End timing overall OpenCV processing
    const totalProcessingTime = cvEndTiming('cvTotalProcessing');
    
    // Get complete performance metrics
    const performanceData = cvGetPerformanceMetrics();
    
    // Send processed result back
    cvCtx.postMessage({
      type: 'processed-frame',
      timestamp: Date.now(),
      processingTimeMs: totalProcessingTime,
      performance: performanceData
    });
  } catch (error) {
    cvLog(`Error processing frame with OpenCV: ${error}`);
    
    // End timing on error
    cvEndTiming('cvFeatureDetection');
    cvEndTiming('cvAdditionalProcessing');
    const totalProcessingTime = cvEndTiming('cvTotalProcessing');
    
    // Send error result
    cvCtx.postMessage({
      type: 'processed-frame',
      timestamp: Date.now(),
      processingTimeMs: totalProcessingTime,
      error: `${error}`,
      performance: cvGetPerformanceMetrics()
    });
  }
}

// Handle messages from the main thread
cvCtx.addEventListener('message', (e) => {
  const { command, data } = e.data;
  
  switch (command) {
    case 'init':
      cvInitOpenCV();
      break;
    case 'process-frame':
      cvProcessFrame(data);
      break;
    default:
      cvLog(`Unknown command: ${command}`);
  }
});

// Notify that the worker is ready
cvCtx.postMessage({ type: 'worker-ready' });
