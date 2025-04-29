/**
 * Improved ROI Debug Canvas with Contour Tracking Visualization
 * 
 * A simplified and reliable debug canvas that displays the contents of a 
 * Region of Interest (ROI) and visualizes contour tracking state.
 */
import React, { useRef, useEffect, useState } from 'react';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import { RegionOfInterest, CircleROI } from '@/lib/types';
import { getVideoFrame } from '@/lib/cameraManager';
import { contourConfig } from '@/lib/contourTracking';

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
  const [contourData, setContourData] = useState<{
    isOccluded: boolean;
    contourCount: number;
    originalContourCount: number;
    visibilityRatio: number;
    visualizationData?: ImageData;
    stabilityScore?: number;
    isStable?: boolean;
  } | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // Listen for OpenCV ready event
  useEffect(() => {
    const opencvListener = addListener(EventType.OPENCV_STATUS, (data) => {
      if (data.ready) {
        setIsOpenCVReady(true);
        setStatus('OpenCV ready. Use pinch gesture to create ROI.');
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
      // Reset contour data for new ROI
      setContourData(null);
    });
    
    // Listen for ROI updates
    const circleRoiUpdateListener = addListener(EventType.ROI_UPDATED, (data: any) => {
      if (roi && data.id === roi.id) {
        // Update the ROI
        if (data.isCircleROI) {
          setRoi({
            ...roi,
            center: data.center || roi.center,
            radius: data.radius || roi.radius
          });
        }
        
        // Check for contour tracking data
        if (data.contourTracking) {
          setContourData({
            isOccluded: data.contourTracking.isOccluded || false,
            contourCount: data.trackingResult?.matchCount || 0,
            originalContourCount: data.trackingResult?.inlierCount || 0,
            visibilityRatio: data.trackingResult?.confidence || 0,
            visualizationData: data.contourTracking.visualizationData,
            stabilityScore: data.contourTracking.stabilityScore || 1.0,
            isStable: data.contourTracking.isStable || true
          });
          
          // Update status based on contour data
          if (data.contourTracking.isOccluded) {
            setStatus(`ROI occluded (${data.trackingResult?.confidence.toFixed(2)})`);
          } else if (data.contourTracking.isStable) {
            setStatus(`Tracking ${data.trackingResult?.matchCount || 0} contours (stable)`);
          } else {
            setStatus(`Tracking ${data.trackingResult?.matchCount || 0} contours (moving)`);
          }
        }
      }
    });
    
    // Listen for ROI deletion
    const circleRoiDeleteListener = addListener(EventType.CIRCLE_ROI_DELETED, (circleROI: CircleROI) => {
      if (roi && roi.id === circleROI.id) {
        setRoi(null);
        setContourData(null);
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
    
    // If we have contour visualization data, show that instead of the original ROI
    if (contourData?.visualizationData) {
      // Create temp canvas for the contour visualization
      const contourCanvas = document.createElement('canvas');
      contourCanvas.width = contourData.visualizationData.width;
      contourCanvas.height = contourData.visualizationData.height;
      const contourCtx = contourCanvas.getContext('2d');
      
      if (contourCtx) {
        // Draw the contour visualization data
        contourCtx.putImageData(contourData.visualizationData, 0, 0);
        
        // Draw onto our main canvas
        ctx.drawImage(
          contourCanvas,
          0, 0, contourCanvas.width, contourCanvas.height,
          0, 0, width, height
        );
      } else {
        // Fallback to original image if context creation fails
        ctx.drawImage(
          tempCanvas, 
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, width, height
        );
      }
    } else {
      // Draw the extracted region to our debug canvas
      ctx.drawImage(
        tempCanvas, 
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, width, height
      );
    }
    
    // Draw a circular mask to highlight the ROI
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, width / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw a circle to show the ROI boundary
    ctx.strokeStyle = contourData?.isOccluded ? 'rgba(255, 100, 0, 0.8)' : 'rgba(0, 255, 0, 0.8)';
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
    ctx.fillText(`ROI: ${displayRadius}px`, 8, 20);
    
    ctx.textAlign = 'right';
    ctx.fillText(`${fps} FPS`, width - 8, 20);
    
    // Status box for contour tracking info
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, height - 60, width, 60); // Increased height for more info
    
    // Status indicator line (color based on tracking state)
    let statusColor;
    if (contourData?.isOccluded) {
      statusColor = '#FF5722'; // Orange for occluded
    } else if (contourData?.isStable) {
      statusColor = '#4CAF50'; // Green for stable tracking
    } else if ((contourData?.contourCount ?? 0) > 0) {
      statusColor = '#2196F3'; // Blue for tracking but not stable
    } else {
      statusColor = '#FFC107'; // Yellow for no contours
    }
    
    ctx.fillStyle = statusColor;
    ctx.fillRect(0, height - 60, width, 4); // Indicator line
    
    // Contour tracking metrics
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '10px Arial';
    
    // Top line - Contour count info
    const countText = contourData 
      ? `Contours: ${contourData.contourCount ?? 0}/${contourData.originalContourCount ?? 0}`
      : 'Initializing contours...';
    ctx.fillText(countText, width / 2, height - 45);
    
    // Middle line - Visibility ratio
    const visibilityText = contourData 
      ? `Visibility: ${((contourData.visibilityRatio ?? 0) * 100).toFixed(0)}%`
      : 'Waiting for tracking data...';
    ctx.fillText(visibilityText, width / 2, height - 30);
    
    // Bottom line - Stability score
    const stabilityText = contourData?.stabilityScore !== undefined
      ? `Stability: ${(contourData.stabilityScore * 100).toFixed(0)}%${contourData.isStable ? ' ✓' : ''}`
      : 'Calculating stability...';
    ctx.fillText(stabilityText, width / 2, height - 15);
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