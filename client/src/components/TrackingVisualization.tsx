import React, { useEffect, useRef, useState } from 'react';
import { addListener, EventType } from '@/lib/eventBus';

interface TrackingVisualizationProps {
  width: number;
  height: number;
}

// Store position history for motion trails
interface PositionHistory {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
}

// Maximum number of history points to keep in motion trail
const MAX_HISTORY_POINTS = 20;
// How long to keep history points (in ms)
const HISTORY_DURATION = 2000;

/**
 * Tracking Visualization Component
 * 
 * Creates a visually striking overlay for tracking visualization
 * designed for large displays and presentations.
 * 
 * Features:
 * - Circular confidence indicator that changes color based on tracking quality
 * - Motion trail showing recent movement path
 * - Rotation indicator for orientation
 * - Smooth animations for all elements
 */
const TrackingVisualization: React.FC<TrackingVisualizationProps> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [positionHistory, setPositionHistory] = useState<{[roiId: string]: PositionHistory[]}>({});
  
  // Convert ROI coordinates to canvas coordinates
  const mapToCanvas = (x: number, y: number, sourceWidth: number, sourceHeight: number) => {
    return {
      x: (x / sourceWidth) * width,
      y: (y / sourceHeight) * height
    };
  };
  
  useEffect(() => {
    // Listen for tracking data updates
    const listener = addListener(EventType.ROI_UPDATED, (data) => {
      if (!data) return;
      
      // Update current tracking data
      setTrackingData(data);
      
      // Update position history
      if (data.isTracked && data.center) {
        setPositionHistory(prev => {
          const roiId = data.roiId || 'default';
          const now = Date.now();
          
          // Filter out old history points
          const filteredHistory = (prev[roiId] || [])
            .filter(p => now - p.timestamp < HISTORY_DURATION);
          
          // Add new point
          const newPoint: PositionHistory = {
            x: data.center.x,
            y: data.center.y,
            confidence: data.confidence,
            timestamp: now
          };
          
          // Limit history size
          const newHistory = [...filteredHistory, newPoint].slice(-MAX_HISTORY_POINTS);
          
          return {
            ...prev,
            [roiId]: newHistory
          };
        });
      }
    });
    
    return () => {
      listener.remove();
    };
  }, []);
  
  // Draw visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // If no tracking data, exit
    if (!trackingData || !trackingData.isTracked) return;
    
    const { 
      centerX, 
      centerY, 
      radius, 
      sourceWidth, 
      sourceHeight,
      confidence = 0.5,
      rotation = 0,
      roiId = 'default' 
    } = trackingData;
    
    // Map ROI center to canvas coordinates
    const canvasCenter = mapToCanvas(centerX, centerY, sourceWidth, sourceHeight);
    
    // Calculate scaled radius for canvas
    const canvasRadius = (radius / sourceWidth) * width;
    
    // Draw history trail
    const history = positionHistory[roiId] || [];
    if (history.length > 1) {
      ctx.beginPath();
      
      // Start from oldest point
      const startPoint = mapToCanvas(
        history[0].x, 
        history[0].y, 
        sourceWidth, 
        sourceHeight
      );
      
      ctx.moveTo(startPoint.x, startPoint.y);
      
      // Draw trail with gradient opacity
      history.forEach((point, index) => {
        if (index === 0) return; // Skip first point, we already moved to it
        
        const pos = mapToCanvas(point.x, point.y, sourceWidth, sourceHeight);
        const alpha = (index / history.length) * 0.7 + 0.1;
        const hue = Math.min(120, point.confidence * 120);
        
        ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
        ctx.lineWidth = 8 * alpha;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        
        // Start a new segment
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      });
    }
    
    // Draw confidence ring
    const hue = Math.min(120, confidence * 120); // 0=red, 120=green
    const gradientRadius = canvasRadius * 1.5;
    
    // Create radial gradient for the ring
    const gradient = ctx.createRadialGradient(
      canvasCenter.x, canvasCenter.y, canvasRadius * 0.8,
      canvasCenter.x, canvasCenter.y, gradientRadius
    );
    
    gradient.addColorStop(0, `hsla(${hue}, 100%, 50%, 0.1)`);
    gradient.addColorStop(0.7, `hsla(${hue}, 100%, 50%, 0.3)`);
    gradient.addColorStop(0.9, `hsla(${hue}, 100%, 60%, 0.5)`);
    gradient.addColorStop(1, `hsla(${hue}, 100%, 70%, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(canvasCenter.x, canvasCenter.y, gradientRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw pulsing circle outline
    const pulseOffset = Math.sin(Date.now() / 200) * 5; // Subtle pulsing effect
    ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      canvasCenter.x, 
      canvasCenter.y, 
      canvasRadius + pulseOffset, 
      0, 
      Math.PI * 2
    );
    ctx.stroke();
    
    // Draw rotation indicator (direction arrow)
    if (rotation !== undefined) {
      const arrowLength = canvasRadius * 1.2;
      const endX = canvasCenter.x + Math.cos(rotation) * arrowLength;
      const endY = canvasCenter.y + Math.sin(rotation) * arrowLength;
      
      // Add glow effect
      ctx.shadowColor = `hsla(${hue + 30}, 100%, 50%, 0.8)`;
      ctx.shadowBlur = 15;
      
      // Draw line
      ctx.strokeStyle = `hsla(${hue + 60}, 100%, 70%, 0.9)`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(canvasCenter.x, canvasCenter.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      // Draw arrow head
      ctx.fillStyle = `hsla(${hue + 60}, 100%, 70%, 0.9)`;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      
      const arrowSize = canvasRadius * 0.2;
      ctx.lineTo(
        endX - arrowSize * Math.cos(rotation - Math.PI/6),
        endY - arrowSize * Math.sin(rotation - Math.PI/6)
      );
      ctx.lineTo(
        endX - arrowSize * Math.cos(rotation + Math.PI/6),
        endY - arrowSize * Math.sin(rotation + Math.PI/6)
      );
      
      ctx.closePath();
      ctx.fill();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    
    // Draw confidence indicator text for large displays
    if (width > 800) {
      const confidencePercent = Math.round(confidence * 100);
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.9)`;
      ctx.fillText(
        `${confidencePercent}%`, 
        canvasCenter.x, 
        canvasCenter.y + canvasRadius + 25
      );
    }
    
    // Request next frame
    requestAnimationFrame(() => {
      // This triggers re-render without state updates
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.globalAlpha = 0.999; // Tiny change to force repaint
      }
    });
  }, [trackingData, positionHistory, width, height]);
  
  return (
    <canvas 
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none', // Allow interaction with elements below
        zIndex: 50, // Above the video but below the UI controls
      }}
    />
  );
};

export default TrackingVisualization;