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
              
              // Setup worker response handler if not already set up
              if (!mediaPipelineWorker.onmessage) {
                mediaPipelineWorker.onmessage = (event) => {
                  if (event.data.type === 'processed-frame' && event.data.handData) {
                    const { landmarks: filteredLandmarks, fingerAngles, connections, colors } = event.data.handData;
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    // Clear canvas first
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw the hand landmarks and connections using the processed data
                    if (filteredLandmarks && filteredLandmarks.length > 0) {
                      filteredLandmarks.forEach((landmarks: any, handIndex: number) => {
                        // Draw landmarks
                        if (landmarksSettings.showLandmarks) {
                          if (landmarksSettings.colorScheme === 'rainbow') {
                            // Draw landmarks with rainbow colors by finger
                            // Each group of landmarks (finger) gets its own color
                            for (let i = 0; i < landmarks.length; i++) {
                              const landmark = landmarks[i];
                              
                              // Determine which finger this landmark belongs to
                              let colorIndex = 6; // Default to wrist color (violet)
                              if (i >= 1 && i <= 4) colorIndex = 0;  // Thumb (red)
                              else if (i >= 5 && i <= 8) colorIndex = 1;  // Index (orange)
                              else if (i >= 9 && i <= 12) colorIndex = 2;  // Middle (yellow)
                              else if (i >= 13 && i <= 16) colorIndex = 3;  // Ring (green)
                              else if (i >= 17 && i <= 20) colorIndex = 4;  // Pinky (blue)
                              
                              const color = FINGER_COLORS[colorIndex];
                              
                              // Draw the landmark
                              ctx.beginPath();
                              ctx.arc(
                                landmark.x * canvas.width, 
                                landmark.y * canvas.height, 
                                landmarksSettings.landmarkSize, 
                                0, 
                                2 * Math.PI
                              );
                              ctx.fillStyle = color;
                              ctx.fill();
                            }
                          } else {
                            // Use default MediaPipe drawing with single color
                            mpDrawing.drawLandmarks(ctx, landmarks, {
                              color: '#ffffff',
                              lineWidth: 2,
                              radius: landmarksSettings.landmarkSize
                            });
                          }
                        }
                        
                        // Draw connections
                        if (landmarksSettings.showConnections) {
                          if (landmarksSettings.colorScheme === 'rainbow') {
                            // Draw connections with rainbow colors
                            // Get the connection info from MediaPipe
                            const connections = mpHands.HAND_CONNECTIONS;
                            
                            for (let i = 0; i < connections.length; i++) {
                              const connection = connections[i];
                              const start = landmarks[connection[0]];
                              const end = landmarks[connection[1]];
                              
                              // Determine which finger this connection belongs to
                              let colorIndex = 5; // Default to palm color (indigo)
                              
                              // Check if it's a finger connection
                              if (connection[0] >= 1 && connection[0] <= 4 && connection[1] >= 1 && connection[1] <= 4) {
                                colorIndex = 0; // Thumb (red)
                              } else if (connection[0] >= 5 && connection[0] <= 8 && connection[1] >= 5 && connection[1] <= 8) {
                                colorIndex = 1; // Index (orange)
                              } else if (connection[0] >= 9 && connection[0] <= 12 && connection[1] >= 9 && connection[1] <= 12) {
                                colorIndex = 2; // Middle (yellow)
                              } else if (connection[0] >= 13 && connection[0] <= 16 && connection[1] >= 13 && connection[1] <= 16) {
                                colorIndex = 3; // Ring (green)
                              } else if (connection[0] >= 17 && connection[0] <= 20 && connection[1] >= 17 && connection[1] <= 20) {
                                colorIndex = 4; // Pinky (blue)
                              }
                              
                              const color = FINGER_COLORS[colorIndex];
                              
                              // Draw the connection
                              ctx.beginPath();
                              ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
                              ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
                              ctx.strokeStyle = color;
                              ctx.lineWidth = landmarksSettings.connectionWidth;
                              ctx.stroke();
                            }
                          } else {
                            // Use default MediaPipe drawing
                            mpDrawing.drawConnectors(ctx, landmarks, mpHands.HAND_CONNECTIONS, {
                              color: '#00ff00',
                              lineWidth: landmarksSettings.connectionWidth
                            });
                          }
                        }
                        
                        // Draw knuckle ruler if enabled
                        if (knuckleRulerSettings.enabled) {
                          const indexKnuckle = landmarks[5]; // MCP joint of index finger
                          const pinkyKnuckle = landmarks[17]; // MCP joint of pinky finger
                          
                          // Calculate distance between knuckles
                          const dx = (pinkyKnuckle.x - indexKnuckle.x) * canvas.width;
                          const dy = (pinkyKnuckle.y - indexKnuckle.y) * canvas.height;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          
                          // Scale factor (pixels per cm) based on known knuckle distance
                          const pixelsPerCm = distance / knuckleRulerSettings.knuckleDistanceCm;
                          
                          // Draw ruler line
                          ctx.beginPath();
                          ctx.moveTo(indexKnuckle.x * canvas.width, indexKnuckle.y * canvas.height);
                          ctx.lineTo(pinkyKnuckle.x * canvas.width, pinkyKnuckle.y * canvas.height);
                          ctx.strokeStyle = '#00aaff';
                          ctx.lineWidth = 2;
                          ctx.stroke();
                          
                          // Draw measurement if enabled
                          if (knuckleRulerSettings.showMeasurement) {
                            const midX = (indexKnuckle.x + pinkyKnuckle.x) / 2 * canvas.width;
                            const midY = (indexKnuckle.y + pinkyKnuckle.y) / 2 * canvas.height - 15;
                            
                            ctx.font = '12px sans-serif';
                            ctx.fillStyle = '#ffffff';
                            ctx.textAlign = 'center';
                            ctx.fillText(`${knuckleRulerSettings.knuckleDistanceCm}cm`, midX, midY);
                            ctx.fillText(`1px ≈ ${(1/pixelsPerCm).toFixed(2)}cm`, midX, midY + 15);
                          }
                        }
                        
                        // Render finger flexion state indicators if enabled
                        if (fingerFlexionSettings.enabled && fingerFlexionSettings.showStateIndicators && fingerAngles) {
                          const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
                          const yOffset = 30;
                          
                          fingerNames.forEach((fingerName, index) => {
                            if (!fingerFlexionSettings.enabledFingers[fingerName]) return;
                            
                            const angle = fingerAngles[fingerName].flex;
                            const thresholds = fingerFlexionSettings.thresholds[fingerName].flex;
                            
                            // Determine state
                            let state = 'in-between';
                            let color = '#ffaa00';
                            
                            if (angle < thresholds.min) {
                              state = 'straight';
                              color = '#00ff00';
                            } else if (angle > thresholds.max) {
                              state = 'bent';
                              color = '#0088ff';
                            }
                            
                            // Draw indicator
                            ctx.font = '12px sans-serif';
                            ctx.fillStyle = color;
                            ctx.textAlign = 'left';
                            ctx.fillText(`${fingerName}: ${state} (${Math.round(angle)}°)`, 10, yOffset + (index * 20));
                          });
                        }
                      });
                    }
                  }
                };
              }
              
              // For immediate visual feedback, draw raw landmarks while waiting for processed data
              results.multiHandLandmarks.forEach((landmarks: any) => {
                if (landmarksSettings.showLandmarks) {
                  mpDrawing.drawLandmarks(ctx, landmarks, {
                    color: 'rgba(255, 255, 255, 0.3)', // Semi-transparent
                    lineWidth: 1,
                    radius: landmarksSettings.landmarkSize - 1
                  });
                }
                
                if (landmarksSettings.showConnections) {
                  mpDrawing.drawConnectors(ctx, landmarks, mpHands.HAND_CONNECTIONS, {
                    color: 'rgba(0, 255, 0, 0.3)', // Semi-transparent
                    lineWidth: landmarksSettings.connectionWidth - 1
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
