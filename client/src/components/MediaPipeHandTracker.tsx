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
  
  // Knuckle ruler settings
  const [knuckleRulerSettings, setKnuckleRulerSettings] = useState({
    enabled: true,
    showMeasurement: true,
    knuckleDistanceCm: 8.0
  });
  
  // Finger flexion settings
  const [fingerFlexionSettings, setFingerFlexionSettings] = useState({
    enabled: true,
    enabledFingers: {
      thumb: true,
      index: true,
      middle: true,
      ring: false,  // Disabled by default to save performance
      pinky: false  // Disabled by default to save performance
    },
    thresholds: {
      thumb: { flex: { min: 5, max: 40 } },
      index: { flex: { min: 5, max: 60 } },
      middle: { flex: { min: 5, max: 60 } },
      ring: { flex: { min: 5, max: 60 } },
      pinky: { flex: { min: 5, max: 60 } }
    }
  });
  
  /**
   * Calculate the angle between three points in 3D space
   * Used for calculating finger joint angles
   * 
   * @param p1 First point
   * @param p2 Second point (joint)
   * @param p3 Third point
   * @returns Angle in degrees
   */
  const calculateAngle = useCallback((p1: any, p2: any, p3: any): number => {
    // Optimized angle calculation - avoid excessive object creation
    const vec1x = p1.x - p2.x;
    const vec1y = p1.y - p2.y;
    const vec1z = p1.z - p2.z;
    
    const vec2x = p3.x - p2.x;
    const vec2y = p3.y - p2.y;
    const vec2z = p3.z - p2.z;
    
    // Calculate dot product
    const dotProduct = vec1x * vec2x + vec1y * vec2y + vec1z * vec2z;
    
    // Calculate magnitudes
    const mag1 = Math.sqrt(vec1x * vec1x + vec1y * vec1y + vec1z * vec1z);
    const mag2 = Math.sqrt(vec2x * vec2x + vec2y * vec2y + vec2z * vec2z);
    
    // Calculate angle in radians
    // Use Math.max to avoid domain errors with acos due to floating-point imprecision
    const cosVal = Math.max(-1.0, Math.min(1.0, dotProduct / (mag1 * mag2)));
    const angleRad = Math.acos(cosVal);
    
    // Convert to degrees
    return angleRad * (180 / Math.PI);
  }, []);
  
  // Pre-defined finger joint indices to avoid recreating the object on each frame
  const fingerJointIndices = {
    thumb: [1, 2, 3, 4],         // CMC, MCP, IP, TIP
    index: [0, 5, 6, 7, 8],      // Wrist, MCP, PIP, DIP, TIP
    middle: [0, 9, 10, 11, 12],  // Wrist, MCP, PIP, DIP, TIP
    ring: [0, 13, 14, 15, 16],   // Wrist, MCP, PIP, DIP, TIP
    pinky: [0, 17, 18, 19, 20]   // Wrist, MCP, PIP, DIP, TIP
  };

  /**
   * Calculate a simplified combined finger flexion angle from hand landmarks
   * Provides a single value per finger by averaging the two main joint angles
   * 
   * @param landmarks Array of hand landmarks from MediaPipe
   * @param enabledFingers Object indicating which fingers to calculate for
   * @returns Object with simplified flexion measurements for each finger
   */
  const calculateFingerAngles = useCallback((landmarks: any, enabledFingers?: {thumb: boolean, index: boolean, middle: boolean, ring: boolean, pinky: boolean}) => {
    // Ensure we have landmarks
    if (!landmarks || landmarks.length < 21) {
      return null;
    }
    
    // Pre-allocate the angles object with simplified flex measurements
    const angles: {[finger: string]: {flex: number | null}} = {
      thumb: { flex: null },
      index: { flex: null },
      middle: { flex: null },
      ring: { flex: null },
      pinky: { flex: null }
    };
    
    // Only calculate angles for enabled fingers (or all if not specified)
    
    // Thumb - only if enabled
    if (!enabledFingers || enabledFingers.thumb) {
      // Use IP joint as the main measurement for thumb
      angles.thumb.flex = calculateAngle(
        landmarks[2], // MCP
        landmarks[3], // IP
        landmarks[4]  // TIP
      );
    }
    
    // Index finger - only if enabled
    if (!enabledFingers || enabledFingers.index) {
      // Combine PIP and DIP angles for index finger
      const pipAngle = calculateAngle(
        landmarks[5], // MCP
        landmarks[6], // PIP
        landmarks[7]  // DIP
      );
      const dipAngle = calculateAngle(
        landmarks[6], // PIP
        landmarks[7], // DIP
        landmarks[8]  // TIP
      );
      // Use weighted average (PIP is more important for flexion)
      angles.index.flex = (pipAngle * 0.6) + (dipAngle * 0.4);
    }
    
    // Middle finger - only if enabled
    if (!enabledFingers || enabledFingers.middle) {
      // Combine PIP and DIP angles for middle finger
      const pipAngle = calculateAngle(
        landmarks[9],  // MCP
        landmarks[10], // PIP
        landmarks[11]  // DIP
      );
      const dipAngle = calculateAngle(
        landmarks[10], // PIP
        landmarks[11], // DIP
        landmarks[12]  // TIP
      );
      // Use weighted average
      angles.middle.flex = (pipAngle * 0.6) + (dipAngle * 0.4);
    }
    
    // Ring finger - only if enabled
    if (!enabledFingers || enabledFingers.ring) {
      // Combine PIP and DIP angles for ring finger
      const pipAngle = calculateAngle(
        landmarks[13], // MCP
        landmarks[14], // PIP
        landmarks[15]  // DIP
      );
      const dipAngle = calculateAngle(
        landmarks[14], // PIP
        landmarks[15], // DIP
        landmarks[16]  // TIP
      );
      // Use weighted average
      angles.ring.flex = (pipAngle * 0.6) + (dipAngle * 0.4);
    }
    
    // Pinky finger - only if enabled
    if (!enabledFingers || enabledFingers.pinky) {
      // Combine PIP and DIP angles for pinky finger
      const pipAngle = calculateAngle(
        landmarks[17], // MCP
        landmarks[18], // PIP
        landmarks[19]  // DIP
      );
      const dipAngle = calculateAngle(
        landmarks[18], // PIP
        landmarks[19], // DIP
        landmarks[20]  // TIP
      );
      // Use weighted average
      angles.pinky.flex = (pipAngle * 0.6) + (dipAngle * 0.4);
    }
    
    return angles;
  }, [calculateAngle]);
  
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
  
  // Frame counter for limiting computation frequency
  const flexionFrameCountRef = useRef(0);
  
  // Initialize MediaPipe when the component mounts
  useEffect(() => {
    // Dynamic imports to avoid bundling these heavy libraries
    const loadDependencies = async () => {
      try {
        dispatch(EventType.LOG, {
          message: 'Loading MediaPipe Hands dependencies...',
          type: 'info'
        });
        
        // Import MediaPipe libraries and create hands instance without arguments to work around runtime error
        const mpHands = await import('@mediapipe/hands');
        const mpCamera = await import('@mediapipe/camera_utils');
        const mpDrawing = await import('@mediapipe/drawing_utils');
        
        // Working around the MediaPipe runtime error using a simpler approach
        // Instead of using CDN resources, use the local files from node_modules
        
        // Initialize MediaPipe Hands with minimal options to avoid errors
        const hands = new mpHands.Hands({
          // No locateFile function - we'll use the local files from node_modules
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
            
            // Add knuckle ruler visualization
            if (knuckleRulerSettings.enabled && knuckleRulerSettings.showMeasurement) {
              console.log("Drawing knuckle ruler, first hand landmarks:", results.multiHandLandmarks[0].length);
              // Get the first detected hand for the knuckle ruler
              const hand = results.multiHandLandmarks[0];
              
              // Use filtered landmarks if available
              const landmarks = applyFilter(hand, 0, now);
              
              // The index knuckle is landmark 5, pinky knuckle is landmark 17
              const indexKnuckle = landmarks[5];
              const pinkyKnuckle = landmarks[17];
              
              if (indexKnuckle && pinkyKnuckle) {
                console.log("Found index and pinky knuckle landmarks for ruler");
                // Calculate the Euclidean distance between knuckles in normalized space (0-1)
                const normalizedDistance = Math.sqrt(
                  Math.pow(indexKnuckle.x - pinkyKnuckle.x, 2) + 
                  Math.pow(indexKnuckle.y - pinkyKnuckle.y, 2)
                );
                
                // Calculate the actual measurement in pixels
                const pixelDistance = normalizedDistance * canvas.width;
                
                // Dispatch an event with the real-time measurement
                dispatch(EventType.SETTINGS_VALUE_CHANGE, {
                  section: 'calibration',
                  setting: 'knuckleRulerRealtime',
                  value: {
                    normalizedDistance,
                    pixelDistance
                  }
                });
                
                // Draw a line connecting the knuckles - make it much more visible
                ctx.beginPath();
                ctx.moveTo(indexKnuckle.x * canvas.width, indexKnuckle.y * canvas.height);
                ctx.lineTo(pinkyKnuckle.x * canvas.width, pinkyKnuckle.y * canvas.height);
                ctx.setLineDash([5, 3]); // Dashed line
                ctx.strokeStyle = '#ffff00'; // Bright yellow for better visibility
                ctx.lineWidth = 3; // Thicker line
                ctx.stroke();
                ctx.setLineDash([]); // Reset to solid line
                
                // Calculate the midpoint for the text
                const midX = (indexKnuckle.x + pinkyKnuckle.x) / 2 * canvas.width;
                const midY = (indexKnuckle.y + pinkyKnuckle.y) / 2 * canvas.height - 15; // Move text up a bit
                
                // Display the measurement
                const measurementText = `${knuckleRulerSettings.knuckleDistanceCm.toFixed(1)} cm`;
                
                // Create a more visible background for the text
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                const textWidth = ctx.measureText(measurementText).width;
                const padding = 6;
                ctx.fillRect(
                  midX - textWidth / 2 - padding, 
                  midY - 10, 
                  textWidth + padding * 2, 
                  24
                );
                
                // Add a border to the background
                ctx.strokeStyle = '#ffff00'; // Match the line color
                ctx.lineWidth = 1.5;
                ctx.strokeRect(
                  midX - textWidth / 2 - padding, 
                  midY - 10, 
                  textWidth + padding * 2, 
                  24
                );
                
                // Draw the text
                ctx.fillStyle = '#ffffff'; // Pure white
                ctx.font = 'bold 14px sans-serif'; // Bold and bigger font
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(measurementText, midX, midY);
                
                // Reset text alignment
                ctx.textAlign = 'start';
                ctx.textBaseline = 'alphabetic';
              }
            }
            
            // Calculate and send finger joint angles if finger flexion is enabled
            if (fingerFlexionSettings.enabled && results.multiHandLandmarks.length > 0) {
              // Only process angles at a reduced rate (every 3rd frame) to improve performance
              // Increment the frame counter
              flexionFrameCountRef.current = (flexionFrameCountRef.current + 1) % 3;
              
              // Only calculate on every 3rd frame
              if (flexionFrameCountRef.current === 0) {
                // Performance monitoring - start timing finger angle calculations
                const angleCalcStartTime = performance.now();
                
                // Get the first detected hand
                const hand = results.multiHandLandmarks[0];
                
                // Use filtered landmarks for angle calculation
                const landmarks = applyFilter(hand, 0, now);
                
                // Calculate finger angles (only for enabled fingers)
                const fingerAngles = calculateFingerAngles(landmarks, fingerFlexionSettings.enabledFingers);
                
                // Performance monitoring - measure time spent on angle calculations
                const angleCalcTime = performance.now() - angleCalcStartTime;
                console.log(`Finger angle calculation time: ${angleCalcTime.toFixed(2)}ms`);
                
                if (fingerAngles) {
                  // Performance monitoring - start timing state calculation and dispatch
                  const stateCalcStartTime = performance.now();
                  
                  // Send angle data to the settings panel for real-time display
                  dispatch(EventType.SETTINGS_VALUE_CHANGE, {
                    section: 'gestures',
                    setting: 'fingerFlexionAngles',
                    value: fingerAngles
                  });
                  
                  // Check for thresholds and trigger events if needed
                  const fingerStates: {[finger: string]: {state: string}} = {};
                  
                  // For each finger, check if it's bent or straight based on thresholds
                  Object.keys(fingerAngles).forEach((finger) => {
                    // Skip fingers that aren't enabled
                    if (!fingerFlexionSettings.enabledFingers[finger]) return;
                    
                    const key = finger as keyof typeof fingerAngles;
                    const angle = fingerAngles[key].flex;
                    
                    // Skip null values (fingers that weren't calculated)
                    if (angle === null) return;
                    
                    const threshold = fingerFlexionSettings.thresholds[key].flex;
                    
                    // Determine finger state
                    let state = 'in-between';
                    if (angle < threshold.min) {
                      state = 'straight';
                    } else if (angle > threshold.max) {
                      state = 'bent';
                    }
                    
                    // Store state for event dispatch
                    fingerStates[finger] = { state };
                  });
                  
                  // Dispatch the finger states for gesture recognition
                  dispatch(EventType.SETTINGS_VALUE_CHANGE, {
                    section: 'gestures',
                    setting: 'fingerFlexionStates',
                    value: fingerStates
                  });
                  
                  // Performance monitoring - measure time spent on state calculation and dispatch
                  const stateCalcTime = performance.now() - stateCalcStartTime;
                  console.log(`Finger state calculation and dispatch time: ${stateCalcTime.toFixed(2)}ms`);
                }
              }
            }
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
  }, [videoRef, applyFilter, landmarksSettings, knuckleRulerSettings, fingerFlexionSettings]);
  
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
      
      // Handle knuckle ruler settings
      if (data.section === 'calibration' && data.setting === 'knuckleRuler') {
        console.log("Received knuckle ruler settings:", data.value);
        setKnuckleRulerSettings(data.value);
      }
      
      // Handle finger flexion settings
      if (data.section === 'gestures' && data.setting === 'fingerFlexion') {
        console.log("Received finger flexion settings:", data.value);
        setFingerFlexionSettings(data.value);
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