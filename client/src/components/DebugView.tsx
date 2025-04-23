import React, { useEffect, useRef, useState } from 'react';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import { getVideoFrame } from '@/lib/cameraManager';

// Simple ROI interface without ORB features
interface ROI {
  id: string;
  points: {x: number, y: number}[];
  timestamp?: number;
}

interface DebugViewProps {
  width?: number;
  height?: number;
}

/**
 * DebugView Component
 * 
 * Displays a small visualization of the marker ROI being sent for processing
 * Shows the raw image content captured within the ROI
 */
const DebugView: React.FC<DebugViewProps> = ({ 
  width = 200, 
  height = 200 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [roi, setROI] = useState<ROI | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const animationRef = useRef<number | null>(null);

  // Listen for new ROIs being created
  useEffect(() => {
    const roiListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'drawing' && data.setting === 'newPath' && data.value?.isROI) {
          // When a new ROI is drawn with pinch gesture, capture it
          const newPath = data.value;
          if (newPath.isComplete && newPath.points.length > 2) {
            // Create ROI from the drawing path
            const newROI: ROI = {
              id: newPath.id || Date.now().toString(),
              points: [...newPath.points],
              timestamp: Date.now()
            };
            
            // Update the ROI to show in debug view
            setROI(newROI);
            
            // Log for debugging
            console.log(`Debug view tracking ROI with ${newROI.points.length} points, ID: ${newROI.id}`);
          }
        }
      }
    );
    
    return () => {
      roiListener.remove();
    };
  }, []);
  
  // Set up animation loop for continuous updates of the video image within the ROI
  useEffect(() => {
    // Skip if there's no ROI or no debug view
    if (!roi || !showDebug) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    
    // Function to render the canvas continuously with fresh video frames
    const updateCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Find the bounding box of the ROI points
          let minX = Number.MAX_VALUE;
          let minY = Number.MAX_VALUE; 
          let maxX = Number.MIN_VALUE;
          let maxY = Number.MIN_VALUE;

          roi.points.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
          });
          
          // Calculate scale to fit the ROI in the canvas with padding
          const padding = 10;
          const roiWidth = maxX - minX;
          const roiHeight = maxY - minY;
          const scaleX = (canvas.width - padding * 2) / roiWidth;
          const scaleY = (canvas.height - padding * 2) / roiHeight;
          const scale = Math.min(scaleX, scaleY);

          // Calculate center offset to position ROI in the center of canvas
          const centerX = (canvas.width / 2) - ((minX + roiWidth / 2) * scale);
          const centerY = (canvas.height / 2) - ((minY + roiHeight / 2) * scale);
          
          // Add a gray background to the canvas by default
          ctx.fillStyle = '#222222';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Capture current video frame
          const videoElements = document.getElementsByTagName('video');
          console.log(`DEBUG: Found ${videoElements.length} video elements`);
          
          if (videoElements.length === 0) {
            console.log('DEBUG: No video elements found on the page');
          }
          
          if (videoElements.length > 0) {
            const videoElement = videoElements[0];
            
            console.log(`DEBUG: Video element ready state: ${videoElement.readyState}`);
            console.log(`DEBUG: Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
            console.log(`DEBUG: Current time: ${videoElement.currentTime.toFixed(2)}s, Paused: ${videoElement.paused}`);
            
            if (videoElement && videoElement.readyState >= 2) {
              try {
                // APPROACH 1: Draw the entire video frame to see if it works at all
                console.log("DEBUG: Drawing entire video frame as a test");
                
                // Calculate center position and scaling to fit the entire video while keeping aspect ratio
                const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
                const canvasAspect = canvas.width / canvas.height;
                
                let drawWidth, drawHeight, drawX, drawY;
                
                if (videoAspect > canvasAspect) {
                  // Video is wider than canvas
                  drawWidth = canvas.width;
                  drawHeight = canvas.width / videoAspect;
                  drawX = 0;
                  drawY = (canvas.height - drawHeight) / 2;
                } else {
                  // Video is taller than canvas
                  drawHeight = canvas.height;
                  drawWidth = canvas.height * videoAspect;
                  drawX = (canvas.width - drawWidth) / 2;
                  drawY = 0;
                }
                
                // Draw a colored background first
                ctx.fillStyle = '#444444';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw the video directly to debug canvas
                ctx.drawImage(videoElement, drawX, drawY, drawWidth, drawHeight);
                console.log(`DEBUG: Successfully drew entire video frame to canvas`);
                
                // APPROACH 2: Try to calculate a more accurate ROI and crop
                // For now, let's focus on showing the whole video with the ROI outline
                // This way we can see the ROI in context of the entire image
                console.log(`DEBUG: Drawing ROI on entire video frame, skipping cropping`);
                
                // Get ROI center for informational display
                let roiCenterX = 0, roiCenterY = 0;
                roi.points.forEach(point => {
                  roiCenterX += point.x;
                  roiCenterY += point.y;
                });
                roiCenterX /= roi.points.length;
                roiCenterY /= roi.points.length;
                
                console.log(`DEBUG: ROI center at: (${roiCenterX}, ${roiCenterY})`);
                
                // No need for additional temp canvas if we're just showing the whole video
                
                // Draw ROI outline directly over the video image
                // We need to map the ROI points to the current canvas coordinates
                
                // Determine the scale factors between the drawing canvas (where ROI was created)
                // and our current debug canvas (where we're showing the video)
                const videoDisplay = document.getElementById('camera-feed') as HTMLVideoElement;
                let drawingCanvasWidth = canvas.width;
                let drawingCanvasHeight = canvas.height;
                
                if (videoDisplay) {
                  // Get the actual dimensions of the video display
                  const rect = videoDisplay.getBoundingClientRect();
                  drawingCanvasWidth = rect.width;
                  drawingCanvasHeight = rect.height;
                }
                
                // Calculate scale between the drawing canvas and our debug canvas
                const scaleX = canvas.width / drawingCanvasWidth;
                const scaleY = canvas.height / drawingCanvasHeight;
                
                // Apply scale factor to map ROI points to our debug canvas
                const scaledPoints = roi.points.map(point => ({
                  x: point.x * scaleX,
                  y: point.y * scaleY
                }));
                
                // Draw the ROI outline
                ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                
                // Start with the first point
                ctx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
                
                // Draw the rest of the points
                for (let i = 1; i < scaledPoints.length; i++) {
                  ctx.lineTo(scaledPoints[i].x, scaledPoints[i].y);
                }
                
                ctx.closePath();
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Reset shadow for other drawings
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
              } catch (e) {
                console.error('Error capturing video frame for debug view:', e);
              }
            }
          }
          
          // Draw ROI info (only the essential information, no feature data)
          if (ctx && roi) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(5, 5, 190, 45);
            
            ctx.font = '12px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillText(`ROI ID: ${roi.id.substring(0, 8)}...`, 10, 20);
            ctx.fillText(`Points: ${roi.points.length}`, 10, 35);
          }
        }
      }
      
      // Continue the animation loop
      animationRef.current = requestAnimationFrame(updateCanvas);
    };
    
    // Start the animation loop
    animationRef.current = requestAnimationFrame(updateCanvas);
    
    // Clean up animation on unmount or when ROI/showDebug changes
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [roi, showDebug]);

  // If no debug data to show but drawing is in progress
  if (!roi && showDebug) {
    return (
      <div className="absolute top-16 left-4 z-30 bg-black/70 p-2 rounded-md shadow-lg backdrop-blur-sm border border-yellow-900">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-xs text-white font-medium">
            Waiting for ROI...
            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-yellow-900/70 rounded">Draw with pinch gesture</span>
          </h3>
          <button 
            className="text-xs text-gray-400 hover:text-white"
            onClick={() => setShowDebug(false)}
          >
            ×
          </button>
        </div>
        <div 
          className="flex items-center justify-center bg-black/40 rounded border border-gray-700"
          style={{ width, height }}
        >
          <p className="text-xs text-yellow-500">
            Use pinch gesture to draw an ROI marker
          </p>
        </div>
      </div>
    );
  }
  
  // If closed or no ROI data
  if (!roi || !showDebug) return null;

  return (
    <div className="absolute top-16 left-4 z-30 bg-black/70 p-2 rounded-md shadow-lg backdrop-blur-sm border border-red-900">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-xs text-white font-medium">
          Raw ROI Image
          {roi && <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-red-900/70 rounded">ID: {roi.id.substring(0, 8)}...</span>}
        </h3>
        <button 
          className="text-xs text-gray-400 hover:text-white"
          onClick={() => setShowDebug(false)}
        >
          ×
        </button>
      </div>
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        className="bg-black/40 rounded border border-gray-700"
      />
    </div>
  );
};

export default DebugView;