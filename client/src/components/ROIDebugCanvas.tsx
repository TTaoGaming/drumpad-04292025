/**
 * ROI Debug Canvas
 * 
 * A simple debug canvas that displays the contents of a specific ROI
 * Used for development and debugging purposes
 */
import React, { useRef, useEffect, useState } from 'react';
import { EventType, addListener } from '@/lib/eventBus';
import { RegionOfInterest } from '@/lib/types';
import { getVideoFrame } from '@/lib/cameraManager';

interface ROIDebugCanvasProps {
  roiId?: string;
  width: number;
  height: number;
  visible: boolean;
}

const ROIDebugCanvas: React.FC<ROIDebugCanvasProps> = ({ 
  roiId = "1", 
  width = 200, 
  height = 200,
  visible = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [roi, setRoi] = useState<RegionOfInterest | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Listen for ROI updates
  useEffect(() => {
    const roisListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'drawing' && data.setting === 'activeROIs') {
          const rois = data.value as RegionOfInterest[];
          // Find ROI with ID 1 (we'll just use the first one if nothing matches)
          const targetRoi = rois.find(r => r.id === roiId) || rois[0];
          
          if (targetRoi) {
            setRoi(targetRoi);
            setIsExtracting(true);
          }
        }
      }
    );
    
    return () => {
      roisListener.remove();
    };
  }, [roiId]);

  // Extract ROI content
  useEffect(() => {
    if (!roi || !isExtracting || !visible) return;
    
    const extractInterval = setInterval(() => {
      extractROIContent();
    }, 100); // Extract every 100ms
    
    return () => {
      clearInterval(extractInterval);
    };
  }, [roi, isExtracting, visible]);

  // Extract ROI content from video frame
  const extractROIContent = () => {
    const canvas = canvasRef.current;
    if (!canvas || !roi) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Get video frame
    const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
    if (!videoElement || !videoElement.videoWidth) return;
    
    // Get frame data
    const frameData = getVideoFrame(videoElement);
    if (!frameData) return;
    
    // Create a temporary canvas to draw the video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Draw the video frame to temp canvas
    tempCtx.putImageData(frameData, 0, 0);

    // Calculate ROI center and radius
    if (roi.points.length > 2) {
      // Calculate center of the ROI (assuming it's a circle)
      let sumX = 0, sumY = 0;
      for (const point of roi.points) {
        sumX += point.x;
        sumY += point.y;
      }
      const centerX = sumX / roi.points.length;
      const centerY = sumY / roi.points.length;
      
      // Calculate radius (distance from center to first point)
      const radius = Math.sqrt(
        Math.pow(roi.points[0].x - centerX, 2) + 
        Math.pow(roi.points[0].y - centerY, 2)
      );
      
      // Draw a red circle on the temp canvas to show what we're extracting
      tempCtx.strokeStyle = 'red';
      tempCtx.lineWidth = 2;
      tempCtx.beginPath();
      tempCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      tempCtx.stroke();

      // Extract the ROI region
      // We'll extract a square region that contains the circle
      const extractSize = radius * 2;
      const sourceX = Math.max(0, centerX - radius);
      const sourceY = Math.max(0, centerY - radius);
      const sourceWidth = Math.min(extractSize, videoElement.videoWidth - sourceX);
      const sourceHeight = Math.min(extractSize, videoElement.videoHeight - sourceY);
      
      // Draw the extracted region to our debug canvas
      ctx.drawImage(
        tempCanvas,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, width, height
      );
      
      // Add ROI ID label
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`ROI ID: ${roi.id}`, 10, 20);
      
      // Add circle to show the ROI extraction outline
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(width/2, height/2, width/2 - 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  if (!visible) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      left: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '8px',
      padding: '10px',
      zIndex: 1000,
      color: 'white',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ margin: 0, padding: 0, fontSize: '14px' }}>ROI Debug View</h3>
        {roi && <p style={{ margin: '3px 0 0 0', padding: 0, fontSize: '12px', opacity: 0.8 }}>ROI ID: {roi.id}</p>}
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          border: '1px solid rgba(255, 255, 255, 0.3)',
          backgroundColor: '#222'
        }}
      />
    </div>
  );
};

export default ROIDebugCanvas;