import React, { useEffect, useRef, useState } from 'react';
import { HandData, HandLandmark } from '@/lib/types';
import { EventType, addListener, dispatch } from '@/lib/eventBus';

interface HandVisualizationProps {
  handData?: HandData;
  videoElement?: HTMLVideoElement | null;
  width: number;
  height: number;
}

interface KnuckleRulerSettings {
  enabled: boolean;
  showMeasurement: boolean;
  knuckleDistanceCm: number;
}

interface CoordinateDisplaySettings {
  enabled: boolean;
  showZ: boolean;
  precision: number;
}

/**
 * HandVisualization component
 * 
 * Draws hand landmarks and connections using the rainbow color scheme
 * Each finger has its own color:
 * - Thumb: Red
 * - Index finger: Orange
 * - Middle finger: Yellow
 * - Ring finger: Green
 * - Pinky: Blue
 * - Palm connections: Indigo
 * - Wrist: Violet
 */
const HandVisualization: React.FC<HandVisualizationProps> = ({ 
  handData, 
  videoElement, 
  width, 
  height 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [debugInfo, setDebugInfo] = useState<string>('No hand data');
  // Debug information: log when this component renders
  console.log("HandVisualization component rendering");
  
  const [knuckleRulerSettings, setKnuckleRulerSettings] = useState<KnuckleRulerSettings>({
    enabled: true,
    showMeasurement: true,
    knuckleDistanceCm: 8.0
  });
  
  // State for coordinate display settings
  const [coordinateDisplay, setCoordinateDisplay] = useState<CoordinateDisplaySettings>({
    enabled: true,
    showZ: true,
    precision: 2
  });
  
  // State to store the index fingertip coordinates
  const [indexFingertipCoords, setIndexFingertipCoords] = useState<HandLandmark | null>(null);
  
  // Debug log for knuckle ruler settings
  useEffect(() => {
    console.log("Current knuckle ruler settings:", knuckleRulerSettings);
  }, [knuckleRulerSettings]);
  
  // Listen for changes to knuckle ruler settings
  useEffect(() => {
    const listener = addListener(EventType.SETTINGS_VALUE_CHANGE, (data) => {
      if (data.section === 'calibration' && data.setting === 'knuckleRuler') {
        setKnuckleRulerSettings(data.value);
      }
      
      // Listen for coordinate display settings changes
      if (data.section === 'visualizations' && data.setting === 'coordinateDisplay') {
        setCoordinateDisplay(data.value);
      }
    });
    
    return () => {
      listener.remove();
    };
  }, []);
  
  // Draw hand landmarks and connections
  useEffect(() => {
    console.log("HandVisualization useEffect triggered", { handData, width, height });
    
    if (!handData) {
      setDebugInfo('No hand data');
      return;
    }
    
    // Show how many landmarks we have
    setDebugInfo(`Landmarks: ${handData.landmarks.length}, Connections: ${handData.connections.length}`);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas ref is null");
      return;
    }
    
    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Could not get 2D context");
      return;
    }
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If we have a video element, we could draw it as a background
    // This is optional based on your visualization needs
    if (videoElement) {
      // ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    }
    
    // Draw a visual debug indicator in the corner
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 180, 30);
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Canvas size: ${width}x${height}`, 5, 20);
    
    // Draw connections first (so they appear behind landmarks)
    if (handData.connections && handData.landmarks) {
      handData.connections.forEach(connection => {
        const start = handData.landmarks[connection.start];
        const end = handData.landmarks[connection.end];
        const color = handData.colors[connection.colorIndex];
        
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
          ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.stroke();
        }
      });
    }
    
    // Draw landmarks on top of connections
    if (handData.landmarks) {
      handData.landmarks.forEach((landmark, index) => {
        // Determine the color of the landmark based on which finger it belongs to
        let colorIndex = 0;
        
        // Wrist
        if (index === 0) {
          colorIndex = 6; // violet
        }
        // Thumb
        else if (index >= 1 && index <= 4) {
          colorIndex = 0; // red
        }
        // Index finger
        else if (index >= 5 && index <= 8) {
          colorIndex = 1; // orange
        }
        // Middle finger
        else if (index >= 9 && index <= 12) {
          colorIndex = 2; // yellow
        }
        // Ring finger
        else if (index >= 13 && index <= 16) {
          colorIndex = 3; // green
        }
        // Pinky
        else if (index >= 17 && index <= 20) {
          colorIndex = 4; // blue
        }
        
        const color = handData.colors[colorIndex];
        
        // Draw the landmark point
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width, 
          landmark.y * canvas.height, 
          index === 0 ? 8 : 6, // Wrist is bigger
          0, 
          2 * Math.PI
        );
        ctx.fillStyle = color;
        ctx.fill();
        
        // Add white border around landmark for better visibility
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
    
    // Extract index fingertip coordinates (index 8 is the index fingertip)
    if (handData.landmarks && handData.landmarks.length > 8) {
      const indexFingertip = handData.landmarks[8];
      if (indexFingertip) {
        // Update the state with the latest coordinates
        setIndexFingertipCoords(indexFingertip);
      }
    }
    
    // Draw index fingertip coordinates if enabled
    if (coordinateDisplay.enabled && indexFingertipCoords) {
      // Index fingertip is highlighed in orange (colorIndex 1)
      const colorIndex = 1;
      const color = handData.colors[colorIndex];
      
      // Draw a crosshair at the index fingertip position
      const tipX = indexFingertipCoords.x * width;
      const tipY = indexFingertipCoords.y * height;
      const crosshairSize = 20;
      
      // Draw crosshair lines
      ctx.beginPath();
      ctx.moveTo(tipX - crosshairSize, tipY);
      ctx.lineTo(tipX + crosshairSize, tipY);
      ctx.moveTo(tipX, tipY - crosshairSize);
      ctx.lineTo(tipX, tipY + crosshairSize);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw circle around fingertip
      ctx.beginPath();
      ctx.arc(tipX, tipY, crosshairSize / 2, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Position for the coordinate display - right side of screen
      const displayX = width - 220;
      const displayY = 80;
      const boxWidth = 200;
      const boxHeight = coordinateDisplay.showZ ? 110 : 80;
      
      // Create a semi-transparent background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(displayX, displayY, boxWidth, boxHeight);
      
      // Add a border with the finger color
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(displayX, displayY, boxWidth, boxHeight);
      
      // Title for the coordinates box
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Index Fingertip Position', displayX + 10, displayY + 20);
      
      // Format the coordinates
      const precision = coordinateDisplay.precision;
      const xCoord = indexFingertipCoords.x.toFixed(precision);
      const yCoord = indexFingertipCoords.y.toFixed(precision);
      
      // Display the X and Y coordinates
      ctx.font = '13px monospace'; // Monospace for better alignment
      ctx.fillText(`X: ${xCoord} (${Math.round(indexFingertipCoords.x * width)}px)`, displayX + 10, displayY + 45);
      ctx.fillText(`Y: ${yCoord} (${Math.round(indexFingertipCoords.y * height)}px)`, displayX + 10, displayY + 70);
      
      // Display Z coordinate if enabled
      if (coordinateDisplay.showZ) {
        const zCoord = indexFingertipCoords.z.toFixed(precision);
        ctx.fillText(`Z: ${zCoord} (depth)`, displayX + 10, displayY + 95);
      }
    }
    
    // Draw knuckle ruler measurement if enabled
    if (knuckleRulerSettings.enabled && handData.landmarks) {
      // Log the ruler state for debugging
      console.log("Knuckle ruler is enabled:", knuckleRulerSettings.enabled);
      console.log("Show measurement:", knuckleRulerSettings.showMeasurement);
      console.log("Landmarks:", handData.landmarks.length);
      
      // The index knuckle is landmark 5, pinky knuckle is landmark 17
      const indexKnuckle = handData.landmarks[5];
      const pinkyKnuckle = handData.landmarks[17];
      
      if (indexKnuckle && pinkyKnuckle) {
        console.log("Found both index and pinky knuckles, drawing ruler");
        // Calculate the Euclidean distance between knuckles in normalized space (0-1)
        const normalizedDistance = Math.sqrt(
          Math.pow(indexKnuckle.x - pinkyKnuckle.x, 2) + 
          Math.pow(indexKnuckle.y - pinkyKnuckle.y, 2)
        );
        
        // Calculate the actual measurement in pixels
        const pixelDistance = normalizedDistance * width;
        
        // Dispatch an event with the real-time measurement
        dispatch(EventType.SETTINGS_VALUE_CHANGE, {
          section: 'calibration',
          setting: 'knuckleRulerRealtime',
          value: {
            normalizedDistance,
            pixelDistance
          }
        });
        
        // Only draw the visualization if showMeasurement is true
        if (knuckleRulerSettings.showMeasurement) {
        // Draw a line connecting the knuckles - make it much more visible
        ctx.beginPath();
        ctx.moveTo(indexKnuckle.x * canvas.width, indexKnuckle.y * canvas.height);
        ctx.lineTo(pinkyKnuckle.x * canvas.width, pinkyKnuckle.y * canvas.height);
        ctx.setLineDash([5, 3]); // Dashed line
        ctx.strokeStyle = '#ffff00'; // Bright yellow for better visibility
        ctx.lineWidth = 3; // Thicker line
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid line
        
        // Calculate the midpoint for the text
        const midX = (indexKnuckle.x + pinkyKnuckle.x) / 2 * canvas.width;
        const midY = (indexKnuckle.y + pinkyKnuckle.y) / 2 * canvas.height - 15; // Move text up a bit
        
        // Display the measurement
        const measurementText = `${knuckleRulerSettings.knuckleDistanceCm.toFixed(1)} cm`;
        
        // Create a more visible background for the text
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        const textWidth = ctx.measureText(measurementText).width;
        const padding = 6;
        ctx.fillRect(
          midX - textWidth / 2 - padding, 
          midY - 10, 
          textWidth + padding * 2, 
          24
        );
        
        // Add a border to the background
        ctx.strokeStyle = '#ffff00'; // Match the line color
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          midX - textWidth / 2 - padding, 
          midY - 10, 
          textWidth + padding * 2, 
          24
        );
        
        // Draw the text
        ctx.fillStyle = '#ffffff'; // Pure white
        ctx.font = 'bold 14px sans-serif'; // Bold and bigger font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(measurementText, midX, midY);
        
        // Reset text alignment
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        }
      }
    }
    
  }, [handData, videoElement, width, height, knuckleRulerSettings, coordinateDisplay]);
  
  return (
    <>
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ border: '1px solid rgba(255, 0, 0, 0.5)' }}
      />
      <div className="absolute top-8 left-4 z-20 bg-black/70 text-white p-2 rounded text-sm">
        Debug: {debugInfo}
      </div>
    </>
  );
};

export default HandVisualization;