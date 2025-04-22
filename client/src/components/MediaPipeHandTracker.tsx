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
    thresholds: {
      thumb: { pip: { min: 5, max: 40 }, dip: { min: 5, max: 40 } },
      index: { pip: { min: 5, max: 60 }, dip: { min: 5, max: 60 } },
      middle: { pip: { min: 5, max: 60 }, dip: { min: 5, max: 60 } },
      ring: { pip: { min: 5, max: 60 }, dip: { min: 5, max: 60 } },
      pinky: { pip: { min: 5, max: 60 }, dip: { min: 5, max: 60 } }
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
    // Calculate vectors between points
    const vec1 = {
      x: p1.x - p2.x,
      y: p1.y - p2.y,
      z: p1.z - p2.z
    };
    
    const vec2 = {
      x: p3.x - p2.x,
      y: p3.y - p2.y,
      z: p3.z - p2.z
    };
    
    // Calculate dot product
    const dotProduct = vec1.x * vec2.x + vec1.y * vec2.y + vec1.z * vec2.z;
    
    // Calculate magnitudes
    const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y + vec1.z * vec1.z);
    const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y + vec2.z * vec2.z);
    
    // Calculate angle in radians
    const angleRad = Math.acos(dotProduct / (mag1 * mag2));
    
    // Convert to degrees
    const angleDeg = angleRad * (180 / Math.PI);
    
    return angleDeg;
  }, []);
  
  /**
   * Calculate all finger joint angles from hand landmarks
   * 
   * @param landmarks Array of hand landmarks from MediaPipe
   * @returns Object with angle measurements for each finger joint
   */
  const calculateFingerAngles = useCallback((landmarks: any) => {
    // Ensure we have landmarks
    if (!landmarks || landmarks.length < 21) {
      return null;
    }
    
    // Fingers and joints mapping
    // For each finger we need 3 joints to calculate 2 angles (PIP and DIP)
    const fingerJointIndices = {
      thumb: [1, 2, 3, 4],         // CMC, MCP, IP, TIP
      index: [0, 5, 6, 7, 8],      // Wrist, MCP, PIP, DIP, TIP
      middle: [0, 9, 10, 11, 12],  // Wrist, MCP, PIP, DIP, TIP
      ring: [0, 13, 14, 15, 16],   // Wrist, MCP, PIP, DIP, TIP
      pinky: [0, 17, 18, 19, 20]   // Wrist, MCP, PIP, DIP, TIP
    };
    
    const angles = {
      thumb: { pip: 0, dip: 0 },
      index: { pip: 0, dip: 0 },
      middle: { pip: 0, dip: 0 },
      ring: { pip: 0, dip: 0 },
      pinky: { pip: 0, dip: 0 }
    };
    
    // Calculate angles for each finger
    // Thumb
    angles.thumb.pip = calculateAngle(
      landmarks[fingerJointIndices.thumb[0]],
      landmarks[fingerJointIndices.thumb[1]],
      landmarks[fingerJointIndices.thumb[2]]
    );
    angles.thumb.dip = calculateAngle(
      landmarks[fingerJointIndices.thumb[1]],
      landmarks[fingerJointIndices.thumb[2]],
      landmarks[fingerJointIndices.thumb[3]]
    );
    
    // Other fingers (index, middle, ring, pinky)
    ['index', 'middle', 'ring', 'pinky'].forEach((finger: string) => {
      const indices = fingerJointIndices[finger as keyof typeof fingerJointIndices];
      
      // PIP joint angle (between proximal and middle phalanges)
      angles[finger as keyof typeof angles].pip = calculateAngle(
        landmarks[indices[1]], // MCP
        landmarks[indices[2]], // PIP
        landmarks[indices[3]]  // DIP
      );
      
      // DIP joint angle (between middle and distal phalanges)
      angles[finger as keyof typeof angles].dip = calculateAngle(
        landmarks[indices[2]], // PIP
        landmarks[indices[3]], // DIP
        landmarks[indices[4]]  // TIP
      );
    });
    
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
              // Get the first detected hand
              const hand = results.multiHandLandmarks[0];
              
              // Use filtered landmarks for angle calculation
              const landmarks = applyFilter(hand, 0, now);
              
              // Calculate finger angles (PIP and DIP angles for each finger)
              const fingerAngles = calculateFingerAngles(landmarks);
              
              if (fingerAngles) {
                // Send angle data to the settings panel for real-time display
                dispatch(EventType.SETTINGS_VALUE_CHANGE, {
                  section: 'gestures',
                  setting: 'fingerFlexionAngles',
                  value: fingerAngles
                });
                
                // Check for thresholds and trigger events if needed
                const fingerStates: {[finger: string]: {pip: string, dip: string}} = {};
                
                // For each finger, check if the joints are bent or straight based on thresholds
                Object.keys(fingerAngles).forEach((finger) => {
                  const key = finger as keyof typeof fingerAngles;
                  const angles = fingerAngles[key];
                  const thresholds = fingerFlexionSettings.thresholds[key];
                  
                  // Determine PIP joint state
                  let pipState = 'in-between';
                  if (angles.pip < thresholds.pip.min) {
                    pipState = 'straight';
                  } else if (angles.pip > thresholds.pip.max) {
                    pipState = 'bent';
                  }
                  
                  // Determine DIP joint state
                  let dipState = 'in-between';
                  if (angles.dip < thresholds.dip.min) {
                    dipState = 'straight';
                  } else if (angles.dip > thresholds.dip.max) {
                    dipState = 'bent';
                  }
                  
                  fingerStates[finger] = {
                    pip: pipState,
                    dip: dipState
                  };
                });
                
                // Dispatch the finger states for gesture recognition
                dispatch(EventType.SETTINGS_VALUE_CHANGE, {
                  section: 'gestures',
                  setting: 'fingerFlexionStates',
                  value: fingerStates
                });
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