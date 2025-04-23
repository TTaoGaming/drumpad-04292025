import { useEffect, useRef } from "react";
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
import WorkerHandTracker from "@/components/WorkerHandTracker";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { EventType, dispatch } from "@/lib/eventBus";
import { getVideoFrame } from "@/lib/cameraManager";
import { useAppState, AppStateActions } from "@/contexts";

function App() {
  // Use the centralized app state instead of local state
  const {
    isCameraRunning,
    isFullscreen,
    isOpenCVReady,
    isMediaPipelineReady,
    handData,
    performanceMetrics,
    resolution,
    logs,
    notifications
  } = useAppState();

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

    // Set up event listeners for worker messages
    opencvWorker.onmessage = (e) => {
      if (e.data.type === 'log') {
        AppStateActions.addLog(e.data.message);
      } else if (e.data.type === 'status') {
        AppStateActions.updateOpenCVStatus(e.data.ready);
      } else if (e.data.type === 'processed-frame') {
        // For now we'll just update any performance metrics
        if (e.data.performance) {
          dispatch(EventType.FRAME_PROCESSED, {
            performance: e.data.performance
          });
        }
      }
    };

    mediaPipelineWorker.onmessage = (e) => {
      if (e.data.type === 'log') {
        AppStateActions.addLog(e.data.message);
      } else if (e.data.type === 'status') {
        AppStateActions.updatePipelineStatus(e.data.ready);
      } else if (e.data.type === 'processed-frame') {
        // Debug message
        console.log('Received from media worker:', e.data);
        
        // Frame processed events are handled by AppState through event bus
        if (e.data.handData) {
          dispatch(EventType.FRAME_PROCESSED, {
            handData: e.data.handData
          });
        }
        
        // Update performance metrics
        if (e.data.performance) {
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

    // Initial log
    AppStateActions.addLog('Application initialized. Click "Start Camera" to begin.');

    // Cleanup event listeners on unmount
    return () => {
      stopFrameProcessing();
      
      if (opencvWorkerRef.current) {
        opencvWorkerRef.current.terminate();
      }
      
      if (mediaPipelineWorkerRef.current) {
        mediaPipelineWorkerRef.current.terminate();
      }
    };
  }, []);

  // Check if all components are ready
  useEffect(() => {
    if (isOpenCVReady && isMediaPipelineReady && isCameraRunning) {
      AppStateActions.addNotification('All systems initialized and ready', 'success');
      AppStateActions.addLog('All systems initialized and ready for frame processing', 'success');
    }
  }, [isOpenCVReady, isMediaPipelineReady, isCameraRunning]);

  // Handle camera state changes
  useEffect(() => {
    if (isCameraRunning) {
      AppStateActions.addLog('Camera started at 480p resolution');
      
      // Start frame processing when camera is running
      startFrameProcessing();
    } else if (animationFrameRef.current) {
      AppStateActions.addLog('Camera stopped');
      
      // Stop frame processing when camera is stopped
      stopFrameProcessing();
    }
  }, [isCameraRunning]);

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

  return (
    <div id="camera-container" className="relative w-screen h-screen bg-background">
      <CameraView 
        isCameraRunning={isCameraRunning}
        videoRef={videoRef}
      />
      
      {/* MediaPipe Hand Tracking Options */}
      {isCameraRunning && (
        <>
          {/* Original MediaPipe Hand Tracking (Main thread) */}
          <MediaPipeHandTracker videoRef={videoRef} />
          
          {/* Worker-based MediaPipe Hand Tracking (Disabled - having CDN loading issues) */}
          {false && <WorkerHandTracker videoRef={videoRef} />}
        </>
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
