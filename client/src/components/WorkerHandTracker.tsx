import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EventType, dispatch, addListener } from '@/lib/eventBus';
import { HandData } from '@/lib/types';
import mediaPipeWorkerService from '@/services/MediaPipeWorkerService';
import { DEFAULT_FILTER_OPTIONS, OneEuroFilterArray } from '@/lib/oneEuroFilter';

interface WorkerHandTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

// Rainbow colors for different parts of the hand
const FINGER_COLORS = [
  '#FF0000', // red - thumb
  '#FF7F00', // orange - index
  '#FFFF00', // yellow - middle
  '#00FF00', // green - ring
  '#0000FF', // blue - pinky
  '#4B0082', // indigo - palm
  '#9400D3'  // violet - wrist
];

// Define finger indices for coloring
const FINGER_INDICES = {
  THUMB: [1, 2, 3, 4],
  INDEX: [5, 6, 7, 8],
  MIDDLE: [9, 10, 11, 12],
  RING: [13, 14, 15, 16],
  PINKY: [17, 18, 19, 20],
  PALM: [0, 1, 5, 9, 13, 17]
};

const WorkerHandTracker: React.FC<WorkerHandTrackerProps> = ({ videoRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  
  // Filter configurations
  const handFiltersRef = useRef<Map<number, OneEuroFilterArray[]>>(new Map());
  const [filterOptions, setFilterOptions] = useState({
    minCutoff: DEFAULT_FILTER_OPTIONS.minCutoff,
    beta: DEFAULT_FILTER_OPTIONS.beta,
    dcutoff: DEFAULT_FILTER_OPTIONS.dcutoff
  });
  
  // Loading state
  const [modelLoading, setModelLoading] = useState(true);
  
  // Landmark visualization settings
  const [landmarksSettings, setLandmarksSettings] = useState({
    showLandmarks: true,
    showConnections: true,
    landmarkSize: 4,
    connectionWidth: 5,
    colorScheme: 'rainbow'
  });
  
  // Knuckle ruler settings
  const [knuckleRulerSettings, setKnuckleRulerSettings] = useState({
    enabled: true,
    showMeasurement: true,
    knuckleDistanceCm: 8.0
  });
  
  // Performance settings
  const [performanceSettings, setPerformanceSettings] = useState({
    frameProcessing: {
      processEveryNth: 1, // Process every frame
    }
  });
  
  // Apply the 1€ filter to hand landmarks
  const applyFilter = useCallback((landmarks: any, handIndex: number, timestamp: number): any => {
    if (!landmarks || landmarks.length === 0) return landmarks;
    
    if (!handFiltersRef.current.has(handIndex)) {
      // Create new filter array for each landmark (each has x,y,z coordinates)
      const handFilters: OneEuroFilterArray[] = [];
      for (let i = 0; i < landmarks.length; i++) {
        handFilters.push(new OneEuroFilterArray(3, filterOptions));
      }
      handFiltersRef.current.set(handIndex, handFilters);
    }
    
    const handFilters = handFiltersRef.current.get(handIndex)!;
    
    // Apply filter to each landmark
    return landmarks.map((landmark: any, i: number) => {
      const values = [landmark.x, landmark.y, landmark.z];
      const filteredValues = handFilters[i].filter(values, timestamp / 1000); // Convert to seconds
      
      return {
        x: filteredValues[0],
        y: filteredValues[1],
        z: filteredValues[2]
      };
    });
  }, [filterOptions]);
  
  // Handle MediaPipe results from worker
  const handleMediaPipeResults = useCallback((results: any, processingTime: number) => {
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
      // Draw landmarks and connections
      const mpDrawing = {
        drawLandmarks: (
          ctx: CanvasRenderingContext2D, 
          landmarks: any[], 
          options: { color: string, lineWidth: number, radius: number }
        ) => {
          ctx.fillStyle = options.color;
          ctx.strokeStyle = options.color;
          ctx.lineWidth = options.lineWidth;
          
          for (let i = 0; i < landmarks.length; i++) {
            const landmark = landmarks[i];
            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;
            
            ctx.beginPath();
            ctx.arc(x, y, options.radius, 0, 2 * Math.PI);
            ctx.fill();
          }
        },
        
        drawConnectors: (
          ctx: CanvasRenderingContext2D, 
          landmarks: any[], 
          connections: [number, number][], 
          options: { color: string, lineWidth: number }
        ) => {
          ctx.strokeStyle = options.color;
          ctx.lineWidth = options.lineWidth;
          
          for (const connection of connections) {
            const [index1, index2] = connection;
            const start = landmarks[index1];
            const end = landmarks[index2];
            
            if (!start || !end) continue;
            
            const x1 = start.x * canvas.width;
            const y1 = start.y * canvas.height;
            const x2 = end.x * canvas.width;
            const y2 = end.y * canvas.height;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
      };
      
      // Create MediaPipe-like connections array for drawing
      const handConnections: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],        // Index finger
        [0, 9], [9, 10], [10, 11], [11, 12],   // Middle finger
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring finger
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [0, 5], [5, 9], [9, 13], [13, 17]      // Palm
      ];
      
      results.multiHandLandmarks.forEach((landmarks: any, handIndex: number) => {
        // Apply 1€ filter to hand landmarks
        const filteredLandmarks = applyFilter(landmarks, handIndex, now);
        
        // Draw filtered landmarks if enabled
        if (landmarksSettings.showLandmarks) {
          mpDrawing.drawLandmarks(ctx, filteredLandmarks, {
            color: '#ffffff',
            lineWidth: 2,
            radius: landmarksSettings.landmarkSize
          });
        }
        
        // Draw connections if enabled
        if (landmarksSettings.showConnections) {
          handConnections.forEach((connection: [number, number]) => {
            // Determine which finger this connection belongs to
            let colorIndex = 5; // Default to palm (indigo)
            
            if (landmarksSettings.colorScheme === 'rainbow') {
              // Identify which finger the connection belongs to for rainbow coloring
              if (FINGER_INDICES.THUMB.includes(connection[0]) && 
                  FINGER_INDICES.THUMB.includes(connection[1])) {
                colorIndex = 0; // Thumb - red
              } else if (FINGER_INDICES.INDEX.includes(connection[0]) && 
                        FINGER_INDICES.INDEX.includes(connection[1])) {
                colorIndex = 1; // Index - orange
              } else if (FINGER_INDICES.MIDDLE.includes(connection[0]) && 
                        FINGER_INDICES.MIDDLE.includes(connection[1])) {
                colorIndex = 2; // Middle - yellow
              } else if (FINGER_INDICES.RING.includes(connection[0]) && 
                        FINGER_INDICES.RING.includes(connection[1])) {
                colorIndex = 3; // Ring - green
              } else if (FINGER_INDICES.PINKY.includes(connection[0]) && 
                        FINGER_INDICES.PINKY.includes(connection[1])) {
                colorIndex = 4; // Pinky - blue
              }
            } else if (landmarksSettings.colorScheme === 'single') {
              // Use a single color (white) for all connections
              colorIndex = 6; // Use violet (last color)
            }
            
            // Draw the connection with appropriate color
            mpDrawing.drawConnectors(ctx, filteredLandmarks, [connection], {
              color: landmarksSettings.colorScheme === 'single' ? '#FFFFFF' : FINGER_COLORS[colorIndex],
              lineWidth: landmarksSettings.connectionWidth
            });
          });
        }
        
        // Add knuckle ruler visualization
        if (knuckleRulerSettings.enabled && knuckleRulerSettings.showMeasurement) {
          // Get the first detected hand for the knuckle ruler
          const landmarks = filteredLandmarks;
          
          // The index knuckle is landmark 5, pinky knuckle is landmark 17
          const indexKnuckle = landmarks[5];
          const pinkyKnuckle = landmarks[17];
          
          if (indexKnuckle && pinkyKnuckle) {
            // Calculate the Euclidean distance between knuckles in normalized space (0-1)
            const normalizedDistance = Math.sqrt(
              Math.pow(indexKnuckle.x - pinkyKnuckle.x, 2) + 
              Math.pow(indexKnuckle.y - pinkyKnuckle.y, 2)
            );
            
            // Calculate the actual measurement in pixels
            const pixelDistance = normalizedDistance * canvas.width;
            
            // Calculate physical distance based on knuckle ruler calibration
            const physicalDistanceCm = (pixelDistance / canvas.width) * knuckleRulerSettings.knuckleDistanceCm;
            
            // Draw knuckle ruler line
            const x1 = indexKnuckle.x * canvas.width;
            const y1 = indexKnuckle.y * canvas.height;
            const x2 = pinkyKnuckle.x * canvas.width;
            const y2 = pinkyKnuckle.y * canvas.height;
            
            // Draw line between knuckles
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            
            // Draw distance text background
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2 - 15; // Offset above the line
            
            // Draw background for text
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(midX - 45, midY - 10, 90, 20);
            
            // Draw text
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${physicalDistanceCm.toFixed(1)} cm`, midX, midY);
            
            // Dispatch an event with the real-time measurement
            dispatch(EventType.SETTINGS_VALUE_CHANGE, {
              section: 'calibration',
              setting: 'knuckleRulerRealtime',
              value: {
                normalizedDistance,
                pixelDistance,
                physicalDistanceCm
              }
            });
          }
        }
      });
    }
    
    // Dispatch performance metrics
    dispatch(EventType.FRAME_PROCESSED, {
      fps,
      processingTime,
      frameSize: {
        width: canvas.width,
        height: canvas.height
      }
    });
    
  }, [applyFilter, landmarksSettings, knuckleRulerSettings]);
  
  // Initialize MediaPipe worker when the component mounts
  useEffect(() => {
    let mounted = true;
    
    const setupWorker = async () => {
      if (!mounted) return;
      
      setModelLoading(true);
      dispatch(EventType.LOG, {
        message: 'Initializing MediaPipe hand tracking in worker...',
        type: 'info'
      });
      
      try {
        // Initialize the worker
        const success = await mediaPipeWorkerService.init(
          handleMediaPipeResults,
          {
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          }
        );
        
        if (success && mounted) {
          dispatch(EventType.LOG, {
            message: 'MediaPipe worker initialized successfully',
            type: 'success'
          });
          
          // Only if still mounted
          if (mounted && videoRef.current && videoRef.current.readyState >= 2) {
            mediaPipeWorkerService.startProcessing(
              videoRef.current,
              performanceSettings.frameProcessing.processEveryNth
            );
          }
        } else if (mounted) {
          throw new Error('Failed to initialize MediaPipe worker');
        }
      } catch (error: any) {
        if (!mounted) return;
        
        console.error('Error initializing MediaPipe worker:', error);
        dispatch(EventType.LOG, {
          message: `MediaPipe worker initialization failed: ${error.message || error}`,
          type: 'error'
        });
      } finally {
        if (mounted) {
          setModelLoading(false);
        }
      }
    };
    
    setupWorker();
    
    // Cleanup when component unmounts
    return () => {
      mounted = false;
      mediaPipeWorkerService.stopProcessing();
      mediaPipeWorkerService.dispose();
    };
  }, [handleMediaPipeResults, performanceSettings.frameProcessing.processEveryNth, videoRef]);
  
  // Start processing frames when video is ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleVideoReady = () => {
      if (mediaPipeWorkerService && videoRef.current) {
        mediaPipeWorkerService.startProcessing(
          videoRef.current,
          performanceSettings.frameProcessing.processEveryNth
        );
      }
    };
    
    video.addEventListener('playing', handleVideoReady);
    
    // If video is already playing, start processing
    if (video.readyState >= 2 && !video.paused && !video.ended) {
      handleVideoReady();
    }
    
    return () => {
      video.removeEventListener('playing', handleVideoReady);
      mediaPipeWorkerService.stopProcessing();
    };
  }, [videoRef, performanceSettings.frameProcessing.processEveryNth]);
  
  // Resize canvas to match video dimensions
  useEffect(() => {
    const resizeCanvas = () => {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.clientWidth;
        canvasRef.current.height = videoRef.current.clientHeight;
      }
    };
    
    // Resize initially
    resizeCanvas();
    
    // Listen for window resize events
    window.addEventListener('resize', resizeCanvas);
    
    // Cleanup
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [videoRef]);
  
  // Listen for settings changes
  useEffect(() => {
    // Listen for settings from the settings panel
    const settingsListener = addListener(EventType.SETTINGS_VALUE_CHANGE, (data) => {
      // Handle hand landmarks visualization settings
      if (data.section === 'handLandmarks') {
        setLandmarksSettings(prev => ({
          ...prev,
          ...data.value
        }));
      }
      
      // Handle knuckle ruler settings
      if (data.section === 'calibration' && data.setting === 'knuckleRuler') {
        setKnuckleRulerSettings(data.value);
      }
      
      // Handle frame processing settings
      if (data.section === 'performance' && data.setting === 'frameProcessing') {
        setPerformanceSettings(prev => ({
          ...prev,
          frameProcessing: data.value
        }));
        
        // Update worker frame processing
        if (mediaPipeWorkerService && videoRef.current) {
          mediaPipeWorkerService.stopProcessing();
          mediaPipeWorkerService.startProcessing(
            videoRef.current,
            data.value.processEveryNth
          );
        }
      }
    });
    
    return () => {
      settingsListener.remove();
    };
  }, [videoRef]);
  
  return (
    <>
      {modelLoading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
          <div className="text-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-white text-sm">Initializing MediaPipe model...</p>
            <p className="text-white/60 text-xs mt-1">This may take a moment</p>
          </div>
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ opacity: modelLoading ? 0 : 1 }}
      />
    </>
  );
};

export default WorkerHandTracker;