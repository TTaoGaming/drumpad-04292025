import React, { useEffect, useState, useRef } from 'react';
import { addListener, EventType } from '@/lib/eventBus';

interface FpsReading {
  timestamp: number;
  fps: number;
}

interface PerformanceData {
  [key: string]: number;
}

interface ModuleTimings {
  name: string;
  time: number;
  percentage: number;
}

interface PerformanceMetricsProps {
  performance?: PerformanceData;
}

/**
 * Enhanced Performance Metrics Component
 * 
 * Displays detailed performance metrics including:
 * - Real-time FPS with rolling averages
 * - Module-specific timing information
 * - Frame processing breakdown
 */
const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ performance: perfData }) => {
  const [currentFps, setCurrentFps] = useState<number>(0);
  const [avg5sFps, setAvg5sFps] = useState<number>(0);
  const [avg10sFps, setAvg10sFps] = useState<number>(0);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [moduleTimings, setModuleTimings] = useState<ModuleTimings[]>([]);
  const [totalFrameTime, setTotalFrameTime] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  // Store historical FPS readings for calculating averages
  const fpsReadingsRef = useRef<FpsReading[]>([]);
  const performanceRef = useRef<PerformanceData>({});
  
  // Update performance reference when prop changes
  useEffect(() => {
    if (perfData) {
      performanceRef.current = {
        ...performanceRef.current,
        ...perfData
      };
    }
  }, [perfData]);

  useEffect(() => {
    // Listen for frame processed events to calculate FPS
    const frameProcessedListener = addListener(
      EventType.FRAME_PROCESSED,
      (data) => {
        if (data && data.performance) {
          const now = performance.now();
          const perfData = data.performance;
          
          // Store all performance metrics for analysis
          performanceRef.current = {
            ...performanceRef.current,
            ...perfData
          };
          
          // Get fps from performance metrics
          const instantFps = perfData.fps || 0;
          const rollingAvgFps = perfData.fpsRollingAvg || instantFps;
          
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
          
          // Process module timings for display
          const moduleData: ModuleTimings[] = [];
          let totalTime = 0;
          
          // Calculate total frame time
          if (perfData.timeBetweenFrames) {
            totalTime = perfData.timeBetweenFrames;
            setTotalFrameTime(totalTime);
          }
          
          // Extract module-specific timings
          const validKeys = [
            'frameProcessing', 
            'processResults', 
            'init',
            'contourDetection',
            'featureExtraction',
            'templateMatching',
            'roiProcessing'
          ];
          
          // Go through all performance metrics and find timing data
          Object.entries(perfData).forEach(entry => {
            const key = entry[0];
            const value = entry[1];
            
            // Skip metadata fields
            if (key === 'fps' || key === 'fpsRollingAvg' || key === 'timeBetweenFrames' || 
                key === 'workerUptime' || key.includes('_start')) {
              return;
            }
            
            // Additional sanity check - look for plausible values
            if (typeof value === 'number' && value > 0 && value < 500) {
              const percentage = totalTime > 0 ? (value / totalTime) * 100 : 0;
              moduleData.push({
                name: key,
                time: value,
                percentage: percentage
              });
            }
          });
          
          // Sort by time consumed (descending)
          moduleData.sort((a, b) => b.time - a.time);
          setModuleTimings(moduleData);
        }
      }
    );
    
    return () => {
      frameProcessedListener.remove();
    };
  }, []);
  
  // Toggle expanded view
  const toggleExpand = () => {
    setExpanded(!expanded);
  };
  
  // Toggle advanced metrics
  const toggleAdvanced = () => {
    setShowAdvanced(!showAdvanced);
  };
  
  return (
    <div className="absolute bottom-4 left-4 z-10 p-3 bg-black/80 rounded-md text-white text-xs font-mono shadow-lg transition-all">
      {/* Main display - always visible */}
      <div className="grid grid-cols-3 gap-3 mb-2" onClick={toggleExpand}>
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
      
      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/20 pt-2 mt-1">
          <div className="flex justify-between items-center mb-2">
            <div className="text-white/90 font-bold">Module Performance</div>
            <button 
              onClick={toggleAdvanced}
              className="text-xs px-2 py-1 bg-white/10 rounded hover:bg-white/20"
            >
              {showAdvanced ? 'Simple View' : 'Advanced View'}
            </button>
          </div>
          
          {/* Frame time */}
          <div className="mb-2">
            <div className="text-white/70 text-xs">Total Frame Time: {totalFrameTime.toFixed(1)}ms</div>
          </div>
          
          {/* Module timings */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {moduleTimings.map((module, index) => (
              <div key={index} className="grid grid-cols-12 gap-1 items-center">
                <div className="col-span-6 text-white/90 truncate">{module.name}</div>
                <div className="col-span-2 text-right text-white/80">{module.time.toFixed(1)}ms</div>
                <div className="col-span-4 pl-1">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${Math.min(module.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {moduleTimings.length === 0 && (
              <div className="text-white/50 italic">No module timings available</div>
            )}
          </div>
          
          {/* Advanced metrics - when toggled */}
          {showAdvanced && (
            <div className="mt-3 border-t border-white/20 pt-2">
              <div className="text-white/90 font-bold mb-2">Raw Performance Data</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {Object.entries(performanceRef.current)
                  .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
                  .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                  .map(([key, value], index) => (
                    <div key={index} className="grid grid-cols-12 gap-1">
                      <div className="col-span-8 text-white/70 truncate">{key}</div>
                      <div className="col-span-4 text-right text-white/80">
                        {typeof value === 'number' 
                          ? (value > 100 ? value.toFixed(0) : value.toFixed(2))
                          : String(value)
                        }
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
          
          <div className="text-xs text-center text-white/40 mt-2">
            Click panel to collapse
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMetrics;