import React, { useEffect, useRef, useState } from 'react';
import { EventType, addListener } from '@/lib/eventBus';
import orbFeatureDetector from '@/lib/orbFeatureDetector';
import { ROIWithFeatures } from '@/lib/orbFeatureDetector';
import { getVideoFrame } from '@/lib/cameraManager';

interface DebugViewProps {
  width?: number;
  height?: number;
}

/**
 * DebugView Component
 * 
 * Displays a small visualization of the marker ROI with ID:1 being processed by OpenCV
 */
const DebugView: React.FC<DebugViewProps> = ({ 
  width = 200, 
  height = 200 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [roi, setROI] = useState<ROIWithFeatures | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const animationRef = useRef<number | null>(null);

  // Update ROI data when changed
  useEffect(() => {
    const updateInterval = setInterval(() => {
      const rois = orbFeatureDetector.getROIs();
      // Find ROI with the latest ID (most recently created)
      if (rois.length > 0) {
        // Sort by timestamp (descending)
        const sortedROIs = [...rois].sort((a, b) => {
          return (b.timestamp || 0) - (a.timestamp || 0);
        });
        
        setROI(sortedROIs[0]); // Get most recent ROI
      }
    }, 500); // Update every 500ms

    // Listen for new ROIs being created
    const roiListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'drawing' && data.setting === 'newPath' && data.value?.isROI) {
          // Force an immediate update of the ROI data
          const rois = orbFeatureDetector.getROIs();
          if (rois.length > 0) {
            // Sort by timestamp (descending)
            const sortedROIs = [...rois].sort((a, b) => {
              return (b.timestamp || 0) - (a.timestamp || 0);
            });
            
            setROI(sortedROIs[0]); // Get most recent ROI
          }
        }
      }
    );

    return () => {
      clearInterval(updateInterval);
      roiListener.remove();
    };
  }, []);

  // Render the ROI to the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !roi) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    const padding = 20;
    const roiWidth = maxX - minX;
    const roiHeight = maxY - minY;
    const scaleX = (canvas.width - padding * 2) / roiWidth;
    const scaleY = (canvas.height - padding * 2) / roiHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calculate center offset to position ROI in the center of canvas
    const centerX = (canvas.width / 2) - ((minX + roiWidth / 2) * scale);
    const centerY = (canvas.height / 2) - ((minY + roiHeight / 2) * scale);

    // Capture current video frame and draw it in the debug view
    const videoElements = document.getElementsByTagName('video');
    if (videoElements.length > 0) {
      const videoElement = videoElements[0];
      
      if (videoElement && videoElement.readyState >= 2) {
        try {
          // Create a temporary canvas for cropping the video frame
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          
          if (tempCtx) {
            // Extract the ROI area from the video frame
            const margin = 20; // Add a small margin around the ROI
            const cropX = Math.max(0, minX - margin);
            const cropY = Math.max(0, minY - margin);
            const cropWidth = Math.min(videoElement.videoWidth - cropX, roiWidth + margin * 2);
            const cropHeight = Math.min(videoElement.videoHeight - cropY, roiHeight + margin * 2);
            
            // Set temp canvas size to the cropped area
            tempCanvas.width = cropWidth;
            tempCanvas.height = cropHeight;
            
            // Draw the cropped portion from the video
            tempCtx.drawImage(
              videoElement,
              cropX, cropY, cropWidth, cropHeight,  // Source rectangle
              0, 0, cropWidth, cropHeight           // Destination rectangle
            );
            
            // Scale and draw the cropped image onto our debug canvas
            // Position it to fit with the ROI overlay
            const destX = (minX - cropX) * scale + centerX;
            const destY = (minY - cropY) * scale + centerY;
            const destWidth = cropWidth * scale;
            const destHeight = cropHeight * scale;
            
            ctx.drawImage(
              tempCanvas,
              0, 0, cropWidth, cropHeight,         // Source rectangle
              destX, destY, destWidth, destHeight  // Destination rectangle
            );
          }
        } catch (e) {
          console.error('Error capturing video frame for debug view:', e);
        }
      }
    }

    // Draw ROI outline with glow effect
    // Glow effect (larger stroke with blur)
    ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(
      roi.points[0].x * scale + centerX,
      roi.points[0].y * scale + centerY
    );
    
    for (let i = 1; i < roi.points.length; i++) {
      ctx.lineTo(
        roi.points[i].x * scale + centerX,
        roi.points[i].y * scale + centerY
      );
    }
    
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Reset shadow for other drawings
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw features
    if (roi.features && roi.features.length > 0) {
      // Draw all features
      roi.features.forEach(feature => {
        const x = feature.x * scale + centerX;
        const y = feature.y * scale + centerY;
        
        // Feature circle with slight glow
        ctx.shadowColor = 'rgba(255, 255, 0, 0.5)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        // Feature orientation line
        const angle = feature.angle * Math.PI / 180;
        const length = feature.size * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + Math.cos(angle) * length,
          y + Math.sin(angle) * length
        );
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      
      // Draw a convex hull around the features to highlight the pattern
      if (roi.features.length > 3) {
        // Simplified visualization - just draw a circle around features center
        const featurePoints = roi.features.map(f => ({ 
          x: f.x * scale + centerX, 
          y: f.y * scale + centerY 
        }));
        
        // Find center of features
        let sumX = 0, sumY = 0;
        featurePoints.forEach(p => { sumX += p.x; sumY += p.y; });
        const centerFeatureX = sumX / featurePoints.length;
        const centerFeatureY = sumY / featurePoints.length;
        
        // Find average distance from center
        let sumDist = 0;
        featurePoints.forEach(p => {
          const dx = p.x - centerFeatureX;
          const dy = p.y - centerFeatureY;
          sumDist += Math.sqrt(dx*dx + dy*dy);
        });
        const avgRadius = sumDist / featurePoints.length;
        
        // Draw circle
        ctx.beginPath();
        ctx.arc(centerFeatureX, centerFeatureY, avgRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw ROI info
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(5, 5, 190, 60);
    
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`ROI ID: ${roi.id.substring(0, 8)}...`, 10, 20);
    ctx.fillText(`Points: ${roi.points.length}`, 10, 35);
    ctx.fillText(`Features: ${roi.features.length}`, 10, 50);
    ctx.fillText(`Last Update: ${new Date(roi.timestamp || 0).toLocaleTimeString()}`, 10, 65);

  }, [roi]);
  
  // Set up animation loop for continuous updates
  useEffect(() => {
    // Skip if there's no ROI or no debug view
    if (!roi || !showDebug) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    
    // Function to render the canvas continuously
    const updateCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Force a redraw of the canvas with the current ROI
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // The ROI doesn't change, but the video frame does, so we'll redraw
          // with a fresh video frame continuously
          
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
          const padding = 20;
          const roiWidth = maxX - minX;
          const roiHeight = maxY - minY;
          const scaleX = (canvas.width - padding * 2) / roiWidth;
          const scaleY = (canvas.height - padding * 2) / roiHeight;
          const scale = Math.min(scaleX, scaleY);

          // Calculate center offset to position ROI in the center of canvas
          const centerX = (canvas.width / 2) - ((minX + roiWidth / 2) * scale);
          const centerY = (canvas.height / 2) - ((minY + roiHeight / 2) * scale);
          
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Capture current video frame
          const videoElements = document.getElementsByTagName('video');
          if (videoElements.length > 0) {
            const videoElement = videoElements[0];
            
            if (videoElement && videoElement.readyState >= 2) {
              try {
                // Create a temporary canvas for cropping the video frame
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                if (tempCtx) {
                  // Extract the ROI area from the video frame
                  const margin = 20; // Add a small margin around the ROI
                  const cropX = Math.max(0, minX - margin);
                  const cropY = Math.max(0, minY - margin);
                  const cropWidth = Math.min(videoElement.videoWidth - cropX, roiWidth + margin * 2);
                  const cropHeight = Math.min(videoElement.videoHeight - cropY, roiHeight + margin * 2);
                  
                  // Set temp canvas size to the cropped area
                  tempCanvas.width = cropWidth;
                  tempCanvas.height = cropHeight;
                  
                  // Draw the cropped portion from the video
                  tempCtx.drawImage(
                    videoElement,
                    cropX, cropY, cropWidth, cropHeight,  // Source rectangle
                    0, 0, cropWidth, cropHeight           // Destination rectangle
                  );
                  
                  // Scale and draw the cropped image onto our debug canvas
                  // Position it to fit with the ROI overlay
                  const destX = (minX - cropX) * scale + centerX;
                  const destY = (minY - cropY) * scale + centerY;
                  const destWidth = cropWidth * scale;
                  const destHeight = cropHeight * scale;
                  
                  ctx.drawImage(
                    tempCanvas,
                    0, 0, cropWidth, cropHeight,         // Source rectangle
                    destX, destY, destWidth, destHeight  // Destination rectangle
                  );
                }
              } catch (e) {
                console.error('Error capturing video frame for debug view:', e);
              }
            }
          }
          
          // Draw ROI outline with glow effect
          ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(
            roi.points[0].x * scale + centerX,
            roi.points[0].y * scale + centerY
          );
          
          for (let i = 1; i < roi.points.length; i++) {
            ctx.lineTo(
              roi.points[i].x * scale + centerX,
              roi.points[i].y * scale + centerY
            );
          }
          
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Reset shadow for other drawings
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          
          // Draw features
          if (roi.features && roi.features.length > 0) {
            // Draw all features
            roi.features.forEach(feature => {
              const x = feature.x * scale + centerX;
              const y = feature.y * scale + centerY;
              
              // Feature circle with slight glow
              ctx.shadowColor = 'rgba(255, 255, 0, 0.5)';
              ctx.shadowBlur = 5;
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
              ctx.fill();
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              
              // Feature orientation line
              const angle = feature.angle * Math.PI / 180;
              const length = feature.size * scale;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(
                x + Math.cos(angle) * length,
                y + Math.sin(angle) * length
              );
              ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
              ctx.lineWidth = 1;
              ctx.stroke();
            });
          }
          
          // Draw ROI info
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(5, 5, 190, 60);
          
          ctx.font = '12px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(`ROI ID: ${roi.id.substring(0, 8)}...`, 10, 20);
          ctx.fillText(`Points: ${roi.points.length}`, 10, 35);
          ctx.fillText(`Features: ${roi.features.length}`, 10, 50);
          ctx.fillText(`Last Update: ${new Date(roi.timestamp || 0).toLocaleTimeString()}`, 10, 65);
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
          Marker ROI Debug View
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