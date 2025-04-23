/**
 * Drawing Canvas Component
 * 
 * Provides a transparent overlay canvas for drawing with pinch gestures.
 * Supports path-based drawing and ROI selection with transparent fill.
 */
import React, { useRef, useEffect, useState } from 'react';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import orbFeatureDetector from '@/lib/orbFeatureDetector';
import { getVideoFrame } from '@/lib/cameraManager';
import { DrawingPath } from '@/lib/types';

interface DrawingCanvasProps {
  width: number;
  height: number;
  enabled: boolean;
  initialPaths?: DrawingPath[];
}

export interface DrawingSettings {
  enabled: boolean;
  mode: 'free' | 'roi';
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fillOpacity: number;
  autoClose: boolean;
  smoothing: boolean;
  showFeatures: boolean;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ width, height, enabled, initialPaths = [] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<DrawingPath[]>(initialPaths);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [settings, setSettings] = useState<DrawingSettings>({
    enabled: enabled,
    mode: 'roi',
    strokeColor: '#00FFFF', // Cyan
    fillColor: '#00FFFF', // Cyan
    strokeWidth: 3,
    fillOpacity: 0.2,
    autoClose: true,
    smoothing: true,
    showFeatures: true
  });

  // Listen for pinch events from MediaPipeHandTracker
  useEffect(() => {
    const pinchStateListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        // Handle pinch gesture state changes
        if (data.section === 'gestures' && data.setting === 'pinchState' && settings.enabled) {
          const { isPinching, distance } = data.value;
          
          // Get the index fingertip position from event bus
          if (data.value.position) {
            // Position already comes in normalized coordinates (0-1)
            // No need to convert again
            handlePinchStateChange(isPinching, data.value.position);
          }
        }
      }
    );
    
    // Listen for finger position updates
    const fingerPositionListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'tracking' && data.setting === 'indexFingertip' && settings.enabled) {
          const position = data.value;
          if (isDrawing && position) {
            addPointToPath(position.x * width, position.y * height);
          }
        }
      }
    );
    
    // Listen for drawing settings changes
    const settingsListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'drawing' && data.setting === 'drawingSettings') {
          setSettings(data.value);
        }
      }
    );
    
    return () => {
      pinchStateListener.remove();
      fingerPositionListener.remove();
      settingsListener.remove();
    };
  }, [isDrawing, width, height, settings.enabled]);
  
  // Drawing canvas renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set drawing styles
    ctx.lineWidth = settings.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    // Draw all completed paths
    paths.forEach(path => drawPath(ctx, path));
    
    // Draw the current active path
    if (currentPath) {
      drawPath(ctx, currentPath);
    }
    
    // Draw feature points if enabled
    if (settings.showFeatures) {
      orbFeatureDetector.drawFeatures(ctx, width, height);
    }
    
    // Publish the current ROIs to the event bus
    const rois = paths.filter(path => path.isROI && path.isComplete);
    if (rois.length > 0) {
      dispatch(EventType.SETTINGS_VALUE_CHANGE, {
        section: 'drawing',
        setting: 'activeROIs',
        value: rois
      });
    }
  }, [paths, currentPath, width, height, settings]);
  
  // Process video frames for feature detection
  useEffect(() => {
    // Only run feature detection when there are completed ROIs
    const completedROIs = paths.filter(path => path.isROI && path.isComplete);
    
    // Make sure the ROIs are added to the feature detector
    completedROIs.forEach(roi => {
      // Check if this ROI has already been added to the feature detector
      // by looking at the existing IDs
      const existingROIs = orbFeatureDetector.getROIs();
      const existingROIIds = existingROIs.map(r => r.id);
      
      // If there's a new ROI that isn't in the feature detector, add it
      if (roi.isComplete && roi.id && !existingROIIds.includes(roi.id) && roi.points.length >= 3) {
        orbFeatureDetector.addROI(roi);
      }
    });
    
    if (completedROIs.length === 0) return;
    
    // Set up animation frame for feature detection
    let animationFrameId: number;
    let videoElement: HTMLVideoElement | null = null;
    
    // Find the first video element
    const videos = document.getElementsByTagName('video');
    if (videos.length > 0) {
      videoElement = videos[0];
    }
    
    // Process frames for feature detection
    const processFrame = () => {
      if (videoElement && videoElement.readyState >= 2) {
        const frameData = getVideoFrame(videoElement);
        if (frameData) {
          orbFeatureDetector.processFrame(frameData);
        }
      }
      
      // Request next frame
      animationFrameId = requestAnimationFrame(processFrame);
    };
    
    // Start processing
    animationFrameId = requestAnimationFrame(processFrame);
    
    // Clean up on component unmount
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [paths]);
  
  // Draw a path to the canvas
  const drawPath = (ctx: CanvasRenderingContext2D, path: DrawingPath) => {
    if (path.points.length < 2) return;
    
    const points = path.points;
    
    // Start a new path
    ctx.beginPath();
    ctx.strokeStyle = settings.strokeColor;
    
    // Move to the first point
    ctx.moveTo(points[0].x, points[0].y);
    
    // Connect all the points
    for (let i = 1; i < points.length; i++) {
      if (settings.smoothing && i > 1 && i < points.length - 1) {
        // Create a smooth curve using the average of current and next point
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      } else {
        // Regular line to next point
        ctx.lineTo(points[i].x, points[i].y);
      }
    }
    
    // If this is an ROI and is complete or we're using auto-close, close the path
    if (path.isROI && (path.isComplete || settings.autoClose)) {
      ctx.closePath();
      
      // Fill the ROI with transparent color
      ctx.fillStyle = `${settings.fillColor}${Math.round(settings.fillOpacity * 255).toString(16).padStart(2, '0')}`;
      ctx.fill();
    }
    
    // Stroke the path
    ctx.stroke();
  };
  
  // Handle pinch state changes
  const handlePinchStateChange = (isPinching: boolean, position: { x: number, y: number }) => {
    // Start drawing when pinching begins
    if (isPinching && !isDrawing) {
      startDrawing(position.x * width, position.y * height);
    } 
    // Stop drawing when pinching ends
    else if (!isPinching && isDrawing) {
      stopDrawing();
    }
  };
  
  // Start a new drawing path
  const startDrawing = (x: number, y: number) => {
    const newPath: DrawingPath = {
      id: Date.now().toString(), // Add a unique ID based on timestamp
      points: [{ x, y }],
      isComplete: false,
      isROI: settings.mode === 'roi'
    };
    
    setCurrentPath(newPath);
    setIsDrawing(true);
    
    // Notify that drawing has started
    dispatch(EventType.LOG, {
      message: `Started ${settings.mode === 'roi' ? 'ROI selection' : 'free drawing'}`,
      type: 'info'
    });
  };
  
  // Add a point to the current path
  const addPointToPath = (x: number, y: number) => {
    if (!currentPath) return;
    
    // Add the new point to the current path
    setCurrentPath(prev => {
      if (!prev) return null;
      
      // Don't add duplicate points too close together
      const lastPoint = prev.points[prev.points.length - 1];
      const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
      
      // Only add points that are at least 5 pixels away from the last point
      if (distance < 5) return prev;
      
      return {
        ...prev,
        points: [...prev.points, { x, y }]
      };
    });
  };
  
  // Complete the current drawing path
  const stopDrawing = () => {
    if (!currentPath) return;
    
    // Add the completed path to our paths list
    const completedPath: DrawingPath = {
      ...currentPath,
      isComplete: true
    };
    
    setPaths(prev => [...prev, completedPath]);
    setCurrentPath(null);
    setIsDrawing(false);
    
    // If this is an ROI, add it to the feature detector
    if (completedPath.isROI && completedPath.points.length >= 3) {
      const roiId = orbFeatureDetector.addROI(completedPath);
      
      // Log ROI creation with the number of vertices
      dispatch(EventType.LOG, {
        message: `Created ROI with ${completedPath.points.length} vertices (ID: ${roiId})`,
        type: 'success'
      });
    } else {
      // Notify that drawing has stopped
      dispatch(EventType.LOG, {
        message: `Completed ${settings.mode === 'roi' ? 'ROI selection' : 'free drawing'}`,
        type: 'success'
      });
    }
    
    // Dispatch the new path as an event
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'drawing',
      setting: 'newPath',
      value: completedPath
    });
  };
  
  // Clear all paths
  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath(null);
    
    dispatch(EventType.LOG, {
      message: 'Canvas cleared',
      type: 'info'
    });
  };
  
  // Listen for clear canvas command
  useEffect(() => {
    const clearCanvasListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'drawing' && data.setting === 'clearCanvas' && data.value === true) {
          clearCanvas();
        }
      }
    );
    
    return () => {
      clearCanvasListener.remove();
    };
  }, []);
  
  // Sync with initialPaths when they change
  useEffect(() => {
    if (initialPaths.length > 0) {
      console.log('Initializing paths with:', initialPaths.length, 'paths');
      setPaths(initialPaths);
      
      // Add these paths to the feature detector if they are ROIs
      initialPaths.forEach(path => {
        if (path.isROI && path.isComplete && path.points.length >= 3 && path.id) {
          orbFeatureDetector.addROI(path);
        }
      });
    }
  }, [initialPaths]);
  
  // Create the canvas style - absolute positioning on top of video
  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none', // Allows clicks to pass through to elements below
    zIndex: 10 // Above video but below UI controls
  };
  
  return (
    <canvas 
      ref={canvasRef}
      width={width}
      height={height}
      style={canvasStyle}
      className={!settings.enabled ? 'hidden' : ''}
    />
  );
};

export default DrawingCanvas;