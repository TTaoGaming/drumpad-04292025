import React, { useEffect, useRef } from 'react';
import { HandData, HandLandmark } from '@/lib/types';
import { EventType, dispatch } from '@/lib/eventBus';

// Define the HandConnection interface here if not found in types
interface HandConnection {
  start: number;
  end: number;
  colorIndex: number;
}

interface MediaPipeHandTrackingProps {
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

const assignConnectionColors = () => {
  // Create an array of connections with color assignments
  const coloredConnections: HandConnection[] = [];
  
  // Add connections for each finger with its color
  // Thumb (red)
  for (let i = 0; i < FINGER_INDICES.THUMB.length - 1; i++) {
    coloredConnections.push({
      start: FINGER_INDICES.THUMB[i],
      end: FINGER_INDICES.THUMB[i + 1],
      colorIndex: 0 // red
    });
  }
  
  // Index finger (orange)
  for (let i = 0; i < FINGER_INDICES.INDEX.length - 1; i++) {
    coloredConnections.push({
      start: FINGER_INDICES.INDEX[i],
      end: FINGER_INDICES.INDEX[i + 1],
      colorIndex: 1 // orange
    });
  }
  
  // Middle finger (yellow)
  for (let i = 0; i < FINGER_INDICES.MIDDLE.length - 1; i++) {
    coloredConnections.push({
      start: FINGER_INDICES.MIDDLE[i],
      end: FINGER_INDICES.MIDDLE[i + 1],
      colorIndex: 2 // yellow
    });
  }
  
  // Ring finger (green)
  for (let i = 0; i < FINGER_INDICES.RING.length - 1; i++) {
    coloredConnections.push({
      start: FINGER_INDICES.RING[i],
      end: FINGER_INDICES.RING[i + 1],
      colorIndex: 3 // green
    });
  }
  
  // Pinky finger (blue)
  for (let i = 0; i < FINGER_INDICES.PINKY.length - 1; i++) {
    coloredConnections.push({
      start: FINGER_INDICES.PINKY[i],
      end: FINGER_INDICES.PINKY[i + 1],
      colorIndex: 4 // blue
    });
  }
  
  // Palm connections (indigo)
  coloredConnections.push(
    { start: 0, end: 5, colorIndex: 5 },  // wrist to index MCP
    { start: 5, end: 9, colorIndex: 5 },  // index to middle MCP
    { start: 9, end: 13, colorIndex: 5 }, // middle to ring MCP
    { start: 13, end: 17, colorIndex: 5 }, // ring to pinky MCP
    { start: 0, end: 17, colorIndex: 5 }, // wrist to pinky MCP
    { start: 0, end: 1, colorIndex: 5 }   // wrist to thumb MCP
  );
  
  return coloredConnections;
};

const MediaPipeHandTracking: React.FC<MediaPipeHandTrackingProps> = ({ videoRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  
  // Define interfaces for MediaPipe types
  interface HandsOptions {
    selfieMode?: boolean;
    maxNumHands?: number;
    modelComplexity?: number;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }
  
  interface ResultsListener {
    (results: any): void;
  }
  
  // Initial MediaPipe Hands setup
  useEffect(() => {
    dispatch(EventType.LOG, {
      message: `Setting up MediaPipe Hands...`,
      type: 'info'
    });
    
    const initializeHandTracking = async () => {
      if (!videoRef.current || !canvasRef.current) {
        dispatch(EventType.LOG, {
          message: 'Video or canvas element not available',
          type: 'error'
        });
        return;
      }
      
      try {
        // Dynamically import MediaPipe libraries
        const mpHands = await import('@mediapipe/hands');
        const mpCamera = await import('@mediapipe/camera_utils');
        const mpDrawing = await import('@mediapipe/drawing_utils');
        
        // Debug the MediaPipe import structure to understand what we're working with
        console.log('MediaPipe Hands dynamic import structure:', mpHands);
        
        // More comprehensive approach to handle various export structures
        let HandsClass;
        
        // Check if Hands is directly available as a named export
        if (typeof mpHands.Hands === 'function') {
          HandsClass = mpHands.Hands;
          console.log('Using named export Hands');
        } 
        // Check if Hands is available as a property of the default export
        else if (typeof mpHands.default === 'object' && typeof mpHands.default.Hands === 'function') {
          HandsClass = mpHands.default.Hands;
          console.log('Using default.Hands export');
        } 
        // Check if the default export itself is the Hands constructor
        else if (typeof mpHands.default === 'function') {
          HandsClass = mpHands.default;
          console.log('Using default export directly as Hands constructor');
        }
        // Try extracting from the raw module if it's an ES module with a 'default' getter
        else if (mpHands && typeof mpHands === 'object') {
          // Try to look for any property that might be the Hands class
          for (const key in mpHands) {
            if (typeof mpHands[key] === 'function' && key !== '__esModule') {
              console.log(`Found potential Hands class as '${key}'`);
              HandsClass = mpHands[key];
              break;
            }
          }
        }
        
        if (!HandsClass) {
          console.error('MediaPipe Hands export structure:', mpHands);
          throw new Error('MediaPipe Hands class not found');
        }
        
        // Same process for Camera class
        let CameraClass;
        
        if (typeof mpCamera.Camera === 'function') {
          CameraClass = mpCamera.Camera;
          console.log('Using named export Camera');
        } else if (typeof mpCamera.default?.Camera === 'function') {
          CameraClass = mpCamera.default.Camera;
          console.log('Using default.Camera export');
        } else if (typeof mpCamera.default === 'function') {
          CameraClass = mpCamera.default;
          console.log('Using default export directly as Camera constructor');
        } else if (mpCamera && typeof mpCamera === 'object') {
          for (const key in mpCamera) {
            if (typeof mpCamera[key] === 'function' && key !== '__esModule') {
              console.log(`Found potential Camera class as '${key}'`);
              CameraClass = mpCamera[key];
              break;
            }
          }
        }
        
        if (!CameraClass) {
          console.error('MediaPipe Camera export structure:', mpCamera);
          throw new Error('MediaPipe Camera class not found');
        }
        
        // Get drawing utilities
        const drawConnectors = mpDrawing.drawConnectors || mpDrawing.default?.drawConnectors;
        const drawLandmarks = mpDrawing.drawLandmarks || mpDrawing.default?.drawLandmarks;
        const HAND_CONNECTIONS = mpHands.HAND_CONNECTIONS || mpHands.default?.HAND_CONNECTIONS || [];
        
        if (!drawConnectors || !drawLandmarks) {
          console.error('MediaPipe drawing utilities not found:', mpDrawing);
          throw new Error('MediaPipe drawing utilities not found');
        }
        
        // Use a specific version in the CDN URL that we know works
        const hands = new HandsClass({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
          }
        });
        
        // Set up options with TypeScript interface for better structure
        const options = {
          selfieMode: true, // Mirror mode for front camera
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        };
        
        hands.setOptions(options);
        
        // Setup results listener
        const onResults: ResultsListener = (results) => {
          const canvasElement = canvasRef.current;
          if (!canvasElement) return;
          
          const ctx = canvasElement.getContext('2d');
          if (!ctx) return;
          
          // Calculate FPS
          const now = performance.now();
          const fps = lastFrameTimeRef.current 
            ? Math.round(1000 / (now - lastFrameTimeRef.current)) 
            : 0;
          lastFrameTimeRef.current = now;
          
          // Clear canvas
          ctx.save();
          ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
          
          // Draw the camera view as background (optional)
          // ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
          
          // Process hand landmarks if available
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            // Process hands data for visualization
            results.multiHandLandmarks.forEach((landmarks, handIndex) => {
              // Convert landmarks to our format
              const handLandmarks: HandLandmark[] = landmarks.map(landmark => ({
                x: landmark.x,
                y: landmark.y,
                z: landmark.z
              }));
              
              // Get connections with color assignments
              const connections = assignConnectionColors();
              
              // Create hand data object
              const handData: HandData = {
                landmarks: handLandmarks,
                connections: connections,
                colors: FINGER_COLORS
              };
              
              // Emit hand data for other components
              dispatch(EventType.FRAME_PROCESSED, {
                handData,
                performance: {
                  handDetectionMs: 0, // Not available directly
                  totalProcessingMs: 0, // Not available directly
                  estimatedFps: fps
                }
              });
              
              // Draw landmarks with individual finger colors
              drawLandmarks(ctx, landmarks, {
                color: '#ffffff',
                lineWidth: 2,
                radius: 4
              });
              
              // Draw connections with rainbow colors
              HAND_CONNECTIONS.forEach((connection, index) => {
                // Find the finger this connection belongs to
                let colorIndex = 5; // Default to indigo (palm)
                
                // Check each finger
                if (FINGER_INDICES.THUMB.includes(connection[0]) && FINGER_INDICES.THUMB.includes(connection[1])) {
                  colorIndex = 0; // Thumb - red
                } else if (FINGER_INDICES.INDEX.includes(connection[0]) && FINGER_INDICES.INDEX.includes(connection[1])) {
                  colorIndex = 1; // Index - orange
                } else if (FINGER_INDICES.MIDDLE.includes(connection[0]) && FINGER_INDICES.MIDDLE.includes(connection[1])) {
                  colorIndex = 2; // Middle - yellow
                } else if (FINGER_INDICES.RING.includes(connection[0]) && FINGER_INDICES.RING.includes(connection[1])) {
                  colorIndex = 3; // Ring - green
                } else if (FINGER_INDICES.PINKY.includes(connection[0]) && FINGER_INDICES.PINKY.includes(connection[1])) {
                  colorIndex = 4; // Pinky - blue
                }
                
                // Draw with the appropriate color
                drawConnectors(ctx, landmarks, [connection], {
                  color: FINGER_COLORS[colorIndex],
                  lineWidth: 5
                });
              });
            });
          }
          
          // Draw FPS counter
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(10, canvasElement.height - 40, 120, 30);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 16px Arial';
          ctx.fillText(`FPS: ${fps}`, 20, canvasElement.height - 18);
          
          ctx.restore();
        };
        
        hands.onResults(onResults);
        handsRef.current = hands;
        
        // Set up camera
        if (videoRef.current) {
          // Use Camera class from dynamic import
          console.log('Using CameraClass from dynamic import');
          
          // We already have CameraClass from the dynamic import above
          
          const camera = new CameraClass(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current && handsRef.current) {
                await handsRef.current.send({image: videoRef.current});
              }
            },
            width: 640,
            height: 480
          });
          
          cameraRef.current = camera;
          camera.start();
          
          dispatch(EventType.LOG, {
            message: 'MediaPipe Hands initialized successfully',
            type: 'success'
          });
        }
      } catch (error) {
        console.error('Error initializing MediaPipe Hands:', error);
        dispatch(EventType.LOG, {
          message: `Failed to initialize MediaPipe Hands: ${error}`,
          type: 'error'
        });
      }
    };
    
    initializeHandTracking();
    
    // Clean up
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, [videoRef]);
  
  // Match canvas size to video
  useEffect(() => {
    const resizeCanvas = () => {
      if (videoRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = videoRef.current;
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
      }
    };
    
    // Set initial size
    resizeCanvas();
    
    // Listen for resize events
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [videoRef]);
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 pointer-events-none"
    />
  );
};

export default MediaPipeHandTracking;