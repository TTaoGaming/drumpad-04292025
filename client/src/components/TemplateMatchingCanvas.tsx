/**
 * Template Matching Canvas
 * 
 * A debug canvas that displays the contents of a specific ROI and implements
 * template matching to track objects as they move.
 */
import React, { useRef, useEffect, useState } from 'react';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import { RegionOfInterest } from '@/lib/types';
import { getVideoFrame } from '@/lib/cameraManager';
import { getFrameManager } from '@/lib/FrameManager';
import {
  saveTemplate,
  clearTemplate,
  matchTemplate,
  TemplateMatchResult,
  ensureTemplateMatchingReady,
  getTemplateImageData
} from '@/lib/templateMatching';

interface TemplateMatchingCanvasProps {
  roiId?: string;
  width: number;
  height: number;
  visible: boolean;
}

const TemplateMatchingCanvas: React.FC<TemplateMatchingCanvasProps> = ({
  roiId = "1",
  width = 200,
  height = 200,
  visible = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [roi, setRoi] = useState<RegionOfInterest | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingResult, setTrackingResult] = useState<TemplateMatchResult | null>(null);
  const [templateImageData, setTemplateImageData] = useState<ImageData | null>(null);
  const [currentImageData, setCurrentImageData] = useState<ImageData | null>(null);
  const [showTemplate, setShowTemplate] = useState(true);
  const [trackingStatus, setTrackingStatus] = useState<string>('Initializing...');
  const [isOpenCVReady, setIsOpenCVReady] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [frameCount, setFrameCount] = useState(0);

  // Initialize template matching
  useEffect(() => {
    const initializeOpenCV = async () => {
      // Check if OpenCV is already available via template matching
      try {
        const ready = await ensureTemplateMatchingReady();
        if (ready) {
          console.log('[TemplateMatchingCanvas] Template matching is ready!');
          setIsOpenCVReady(true);
          setTrackingStatus('Template matcher ready');
        } else {
          console.error('[TemplateMatchingCanvas] Failed to initialize template matching');
          setTrackingStatus('Error loading OpenCV for template matching');
        }
      } catch (err) {
        console.error('[TemplateMatchingCanvas] Error initializing template matching:', err);
        setTrackingStatus('Error: ' + String(err).slice(0, 50) + '...');
      }
    };
    
    // Start the initialization process
    initializeOpenCV();
  }, []);

  // Listen for ROI creation events
  useEffect(() => {
    const listener = addListener(EventType.ROI_CREATED, (data: RegionOfInterest) => {
      console.log('[TemplateMatchingCanvas] ROI created event received:', data);
      setRoi(data);
      setIsTracking(true);  // Start tracking automatically when ROI is created
      
      // Reset previous tracking state
      clearTemplate(roiId);
      setTemplateImageData(null);
      setTrackingResult(null);
      setConfidenceHistory([]);
      setTrackingStatus('New ROI captured, initializing tracking...');
    });
    
    return () => {
      listener.remove();
    };
  }, [roiId]);

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
    
    // Get frame data from FrameManager
    const frameData = getFrameManager().getCurrentFrame();
    if (!frameData) return;
    
    // Create a temporary canvas to draw the video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Draw the video frame to temp canvas
    tempCtx.putImageData(frameData, 0, 0);

    // Calculate scaling factors between display size and actual video size
    const displayElement = document.querySelector('.camera-view') as HTMLElement;
    if (!displayElement) {
      console.warn("[TemplateMatchingCanvas] Could not find camera display element for scaling calculation");
      return;
    }
    
    const displayWidth = displayElement.clientWidth;
    const displayHeight = displayElement.clientHeight;
    
    const scaleX = videoElement.videoWidth / displayWidth;
    const scaleY = videoElement.videoHeight / displayHeight;
    
    // Only log scaling info occasionally to avoid console spam
    if (frameCount % 100 === 0) {
      console.log(`[TemplateMatchingCanvas] Coordinate scaling: display(${displayWidth}x${displayHeight}) to video(${videoElement.videoWidth}x${videoElement.videoHeight})`);
      console.log(`[TemplateMatchingCanvas] Scale factors: x=${scaleX.toFixed(2)}, y=${scaleY.toFixed(2)}`);
    }

    // Calculate ROI center and radius
    if (roi.points.length > 2) {
      // Calculate center of the ROI (assuming it's a circle)
      let sumX = 0, sumY = 0;
      for (const point of roi.points) {
        // Scale the point coordinates from display size to video frame size
        sumX += point.x * scaleX;
        sumY += point.y * scaleY;
      }
      const centerX = sumX / roi.points.length;
      const centerY = sumY / roi.points.length;
      
      // Calculate average radius from all points - scale this too
      let totalRadius = 0;
      for (const point of roi.points) {
        const scaledX = point.x * scaleX;
        const scaledY = point.y * scaleY;
        
        const distToCenter = Math.sqrt(
          Math.pow(scaledX - centerX, 2) + 
          Math.pow(scaledY - centerY, 2)
        );
        totalRadius += distToCenter;
      }
      const radius = totalRadius / roi.points.length;
      
      // Log radius calculation for debugging (limit frequency to reduce console spam)
      if (frameCount % 30 === 0) {
        console.log(`[TemplateMatchingCanvas] Average radius calculated from ${roi.points.length} points = ${radius.toFixed(2)}px`);
        console.log(`[TemplateMatchingCanvas] Center coordinates: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
      }
      
      // Extract the ROI region
      // We'll extract a square region that contains the circle
      const extractSize = radius * 2;
      const sourceX = Math.max(0, centerX - radius);
      const sourceY = Math.max(0, centerY - radius);
      const sourceWidth = Math.min(extractSize, videoElement.videoWidth - sourceX);
      const sourceHeight = Math.min(extractSize, videoElement.videoHeight - sourceY);
      
      if (frameCount % 30 === 0) {
        console.log(`[TemplateMatchingCanvas] Extracting region: x=${sourceX.toFixed(0)}, y=${sourceY.toFixed(0)}, w=${sourceWidth.toFixed(0)}, h=${sourceHeight.toFixed(0)}`);
      }
      
      // Get the square region
      const roiImageData = tempCtx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);
      
      // Store the current image data
      setCurrentImageData(roiImageData);
      
      // Draw the debug canvas with our extracted region
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
      
      // Draw the extracted region
      const tempRoiCanvas = document.createElement('canvas');
      tempRoiCanvas.width = roiImageData.width;
      tempRoiCanvas.height = roiImageData.height;
      const tempRoiCtx = tempRoiCanvas.getContext('2d');
      if (tempRoiCtx) {
        tempRoiCtx.putImageData(roiImageData, 0, 0);
        ctx.drawImage(tempRoiCanvas, 0, 0, width, height);
      }
      
      // If we're tracking, perform template matching
      if (isTracking && isOpenCVReady) {
        // If we haven't captured a template yet, do it now
        if (!templateImageData && currentImageData) {
          // Use the current frame as template
          saveTemplate(roiId, roiImageData);
          setTemplateImageData(roiImageData);
          setTrackingStatus('Template captured, tracking active');
          console.log('[TemplateMatchingCanvas] Template captured:', roiImageData.width, 'x', roiImageData.height);
        } 
        // Otherwise, try to match the template
        else if (templateImageData && currentImageData) {
          // Perform template matching
          const debugData: any = {};
          const result = matchTemplate(roiId, frameData, (data) => {
            setDebugInfo(data);
          });
          
          // Update tracking result
          setTrackingResult(result);
          
          // Update tracking status based on result
          if (result) {
            // Add to confidence history (last 10 frames)
            const newHistory = [...confidenceHistory, result.confidence].slice(-10);
            setConfidenceHistory(newHistory);
            
            // Calculate average confidence
            const avgConfidence = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
            
            setTrackingStatus(`Tracking: ${result.isTracked ? 'YES' : 'NO'} (${(avgConfidence * 100).toFixed(0)}%)`);
            
            // Draw match result on the debug canvas
            if (result.isTracked) {
              // Draw a rectangle around the match
              ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
              ctx.lineWidth = 3;
              ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
              
              // Draw a confidence bar
              const barHeight = 8;
              const barWidth = width - 20;
              const barX = 10;
              const barY = height - 20;
              
              // Background
              ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
              ctx.fillRect(barX, barY, barWidth, barHeight);
              
              // Foreground (confidence)
              const confColor = result.confidence > 0.8 ? 'rgba(0, 255, 0, 0.7)' : 
                              result.confidence > 0.6 ? 'rgba(255, 255, 0, 0.7)' : 
                              'rgba(255, 0, 0, 0.7)';
              ctx.fillStyle = confColor;
              ctx.fillRect(barX, barY, barWidth * result.confidence, barHeight);
              
              // Text
              ctx.fillStyle = 'white';
              ctx.font = '12px Arial';
              ctx.fillText(`${(result.confidence * 100).toFixed(0)}%`, barX + 4, barY - 4);
            } else {
              // Draw a red X
              ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(width * 0.2, height * 0.2);
              ctx.lineTo(width * 0.8, height * 0.8);
              ctx.moveTo(width * 0.8, height * 0.2);
              ctx.lineTo(width * 0.2, height * 0.8);
              ctx.stroke();
            }
          } else {
            setTrackingStatus('Matching failed');
          }
        }
      }
      
      // Draw borders and status
      ctx.strokeStyle = isTracking ? 'rgba(0, 128, 255, 0.8)' : 'rgba(255, 0, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, width, height);
      
      // Draw status text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, 20);
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(trackingStatus, 4, 14);
    }
    
    // Increment frame counter
    setFrameCount(frameCount + 1);
  };

  // Reference to the frame subscription
  const frameSubscriptionRef = useRef<(() => void) | null>(null);
  
  // Run extraction by subscribing to FrameManager
  useEffect(() => {
    if (!visible) return;
    
    // Get frame manager singleton
    const frameManager = getFrameManager();
    
    // Subscribe to frame updates with medium priority
    frameSubscriptionRef.current = frameManager.subscribe(
      'template_matching_canvas',
      () => {
        if (isOpenCVReady && visible && canvasRef.current) {
          extractROIContent();
        }
      },
      3 // Medium priority (higher than visualization, lower than main processing)
    );
    
    return () => {
      // Clean up subscription when component unmounts or visibility changes
      if (frameSubscriptionRef.current) {
        frameSubscriptionRef.current();
        frameSubscriptionRef.current = null;
      }
    };
  }, [visible, roi, isOpenCVReady, isTracking, templateImageData, currentImageData, trackingResult, frameCount]);

  // Capture reference template on demand
  const captureReferenceTemplate = () => {
    if (!currentImageData) {
      console.error('[TemplateMatchingCanvas] No ROI data available to capture template');
      setTrackingStatus('Error: No ROI data to capture');
      return;
    }
    
    // Save the current frame as template
    const success = saveTemplate(roiId, currentImageData);
    if (success) {
      setTemplateImageData(currentImageData);
      setTrackingStatus('Template captured manually');
      console.log('[TemplateMatchingCanvas] Template captured manually');
    } else {
      setTrackingStatus('Failed to capture template');
    }
  };

  // Clear tracking
  const clearTracking = () => {
    clearTemplate(roiId);
    setTemplateImageData(null);
    setTrackingResult(null);
    setConfidenceHistory([]);
    setIsTracking(false);
    setTrackingStatus('Tracking cleared');
  };

  // Toggle tracking
  const toggleTracking = () => {
    if (isTracking) {
      setIsTracking(false);
      setTrackingStatus('Tracking paused');
    } else {
      setIsTracking(true);
      setTrackingStatus('Tracking active');
    }
  };

  // Toggle template display
  const toggleTemplateDisplay = () => {
    setShowTemplate(!showTemplate);
  };

  // Handle UI events
  const handleCanvasClick = () => {
    // For manual testing, toggle tracking on canvas click
    toggleTracking();
  };

  if (!visible) return null;

  return (
    <div className="template-matching-canvas-container" style={{ width, height, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        style={{ 
          cursor: 'pointer', 
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
      />
      
      {/* Controls */}
      <div 
        className="template-controls" 
        style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          display: 'flex', 
          justifyContent: 'space-around',
          padding: '4px',
          background: 'rgba(0,0,0,0.5)'
        }}
      >
        <button
          onClick={captureReferenceTemplate}
          style={{ 
            fontSize: '9px', 
            padding: '2px 4px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '2px'
          }}
        >
          Capture
        </button>
        <button
          onClick={toggleTracking}
          style={{ 
            fontSize: '9px', 
            padding: '2px 4px',
            background: isTracking ? '#F44336' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '2px'
          }}
        >
          {isTracking ? 'Pause' : 'Track'}
        </button>
        <button
          onClick={clearTracking}
          style={{ 
            fontSize: '9px', 
            padding: '2px 4px',
            background: '#9E9E9E',
            color: 'white',
            border: 'none',
            borderRadius: '2px'
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default TemplateMatchingCanvas;