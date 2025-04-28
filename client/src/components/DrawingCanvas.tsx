/**
 * Drawing Canvas Component - Fixed version for auto timer functionality
 * 
 * Provides a transparent overlay canvas for drawing with pinch gestures.
 * Supports path-based drawing and ROI selection with transparent fill.
 */
import React, { useRef, useEffect, useState } from 'react';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import orbFeatureDetector from '@/lib/orbFeatureDetector';
import { getVideoFrame } from '@/lib/cameraManager';
import { DrawingPath } from '@/lib/types';

// Educational number blocks colors (1-5) for hand parts
const FINGER_COLORS = [
  '#0000FF', // blue - thumb
  '#FF0000', // red - index (1)
  '#FF7F00', // orange - middle (2)
  '#FFFF00', // yellow - ring (3)
  '#00FF00', // green - pinky (4)
  '#808080', // gray - palm
  '#9400D3'  // violet - wrist
];

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
  const [canvasSize, setCanvasSize] = useState({ width, height });
  const [longPressDelay, setLongPressDelay] = useState(500); // 500ms default delay
  const [maxDrawingDuration, setMaxDrawingDuration] = useState(5000); // 5 seconds default max drawing time
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer for auto-ending drawing
  const pinchPositionRef = useRef<{x: number, y: number} | null>(null);
  const isPinchingRef = useRef<boolean>(false); // Track pinch state
  const isLongPressActiveRef = useRef<boolean>(false); // Track if long press is in progress
  const [settings, setSettings] = useState<DrawingSettings>({
    enabled: enabled,
    mode: 'roi',
    strokeColor: FINGER_COLORS[1], // Default to index finger (red)
    fillColor: FINGER_COLORS[1], // Default to index finger (red)
    strokeWidth: 3,
    fillOpacity: 0.2,
    autoClose: true,
    smoothing: true,
    showFeatures: true
  });
  
  // Calculate the center of a set of points
  const calculateCenter = (points: { x: number, y: number }[]): { x: number, y: number } => {
    if (points.length === 0) return { x: 0, y: 0 };
    
    const sum = points.reduce((acc, point) => {
      return { x: acc.x + point.x, y: acc.y + point.y };
    }, { x: 0, y: 0 });
    
    return { x: sum.x / points.length, y: sum.y / points.length };
  };
  
  // Calculate the average distance from center for all points
  const calculateAverageRadius = (points: { x: number, y: number }[], center: { x: number, y: number }): number => {
    if (points.length === 0) return 0;
    
    const distances = points.map(point => 
      Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2))
    );
    
    return distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
  };
  
  // Find the maximum distance between any two points in a shape
  const findShapeDiameter = (points: { x: number, y: number }[]): number => {
    if (points.length < 2) return 0;
    
    let maxDistance = 0;
    
    // Check distance between all pairs of points
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > maxDistance) {
          maxDistance = distance;
        }
      }
    }
    
    return maxDistance;
  };
  
  // Calculate the maximum distance from center for any point
  const calculateMaxDistance = (points: { x: number, y: number }[]): number => {
    if (points.length === 0) return 0;
    
    const center = calculateCenter(points);
    
    let maxDistance = 0;
    for (const point of points) {
      const distance = Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2));
      maxDistance = Math.max(maxDistance, distance);
    }
    
    // Return the diameter (2 * radius) for better size approximation
    return maxDistance * 2;
  };
  
  // Add point to the current path
  const addPointToPath = (x: number, y: number) => {
    if (!currentPath) return;
    
    // Check if we already have points
    if (currentPath.points.length > 0) {
      // Calculate distance from last point
      const lastPoint = currentPath.points[currentPath.points.length - 1];
      const dx = x - lastPoint.x;
      const dy = y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only add the point if it's a significant distance from the last point
      // This prevents too many points in the same spot
      if (distance < 5) {
        console.log(`  Point too close to last point (${Math.round(distance)}px), skipping`);
        return;
      }
      
      console.log(`  Added point at distance ${Math.round(distance)}px from last point`);
    }
    
    console.log(`Adding point: (${Math.round(x)}, ${Math.round(y)})`);
    
    // Add the point to the current path
    setCurrentPath(prev => {
      if (!prev) return null;
      return {
        ...prev,
        points: [...prev.points, { x, y }]
      };
    });
  };
  
  // Initiate and manage a long press
  const handlePinchStateChange = (isPinching: boolean, position: { x: number, y: number }, fingerId?: number) => {
    console.log(`Pinch state change: isPinching=${isPinching}, position=(${position.x}, ${position.y}), isDrawing=${isDrawing}`);
    
    // Update our pinch state ref for other functions to access
    isPinchingRef.current = isPinching;
    
    // Save the position for other functions
    pinchPositionRef.current = position;
    
    // CASE 1: Starting a pinch (potential start of drawing)
    if (isPinching && !isDrawing && !longPressTimerRef.current) {
      console.log('Starting long press timer for drawing');
      
      // Start a long press timer
      longPressTimerRef.current = setTimeout(() => {
        console.log('Long press timer completed');
        
        // Check if we're still pinching when the timer completes
        if (isPinchingRef.current) {
          console.log('Long press detected, now starting to draw');
          
          // Set long press as active
          isLongPressActiveRef.current = true;
          
          // Start a new drawing path using the saved position
          if (pinchPositionRef.current) {
            startDrawing(pinchPositionRef.current.x, pinchPositionRef.current.y, fingerId);
            console.log(`Started drawing at (${pinchPositionRef.current.x}, ${pinchPositionRef.current.y})`);
          }
        } else {
          console.log('Long press timer completed, but pinch already released');
          isLongPressActiveRef.current = false;
        }
        
        // Clear the timer reference
        longPressTimerRef.current = null;
      }, longPressDelay);
    } 
    // CASE 2: Continue drawing when already drawing and still pinching
    else if (isPinching && isDrawing) {
      // Add the current point to the path
      console.log('Continuing drawing with thumb pinch at:', position);
      addPointToPath(position.x, position.y);
    }
    // CASE 3: Pinch released
    else if (!isPinching) {
      console.log('Pinch released, was drawing:', isDrawing);
      
      // Clear any pending long press timer
      if (longPressTimerRef.current) {
        console.log('Canceling long press timer due to pinch release');
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        isLongPressActiveRef.current = false;
      }
      
      // Reset the saved position
      pinchPositionRef.current = null;
      
      // Stop drawing if we were drawing
      if (isDrawing) {
        console.log('Stopping drawing with points:', currentPath ? currentPath.points.length : 0);
        stopDrawing();
      }
    }
  };
  
  // Start a new drawing path
  const startDrawing = (x: number, y: number, fingerId?: number) => {
    // Always use index finger (color index 1)
    const colorIndex = 1;
    
    const newPath: DrawingPath = {
      id: Date.now().toString(), // Add a unique ID based on timestamp
      points: [{ x, y }],
      isComplete: false,
      isROI: settings.mode === 'roi',
      colorIndex: colorIndex, // Always use index finger color (red)
      fingerId: 1            // Always use index finger (fingerId = 1)
    };
    
    setCurrentPath(newPath);
    setIsDrawing(true);
    
    // Start the auto drawing timeout timer
    startDrawingTimeout();
    
    // Notify that drawing has started
    dispatch(EventType.LOG, {
      message: `Started ${settings.mode === 'roi' ? 'ROI selection' : 'free drawing'}`,
      type: 'info'
    });
  };

  // Set up the auto-end drawing timer
  const startDrawingTimeout = () => {
    // Clear any existing timer first
    if (drawingTimeoutRef.current) {
      clearTimeout(drawingTimeoutRef.current);
      drawingTimeoutRef.current = null;
      console.log('Cleared existing drawing timeout timer');
    }
    
    console.log(`Setting new auto-end drawing timer for ${maxDrawingDuration}ms (${maxDrawingDuration/1000} seconds)`);
    
    // Set a new timer to automatically end drawing after the configured time
    drawingTimeoutRef.current = setTimeout(() => {
      console.log(`======= AUTO-END TIMER TRIGGERED =======`);
      console.log(`Drawing timeout reached (${maxDrawingDuration}ms), automatically completing ROI`);
      console.log(`Current state: isDrawing=${isDrawing}, currentPath=${currentPath ? 'exists' : 'null'}`);
      
      if (isDrawing && currentPath) {
        console.log(`Current path has ${currentPath.points.length} points`);
        
        // End the drawing
        dispatch(EventType.NOTIFICATION, {
          message: `Drawing auto-completed after ${maxDrawingDuration/1000} seconds`,
          type: 'info'
        });
        
        // Important: Call stopDrawing to complete the path and create the ROI
        stopDrawing();
        console.log('Auto-end timer called stopDrawing()');
      } else {
        console.log('Drawing timeout reached but no current path or not drawing');
      }
      
      drawingTimeoutRef.current = null;
    }, maxDrawingDuration);
    
    console.log(`Set auto drawing timeout with ID: ${drawingTimeoutRef.current}`);
  };
  
  // Complete the current drawing path
  const stopDrawing = () => {
    console.log('stopDrawing called - current state:', { 
      isDrawing, 
      hasCurrentPath: currentPath ? true : false,
      pointCount: currentPath ? currentPath.points.length : 0
    });
    
    if (!currentPath) {
      console.log('No current path to complete');
      return;
    }
    
    // Clear the drawing timeout timer since we're stopping manually
    if (drawingTimeoutRef.current) {
      clearTimeout(drawingTimeoutRef.current);
      drawingTimeoutRef.current = null;
      console.log('Cleared existing drawing timeout timer in stopDrawing');
    }
    
    let finalPoints = [...currentPath.points];
    let finalPathDescription = 'custom shape';
    
    // For AR MPE drumpad applications, we always use circular ROIs based on drawn diameter
    if (currentPath.isROI) {
      // First validate that we have enough points to work with
      if (currentPath.points.length < 3) {
        // Create a default circle at the single point
        const point = currentPath.points[0];
        const center = { x: point.x, y: point.y };
        const radius = 50; // Default radius for single point (100px diameter)
        
        // Generate circle points
        finalPoints = [];
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          finalPoints.push({
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle)
          });
        }
        finalPathDescription = 'circle (default size)';
        console.log(`Created default circle with radius ${radius}px at (${center.x}, ${center.y})`);
      } 
      else {
        // We have enough points for a proper shape
        console.log(`Processing ${currentPath.points.length} points for ROI creation`);
        
        // Keep all points for better size measurement - no simplification for diameter calculation
        const allPoints = [...currentPath.points];
        
        // Calculate the center point of the drawing
        const center = calculateCenter(allPoints);
        
        // Find the diameter based on farthest points (the true maximum width of drawing)
        const diameter = findShapeDiameter(allPoints);
        const radius = Math.max(diameter / 2, 30); // Ensure minimum 30px radius
        
        console.log(`Measured drawing diameter: ${diameter}px (radius: ${radius}px)`);
        console.log(`Creating circle with center (${Math.round(center.x)}, ${Math.round(center.y)}) and radius ${Math.round(radius)}px`);
        
        // Create a perfect circle with this diameter
        finalPoints = [];
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          finalPoints.push({
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle)
          });
        }
        finalPathDescription = 'circle (matched size)';
      }
    }
    
    // Add the completed path to our paths list with the new points
    const completedPath: DrawingPath = {
      ...currentPath,
      points: finalPoints,
      isComplete: true
    };
    
    setPaths(prev => [...prev, completedPath]);
    setCurrentPath(null);
    setIsDrawing(false);
    
    // If this is an ROI, add it to the feature detector
    if (completedPath.isROI) {
      const roiId = orbFeatureDetector.addROI(completedPath);
      
      // Log ROI creation with the number of vertices and shape
      dispatch(EventType.LOG, {
        message: `Created ROI ${finalPathDescription} with ${completedPath.points.length} vertices (ID: ${roiId})`,
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
  
  // Listen for pinch events from MediaPipeHandTracker
  useEffect(() => {
    // Find the video element to get actual display size
    const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
    let videoDisplayWidth = width;
    let videoDisplayHeight = height;
    
    if (videoElement) {
      // Get the actual display size of the video element
      const displayRect = videoElement.getBoundingClientRect();
      videoDisplayWidth = displayRect.width;
      videoDisplayHeight = displayRect.height;
      
      // Log for debugging
      console.log(`Video display size: ${videoDisplayWidth}x${videoDisplayHeight}`);
      console.log(`Canvas size: ${canvasSize.width}x${canvasSize.height}`);
    }
    
    // Listen for maxDrawingDuration setting changes
    const maxDurationListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        // Listen for max drawing duration settings changes
        if (data.section === 'drawing' && data.setting === 'maxDrawingDuration' && typeof data.value === 'number') {
          console.log('Updating max drawing duration to', data.value, 'ms');
          setMaxDrawingDuration(data.value);
          
          // If we're currently drawing, reset the drawing timeout with the new duration
          if (isDrawing && currentPath) {
            startDrawingTimeout();
          }
        }
      }
    );
    
    const pinchStateListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        // Handle pinch gesture state changes
        if (data.section === 'gestures' && data.setting === 'pinchState' && settings.enabled) {
          const { isPinching, distance, fingerId, activeFinger } = data.value;
          
          console.log(`Received pinch event - isPinching: ${isPinching}, distance: ${distance.toFixed(3)}`);
          
          // Debug which finger is being used (always index finger now)
          if (fingerId !== undefined) {
            console.log(`Active finger: ${activeFinger} (ID: ${fingerId})`);
          }
          
          // Get the fingertip position from event bus
          if (data.value.position) {
            // The position already comes in pixel coordinates from MediaPipeHandTracker
            // We don't need to scale - just use directly
            const position = data.value.position;
            
            console.log(`Pinch position: (${position.x}, ${position.y})`);
            
            // Handle the pinch state change with the position
            handlePinchStateChange(isPinching, { x: position.x, y: position.y }, fingerId);
          }
        }
      }
    );
    
    // Listen for finger position updates
    const fingerPositionListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'tracking' && data.setting === 'thumbPosition' && settings.enabled) {
          const position = data.value;
          
          // Always use index finger color (red)
          if (position) {
            // Update stroke and fill colors to always use index finger color
            setSettings(prev => ({
              ...prev,
              strokeColor: FINGER_COLORS[1], // Index finger color (red)
              fillColor: FINGER_COLORS[1]    // Index finger color (red) 
            }));
          }
          
          if (isDrawing && position && currentPath && currentPath.points.length > 0) {
            // No need to scale - coordinates are already in pixel space from MediaPipeHandTracker
            // Just use them directly
            
            // Add point to our current drawing path
            addPointToPath(position.x, position.y);
            
            // Log for debugging
            console.log(`Continuing drawing with thumb at (${Math.round(position.x)}, ${Math.round(position.y)})`);
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
        
        // Listen for long press delay settings changes
        if (data.section === 'drawing' && data.setting === 'longPressDelay' && typeof data.value === 'number') {
          console.log('Updating long press delay to', data.value, 'ms');
          setLongPressDelay(data.value);
        }
      }
    );
    
    return () => {
      pinchStateListener.remove();
      fingerPositionListener.remove();
      settingsListener.remove();
      maxDurationListener.remove();
      
      // Clean up the long press timer if component unmounts
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      
      // Clean up the drawing timeout timer
      if (drawingTimeoutRef.current) {
        clearTimeout(drawingTimeoutRef.current);
        drawingTimeoutRef.current = null;
      }
    };
  }, [isDrawing, width, height, settings.enabled, currentPath, longPressDelay, maxDrawingDuration]);
  
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
  
  // Clear previous paths when creating a new ROI
  useEffect(() => {
    if (isDrawing && currentPath && currentPath.isROI) {
      // If we're drawing a new ROI, clear previous paths
      setPaths([]);
      
      // Also clear the ROIs
      orbFeatureDetector.clearROIs();
    }
  }, [isDrawing, currentPath]);
  
  // Drawing canvas renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas - using canvasSize state
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
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
    
    // Publish the current ROIs to the event bus
    const rois = paths.filter(path => path.isROI && path.isComplete);
    if (rois.length > 0) {
      dispatch(EventType.SETTINGS_VALUE_CHANGE, {
        section: 'drawing',
        setting: 'activeROIs',
        value: rois
      });
    }
  }, [paths, currentPath, canvasSize, settings]);
  
  // ROI Management
  useEffect(() => {
    // Only track completed ROIs
    const completedROIs = paths.filter(path => path.isROI && path.isComplete);
    
    // Make sure the ROIs are added to the ROI manager
    completedROIs.forEach(roi => {
      // Add the ROI if it has enough points and is complete
      if (roi.isComplete && roi.id && roi.points.length >= 3) {
        orbFeatureDetector.addROI(roi);
      }
    });
    
    // No frame processing needed anymore since we removed feature detection
  }, [paths]);
  
  // Update canvas size when width/height props change or when viewport size changes
  useEffect(() => {
    // Function to update canvas size based on video display dimensions
    const updateCanvasSize = () => {
      // Find the video element to get actual display size
      const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
      
      if (videoElement) {
        // Get the actual display size of the video element
        const displayRect = videoElement.getBoundingClientRect();
        const videoDisplayWidth = displayRect.width;
        const videoDisplayHeight = displayRect.height;
        
        // Only update if dimensions have changed
        if (videoDisplayWidth !== canvasSize.width || videoDisplayHeight !== canvasSize.height) {
          console.log(`Canvas size updated to match video: ${videoDisplayWidth}x${videoDisplayHeight}`);
          setCanvasSize({ width: videoDisplayWidth, height: videoDisplayHeight });
          
          // Resize canvas element
          if (canvasRef.current) {
            canvasRef.current.width = videoDisplayWidth;
            canvasRef.current.height = videoDisplayHeight;
          }
          
          // Log for debugging
          dispatch(EventType.LOG, {
            message: `Drawing canvas resized to ${videoDisplayWidth}x${videoDisplayHeight}`,
            type: 'info'
          });
        }
      } else if (width !== canvasSize.width || height !== canvasSize.height) {
        // Fallback to props if video element isn't available
        console.log(`Canvas size updated from props: ${width}x${height}`);
        setCanvasSize({ width, height });
        
        // Resize canvas element
        if (canvasRef.current) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
        }
      }
    };
    
    // Initial update
    updateCanvasSize();
    
    // Also listen for window resize events
    window.addEventListener('resize', updateCanvasSize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [width, height, canvasSize.width, canvasSize.height]);
  
  // Draw a path to the canvas
  const drawPath = (ctx: CanvasRenderingContext2D, path: DrawingPath) => {
    if (path.points.length < 1) return;
    
    const points = path.points;
    
    // Start a new path
    ctx.beginPath();
    
    // Set different stroke styles based on whether the path is active or completed
    if (!path.isComplete) {
      // Actively drawing - use a thicker, more vibrant line
      ctx.strokeStyle = settings.strokeColor;
      ctx.lineWidth = settings.strokeWidth + 2; // Slightly thicker for active drawing
    } else {
      // Completed path - use the normal stroke style
      ctx.strokeStyle = settings.strokeColor;
      ctx.lineWidth = settings.strokeWidth;
    }
    
    // For single point (just starting), draw a circle
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
      ctx.fillStyle = settings.strokeColor;
      ctx.fill();
      return;
    }
    
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
    
    // If this is an ROI
    if (path.isROI) {
      // Draw line between last point and first point
      if (path.isComplete || settings.autoClose) {
        if (points.length > 2) {
          ctx.closePath();
        }
      }
      
      // Clean, minimalistic look for completed paths
      if (path.isComplete) {
        // Fill the ROI with transparent color
        ctx.fillStyle = `${settings.fillColor}${Math.round(settings.fillOpacity * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
        
        // Add ID number to the center of the ROI
        if (path.id) {
          // Calculate center of the ROI
          const center = calculateCenter(points);
          
          // Extract numerical ID from the ROI ID (which is a timestamp string)
          let idNumber;
          
          if (path.colorIndex !== undefined) {
            // If a specific color index was saved with the path, use that for the ID number
            idNumber = path.colorIndex;
          } else {
            // Otherwise generate a sequential ID based on the color
            // Get color from the stroke style and find its index in FINGER_COLORS
            const pathColor = ctx.strokeStyle.toString();
            // Find index in FINGER_COLORS (defaults to 1 if not found)
            const colorIndex = FINGER_COLORS.indexOf(pathColor);
            idNumber = colorIndex > 0 ? colorIndex : 1;
          }
          
          // Draw ID number
          ctx.font = 'bold 24px sans-serif';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(idNumber.toString(), center.x, center.y);
        }
      }
    }
    
    // Stroke the path
    ctx.stroke();
    
    // Draw feature points if enabled and this is an ROI
    if (settings.showFeatures && path.isROI && path.isComplete && path.id) {
      // Get all ROIs
      const rois = orbFeatureDetector.getROIs();
      // Find the matching ROI by ID
      const roi = rois.find(r => r.id === path.id);
      
      if (roi && roi.features && roi.features.length > 0) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
        
        for (const feature of roi.features) {
          ctx.beginPath();
          ctx.arc(feature.x, feature.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };
  
  // Create the canvas style - absolute positioning on top of video
  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',        // Fill the entire container
    height: '100%',       // Fill the entire container
    pointerEvents: 'none', // Allows clicks to pass through to elements below
    zIndex: 10,           // Above video but below UI controls
    objectFit: 'cover'    // Cover the entire area without stretching
  };
  
  return (
    <canvas 
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      style={canvasStyle}
      className={!settings.enabled ? 'hidden' : ''}
    />
  );
};

export default DrawingCanvas;