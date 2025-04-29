import React, { useEffect, useState, useRef } from 'react';
import { addListener, EventType } from '@/lib/eventBus';

interface FpsReading {
  timestamp: number;
  fps: number;
}

/**
 * FPS Stats Component
 * 
 * Displays realtime and average FPS metrics
 */
const FpsStats: React.FC = () => {
  const [currentFps, setCurrentFps] = useState<number>(0);
  const [avg5sFps, setAvg5sFps] = useState<number>(0);
  const [avg10sFps, setAvg10sFps] = useState<number>(0);
  
  // Store historical FPS readings for calculating averages
  const fpsReadingsRef = useRef<FpsReading[]>([]);
  
  useEffect(() => {
    // Listen for frame processed events to calculate FPS
    const frameProcessedListener = addListener(
      EventType.FRAME_PROCESSED,
      (data) => {
        if (data && data.performance) {
          const now = performance.now();
          
          // Get fps from performance metrics
          const instantFps = data.performance.fps || 0;
          const rollingAvgFps = data.performance.fpsRollingAvg || instantFps;
          
          // If the fps is extremely high, it might be a miscalculation, cap it
          const cappedFps = Math.min(instantFps, 120); // Cap at 120fps
          setCurrentFps(Math.round(cappedFps));
          
          // Add the new reading to history for our own averaging
          fpsReadingsRef.current.push({
            timestamp: now,
            fps: cappedFps
          });
          
          // Use the rolling average from the worker if available
          if (rollingAvgFps) {
            setAvg5sFps(Math.round(Math.min(rollingAvgFps, 120)));
          } else {
            // Calculate 5s average as fallback
            const fiveSecondsAgo = now - 5000;
            const readings5s = fpsReadingsRef.current.filter(
              reading => reading.timestamp >= fiveSecondsAgo
            );
            
            if (readings5s.length > 0) {
              const sum5s = readings5s.reduce((sum, reading) => sum + reading.fps, 0);
              setAvg5sFps(Math.round(sum5s / readings5s.length));
            }
          }
          
          // Calculate 10s average
          const tenSecondsAgo = now - 10000;
          const readings10s = fpsReadingsRef.current.filter(
            reading => reading.timestamp >= tenSecondsAgo
          );
          
          if (readings10s.length > 0) {
            const sum10s = readings10s.reduce((sum, reading) => sum + reading.fps, 0);
            setAvg10sFps(Math.round(sum10s / readings10s.length));
          }
          
          // Clean up old readings (older than 10 seconds)
          fpsReadingsRef.current = fpsReadingsRef.current.filter(
            reading => reading.timestamp >= tenSecondsAgo
          );
        }
      }
    );
    
    return () => {
      frameProcessedListener.remove();
    };
  }, []);
  
  return (
    <div className="absolute bottom-16 left-4 z-10 p-2 bg-black/70 rounded-md text-white text-xs font-mono">
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-white/70">FPS</div>
          <div className="text-lg font-bold">{currentFps}</div>
        </div>
        <div className="text-center">
          <div className="text-white/70">5s avg</div>
          <div className="text-lg font-bold">{avg5sFps}</div>
        </div>
        <div className="text-center">
          <div className="text-white/70">10s avg</div>
          <div className="text-lg font-bold">{avg10sFps}</div>
        </div>
      </div>
    </div>
  );
};

export default FpsStats;