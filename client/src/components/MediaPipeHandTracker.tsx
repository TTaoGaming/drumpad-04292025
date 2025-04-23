import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EventType, dispatch, addListener } from '@/lib/eventBus';
import { HandData, HandLandmark, HandConnection, PinchState } from '@/lib/types';
import { OneEuroFilterArray, DEFAULT_FILTER_OPTIONS } from '@/lib/oneEuroFilter';
import { HandTrackingOptimizer, OptimizationSettings, DEFAULT_OPTIMIZATION_SETTINGS } from '@/lib/handTrackingOptimizer';
import { debounce, throttle } from '@/lib/utils';

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
  
  // Coordinate display settings
  const [coordinateDisplay, setCoordinateDisplay] = useState({
    enabled: true,
    showZ: true,
    precision: 2
  });
  
  // Pinch gesture settings
  const [pinchGestureSettings, setPinchGestureSettings] = useState({
    enabled: true,
    showVisualizer: true,
    threshold: 0.05, // Normalized distance threshold for pinch detection (0-1)
    releaseThreshold: 0.07, // Higher threshold to prevent flickering (hysteresis)
    stabilityFrames: 3, // Number of frames to confirm a pinch state change (prevents flickering)
    activeFinger: 'index' as 'index' | 'middle' | 'ring' | 'pinky' // Which finger to use for pinching with thumb
  });
  
  // Pinch state
  const [isPinching, setIsPinching] = useState(false);
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);
  const pinchStateMemoryRef = useRef({
    isPinching: false,
    stableCount: 0,
    lastDistance: null as number | null
  });
  
  // State to store the index fingertip coordinates
  const [indexFingertipCoords, setIndexFingertipCoords] = useState<HandLandmark | null>(null);
  
  // Finger flexion settings
  const [fingerFlexionSettings, setFingerFlexionSettings] = useState({
    enabled: false, // Disabled by default for better performance
    enabledFingers: {
      thumb: true,
      index: true,
      middle: true,
      ring: false,  // Disabled by default to save performance
      pinky: false  // Disabled by default to save performance
    },
    thresholds: {
      thumb: { flex: { min: 5, max: 30 } },
      index: { flex: { min: 5, max: 30 } },
      middle: { flex: { min: 5, max: 30 } },
      ring: { flex: { min: 5, max: 30 } },
      pinky: { flex: { min: 5, max: 30 } }
    }
  });
  
  /**
   * Calculate the angle between three points in 3D space
   * Used for calculating finger joint angles
   * 
   * @param p1 First point
   * @param p2 Second point (joint)
   * @param p3 Third point
   * @returns Angle in degrees (normalized for flexion: 0 = straight, 180 = fully bent)
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
    
    // Convert to degrees - normalize the range for finger flexion
    // When a finger is straight, this will be close to 180 degrees,
    // so we invert it (180 - angle) to make it more intuitive:
    // 0 degrees = straight, higher values = more bent
    return 180 - (angleRad * (180 / Math.PI));
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
   * Calculate finger flexion angles using only the PIP joint (main trigger joint)
   * This simulates a trigger-pull motion, focusing on the middle joint that most people use
   * when pressing buttons or pulling triggers
   * 
   * @param landmarks Array of hand landmarks from MediaPipe
   * @param enabledFingers Object indicating which fingers to calculate for
   * @returns Object with PIP joint flexion measurements for each finger
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
      // Use ONLY the PIP joint angle for index finger (main trigger joint)
      angles.index.flex = calculateAngle(
        landmarks[5], // MCP
        landmarks[6], // PIP
        landmarks[7]  // DIP
      );
    }
    
    // Middle finger - only if enabled
    if (!enabledFingers || enabledFingers.middle) {
      // Use ONLY the PIP joint angle for middle finger
      angles.middle.flex = calculateAngle(
        landmarks[9],  // MCP
        landmarks[10], // PIP
        landmarks[11]  // DIP
      );
    }
    
    // Ring finger - only if enabled
    if (!enabledFingers || enabledFingers.ring) {
      // Use ONLY the PIP joint angle for ring finger
      angles.ring.flex = calculateAngle(
        landmarks[13], // MCP
        landmarks[14], // PIP
        landmarks[15]  // DIP
      );
    }
    
    // Pinky finger - only if enabled
    if (!enabledFingers || enabledFingers.pinky) {
      // Use ONLY the PIP joint angle for pinky finger
      angles.pinky.flex = calculateAngle(
        landmarks[17], // MCP
        landmarks[18], // PIP
        landmarks[19]  // DIP
      );
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
  
  // Performance settings
  const [performanceSettings, setPerformanceSettings] = useState({
    throttling: {
      enabled: true,
      interval: 200, // ms
    },
    frameProcessing: {
      processEveryNth: 1, // Process every frame
    },
    landmarkFiltering: {
      enabled: true,
    },
    roiOptimization: {
      enabled: false,
      minROISize: DEFAULT_OPTIMIZATION_SETTINGS.minROISize,
      maxROISize: DEFAULT_OPTIMIZATION_SETTINGS.maxROISize,
      velocityMultiplier: DEFAULT_OPTIMIZATION_SETTINGS.velocityMultiplier,
      movementThreshold: DEFAULT_OPTIMIZATION_SETTINGS.movementThreshold,
      maxTimeBetweenFullFrames: DEFAULT_OPTIMIZATION_SETTINGS.maxTimeBetweenFullFrames,
    }
  });
  
  // Create hand tracking optimizer ref
  const handOptimizerRef = useRef<HandTrackingOptimizer>(
    new HandTrackingOptimizer(performanceSettings.roiOptimization)
  );
  
  // Create throttled dispatch function for UI updates
  const throttledDispatch = useCallback((type: EventType, data: any) => {
    // Use the throttle function with the current interval
    const throttled = throttle((t: EventType, d: any) => {
      dispatch(t, d);
    }, performanceSettings.throttling.interval);
    
    throttled(type, data);
  }, [performanceSettings.throttling.interval]);
  
  // Apply the 1€ filter to hand landmarks
  const applyFilter = useCallback((landmarks: any, handIndex: number, timestamp: number): any => {
    // Skip filtering if disabled in performance settings
    if (!performanceSettings.landmarkFiltering.enabled) {
      return landmarks;
    }
    
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
  }, [filterOptions, performanceSettings.landmarkFiltering.enabled]);
  
  // Frame counter for limiting computation frequency
  const flexionFrameCountRef = useRef(0);
  
  // Frame counter for frame skipping
  const frameCountRef = useRef(0);
  
  // Debug setting to show/hide the ROI visualization
  const [showROI, setShowROI] = useState(true);
  
  /**
   * Calculate distance between two landmarks in 3D space
   * @param p1 First landmark
   * @param p2 Second landmark
   * @returns Distance in normalized space (0-1)
   */
  const calculateDistance = useCallback((p1: HandLandmark, p2: HandLandmark): number => {
    // Calculate 3D Euclidean distance
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + 
      Math.pow(p1.y - p2.y, 2) + 
      Math.pow(p1.z - p2.z, 2)
    );
  }, []);
  
  /**
   * Calculate and update pinch gesture state
   * @param landmarks Array of landmarks from MediaPipe
   * @returns Object with pinch state and distance
   */
  const calculatePinchGesture = useCallback((landmarks: HandLandmark[]): {isPinching: boolean, distance: number} => {
    // Ensure we have landmarks
    if (!landmarks || landmarks.length < 21) {
      return { isPinching: false, distance: 1.0 };
    }
    
    // Get the thumb tip (landmark 4)
    const thumbTip = landmarks[4];
    
    // Get the active finger tip based on settings
    let activeFingertip: HandLandmark;
    switch (pinchGestureSettings.activeFinger) {
      case 'index':
        activeFingertip = landmarks[8]; // Index fingertip
        break;
      case 'middle':
        activeFingertip = landmarks[12]; // Middle fingertip
        break;
      case 'ring':
        activeFingertip = landmarks[16]; // Ring fingertip
        break;
      case 'pinky':
        activeFingertip = landmarks[20]; // Pinky fingertip
        break;
      default:
        activeFingertip = landmarks[8]; // Default to index
    }
    
    // Calculate distance between thumb tip and selected finger tip
    const distance = calculateDistance(thumbTip, activeFingertip);
    
    // Get current pinch state and memory
    const memory = pinchStateMemoryRef.current;
    
    // Apply hysteresis - use different thresholds for pinching and releasing
    // This prevents flickering when near the threshold
    let newPinchState = memory.isPinching;
    
    if (memory.isPinching) {
      // Currently pinching - only release if distance exceeds release threshold
      if (distance > pinchGestureSettings.releaseThreshold) {
        newPinchState = false;
      }
    } else {
      // Currently not pinching - only start pinching if distance is below pinch threshold
      if (distance < pinchGestureSettings.threshold) {
        newPinchState = true;
      }
    }
    
    // Apply stability frames to prevent flickering
    if (newPinchState !== memory.isPinching) {
      memory.stableCount++;
      
      // Only change state after enough stable frames
      if (memory.stableCount >= pinchGestureSettings.stabilityFrames) {
        memory.isPinching = newPinchState;
        memory.stableCount = 0;
      }
    } else {
      // Reset stable count when state remains consistent
      memory.stableCount = 0;
    }
    
    // Update memory with latest values
    memory.lastDistance = distance;
    
    return {
      isPinching: memory.isPinching,
      distance,
      pendingState: newPinchState !== memory.isPinching ? newPinchState : null,
      stableCount: memory.stableCount,
      stabilityFrames: pinchGestureSettings.stabilityFrames
    };
  }, [calculateDistance, pinchGestureSettings]);
  
  /**
   * Draw the Region of Interest (ROI) for debugging
   * @param ctx Canvas context 
   * @param roi ROI object with normalized coordinates
   * @param width Canvas width
   * @param height Canvas height
   */
  const drawROI = useCallback((
    ctx: CanvasRenderingContext2D, 
    roi: {x: number, y: number, width: number, height: number},
    width: number,
    height: number
  ) => {
    if (!showROI) return;
    
    // Convert normalized coordinates to canvas pixels
    const x = roi.x * width;
    const y = roi.y * height;
    const w = roi.width * width;
    const h = roi.height * height;
    
    // Draw the ROI with a semi-transparent fill and dashed border
    ctx.fillStyle = 'rgba(0, 255, 255, 0.1)'; // Cyan with low opacity
    ctx.fillRect(x, y, w, h);
    
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)'; // Cyan with higher opacity
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Dashed border
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]); // Reset to solid line
    
    // Show ROI info
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Dark background
    ctx.fillRect(x, y - 20, 140, 20); // Background for text
    
    ctx.fillStyle = 'rgba(0, 255, 255, 1)'; // Cyan text
    ctx.font = '12px sans-serif';
    ctx.fillText(`ROI: ${w.toFixed(0)}×${h.toFixed(0)}px`, x + 5, y - 7);
  }, [showROI]);
  
  // State memory for hysteresis to prevent flickering
  const fingerStateMemoryRef = useRef<{
    [finger: string]: {
      state: string;
      stable: boolean;
      stableCount: number;
      lastAngle: number | null;
    }
  }>({
    thumb: { state: 'straight', stable: true, stableCount: 0, lastAngle: null },
    index: { state: 'straight', stable: true, stableCount: 0, lastAngle: null },
    middle: { state: 'straight', stable: true, stableCount: 0, lastAngle: null },
    ring: { state: 'straight', stable: true, stableCount: 0, lastAngle: null },
    pinky: { state: 'straight', stable: true, stableCount: 0, lastAngle: null }
  });
  
  // Listen for performance settings changes
  useEffect(() => {
    const perfSettingsListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'performance') {
          if (data.setting === 'throttling') {
            setPerformanceSettings(prev => ({
              ...prev,
              throttling: data.value
            }));
          } else if (data.setting === 'frameProcessing') {
            setPerformanceSettings(prev => ({
              ...prev,
              frameProcessing: data.value
            }));
          } else if (data.setting === 'landmarkFiltering') {
            setPerformanceSettings(prev => ({
              ...prev,
              landmarkFiltering: data.value
            }));
          } else if (data.setting === 'roiOptimization') {
            setPerformanceSettings(prev => ({
              ...prev,
              roiOptimization: data.value
            }));
            // Update the optimizer with new settings
            handOptimizerRef.current.updateSettings(data.value);
          }
        }
      }
    );
    
    return () => {
      perfSettingsListener.remove();
    };
  }, []);
  
  // Listen for visualization settings changes
  useEffect(() => {
    const visualizationListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        // Listen for knuckle ruler setting changes
        if (data.section === 'calibration' && data.setting === 'knuckleRuler') {
          setKnuckleRulerSettings(data.value);
        }
        
        // Listen for coordinate display setting changes
        if (data.section === 'visualizations' && data.setting === 'coordinateDisplay') {
          setCoordinateDisplay(data.value);
        }
        
        // Listen for pinch gesture setting changes
        if (data.section === 'gestures' && data.setting === 'pinchGesture') {
          setPinchGestureSettings(data.value);
        }
      }
    );
    
    return () => {
      visualizationListener.remove();
    };
  }, []);

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
        
        // Initialize MediaPipe Hands with CDN - using version we know works
        // @ts-ignore - TypeScript doesn't like the locateFile, but it's required
        const hands = new mpHands.Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
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
            
            // Extract and display index fingertip coordinates if enabled
            if (coordinateDisplay.enabled) {
              // Get the first detected hand
              const hand = results.multiHandLandmarks[0];
              
              // Use filtered landmarks if available
              const landmarks = applyFilter(hand, 0, now);
              
              // The index fingertip is landmark 8
              if (landmarks && landmarks.length > 8) {
                const indexFingertip = landmarks[8];
                
                if (indexFingertip) {
                  // Update the state with the latest coordinates
                  setIndexFingertipCoords(indexFingertip);
                  
                  // Draw a crosshair at the index fingertip position
                  const tipX = indexFingertip.x * canvas.width;
                  const tipY = indexFingertip.y * canvas.height;
                  const crosshairSize = 20;
                  
                  // Draw crosshair lines
                  ctx.beginPath();
                  ctx.moveTo(tipX - crosshairSize, tipY);
                  ctx.lineTo(tipX + crosshairSize, tipY);
                  ctx.moveTo(tipX, tipY - crosshairSize);
                  ctx.lineTo(tipX, tipY + crosshairSize);
                  ctx.strokeStyle = FINGER_COLORS[1]; // Orange (index finger color)
                  ctx.lineWidth = 2;
                  ctx.stroke();
                  
                  // Draw circle around fingertip
                  ctx.beginPath();
                  ctx.arc(tipX, tipY, crosshairSize / 2, 0, 2 * Math.PI);
                  ctx.strokeStyle = FINGER_COLORS[1]; // Orange (index finger color)
                  ctx.lineWidth = 2;
                  ctx.stroke();
                  
                  // Position for the coordinate display - right side of screen
                  const displayX = canvas.width - 220;
                  const displayY = 40; // Move up to avoid performance metrics
                  const boxWidth = 200;
                  const boxHeight = coordinateDisplay.showZ ? 110 : 80;
                  
                  // Create a semi-transparent background
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                  ctx.fillRect(displayX, displayY, boxWidth, boxHeight);
                  
                  // Add a border with the finger color
                  ctx.strokeStyle = FINGER_COLORS[1]; // Orange (index finger color)
                  ctx.lineWidth = 2;
                  ctx.strokeRect(displayX, displayY, boxWidth, boxHeight);
                  
                  // Title for the coordinates box
                  ctx.fillStyle = 'white';
                  ctx.font = 'bold 14px sans-serif';
                  ctx.fillText('Index Fingertip Position', displayX + 10, displayY + 20);
                  
                  // Format the coordinates
                  const precision = coordinateDisplay.precision;
                  const xCoord = indexFingertip.x.toFixed(precision);
                  const yCoord = indexFingertip.y.toFixed(precision);
                  
                  // Display the X and Y coordinates
                  ctx.font = '13px monospace'; // Monospace for better alignment
                  ctx.fillText(`X: ${xCoord} (${Math.round(indexFingertip.x * canvas.width)}px)`, displayX + 10, displayY + 45);
                  ctx.fillText(`Y: ${yCoord} (${Math.round(indexFingertip.y * canvas.height)}px)`, displayX + 10, displayY + 70);
                  
                  // Display Z coordinate if enabled
                  if (coordinateDisplay.showZ) {
                    const zCoord = indexFingertip.z.toFixed(precision);
                    ctx.fillText(`Z: ${zCoord} (depth)`, displayX + 10, displayY + 95);
                  }
                }
              }
            }
            
            // Process pinch gesture if enabled
            if (pinchGestureSettings.enabled) {
              // Get the first detected hand
              const hand = results.multiHandLandmarks[0];
              
              // Use filtered landmarks if available
              const landmarks = applyFilter(hand, 0, now);
              
              if (landmarks && landmarks.length >= 21) {
                // Calculate pinch gesture
                const { isPinching, distance } = calculatePinchGesture(landmarks);
                
                // Update state
                setIsPinching(isPinching);
                setPinchDistance(distance);
                
                // Dispatch event for other components
                const dispatchFn = performanceSettings.throttling.enabled ? throttledDispatch : dispatch;
                dispatchFn(EventType.SETTINGS_VALUE_CHANGE, {
                  section: 'gestures',
                  setting: 'pinchState',
                  value: {
                    isPinching,
                    distance
                  }
                });
                
                // Visualize the pinch if enabled
                if (pinchGestureSettings.showVisualizer) {
                  // Get thumb and active finger tip landmarks
                  const thumbTip = landmarks[4];
                  
                  // Get the selected finger tip based on settings
                  let activeFingertip: HandLandmark;
                  let fingerColorIndex = 1; // Default to index (orange)
                  
                  switch (pinchGestureSettings.activeFinger) {
                    case 'index':
                      activeFingertip = landmarks[8]; // Index fingertip
                      fingerColorIndex = 1; // Orange
                      break;
                    case 'middle':
                      activeFingertip = landmarks[12]; // Middle fingertip
                      fingerColorIndex = 2; // Yellow
                      break;
                    case 'ring':
                      activeFingertip = landmarks[16]; // Ring fingertip
                      fingerColorIndex = 3; // Green
                      break;
                    case 'pinky':
                      activeFingertip = landmarks[20]; // Pinky fingertip
                      fingerColorIndex = 4; // Blue
                      break;
                    default:
                      activeFingertip = landmarks[8]; // Default to index
                      fingerColorIndex = 1; // Orange
                  }
                  
                  // Convert to screen coordinates
                  const thumbX = thumbTip.x * canvas.width;
                  const thumbY = thumbTip.y * canvas.height;
                  const fingerX = activeFingertip.x * canvas.width;
                  const fingerY = activeFingertip.y * canvas.height;
                  
                  // Calculate midpoint between thumb and finger
                  const midX = (thumbX + fingerX) / 2;
                  const midY = (thumbY + fingerY) / 2;
                  
                  // Draw line connecting thumb and finger
                  ctx.beginPath();
                  ctx.moveTo(thumbX, thumbY);
                  ctx.lineTo(fingerX, fingerY);
                  
                  // Line color based on pinch state
                  const lineColor = isPinching ? '#00FF00' : FINGER_COLORS[fingerColorIndex];
                  ctx.strokeStyle = lineColor;
                  ctx.lineWidth = 3;
                  ctx.stroke();
                  
                  // Draw circles at the tips
                  const tipRadius = 8;
                  
                  // Thumb tip circle
                  ctx.beginPath();
                  ctx.arc(thumbX, thumbY, tipRadius, 0, 2 * Math.PI);
                  ctx.fillStyle = FINGER_COLORS[0]; // Red (thumb color)
                  ctx.fill();
                  
                  // Active finger tip circle
                  ctx.beginPath();
                  ctx.arc(fingerX, fingerY, tipRadius, 0, 2 * Math.PI);
                  ctx.fillStyle = FINGER_COLORS[fingerColorIndex]; // Finger color
                  ctx.fill();
                  
                  // Show distance label at midpoint
                  // Create background for text
                  const labelWidth = 80;
                  const labelHeight = 24;
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                  ctx.fillRect(midX - labelWidth / 2, midY - labelHeight / 2, labelWidth, labelHeight);
                  
                  // Add border - green if pinching, otherwise standard color
                  ctx.strokeStyle = isPinching ? '#00FF00' : lineColor;
                  ctx.lineWidth = 1.5;
                  ctx.strokeRect(midX - labelWidth / 2, midY - labelHeight / 2, labelWidth, labelHeight);
                  
                  // Show distance
                  ctx.fillStyle = 'white';
                  ctx.font = 'bold 12px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  
                  // Format distance for display - normalized and in pixels
                  const pixelDistance = distance * canvas.width;
                  const distanceText = `${distance.toFixed(2)}/${Math.round(pixelDistance)}px`;
                  ctx.fillText(distanceText, midX, midY);
                  
                  // Reset text alignment
                  ctx.textAlign = 'start';
                  ctx.textBaseline = 'alphabetic';
                  
                  // Add a pinch state indicator in the corner
                  // Position below coordinate display if that's enabled
                  const stateDisplayY = coordinateDisplay.enabled ? 
                    (coordinateDisplay.showZ ? 160 : 130) : 40;
                  
                  const stateDisplayX = canvas.width - 220;
                  const stateBoxWidth = 200;
                  const stateBoxHeight = 70;
                  
                  // Create a semi-transparent background
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                  ctx.fillRect(stateDisplayX, stateDisplayY, stateBoxWidth, stateBoxHeight);
                  
                  // Add border that changes color based on pinch state
                  ctx.strokeStyle = isPinching ? '#00FF00' : '#FF3333';
                  ctx.lineWidth = 2;
                  ctx.strokeRect(stateDisplayX, stateDisplayY, stateBoxWidth, stateBoxHeight);
                  
                  // Title for the state box
                  ctx.fillStyle = 'white';
                  ctx.font = 'bold 14px sans-serif';
                  ctx.fillText('Pinch Gesture', stateDisplayX + 10, stateDisplayY + 20);
                  
                  // Display pinch state
                  ctx.font = '13px sans-serif';
                  const stateText = isPinching ? 'ACTIVE' : 'INACTIVE';
                  ctx.fillStyle = isPinching ? '#00FF00' : '#FF3333';
                  ctx.fillText(`State: ${stateText}`, stateDisplayX + 10, stateDisplayY + 45);
                  
                  // Display threshold info
                  ctx.fillStyle = 'white';
                  const thresholdText = `Threshold: ${pinchGestureSettings.threshold.toFixed(2)}`;
                  ctx.fillText(thresholdText, stateDisplayX + 100, stateDisplayY + 45);
                }
              }
            }
            
            // Get the first hand landmarks for ROI optimization
            const firstHandLandmarks = results.multiHandLandmarks[0];
            
            // Update ROI optimizer with current hand position
            let shouldProcessFullFrame = true;
            
            if (performanceSettings.roiOptimization.enabled) {
              // Update the optimizer with new hand landmarks
              shouldProcessFullFrame = handOptimizerRef.current.update(firstHandLandmarks);
              
              // Draw ROI visualization if enabled
              const roi = handOptimizerRef.current.getROI();
              if (roi) {
                drawROI(ctx, roi, canvas.width, canvas.height);
              }
            } else {
              // If ROI optimization is disabled, use frame skipping logic
              frameCountRef.current = (frameCountRef.current + 1) % performanceSettings.frameProcessing.processEveryNth;
              shouldProcessFullFrame = frameCountRef.current === 0;
            }
            
            // Only process frames based on optimization strategy
            if (shouldProcessFullFrame) {
              // Calculate and send finger joint angles if finger flexion is enabled
              if (fingerFlexionSettings.enabled && results.multiHandLandmarks.length > 0) {
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
                  // Use throttled dispatch if throttling is enabled
                  const dispatchFn = performanceSettings.throttling.enabled ? throttledDispatch : dispatch;
                  
                  dispatchFn(EventType.SETTINGS_VALUE_CHANGE, {
                    section: 'gestures',
                    setting: 'fingerFlexionAngles',
                    value: fingerAngles
                  });
                  
                  // Check for thresholds and trigger events if needed
                  const fingerStates: {[finger: string]: {state: string}} = {};
                  
                  // For each finger, check if it's bent or straight based on thresholds
                  Object.keys(fingerAngles).forEach((finger) => {
                    // Cast to the proper type for type safety
                    const fingerKey = finger as 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
                    
                    // Skip fingers that aren't enabled
                    if (!fingerFlexionSettings.enabledFingers[fingerKey]) return;
                    
                    const key = fingerKey as keyof typeof fingerAngles;
                    const angle = fingerAngles[key].flex;
                    
                    // Skip null values (fingers that weren't calculated)
                    if (angle === null) return;
                    
                    const threshold = fingerFlexionSettings.thresholds[fingerKey].flex;
                    
                    // Get the current memory for this finger
                    const memory = fingerStateMemoryRef.current[fingerKey];
                    
                    // Determine new state based on angle
                    let newState = 'in-between';
                    if (angle < threshold.min) {
                      newState = 'straight';
                    } else if (angle > threshold.max) {
                      newState = 'bent';
                    }
                    
                    // Apply hysteresis - only change state after several consistent readings
                    // This prevents flickering when the angle is near a threshold
                    const STABILITY_THRESHOLD = 3; // Frames needed to confirm state change
                    
                    if (newState === memory.state) {
                      // Increase stability counter when state is consistent
                      memory.stableCount = Math.min(memory.stableCount + 1, STABILITY_THRESHOLD + 2);
                      memory.stable = true;
                    } else {
                      // State is different - might be changing or just noise
                      if (memory.stableCount > 0) {
                        // Decrement counter - require multiple frames to change state
                        memory.stableCount--;
                        
                        // Only change state after confirmed with multiple frames
                        if (memory.stableCount === 0) {
                          memory.state = newState;
                          memory.stable = false; // Mark as transitioning
                        }
                      }
                    }
                    
                    // Store angle for next frame comparison
                    memory.lastAngle = angle;
                    
                    // Always use the stable memory state for display and events
                    fingerStates[finger] = { state: memory.state };
                  });
                  
                  // Dispatch the finger states for gesture recognition
                  // Use the same dispatch function (throttled or not)
                  dispatchFn(EventType.SETTINGS_VALUE_CHANGE, {
                    section: 'gestures',
                    setting: 'fingerFlexionStates',
                    value: fingerStates
                  });
                  
                  // Draw visual indicators for finger states on the canvas
                  if (fingerFlexionSettings.enabled) {
                    const hand = results.multiHandLandmarks[0];
                    const filteredLandmarks = applyFilter(hand, 0, now);
                    
                    // Draw state indicators for each finger
                    Object.keys(fingerStates).forEach((finger) => {
                      // Cast to the proper type for type safety
                      const fingerKey = finger as 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
                      const state = fingerStates[finger].state;
                      
                      // Only draw for fingers that have a state and are enabled
                      if (state && fingerFlexionSettings.enabledFingers[fingerKey]) {
                        // Get the finger tip landmark
                        const tipIndex = fingerJointIndices[fingerKey][fingerJointIndices[fingerKey].length - 1];
                        const tipLandmark = filteredLandmarks[tipIndex];
                        
                        // Draw a circle at the fingertip with color based on state
                        if (tipLandmark) {
                          const x = tipLandmark.x * canvas.width;
                          const y = tipLandmark.y * canvas.height;
                          const radius = 10; // Size of the indicator
                          
                          // Use a more stable color scheme for solid indicator circles
                          let color;
                          switch (state) {
                            case 'straight':
                              color = 'rgba(255, 255, 255, 0.5)'; // White for straight
                              break;
                            case 'bent':
                              color = 'rgba(255, 0, 0, 0.5)'; // Red for bent
                              break;
                            default:
                              color = 'rgba(255, 255, 0, 0.5)'; // Yellow for in-between
                          }
                          
                          // Draw a solid circle with transparency
                          const circleRadius = 8; // Size of the indicator
                          
                          // Fill with color
                          ctx.beginPath();
                          ctx.arc(x, y, circleRadius, 0, 2 * Math.PI);
                          ctx.fillStyle = color;
                          ctx.fill();
                          
                          // Add a subtle border
                          ctx.lineWidth = 1.5;
                          ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                          ctx.stroke();
                          
                          // Add a persistent state label below the fingertip
                          // This makes the state more obvious without increasing flashing
                          const stateLabel = state.charAt(0).toUpperCase(); // Just use first letter (S, B, I)
                          ctx.font = 'bold 10px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillStyle = 'white';
                          ctx.fillText(stateLabel, x, y + circleRadius + 10);
                        }
                      }
                    });
                  }
                  
                  // Performance monitoring - measure time spent on state calculation and dispatch
                  const stateCalcTime = performance.now() - stateCalcStartTime;
                  console.log(`Finger state calculation and dispatch time: ${stateCalcTime.toFixed(2)}ms`);
                }
              }
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
  }, [
    videoRef, 
    applyFilter, 
    drawROI,
    landmarksSettings, 
    knuckleRulerSettings, 
    fingerFlexionSettings, 
    performanceSettings.roiOptimization.enabled,
    calculateFingerAngles,
    throttledDispatch
  ]);
  
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