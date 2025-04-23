import { useEffect, useState, useRef } from "react";
import CameraView from "@/components/CameraView";
import StatusIndicators from "@/components/StatusIndicators";
import ControlsOverlay from "@/components/ControlsOverlay";
import Notifications from "@/components/Notifications";
import ConsoleOutput from "@/components/ConsoleOutput";
import HandVisualization from "@/components/HandVisualization";
import PerformanceDisplay from "@/components/PerformanceDisplay";
import PerformanceMonitor from "@/components/PerformanceMonitor";
import FpsStats from "@/components/PerformanceMetrics";
import MediaPipeHandTracker from "@/components/MediaPipeHandTracker";
import DrawingCanvas from "@/components/DrawingCanvas";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { EventType, addListener, dispatch } from "@/lib/eventBus";
import { Notification, HandData, PerformanceMetrics, DrawingPath } from "@/lib/types";
import { getVideoFrame } from "@/lib/cameraManager";

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

  // References to workers
  const opencvWorkerRef = useRef<Worker | null>(null);
  const mediaPipelineWorkerRef = useRef<Worker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameProcessingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const resolutionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Listen for OpenCV ready event from CDN
    window.addEventListener('opencv-ready', () => {
      addLog("OpenCV.js loaded from CDN and ready");
      setIsOpenCVReady(true);
      
      // Log OpenCV version if available
      if (typeof (window as any).cv !== 'undefined') {
        const version = (window as any).cv.version || 'unknown';
        addLog(`OpenCV.js version: ${version}`);
      }
    });
    
    // Check if OpenCV is already available
    if (typeof (window as any).cv !== 'undefined') {
      addLog("OpenCV.js already loaded from CDN");
      setIsOpenCVReady(true);
    }
  
    // Initialize workers when component mounts
    const opencvWorker = new Worker(
      new URL('./workers/opencv.worker.ts', import.meta.url),
      { type: 'module' }
    );

    const mediaPipelineWorker = new Worker(
      new URL('./workers/media-pipeline.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Store workers in refs
    opencvWorkerRef.current = opencvWorker;
    mediaPipelineWorkerRef.current = mediaPipelineWorker;

    // Set up event listeners for worker messages
    opencvWorker.onmessage = (e) => {
      if (e.data.type === 'log') {
        addLog(e.data.message);
      } else if (e.data.type === 'status') {
        setIsOpenCVReady(e.data.ready);
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

    mediaPipelineWorker.onmessage = (e) => {
      if (e.data.type === 'log') {
        addLog(e.data.message);
      } else if (e.data.type === 'status') {
        setIsMediaPipelineReady(e.data.ready);
      } else if (e.data.type === 'processed-frame') {
        // Debug message
        console.log('Received from media worker:', e.data);
        
        // Handle MediaPipe processed frame 
        if (e.data.handData) {
          console.log('Setting hand data:', e.data.handData);
          setHandData(e.data.handData);
        }
        
        // Update performance metrics
        if (e.data.performance) {
          console.log('Setting performance metrics:', e.data.performance);
          setPerformanceMetrics(prev => ({
            ...(prev || {}),
            ...e.data.performance
          }));
          
          // Dispatch event for PerformanceMonitor
          dispatch(EventType.FRAME_PROCESSED, {
            performance: e.data.performance,
            timestamp: Date.now()
          });
        }
        
        // Continue processing frames
        frameProcessingRef.current = false;
      }
    };

    // Start workers initialization
    opencvWorker.postMessage({ command: 'init' });
    mediaPipelineWorker.postMessage({ command: 'init' });

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
    
    // Test the ORB detector with real OpenCV integration
    import('@/lib/orbFeatureDetector').then(module => {
      const detector = module.ORBFeatureDetector.getInstance();
      addLog(`ORB Feature Detector OpenCV Ready: ${detector.isOpenCVReady()}`);
    });

    // Cleanup event listeners on unmount
    return () => {
      stopFrameProcessing();
      
      if (opencvWorkerRef.current) {
        opencvWorkerRef.current.terminate();
      }
      
      if (mediaPipelineWorkerRef.current) {
        mediaPipelineWorkerRef.current.terminate();
      }
      
      cameraListener.remove();
      fullscreenListener.remove();
      logListener.remove();
      notificationListener.remove();
      drawingListener.remove();
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

  const processVideoFrame = () => {
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
        // Capture frame from video
        const frameData = getVideoFrame(videoRef.current);
        
        if (frameData && mediaPipelineWorkerRef.current) {
          console.log('Sending frame to worker', frameData ? 'Frame available' : 'No frame');
          
          // Send frame to Media Pipeline worker for hand detection
          mediaPipelineWorkerRef.current.postMessage({
            command: 'process-frame',
            data: frameData
          });
          
          // We could also send to OpenCV worker in parallel for other processing
          if (opencvWorkerRef.current) {
            opencvWorkerRef.current.postMessage({
              command: 'process-frame',
              data: frameData
            });
          }
        }
      } catch (error) {
        console.error('Error processing video frame:', error);
        frameProcessingRef.current = false;
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
      
      {/* Performance metrics display */}
      {performanceMetrics && (
        <PerformanceDisplay
          performance={performanceMetrics}
          className="absolute top-16 right-4 z-10"
        />
      )}
      
      <Notifications 
        notifications={notifications}
      />
      
      <ConsoleOutput 
        logs={logs}
      />
      
      {/* Settings Panel */}
      <SettingsPanel />
      
      {/* Performance Monitor */}
      <PerformanceMonitor />
      
      {/* FPS Statistics with averages */}
      {isCameraRunning && <FpsStats />}
    </div>
  );
}

export default App;
