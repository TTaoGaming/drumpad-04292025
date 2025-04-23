import React, { useEffect, useRef, useState } from 'react';
import { EventType, addListener } from '@/lib/eventBus';

interface DebugViewProps {
  enabled?: boolean;
}

/**
 * Debug View Component
 * 
 * Shows visualization of OpenCV processing stages to help debug contour detection
 */
const DebugView: React.FC<DebugViewProps> = ({ enabled = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [debugImages, setDebugImages] = useState<{
    original?: ImageData;
    threshold?: ImageData;
    contours?: ImageData;
    roi?: { x: number, y: number, width: number, height: number };
  }>({});

  useEffect(() => {
    // Listen for debug visualizations from the detector
    const listener = addListener(EventType.FEATURE_DEBUG, (data) => {
      setDebugImages(data);
      
      // Draw to the canvas when we receive new debug data
      if (canvasRef.current && data.original) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          drawDebugVisualizations(ctx, data);
        }
      }
    });

    return () => {
      listener.remove();
    };
  }, []);

  const drawDebugVisualizations = (
    ctx: CanvasRenderingContext2D, 
    data: {
      original?: ImageData;
      threshold?: ImageData;
      contours?: ImageData;
      roi?: { x: number, y: number, width: number, height: number };
    }
  ) => {
    const { original, threshold, contours, roi } = data;
    
    // Set canvas size based on the data we have
    if (original) {
      const canvasWidth = 320; // Fixed debug panel width
      const originalAspect = original.width / original.height;
      const canvasHeight = canvasWidth / originalAspect;
      
      // Update canvas dimensions
      ctx.canvas.width = canvasWidth;
      ctx.canvas.height = canvasHeight * 3; // Space for 3 images stacked vertically
      
      // Clear canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Draw original image at the top
      ctx.putImageData(original, 0, 0);
      ctx.fillStyle = 'white';
      ctx.fillText('Original ROI', 10, 20);
      
      // Draw threshold image in the middle if available
      if (threshold) {
        // Scale and put ImageData - we need to create a temporary canvas for this
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = threshold.width;
        tempCanvas.height = threshold.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.putImageData(threshold, 0, 0);
          
          // Draw the threshold image scaled to our debug view
          ctx.drawImage(tempCanvas, 0, canvasHeight, canvasWidth, canvasHeight);
          ctx.fillStyle = 'white';
          ctx.fillText('Threshold', 10, canvasHeight + 20);
        }
      }
      
      // Draw contours image at the bottom if available
      if (contours) {
        // Scale and put ImageData - we need to create a temporary canvas for this
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = contours.width;
        tempCanvas.height = contours.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.putImageData(contours, 0, 0);
          
          // Draw the contours image scaled to our debug view
          ctx.drawImage(tempCanvas, 0, canvasHeight * 2, canvasWidth, canvasHeight);
          ctx.fillStyle = 'white';
          ctx.fillText('Contours', 10, canvasHeight * 2 + 20);
        }
      }
      
      // Draw ROI rectangle on all images if available
      if (roi) {
        // Calculate scaled coordinates
        const scaleX = canvasWidth / original.width;
        const scaleY = canvasHeight / original.height;
        
        const scaledX = roi.x * scaleX;
        const scaledY = roi.y * scaleY;
        const scaledWidth = roi.width * scaleX;
        const scaledHeight = roi.height * scaleY;
        
        // Draw on original image
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 2;
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
        
        // Draw on threshold image
        ctx.strokeRect(scaledX, canvasHeight + scaledY, scaledWidth, scaledHeight);
        
        // Draw on contours image
        ctx.strokeRect(scaledX, canvasHeight * 2 + scaledY, scaledWidth, scaledHeight);
      }
    }
  };

  if (!enabled) return null;

  return (
    <div className="absolute top-16 right-4 z-50 bg-black/50 border border-white/20 rounded-md overflow-hidden">
      <div className="px-2 py-1 text-xs font-mono bg-black/80 text-white">
        Debug Visualization
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-auto"
        width={320}
        height={720}
      />
    </div>
  );
};

export default DebugView;