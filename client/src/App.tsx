import { useEffect, useState, useRef } from "react";
import CameraView from "@/components/CameraView";
import StatusIndicators from "@/components/StatusIndicators";
import ControlsOverlay from "@/components/ControlsOverlay";
import Notifications from "@/components/Notifications";
import ConsoleOutput from "@/components/ConsoleOutput";
import HandVisualization from "@/components/HandVisualization";
import MediaPipeHandTracker from "@/components/MediaPipeHandTracker";
import SettingsPanel from "@/components/settings/SettingsPanel";
import FpsCounter from "@/components/FpsCounter";
import { EventType, addListener, dispatch } from "@/lib/eventBus";
import { Notification, HandData, PerformanceMetrics } from "@/lib/types";
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

  // References to workers
  const opencvWorkerRef = useRef<Worker | null>(null);
  const mediaPipelineWorkerRef = useRef<Worker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameProcessingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
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
    
    // Make the worker globally accessible
    (window as any).mediaPipelineWorker = mediaPipelineWorker;

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
        
        // Update performance metrics (kept for internal tracking)
        if (e.data.performance) {
          console.log('Setting performance metrics:', e.data.performance);
          setPerformanceMetrics(prev => ({
            ...(prev || {}),
            ...e.data.performance
          }));
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

    // Initial log
    addLog('Application initialized. Click "Start Camera" to begin.');

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
    // Only process if needed for non-MediaPipe processing (OpenCV, etc.)
    // The MediaPipeHandTracker component now handles sending frames to the media pipeline worker
    if (
      isOpenCVReady && 
      isCameraRunning && 
      videoRef.current && 
      !frameProcessingRef.current &&
      opencvWorkerRef.current // Only send to OpenCV worker now
    ) {
      frameProcessingRef.current = true;
      
      try {
        // Capture frame from video
        const frameData = getVideoFrame(videoRef.current);
        
        // We now only send the frame to the OpenCV worker for additional processing
        // The MediaPipe processing is handled directly in the MediaPipeHandTracker component
        if (frameData && opencvWorkerRef.current) {
          opencvWorkerRef.current.postMessage({
            command: 'process-frame',
            data: frameData
          });
        }
        
        // We're no longer waiting for the media pipeline worker to respond
        // since that's handled by the MediaPipeHandTracker component
        frameProcessingRef.current = false;
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
    setNotifications(prev => [...prev, { id, message, type }]);
    
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
      
      {/* FPS Counter */}
      {isCameraRunning && <FpsCounter />}
    </div>
  );
}

export default App;