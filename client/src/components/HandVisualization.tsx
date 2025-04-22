import React, { useEffect, useRef, useState } from 'react';
import { HandData } from '@/lib/types';

interface HandVisualizationProps {
  handData?: HandData;
  videoElement?: HTMLVideoElement | null;
  width: number;
  height: number;
}

/**
 * HandVisualization component
 * 
 * Draws hand landmarks and connections using the rainbow color scheme
 * Each finger has its own color:
 * - Thumb: Red
 * - Index finger: Orange
 * - Middle finger: Yellow
 * - Ring finger: Green
 * - Pinky: Blue
 * - Palm connections: Indigo
 * - Wrist: Violet
 */
const HandVisualization: React.FC<HandVisualizationProps> = ({ 
  handData, 
  videoElement, 
  width, 
  height 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [debugInfo, setDebugInfo] = useState<string>('No hand data');
  
  // Draw hand landmarks and connections
  useEffect(() => {
    console.log("HandVisualization useEffect triggered", { handData, width, height });
    
    if (!handData) {
      setDebugInfo('No hand data');
      return;
    }
    
    // Show how many landmarks we have
    setDebugInfo(`Landmarks: ${handData.landmarks.length}, Connections: ${handData.connections.length}`);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas ref is null");
      return;
    }
    
    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Could not get 2D context");
      return;
    }
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If we have a video element, we could draw it as a background
    // This is optional based on your visualization needs
    if (videoElement) {
      // ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    }
    
    // Draw a visual debug indicator in the corner
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 180, 30);
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Canvas size: ${width}x${height}`, 5, 20);
    
    // Draw connections first (so they appear behind landmarks)
    if (handData.connections && handData.landmarks) {
      handData.connections.forEach(connection => {
        const start = handData.landmarks[connection.start];
        const end = handData.landmarks[connection.end];
        const color = handData.colors[connection.colorIndex];
        
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
          ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.stroke();
        }
      });
    }
    
    // Draw landmarks on top of connections
    if (handData.landmarks) {
      handData.landmarks.forEach((landmark, index) => {
        // Determine the color of the landmark based on which finger it belongs to
        let colorIndex = 0;
        
        // Wrist
        if (index === 0) {
          colorIndex = 6; // violet
        }
        // Thumb
        else if (index >= 1 && index <= 4) {
          colorIndex = 0; // red
        }
        // Index finger
        else if (index >= 5 && index <= 8) {
          colorIndex = 1; // orange
        }
        // Middle finger
        else if (index >= 9 && index <= 12) {
          colorIndex = 2; // yellow
        }
        // Ring finger
        else if (index >= 13 && index <= 16) {
          colorIndex = 3; // green
        }
        // Pinky
        else if (index >= 17 && index <= 20) {
          colorIndex = 4; // blue
        }
        
        const color = handData.colors[colorIndex];
        
        // Draw the landmark point
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width, 
          landmark.y * canvas.height, 
          index === 0 ? 8 : 6, // Wrist is bigger
          0, 
          2 * Math.PI
        );
        ctx.fillStyle = color;
        ctx.fill();
        
        // Add white border around landmark for better visibility
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
    
  }, [handData, videoElement, width, height]);
  
  return (
    <>
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 z-10 pointer-events-none border-2 border-red-500"
      />
      <div className="absolute top-8 left-4 z-20 bg-black/70 text-white p-2 rounded text-sm">
        Debug: {debugInfo}
      </div>
    </>
  );
};

export default HandVisualization;