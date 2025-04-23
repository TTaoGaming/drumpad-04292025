import React, { useEffect, useRef, useState, RefObject, useCallback } from 'react';
// Import types only for type checking, we'll load the actual modules dynamically
import type { Results, ResultsListener, HAND_CONNECTIONS } from '@mediapipe/hands';
import { addListener, dispatch, EventType } from '../lib/eventBus';
import { throttle } from '../lib/utils';

// The hand indices for each finger
const FINGER_INDICES = {
  THUMB: [1, 2, 3, 4],
  INDEX: [5, 6, 7, 8],
  MIDDLE: [9, 10, 11, 12],
  RING: [13, 14, 15, 16],
  PINKY: [17, 18, 19, 20]
};

// Rainbow colors for fingers
const FINGER_COLORS = [
  '#FF0000', // Red (thumb)
  '#FF7F00', // Orange (index)
  '#FFFF00', // Yellow (middle)
  '#00FF00', // Green (ring)
  '#0000FF', // Blue (pinky)
  '#4B0082', // Indigo (palm connections)
  '#9400D3'  // Violet (wrist)
];

interface MediaPipeHandTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

const MediaPipeHandTracker: React.FC<MediaPipeHandTrackerProps> = ({ videoRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTracking, setIsTracking] = useState(false);
  const lastFrameTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const handOptimizerRef = useRef<any>({ update: () => true, getROI: () => null }); // Simplified
  const fingerStateMemoryRef = useRef<any>({
    thumb: { state: 'straight', stableCount: 0, stable: false },
    index: { state: 'straight', stableCount: 0, stable: false },
    middle: { state: 'straight', stableCount: 0, stable: false },
    ring: { state: 'straight', stableCount: 0, stable: false },
    pinky: { state: 'straight', stableCount: 0, stable: false }
  });

  // Settings with state hooks for reactivity
  const [landmarksSettings, setLandmarksSettings] = useState({
    showLandmarks: true,
    showConnections: true,
    colorScheme: 'rainbow',
    landmarkSize: 4,
    connectionWidth: 2
  });
  
  const [knuckleRulerSettings, setKnuckleRulerSettings] = useState({
    enabled: false,
    showMeasurement: false,
    knuckleDistanceCm: 8.0
  });
  
  const [performanceSettings, setPerformanceSettings] = useState({
    landmarkFiltering: { enabled: true },
    roiOptimization: { enabled: false },
    throttling: { enabled: true },
    frameProcessing: { processEveryNth: 1 }
  });
  
  const [fingerFlexionSettings, setFingerFlexionSettings] = useState({
    enabled: false,
    showStateIndicators: false,
    enabledFingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
    thresholds: {
      thumb: { flex: { min: 20, max: 45 } },
      index: { flex: { min: 20, max: 45 } },
      middle: { flex: { min: 20, max: 45 } },
      ring: { flex: { min: 20, max: 45 } },
      pinky: { flex: { min: 20, max: 45 } }
    }
  });
  
  const [filterOptions, setFilterOptions] = useState({
    minCutoff: 0.001,
    beta: 0.1,
    dcutoff: 1.0
  });

  // Listen for settings changes from settings panel
  useEffect(() => {
    // Add listeners for various settings changes
    const settingsListener = addListener(EventType.SETTINGS_VALUE_CHANGE, (data) => {
      console.log("Settings changed:", data);
      
      // Handle changes to landmark visualization
      if (data.section === 'landmarks') {
        setLandmarksSettings(prev => ({ ...prev, ...data.value }));
      }
      
      // Handle changes to knuckle ruler settings
      if (data.section === 'ruler') {
        setKnuckleRulerSettings(prev => ({ ...prev, ...data.value }));
      }
      
      // Handle performance setting changes
      if (data.section === 'performance') {
        setPerformanceSettings(prev => ({ ...prev, ...data.value }));
      }
      
      // Handle filter setting changes
      if (data.section === 'filters' && data.setting === 'oneEuro') {
        setFilterOptions(prev => ({ ...prev, ...data.value }));
      }
      
      // Handle finger flexion settings
      if (data.section === 'gestures' && data.setting === 'fingerFlexion') {
        setFingerFlexionSettings(prev => ({ ...prev, ...data.value }));
      }
    });
    
    // Return cleanup function
    return () => {
      settingsListener.remove();
    };
  }, []);

  useEffect(() => {
    // Initialize canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Size canvas to match video
    if (videoRef.current) {
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
    } else {
      canvas.width = 640;
      canvas.height = 480;
    }
    
    // Initialize MediaPipe with dynamic imports
    const initializeMediaPipe = async () => {
      try {
        dispatch(EventType.LOG, { message: 'Loading MediaPipe Hands dependencies...', type: 'info' });
        
        // Dynamically import MediaPipe modules
        const mpHands = await import('@mediapipe/hands');
        const mpDrawing = await import('@mediapipe/drawing_utils');
        const mpCamera = await import('@mediapipe/camera_utils');
        
        // Initialize MediaPipe Hands
        const hands = new mpHands.Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
          }
        });
    
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        
        // Access the globally available media pipeline worker
        const mediaPipelineWorker = (window as any).mediaPipelineWorker;
        
        // Log if worker is available
        if (mediaPipelineWorker) {
          console.log("Media pipeline worker found and available");
        } else {
          console.warn("Media pipeline worker not available");
        }
        
        // Setup result handler
        hands.onResults((results: any) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          // Calculate FPS
          const now = performance.now();
          const fps = lastFrameTimeRef.current ? 
            Math.round(1000 / (now - lastFrameTimeRef.current)) : 0;
          lastFrameTimeRef.current = now;
          
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Process hands if available
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            // If the mediaPipelineWorker is available, use it for processing
            if (mediaPipelineWorker) {
              // Log that we're sending data to the worker
              console.log("Sending landmarks to worker for processing", {
                landmarkCount: results.multiHandLandmarks.length,
                timestamp: now
              });
              
              // Send raw landmarks to the worker for processing
              mediaPipelineWorker.postMessage({
                command: 'process-frame',
                rawLandmarks: results.multiHandLandmarks,
                timestamp: now,
                filterOptions: filterOptions,
                fingerFlexionSettings: fingerFlexionSettings,
                landmarkFilteringEnabled: performanceSettings.landmarkFiltering.enabled
              });
              
              // Simple drawing without worker response for now
              results.multiHandLandmarks.forEach((landmarks: any) => {
                if (landmarksSettings.showLandmarks) {
                  mpDrawing.drawLandmarks(ctx, landmarks, {
                    color: '#ffffff',
                    lineWidth: 2,
                    radius: landmarksSettings.landmarkSize
                  });
                }
                
                if (landmarksSettings.showConnections) {
                  mpDrawing.drawConnectors(ctx, landmarks, mpHands.HAND_CONNECTIONS, {
                    color: '#00ff00',
                    lineWidth: landmarksSettings.connectionWidth
                  });
                }
              });
            } else {
              // Fallback to main thread processing
              results.multiHandLandmarks.forEach((landmarks: any) => {
                if (landmarksSettings.showLandmarks) {
                  mpDrawing.drawLandmarks(ctx, landmarks, {
                    color: '#ffffff',
                    lineWidth: 2,
                    radius: landmarksSettings.landmarkSize
                  });
                }
                
                if (landmarksSettings.showConnections) {
                  mpDrawing.drawConnectors(ctx, landmarks, mpHands.HAND_CONNECTIONS, {
                    color: '#00ff00',
                    lineWidth: landmarksSettings.connectionWidth
                  });
                }
              });
            }
          }
          
          // Dispatch FPS info to event bus instead of drawing directly
          dispatch(EventType.FRAME_PROCESSED, {
            fps: fps,
            timestamp: now,
            processingTime: {
              total: now - lastFrameTimeRef.current
            }
          });
        });
        
        // Initialize camera if video element is available
        if (videoRef.current) {
          const camera = new mpCamera.Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current) {
                await hands.send({image: videoRef.current});
              }
            },
            width: 640,
            height: 480
          });
          
          // Start camera
          camera.start()
            .then(() => {
              dispatch(EventType.LOG, { message: 'MediaPipe Hands tracking initialized successfully', type: 'success' });
              setIsTracking(true);
            })
            .catch((error: any) => {
              console.error('Error starting camera:', error);
              dispatch(EventType.LOG, { message: 'Failed to initialize MediaPipe Hands tracking: ' + error.message, type: 'error' });
            });
        }
      } catch (error) {
        console.error('Error initializing MediaPipe:', error);
        dispatch(EventType.LOG, { message: 'Failed to load MediaPipe libraries: ' + (error as Error).message, type: 'error' });
      }
    };
    
    // Call the initialization function
    initializeMediaPipe();
    
    // Cleanup function for the useEffect
    return () => {
      // The camera and hands instances are managed inside the async function
      // Additional cleanup can be done here if needed
    };
  }, [videoRef]);

  // Simple filter application (would be offloaded to worker)
  const applyFilter = (landmarks: any, handIndex: number, timestamp: number) => {
    return landmarks;
  };
  
  // Simple draw ROI function
  const drawROI = (ctx: CanvasRenderingContext2D, roi: any, width: number, height: number) => {
    if (!roi) return;
    
    const x = roi.x * width;
    const y = roi.y * height;
    const w = roi.width * width;
    const h = roi.height * height;
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  };
  
  // Simplified angle calculation
  const calculateFingerAngles = (landmarks: any, enabledFingers?: any) => {
    if (!landmarks) return null;
    
    return {
      thumb: { flex: 0 },
      index: { flex: 0 },
      middle: { flex: 0 },
      ring: { flex: 0 },
      pinky: { flex: 0 }
    };
  };
  
  // Throttled dispatch function
  const throttledDispatch = useCallback((type: EventType, data: any) => {
    const throttled = throttle((t: EventType, d: any) => {
      dispatch(t, d);
    }, 16); // ~60fps
    
    throttled(type, data);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 z-10 w-full h-full pointer-events-none"
    />
  );
};

export default MediaPipeHandTracker;
