import React, { useEffect, useRef } from 'react';

interface SimpleHandVisualizerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

/**
 * Simple hand visualizer that draws directly on a canvas overlay
 * No worker communication - just to demonstrate the visualization
 */
const SimpleHandVisualizer: React.FC<SimpleHandVisualizerProps> = ({ videoRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Rainbow colors
  const COLORS = [
    'red',         // Thumb
    'orange',      // Index finger
    'yellow',      // Middle finger
    'green',       // Ring finger
    'blue',        // Pinky
    'indigo',      // Palm connections
    'violet'       // Wrist
  ];
  
  // Draw a simple simulated hand
  const drawSimulatedHand = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    // Movement factor based on time
    const movement = Math.sin(time / 1000) * 0.05;
    
    // Center position with slight movement
    const centerX = width * (0.5 + movement);
    const centerY = height * (0.5 + movement * 0.5);
    
    // Draw palm
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.fill();
    ctx.strokeStyle = COLORS[5]; // indigo
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw wrist point
    const wristY = centerY + 60;
    ctx.beginPath();
    ctx.arc(centerX, wristY, 10, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[6]; // violet
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Connect wrist to palm
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, wristY);
    ctx.strokeStyle = COLORS[6]; // violet
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Draw fingers
    const fingerCount = 5;
    const fingerSpacing = Math.PI / (fingerCount - 1);
    const fingerLength = 100;
    
    for (let i = 0; i < fingerCount; i++) {
      // Angle for the current finger (thumb on left to pinky on right)
      const angle = Math.PI / 2 - (fingerSpacing * 2) + (i * fingerSpacing);
      
      // Add some movement to fingers
      const fingerMovement = Math.sin(time / 500 + i) * 0.2;
      const adjustedAngle = angle + fingerMovement;
      
      // Calculate segment positions
      const segmentCount = 3;
      let prevX = centerX;
      let prevY = centerY;
      
      for (let j = 0; j < segmentCount; j++) {
        const segmentLength = (fingerLength / segmentCount) * (1 - (j * 0.1));
        const segmentX = prevX + Math.cos(adjustedAngle) * segmentLength;
        const segmentY = prevY - Math.sin(adjustedAngle) * segmentLength;
        
        // Draw segment connection
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(segmentX, segmentY);
        ctx.strokeStyle = COLORS[i];
        ctx.lineWidth = 4 - j;
        ctx.stroke();
        
        // Draw segment joint
        ctx.beginPath();
        ctx.arc(segmentX, segmentY, 5 - j, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[i];
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        prevX = segmentX;
        prevY = segmentY;
      }
    }
    
    // Add FPS counter - positioned in bottom left for better visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, height - 40, 120, 30);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    const fps = Math.round(1000 / (performance.now() - (lastFrameTime || performance.now())));
    ctx.fillText(`FPS: ${fps}`, 20, height - 18);
  };
  
  let lastFrameTime: number | null = null;
  
  // Animation loop
  const animate = (time: number) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (canvas && video) {
      // Match canvas size to video dimensions 
      const width = video.clientWidth;
      const height = video.clientHeight;
      
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw hand
        drawSimulatedHand(ctx, width, height, time);
        
        // Update last frame time
        lastFrameTime = time;
      }
    }
    
    // Continue animation loop
    animationRef.current = requestAnimationFrame(animate);
  };
  
  // Set up animation and clean up on unmount
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 pointer-events-none"
    />
  );
};

export default SimpleHandVisualizer;