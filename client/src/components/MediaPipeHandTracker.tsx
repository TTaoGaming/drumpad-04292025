import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EventType, dispatch, addListener } from '@/lib/eventBus';
import { HandData, HandLandmark, HandConnection } from '@/lib/types';
import { OneEuroFilterArray, DEFAULT_FILTER_OPTIONS } from '@/lib/oneEuroFilter';

interface MediaPipeHandTrackerProps {
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

const MediaPipeHandTracker: React.FC<MediaPipeHandTrackerProps> = ({ videoRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const handFiltersRef = useRef<Map<number, OneEuroFilterArray[]>>(new Map());
  
  // Filter settings state
  const [filterOptions, setFilterOptions] = useState({
    minCutoff: DEFAULT_FILTER_OPTIONS.minCutoff,
    beta: DEFAULT_FILTER_OPTIONS.beta,
    dcutoff: DEFAULT_FILTER_OPTIONS.dcutoff
  });
  
  // Landmark visualization settings
  const [landmarksSettings, setLandmarksSettings] = useState({
    showLandmarks: true,
    showConnections: true,
    landmarkSize: 4,
    connectionWidth: 5,
    colorScheme: 'rainbow'
  });
  
  // Filter settings change handler
  const handleFilterSettingsChange = useCallback((newSettings: {
    minCutoff: number;
    beta: number;
    dcutoff: number;
  }) => {
    setFilterOptions(newSettings);
    
    // Update all existing filters with new settings
    handFiltersRef.current.forEach(handFilters => {
      handFilters.forEach(filter => {
        filter.updateOptions(newSettings);
      });
    });
  }, []);
  
  // Apply the 1€ filter to hand landmarks
  const applyFilter = useCallback((landmarks: any, handIndex: number, timestamp: number): any => {
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
  
  // Initialize MediaPipe when the component mounts
  useEffect(() => {
    // Dynamic imports to avoid bundling these heavy libraries
    const loadDependencies = async () => {
      try {
        dispatch(EventType.LOG, {
          message: 'Loading MediaPipe Hands dependencies...',
          type: 'info'
        });
        
        // Import MediaPipe libraries
        const mpHands = await import('@mediapipe/hands');
        const mpCamera = await import('@mediapipe/camera_utils');
        const mpDrawing = await import('@mediapipe/drawing_utils');
        
        // Initialize MediaPipe Hands
        const hands = new mpHands.Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });
        
        // Configure Hands
        hands.setOptions({
          selfieMode: false, // Disabled mirror effect for desktop surface scenarios
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        
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
                mpHands.HAND_CONNECTIONS.forEach((connection: any) => {
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
            });
          }
          
          // Draw FPS counter
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(10, canvas.height - 40, 120, 30);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 16px Arial';
          ctx.fillText(`FPS: ${fps}`, 20, canvas.height - 18);
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
          
          camera.start();
          
          dispatch(EventType.LOG, {
            message: 'MediaPipe Hands tracking initialized successfully',
            type: 'success'
          });
          
          // Cleanup function to stop camera and hands when component unmounts
          return () => {
            camera.stop();
            hands.close();
          };
        }
      } catch (error) {
        console.error('Error loading MediaPipe Hands:', error);
        dispatch(EventType.LOG, {
          message: `MediaPipe initialization failed: ${error}`,
          type: 'error'
        });
      }
    };
    
    loadDependencies();
  }, [videoRef, applyFilter, landmarksSettings]);
  
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
    // Listen for filter settings from the settings panel
    const settingsListener = addListener(EventType.SETTINGS_VALUE_CHANGE, (data) => {
      // Handle 1€ Filter settings
      if (data.section === 'filters' && data.setting === 'oneEuroFilter') {
        if (data.value.enabled !== undefined) {
          // Update filter options
          handleFilterSettingsChange(data.value.params);
        }
      }
      
      // Handle hand landmarks visualization settings
      if (data.section === 'handLandmarks') {
        setLandmarksSettings(prev => ({
          ...prev,
          ...data.value
        }));
      }
    });
    
    return () => {
      settingsListener.remove();
    };
  }, [handleFilterSettingsChange]);
  
  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 pointer-events-none"
      />
    </>
  );
};

export default MediaPipeHandTracker;