import React, { useEffect, useRef } from 'react';
import { 
  Hands, HAND_CONNECTIONS
} from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { EventType, dispatch } from '@/lib/eventBus';
import { HandData, HandLandmark, HandConnection } from '@/lib/types';

interface MediaPipeHandTrackingProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

// Numberblocks-inspired color scheme for hand landmarks
const FINGER_COLORS = [
  '#0066CC', // blue - thumb (Numberblocks 0)
  '#FF0000', // red - index (Numberblocks 1)
  '#FFA500', // orange - middle (Numberblocks 2)
  '#FFFF00', // yellow - ring (Numberblocks 3)
  '#008000', // green - pinky (Numberblocks 4)
  '#777777', // gray - palm
  '#444444'  // dark gray - wrist
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
  
  // Add connections for each finger with its color (Numberblocks inspired)
  // Thumb (blue - like Numberblocks 0)
  for (let i = 0; i < FINGER_INDICES.THUMB.length - 1; i++) {
    coloredConnections.push({
      start: FINGER_INDICES.THUMB[i],
      end: FINGER_INDICES.THUMB[i + 1],
      colorIndex: 0 // blue
    });
  }
  
  // Index finger (red - like Numberblocks 1)
  for (let i = 0; i < FINGER_INDICES.INDEX.length - 1; i++) {
    coloredConnections.push({
      start: FINGER_INDICES.INDEX[i],
      end: FINGER_INDICES.INDEX[i + 1],
      colorIndex: 1 // red
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
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  
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
        // Configure MediaPipe Hands
        const hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });
        
        // Set up options
        const options: HandsOptions = {
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
                  colorIndex = 0; // Thumb - blue (Numberblocks 0)
                } else if (FINGER_INDICES.INDEX.includes(connection[0]) && FINGER_INDICES.INDEX.includes(connection[1])) {
                  colorIndex = 1; // Index - red (Numberblocks 1)
                } else if (FINGER_INDICES.MIDDLE.includes(connection[0]) && FINGER_INDICES.MIDDLE.includes(connection[1])) {
                  colorIndex = 2; // Middle - orange (Numberblocks 2)
                } else if (FINGER_INDICES.RING.includes(connection[0]) && FINGER_INDICES.RING.includes(connection[1])) {
                  colorIndex = 3; // Ring - yellow (Numberblocks 3)
                } else if (FINGER_INDICES.PINKY.includes(connection[0]) && FINGER_INDICES.PINKY.includes(connection[1])) {
                  colorIndex = 4; // Pinky - green (Numberblocks 4)
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
          const camera = new Camera(videoRef.current, {
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