/**
 * Improved ROI Debug Canvas
 * 
 * A simplified and more reliable debug canvas that displays the contents of a 
 * Region of Interest (ROI) and visualizes tracking state.
 */
import React, { useRef, useEffect, useState } from 'react';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import { RegionOfInterest, CircleROI } from '@/lib/types';
import { getVideoFrame } from '@/lib/cameraManager';

interface ImprovedROIDebugCanvasProps {
  width: number;
  height: number;
  visible: boolean;
}

const ImprovedROIDebugCanvas: React.FC<ImprovedROIDebugCanvasProps> = ({
  width = 200,
  height = 200,
  visible = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [roi, setRoi] = useState<CircleROI | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [status, setStatus] = useState<string>('Waiting for ROI...');
  const [isOpenCVReady, setIsOpenCVReady] = useState<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // Listen for OpenCV ready event
  useEffect(() => {
    const opencvListener = addListener(EventType.OPENCV_STATUS, (data) => {
      if (data.ready) {
        setIsOpenCVReady(true);
        setStatus('OpenCV ready. Draw an ROI to continue.');
      }
    });
    
    return () => {
      opencvListener.remove();
    };
  }, []);
  
  // Listen for ROI creation events
  useEffect(() => {
    // Listen for circle ROI events
    const circleRoiListener = addListener(EventType.CIRCLE_ROI_CREATED, (circleROI: CircleROI) => {
      console.log('Circle ROI detected:', circleROI);
      setRoi(circleROI);
      setStatus(`Circle ROI detected: ID ${circleROI.id}`);
    });
    
    // Listen for ROI updates
    const circleRoiUpdateListener = addListener(EventType.CIRCLE_ROI_UPDATED, (circleROI: CircleROI) => {
      if (roi && roi.id === circleROI.id) {
        setRoi(circleROI);
        setStatus(`ROI updated: ID ${circleROI.id}`);
      }
    });
    
    // Listen for ROI deletion
    const circleRoiDeleteListener = addListener(EventType.CIRCLE_ROI_DELETED, (circleROI: CircleROI) => {
      if (roi && roi.id === circleROI.id) {
        setRoi(null);
        setStatus('ROI deleted. Draw a new one.');
      }
    });
    
    return () => {
      circleRoiListener.remove();
      circleRoiUpdateListener.remove();
      circleRoiDeleteListener.remove();
    };
  }, [roi]);

  // Animation loop for rendering
  useEffect(() => {
    if (!visible) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }
    
    const renderFrame = () => {
      const now = performance.now();
      
      // Calculate FPS every second
      if (now - lastFrameTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }
      
      frameCountRef.current++;
      
      // Render the ROI content
      renderROIContent();
      
      // Continue the animation loop
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };
    
    // Start the rendering loop
    animationFrameRef.current = requestAnimationFrame(renderFrame);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [visible, roi]);
  
  // Render the ROI content to the canvas
  const renderROIContent = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw a checkerboard background
    const squareSize = 10;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#e0e0e0';
    for (let x = 0; x < width; x += squareSize * 2) {
      for (let y = 0; y < height; y += squareSize * 2) {
        ctx.fillRect(x, y, squareSize, squareSize);
        ctx.fillRect(x + squareSize, y + squareSize, squareSize, squareSize);
      }
    }
    
    // Draw border
    ctx.strokeStyle = roi ? '#4CAF50' : '#F44336';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
    
    // If we don't have an ROI, display instructions
    if (!roi) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, width, 30);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(status, width / 2, 20);
      
      // Draw help text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Draw a circle ROI', width / 2, height / 2 - 10);
      ctx.fillText('using pinch gesture', width / 2, height / 2 + 10);
      
      return;
    }
    
    // We have an ROI, so extract its content
    const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
    if (!videoElement || !videoElement.videoWidth) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, width, 30);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Camera not available', width / 2, 20);
      return;
    }
    
    // Get frame data
    const frameData = getVideoFrame(videoElement);
    if (!frameData) return;
    
    // Create a temporary canvas for processing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Draw the video frame to temp canvas
    tempCtx.putImageData(frameData, 0, 0);
    
    // Since we now use normalized coordinates (0.0-1.0), we can directly
    // translate to video coordinates without a scaling factor
    
    // Calculate the center and radius in video pixel coordinates
    const videoCenterX = roi.center.x * videoElement.videoWidth;
    const videoCenterY = roi.center.y * videoElement.videoHeight;
    const videoRadius = roi.radius * videoElement.videoWidth; // Radius is normalized relative to width
    
    // Extract the ROI region as a square that contains the circle
    const sourceX = Math.max(0, videoCenterX - videoRadius);
    const sourceY = Math.max(0, videoCenterY - videoRadius);
    const sourceSize = videoRadius * 2;
    const sourceWidth = Math.min(sourceSize, videoElement.videoWidth - sourceX);
    const sourceHeight = Math.min(sourceSize, videoElement.videoHeight - sourceY);
    
    // Draw the extracted region to our debug canvas
    ctx.drawImage(
      tempCanvas, 
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, width, height
    );
    
    // Draw a circular mask to highlight the ROI
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, width / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw a circle to show the ROI boundary
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, width / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Overlay status and info
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, 30);
    
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    // Show both normalized and video pixel radius
    const displayRadius = Math.round(videoRadius * 2);
    ctx.fillText(`ROI: ${displayRadius}px (${roi.radius.toFixed(3)})`, 8, 20);
    
    ctx.textAlign = 'right';
    ctx.fillText(`${fps} FPS`, width - 8, 20);
    
    // Draw matching info if available
    if (roi.matchResult) {
      const confidence = roi.matchResult.confidence * 100;
      const confText = `${confidence.toFixed(0)}%`;
      
      // Confidence bar background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, height - 20, width, 20);
      
      // Confidence bar foreground
      const barColor = confidence > 80 ? '#4CAF50' : 
                       confidence > 60 ? '#FFC107' : 
                       '#F44336';
      ctx.fillStyle = barColor;
      ctx.fillRect(0, height - 20, width * (confidence / 100), 20);
      
      // Confidence text
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText(`Match: ${confText}`, width / 2, height - 6);
    }
  };

  if (!visible) return null;

  return (
    <div 
      className="improved-roi-debug-canvas" 
      style={{ 
        position: 'fixed',
        top: '70px',
        left: '20px',
        zIndex: 1000,
        width,
        height,
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
      />
    </div>
  );
};

export default ImprovedROIDebugCanvas;