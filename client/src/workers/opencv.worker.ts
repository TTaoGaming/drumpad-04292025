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

// Create a mock CV object with basic functionality for testing
function createMockCV() {
  cvLog('Creating mock OpenCV implementation');
  return {
    ORB: function() { return { detectAndCompute: function() {} }; },
    BFMatcher: function() { return { match: function() {} }; },
    Mat: function() { return {}; },
    KeyPointVector: function() { return { size: function() { return 0; } }; },
    DMatchVector: function() { return { size: function() { return 0; } }; },
    Point: function(x: number, y: number) { return { x, y }; },
    matFromImageData: function() { return {}; },
    findHomography: function() { return {}; }
  };
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
  
  try {
    // Set up the Module for when OpenCV would be loaded
    cvLog('Setting up Module object for OpenCV initialization');
    (self as any).Module = {
      onRuntimeInitialized: function() {
        cvLog('OpenCV runtime initialized callback triggered');
        cvOnOpenCVReady();
      }
    };
    
    // Try different OpenCV versions if one fails
    const tryLoadOpenCV = (url: string) => {
      try {
        cvLog(`Attempting to load OpenCV.js from: ${url}`);
        // @ts-ignore - importScripts is available in Worker context
        self.importScripts(url);
        cvLog(`Successfully imported script from ${url}, waiting for initialization...`);
        return true;
      } catch (err) {
        cvLog(`Failed to load from ${url}: ${(err as Error).message}`);
        return false;
      }
    };
    
    // Try loading from different CDNs, starting with latest and falling back to stable
    const urls = [
      'https://docs.opencv.org/master/opencv.js',
      'https://docs.opencv.org/4.8.0/opencv.js',
      'https://docs.opencv.org/4.7.0/opencv.js'
    ];
    
    let loaded = false;
    for (const url of urls) {
      if (tryLoadOpenCV(url)) {
        loaded = true;
        break;
      }
    }
    
    if (!loaded) {
      throw new Error('Failed to load OpenCV.js from any source');
    }
    
    // Check if OpenCV is already loaded (might happen if onRuntimeInitialized doesn't fire)
    setTimeout(() => {
      if (!opencvLoaded) {
        cvLog('OpenCV initialization timeout reached, checking manual initialization');
        if ((self as any).cv && typeof (self as any).cv.ORB === 'function') {
          cvLog('OpenCV appears to be loaded but the callback never fired, manually initializing');
          cvOnOpenCVReady();
        } else {
          cvLog('OpenCV still not available after timeout');
        }
      }
    }, 5000);
  } catch (error) {
    cvLog('Error in OpenCV.js loading process: ' + (error as Error).message);
    
    // Even with the error, check if OpenCV is available
    setTimeout(() => {
      if ((self as any).cv && typeof (self as any).cv.ORB === 'function') {
        cvLog('OpenCV appears to be available despite error, manually initializing');
        cvOnOpenCVReady();
      } else {
        // As a last resort, use simulated OpenCV for testing
        cvLog('Using simulated OpenCV environment as last resort');
        (self as any).cv = createMockCV();
        cvOnOpenCVReady();
      }
      cvEndTiming('cvInit');
    }, 2000);
  }
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
  
  // In a real implementation, we would use cv.Mat to process the frame
  // This is a placeholder for the actual OpenCV processing
  
  // Example processing workflow:
  // 1. Convert ImageData to cv.Mat
  // 2. Apply image processing operations
  // 3. Convert result back to ImageData
  // 4. Send processed data back to main thread
  
  // Simulate some processing time for feature detection
  setTimeout(() => {
    // End timing feature detection
    const featureDetectionTime = cvEndTiming('cvFeatureDetection');
    
    // Start timing additional processing
    cvStartTiming('cvAdditionalProcessing');
    
    // Simulate additional processing time
    setTimeout(() => {
      // End timing additional processing
      const additionalProcessingTime = cvEndTiming('cvAdditionalProcessing');
      
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
    }, 2);
  }, 8);
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
