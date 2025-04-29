import { useEffect, useState, useRef } from "react";
import CameraView from "@/components/CameraView";
import StatusIndicators from "@/components/StatusIndicators";
import ControlsOverlay from "@/components/ControlsOverlay";
import Notifications from "@/components/Notifications";
import ConsoleOutput from "@/components/ConsoleOutput";
import HandVisualization from "@/components/HandVisualization";
import MediaPipeHandTracker from "@/components/MediaPipeHandTracker";
import DrawingCanvas from "@/components/DrawingCanvas";
import ImprovedROIDebugCanvas from "@/components/ImprovedROIDebugCanvas";
import TrackingVisualization from "@/components/TrackingVisualization";
import SettingsPanel from "@/components/settings/SettingsPanel";
import UnifiedPerformanceDashboard from "@/components/UnifiedPerformanceDashboard";
import { EventType, addListener, dispatch } from "@/lib/eventBus";
import { Notification, HandData, PerformanceMetrics, DrawingPath, CircleROI } from "@/lib/types";
import { getVideoFrame } from "@/lib/cameraManager";
import { loadOpenCV, setupOpenCVEventListener } from "./lib/opencvLoader";

function App() {
  const [isOpenCVReady, setIsOpenCVReady] = useState(false);
  const [isMediaPipelineReady, setIsMediaPipelineReady] = useState(false);
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [handData, setHandData] = useState<HandData | undefined>(undefined);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | undefined>(undefined);
  const [resolution, setResolution] = useState({ width: 640, height: 480 });
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [showDebugCanvas, setShowDebugCanvas] = useState(true);

  // References to workers
  const opencvWorkerRef = useRef<Worker | null>(null);
  const mediaPipeHandsWorkerRef = useRef<Worker | null>(null); // MediaPipe Hands worker
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameProcessingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const resolutionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add variables for frame skipping
  const frameSkipCountRef = useRef<number>(0);
  const targetFpsRef = useRef<number>(30);
  const lastFrameTimeRef = useRef<number>(0);
  const adaptiveFrameSkipRef = useRef<boolean>(true);

  // Start OpenCV loading process

  useEffect(() => {
    // Start loading OpenCV in main thread and set up an event listener for when it's ready
    loadOpenCV().then(() => {
      console.log('OpenCV.js loaded and ready in main thread');
      setIsOpenCVReady(true);
      dispatch(EventType.OPENCV_STATUS, { ready: true });
    }).catch(err => {
      console.error('Failed to load OpenCV in main thread:', err);
    });
    
    // Also set up an event listener for components that might need it
    const cleanupOpenCVListener = setupOpenCVEventListener(() => {
      console.log('OpenCV ready event fired');
      setIsOpenCVReady(true);
      dispatch(EventType.OPENCV_STATUS, { ready: true });
    });
    
    // Initialize workers when component mounts
    // IMPORTANT: For OpenCV worker, don't use module type so it can use importScripts()
    const opencvWorker = new Worker(
      new URL('./workers/opencv.worker.ts', import.meta.url)
    );
    
    // Initialize our MediaPipe Hands worker
    // Don't use module type as it needs to use importScripts() for MediaPipe loading
    const mediaPipeHandsWorker = new Worker(
      new URL('./workers/mediapipe-hands.worker.ts', import.meta.url)
    );

    // Store workers in refs
    opencvWorkerRef.current = opencvWorker;
    mediaPipeHandsWorkerRef.current = mediaPipeHandsWorker;

    // Set up event listeners for worker messages
    opencvWorker.onmessage = (e) => {
      console.log('[OpenCV Worker]:', e.data);
      
      if (e.data.type === 'log') {
        addLog(e.data.message);
      } else if (e.data.type === 'status') {
        console.log('OpenCV status update:', e.data.ready);
        setIsOpenCVReady(e.data.ready);
        dispatch(EventType.OPENCV_STATUS, { ready: e.data.ready });
        if (e.data.ready) {
          addLog('OpenCV.js ready in worker', 'success');
        }
      } else if (e.data.type === 'opencv-ready') {
        console.log('OpenCV initialized in worker with features:', e.data.opencvFeatures);
        dispatch(EventType.OPENCV_STATUS, { ready: true, features: e.data.opencvFeatures });
        addLog('OpenCV.js ready with features: ' + e.data.opencvFeatures.join(', '), 'success');
      } else if (e.data.type === 'processed-frame') {
        // Handle OpenCV processed frame here
        // For now we'll just update any performance metrics
        if (e.data.performance) {
          setPerformanceMetrics(prev => ({
            ...(prev || {}),
            ...e.data.performance
          }));
        }
      }
    };
    
    // Handle events from the MediaPipe Hands worker
    mediaPipeHandsWorker.onmessage = (e) => {
      if (e.data.type === 'log') {
        addLog(`[MediaPipe Hands]: ${e.data.message}`, e.data.level || 'info');
      } else if (e.data.type === 'status') {
        // Update the MediaPipe status
        const isReady = e.data.ready;
        if (isReady) {
          addLog('MediaPipe Hands worker ready', 'success');
          setIsMediaPipelineReady(true);
        }
      } else if (e.data.type === 'loaded') {
        // Worker loaded, initialize it
        addLog('MediaPipe Hands worker loaded, initializing...');
        mediaPipeHandsWorker.postMessage({ command: 'init' });
      } else if (e.data.type === 'results') {
        // We got hand tracking results from the worker
        if (e.data.data) {
          const handLandmarks = e.data.data.landmarks || [];
          
          // Only continue processing if we have landmarks
          if (handLandmarks.length > 0) {
            // Create hand data directly from worker results
            const handData = {
              landmarks: handLandmarks[0], // Just use the first hand for now
              connections: [], // Will be filled in by MediaPipeHandTracker
              colors: []      // Will be filled in by MediaPipeHandTracker
            };
            
            // ONLY set state once (don't dispatch redundant event with handData)
            setHandData(handData);
          }
          
          // Update performance metrics
          if (e.data.performance) {
            setPerformanceMetrics(prev => ({
              ...(prev || {}),
              ...e.data.performance,
              mediapigeHandsWorker: e.data.performance
            }));
            
            // Dispatch ONLY performance metrics, not duplicate handData
            dispatch(EventType.FRAME_PROCESSED, {
              performance: e.data.performance,
              timestamp: Date.now()
            });
          }
          
          // Continue processing frames
          frameProcessingRef.current = false;
        }
      }
    };

    // Start workers initialization
    opencvWorker.postMessage({ command: 'init' });
    mediaPipeHandsWorker.postMessage({ command: 'init' });

    // Set up event listeners
    const cameraListener = addListener(EventType.CAMERA_STATUS_CHANGE, (data) => {
      setIsCameraRunning(data.isRunning);
      
      if (data.isRunning) {
        addLog('Camera started at 480p resolution');
        
        // Start frame processing when camera is running
        startFrameProcessing();
      } else {
        addLog('Camera stopped');
        
        // Stop frame processing when camera is stopped
        stopFrameProcessing();
      }
      
      // Update resolution if provided
      if (data.resolution) {
        setResolution(data.resolution);
      }
    });

    const fullscreenListener = addListener(EventType.FULLSCREEN_CHANGE, (data) => {
      setIsFullscreen(data.isFullscreen);
    });

    const logListener = addListener(EventType.LOG, (data) => {
      addLog(data.message, data.type);
    });

    const notificationListener = addListener(EventType.NOTIFICATION, (data) => {
      addNotification(data.message, data.type);
    });
    
    // Listen for new drawing paths from DrawingCanvas
    const drawingListener = addListener(EventType.SETTINGS_VALUE_CHANGE, (data) => {
      if (data.section === 'drawing' && data.setting === 'newPath' && data.value) {
        // Replace existing ROI paths with the new path - only keep one ROI at a time
        const newPath = data.value as DrawingPath;
        
        // If this is an ROI path, replace all existing ROI paths
        if (newPath.isROI) {
          // Filter out any existing ROI paths and add the new one
          setDrawingPaths(prev => {
            // Keep only non-ROI paths (if any) and add the new ROI path
            const nonRoiPaths = prev.filter(path => !path.isROI);
            return [...nonRoiPaths, newPath];
          });
          
          // Log for debugging
          addLog(`Created a new ROI marker with ${newPath.points.length} points`, 'success');
        } else {
          // For non-ROI paths, just add to the array (maintaining backward compatibility)
          setDrawingPaths(prev => [...prev, newPath]);
        }
      }
      
      // Clear all paths if requested
      if (data.section === 'drawing' && data.setting === 'clearCanvas' && data.value === true) {
        setDrawingPaths([]);
        addLog('Cleared all drawing paths', 'info');
      }
    });

    // Initial log
    addLog('Application initialized. Click "Start Camera" to begin.');

    // Listen for new Circle ROIs from DrawingCanvas
    const circleRoiListener = addListener(EventType.CIRCLE_ROI_CREATED, (circleROI: CircleROI) => {
      // Log for debugging
      addLog(`Created new Circle ROI at (${Math.round(circleROI.center.x)}, ${Math.round(circleROI.center.y)}) with radius ${Math.round(circleROI.radius)}px (ID: ${circleROI.id})`, 'success');
      
      // We're only visualizing the ROI now, not tracking features within it
      // This simplified approach focuses only on hand tracking with pinch lasso ROI functionality
    });

    // Cleanup event listeners on unmount
    return () => {
      stopFrameProcessing();
      
      if (opencvWorkerRef.current) {
        opencvWorkerRef.current.terminate();
      }
      
      cameraListener.remove();
      fullscreenListener.remove();
      logListener.remove();
      notificationListener.remove();
      drawingListener.remove();
      circleRoiListener.remove();
    };
  }, []);

  // Check if all components are ready
  useEffect(() => {
    if (isOpenCVReady && isMediaPipelineReady && isCameraRunning) {
      dispatch(EventType.NOTIFICATION, {
        message: 'All systems initialized and ready',
        type: 'success'
      });
      dispatch(EventType.LOG, {
        message: 'All systems initialized and ready for frame processing',
        type: 'success'
      });
    }
  }, [isOpenCVReady, isMediaPipelineReady, isCameraRunning]);
  
  // Handle video size changes and update drawing canvas dimensions
  useEffect(() => {
    if (!videoRef.current || !isCameraRunning) return;
    
    // Clear any existing timeout
    if (resolutionTimeoutRef.current) {
      clearTimeout(resolutionTimeoutRef.current);
    }
    
    const updateVideoResolution = () => {
      if (!videoRef.current) return;
      
      const videoElement = videoRef.current;
      const { videoWidth, videoHeight } = videoElement;
      
      // Only update resolution if there's actual video data
      if (videoWidth && videoHeight) {
        console.log(`Video resolution updated: ${videoWidth}x${videoHeight}`);
        setResolution({ width: videoWidth, height: videoHeight });
        
        // Dispatch event for other components
        dispatch(EventType.CAMERA_STATUS_CHANGE, { 
          isRunning: true,
          resolution: { width: videoWidth, height: videoHeight }
        });
      }
    };
    
    // Set up an event listener for loadedmetadata
    const handleMetadataLoaded = () => {
      updateVideoResolution();
    };
    
    // Set up an event listener for resize
    const handleResize = () => {
      // Use a timeout to debounce rapid resize events
      if (resolutionTimeoutRef.current) {
        clearTimeout(resolutionTimeoutRef.current);
      }
      
      resolutionTimeoutRef.current = setTimeout(() => {
        updateVideoResolution();
      }, 300);
    };
    
    videoRef.current.addEventListener('loadedmetadata', handleMetadataLoaded);
    videoRef.current.addEventListener('resize', handleResize);
    
    // Also try to update immediately in case video is already loaded
    updateVideoResolution();
    
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleMetadataLoaded);
        videoRef.current.removeEventListener('resize', handleResize);
      }
      
      if (resolutionTimeoutRef.current) {
        clearTimeout(resolutionTimeoutRef.current);
      }
    };
  }, [isCameraRunning, videoRef.current]);

  // Frame processing functions
  const startFrameProcessing = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    processVideoFrame();
  };

  const stopFrameProcessing = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  // Frame rate throttling configuration
  const targetFPS = 60; // Target 60 FPS for smooth performance
  const frameInterval = 1000 / targetFPS; // Time between frames in ms
  const performanceCounterRef = useRef({ frames: 0, startTime: 0, lastFpsUpdate: 0 });
  
  // Throttle console logs related to frame processing
  const frameLogCountRef = useRef(0);
  const LOG_EVERY_N_FRAMES = 300; // Only log every 300 frames (approx. every 5 seconds at 60fps)
  
  const processVideoFrame = async () => {
    if (!isCameraRunning) return;
    
    // Implement adaptive frame skipping
    const now = performance.now();
    const timeSinceLastFrame = now - lastFrameTimeRef.current;
    const targetFrameTime = 1000 / targetFpsRef.current;
    
    // Skip frames if we're running behind and adaptive frame skipping is enabled
    if (adaptiveFrameSkipRef.current && lastFrameTimeRef.current !== 0) {
      // If we're taking more than 1.5x target frame time, start skipping frames
      if (timeSinceLastFrame < targetFrameTime * 0.8) {
        // We're running ahead of schedule, process this frame
        frameSkipCountRef.current = Math.max(0, frameSkipCountRef.current - 1);
      } else if (timeSinceLastFrame > targetFrameTime * 1.5) {
        // We're running behind, increase frame skip
        frameSkipCountRef.current = Math.min(5, frameSkipCountRef.current + 1);
      }
      
      // Skip this frame if frameSkipCount > 0
      if (frameSkipCountRef.current > 0) {
        // Update performance metrics to show skipped frames
        setPerformanceMetrics(prev => ({
          ...(prev || {}),
          skippedFrames: (prev?.skippedFrames || 0) + 1,
          frameSkipLevel: frameSkipCountRef.current
        }));
        
        // Schedule next frame and skip processing this one
        animationFrameRef.current = requestAnimationFrame(processVideoFrame);
        return;
      }
    }
    
    // Update last frame time
    lastFrameTimeRef.current = now;
    
    // If we're already processing a frame, skip this one
    if (frameProcessingRef.current) {
      console.log('Frame processing in progress, skipping');
      animationFrameRef.current = requestAnimationFrame(processVideoFrame);
      return;
    }
    
    // Mark that we're processing a frame
    frameProcessingRef.current = true;
    
    // Track actual FPS
    if (performanceCounterRef.current.startTime === 0) {
      performanceCounterRef.current.startTime = now;
    }
    
    // Only process frame if enough time has elapsed
    if (timeSinceLastFrame >= frameInterval) {
      performanceCounterRef.current.frames++;
      
      // Update FPS counter every second
      if (now - performanceCounterRef.current.lastFpsUpdate > 1000) {
        const seconds = (now - performanceCounterRef.current.startTime) / 1000;
        const fps = performanceCounterRef.current.frames / seconds;
        
        // Only log occasionally to reduce overhead
        if (++frameLogCountRef.current % LOG_EVERY_N_FRAMES === 0) {
          console.log(`Actual FPS: ${fps.toFixed(1)}`);
        }
        
        // Reset counters to avoid decreasing average over long periods
        if (performanceCounterRef.current.frames > 1000) {
          performanceCounterRef.current.frames = 0;
          performanceCounterRef.current.startTime = now;
        }
        
        performanceCounterRef.current.lastFpsUpdate = now;
      }
    
      // Only process if workers are ready and camera is running
      if (
        isOpenCVReady && 
        isMediaPipelineReady && 
        isCameraRunning && 
        videoRef.current && 
        !frameProcessingRef.current
      ) {
        frameProcessingRef.current = true;
        
        try {
          // Import and initialize performance tracking utilities
          const { initPerformanceTracker, startTiming, endTiming, endFrame } = await import('./lib/performanceTracker');
          
          // Initialize tracker for this frame
          initPerformanceTracker();
          
          startTiming('frameProcessing');
          
          // Capture frame from video with timing
          startTiming('frameCapture');
          const frameData = videoRef.current ? getVideoFrame(videoRef.current) : null;
          endTiming('frameCapture');
          
          if (frameData) {
            // Measure communication with workers
            startTiming('workerCommunication');
            
            // Send frame to MediaPipe Hands worker for processing
            if (mediaPipeHandsWorkerRef.current) {
              mediaPipeHandsWorkerRef.current.postMessage({
                command: 'process',
                data: {
                  frame: frameData,
                  frameTime: timeSinceLastFrame
                }
              });
            }
            
            // OpenCV worker processing in parallel
            if (opencvWorkerRef.current) {
              opencvWorkerRef.current.postMessage({
                command: 'process-frame',
                data: frameData
              });
            }
            
            endTiming('workerCommunication');
          }
          
          // UI rendering measurements
          startTiming('rendering');
          // Any UI rendering that happens in this frame
          endTiming('rendering');
          
          // Need to end the frameProcessing timing we started at the beginning
          endTiming('frameProcessing');
          
          // End frame timing and publish metrics
          endFrame();
          
          // Mark frame as complete to allow next frame processing
          setTimeout(() => {
            frameProcessingRef.current = false;
          }, 0);
        } catch (error) {
          console.error('Error processing video frame:', error);
          frameProcessingRef.current = false;
        }
      }
    }
    
    // Continue requesting frames
    animationFrameRef.current = requestAnimationFrame(processVideoFrame);
  };

  const addLog = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date() }]);
    console.log(`[${type.toUpperCase()}]: ${message}`);
  };

  const addNotification = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    const id = Date.now().toString();
    const timestamp = new Date();
    setNotifications(prev => [...prev, { id, message, type, timestamp }]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    }, 5000);
  };

  return (
    <div id="camera-container" className="relative w-screen h-screen bg-background">
      <CameraView 
        isCameraRunning={isCameraRunning}
        videoRef={videoRef}
      />
      
      {/* Debug Canvas Toggle Button */}
      {isCameraRunning && (
        <button
          onClick={() => setShowDebugCanvas(prev => !prev)}
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: 1001,
            backgroundColor: showDebugCanvas ? 'rgba(0, 128, 0, 0.7)' : 'rgba(128, 128, 128, 0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '5px 10px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {showDebugCanvas ? 'Hide ROI Debug' : 'Show ROI Debug'}
        </button>
      )}
      
      {/* Improved ROI Debug Canvas */}
      {isCameraRunning && (
        <ImprovedROIDebugCanvas
          width={200}
          height={200}
          visible={showDebugCanvas}
        />
      )}
      
      {/* MediaPipe Hand Tracking - tracks your actual hands via webcam */}
      {isCameraRunning && (
        <MediaPipeHandTracker videoRef={videoRef} />
      )}
      
      {/* Drawing Canvas for pinch-based drawing */}
      {isCameraRunning && (
        <DrawingCanvas
          width={resolution.width}
          height={resolution.height}
          enabled={true}
          initialPaths={drawingPaths}
        />
      )}
      
      {/* Main Tracking Visualization for large displays */}
      {isCameraRunning && (
        <TrackingVisualization
          width={resolution.width}
          height={resolution.height}
        />
      )}
      
      {/* Legacy hand visualization components (not used) */}
      {false && isCameraRunning && handData && (
        <HandVisualization
          handData={handData}
          videoElement={videoRef.current}
          width={resolution.width}
          height={resolution.height}
        />
      )}
      
      <StatusIndicators 
        isCameraRunning={isCameraRunning}
        isOpenCVReady={isOpenCVReady}
        isMediaPipelineReady={isMediaPipelineReady}
      />
      
      <ControlsOverlay 
        isCameraRunning={isCameraRunning}
        isFullscreen={isFullscreen}
      />
      
      <Notifications 
        notifications={notifications}
      />
      
      <ConsoleOutput 
        logs={logs}
      />
      
      {/* Settings Panel */}
      <SettingsPanel />
      
      {/* Unified Performance Dashboard */}
      {isCameraRunning && <UnifiedPerformanceDashboard targetFps={60} />}
    </div>
  );
}

export default App;
