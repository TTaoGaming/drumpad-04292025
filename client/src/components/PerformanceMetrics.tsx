import React, { useEffect, useState, useRef } from 'react';
import { addListener, EventType } from '@/lib/eventBus';
import { Activity, BarChart3, ChevronDown, ChevronUp, X, Timer } from 'lucide-react';

interface FpsReading {
  timestamp: number;
  fps: number;
}

interface ModuleTiming {
  moduleId: string;
  duration: number;
}

/**
 * FPS Stats Component
 * 
 * Displays realtime and average FPS metrics with optional module timings
 */
const FpsStats: React.FC = () => {
  const [currentFps, setCurrentFps] = useState<number>(0);
  const [avg5sFps, setAvg5sFps] = useState<number>(0);
  const [avg10sFps, setAvg10sFps] = useState<number>(0);
  const [showModuleTimes, setShowModuleTimes] = useState<boolean>(false);
  const [moduleTimes, setModuleTimes] = useState<ModuleTiming[]>([]);
  
  // Store historical FPS readings for calculating averages
  const fpsReadingsRef = useRef<FpsReading[]>([]);
  
  useEffect(() => {
    // Listen for frame processed events to calculate FPS
    const frameProcessedListener = addListener(
      EventType.FRAME_PROCESSED,
      (data) => {
        console.log('FpsStats received event:', data);
        if (data && data.performance) {
          const now = performance.now();
          console.log('Performance data:', data.performance);
          
          // Handle FPS data
          if (data.performance.fps) {
            console.log('Setting FPS:', data.performance.fps);
            setCurrentFps(Math.round(data.performance.fps));
            
            // Add the new reading to history
            fpsReadingsRef.current.push({
              timestamp: now,
              fps: data.performance.fps
            });
            
            // Calculate 5s average
            const fiveSecondsAgo = now - 5000;
            const readings5s = fpsReadingsRef.current.filter(
              reading => reading.timestamp >= fiveSecondsAgo
            );
            
            if (readings5s.length > 0) {
              const sum5s = readings5s.reduce((sum, reading) => sum + reading.fps, 0);
              setAvg5sFps(Math.round(sum5s / readings5s.length));
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
          
          // Process module timings
          const newModuleTimes: ModuleTiming[] = [];
          Object.entries(data.performance).forEach(([moduleId, duration]) => {
            // Skip fps as it's not a module time
            if (moduleId === 'fps') return;
            
            newModuleTimes.push({
              moduleId: formatModuleId(moduleId),
              duration: duration as number
            });
          });
          
          // Sort by duration (highest first) and update state
          if (newModuleTimes.length > 0) {
            newModuleTimes.sort((a, b) => b.duration - a.duration);
            setModuleTimes(newModuleTimes);
          }
        }
      }
    );
    
    return () => {
      frameProcessedListener.remove();
    };
  }, []);
  
  // Format module ID for better readability
  const formatModuleId = (id: string): string => {
    return id
      // Insert spaces before capitals
      .replace(/([A-Z])/g, ' $1')
      // Replace underscores with spaces
      .replace(/_/g, ' ')
      // Capitalize first letter
      .replace(/^./, str => str.toUpperCase())
      // Remove trailing "Ms" if present
      .replace(/Ms$/, '')
      .trim();
  };
  
  // Calculate frame time (ms) from current FPS
  const frameTimeMs = currentFps > 0 ? (1000 / currentFps).toFixed(1) : '0';
  
  // Determine status color based on FPS ranges
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return 'text-green-400'; // Excellent
    if (fps >= 45) return 'text-lime-400';  // Good
    if (fps >= 30) return 'text-yellow-400'; // Acceptable
    if (fps >= 20) return 'text-orange-400'; // Poor
    return 'text-red-400'; // Bad
  };
  
  const toggleModuleTimes = () => {
    setShowModuleTimes(!showModuleTimes);
  };
  
  return (
    <div className="absolute bottom-4 left-4 z-50 px-3 py-2 bg-black/85 backdrop-blur-sm rounded-md border border-white/10 text-white shadow-lg">
      {/* Header with toggle */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center">
          <Activity size={14} className="mr-1 text-white/70" />
          <span className="text-xs font-medium">Performance Metrics</span>
        </div>
        
        <div className="flex gap-1">
          {/* Module Times Toggle */}
          <button 
            onClick={toggleModuleTimes}
            className="flex items-center justify-center h-5 w-5 rounded-full hover:bg-white/10 text-white/70"
            title={showModuleTimes ? "Hide module times" : "Show module times"}
          >
            <Timer size={12} />
          </button>
          
          {/* Expand/Collapse Button - for future use */}
          <button 
            className="invisible flex items-center justify-center h-5 w-5 rounded-full hover:bg-white/10 text-white/70"
            title="Expand"
          >
            {showModuleTimes ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>
      </div>
      
      {/* Main metrics display */}
      <div className="flex items-center gap-4">
        {/* Current FPS with color indicator */}
        <div className="flex flex-col items-center">
          <div className="text-xs text-white/70">FPS</div>
          <div className={`text-xl font-bold ${getFpsColor(currentFps)}`}>{currentFps}</div>
        </div>
        
        {/* Separator */}
        <div className="h-10 w-px bg-white/20"></div>
        
        {/* Averages with compact visualization */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="text-xs text-white/70 w-12">5s avg:</div>
            <div className={`text-sm font-medium ${getFpsColor(avg5sFps)}`}>{avg5sFps}</div>
            <div className="h-2 w-16 bg-gray-700 rounded overflow-hidden">
              <div 
                className={`h-full ${getFpsColor(avg5sFps)}`}
                style={{ width: `${Math.min(100, (avg5sFps / 60) * 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-xs text-white/70 w-12">10s avg:</div>
            <div className={`text-sm font-medium ${getFpsColor(avg10sFps)}`}>{avg10sFps}</div>
            <div className="h-2 w-16 bg-gray-700 rounded overflow-hidden">
              <div 
                className={`h-full ${getFpsColor(avg10sFps)}`}
                style={{ width: `${Math.min(100, (avg10sFps / 60) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        {/* Separator */}
        <div className="h-10 w-px bg-white/20"></div>
        
        {/* Frame time */}
        <div className="flex flex-col items-center">
          <div className="text-xs text-white/70">Frame time</div>
          <div className="text-sm font-medium font-mono">{frameTimeMs} ms</div>
        </div>
      </div>
      
      {/* Module times panel (conditionally shown) */}
      {showModuleTimes && moduleTimes.length > 0 && (
        <>
          <div className="h-px bg-white/10 my-2"></div>
          <div className="max-h-36 overflow-y-auto pr-1 -mr-1">
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1">
              {moduleTimes.map((module, index) => (
                <React.Fragment key={index}>
                  <div className="text-xs text-white/80">{module.moduleId}:</div>
                  <div className="h-2 bg-gray-700 rounded overflow-hidden self-center">
                    <div 
                      className="h-full bg-blue-500"
                      style={{ 
                        width: `${Math.min(100, (module.duration / 16) * 100)}%`,
                        backgroundColor: module.duration > 5 ? '#ec4899' : '#3b82f6'
                      }}
                    ></div>
                  </div>
                  <div className="text-xs font-mono font-medium text-right">{module.duration.toFixed(1)} ms</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FpsStats;