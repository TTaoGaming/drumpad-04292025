import React, { useEffect, useRef } from 'react';
import { EventType, dispatch } from '@/lib/eventBus';
import { HandData, HandLandmark, HandConnection } from '@/lib/types';

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
            results.multiHandLandmarks.forEach((landmarks: any) => {
              // Draw landmarks
              mpDrawing.drawLandmarks(ctx, landmarks, {
                color: '#ffffff',
                lineWidth: 2,
                radius: 4
              });
              
              // Draw connections with colors
              mpHands.HAND_CONNECTIONS.forEach((connection: any) => {
                // Determine which finger this connection belongs to
                let colorIndex = 5; // Default to palm (indigo)
                
                // Identify which finger the connection belongs to
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
                
                // Draw the connection with appropriate color
                mpDrawing.drawConnectors(ctx, landmarks, [connection], {
                  color: FINGER_COLORS[colorIndex],
                  lineWidth: 5
                });
              });
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
  }, [videoRef]);
  
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
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 pointer-events-none"
    />
  );
};

export default MediaPipeHandTracker;