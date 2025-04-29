import React, { useEffect, useState } from 'react';

interface PerformanceOptimizationStatusProps {
  targetFps: number;
}

/**
 * Performance Optimization Status Component
 * 
 * Displays real-time information about the canvas pool usage and FPS
 * to help visualize the impact of optimizations
 */
const PerformanceOptimizationStatus: React.FC<PerformanceOptimizationStatusProps> = ({ 
  targetFps 
}) => {
  const [stats, setStats] = useState({
    fps: 0,
    fpsHistory: [] as number[],
    canvasPoolSize: 0,
    framesCaptured: 0,
    memoryUsageMB: 0
  });

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    // Monitor FPS and memory usage
    const updateStats = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - lastTime;
      
      if (elapsed >= 1000) {
        // Calculate FPS
        const fps = Math.round((frameCount * 1000) / elapsed);
        
        // Estimate memory usage (if available)
        let memoryUsageMB = 0;
        if (window.performance && (performance as any).memory) {
          memoryUsageMB = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024));
        }
        
        // Try to get canvas pool size from any global variable (this is just for display)
        const canvasPoolInfo = (window as any).canvasPoolInfo || { size: '—', created: 0 };
        
        // Update state with new stats
        setStats(prev => {
          const fpsHistory = [...prev.fpsHistory, fps].slice(-20);
          return {
            fps,
            fpsHistory,
            canvasPoolSize: canvasPoolInfo.size,
            framesCaptured: prev.framesCaptured + frameCount,
            memoryUsageMB
          };
        });
        
        // Reset counters
        frameCount = 0;
        lastTime = now;
      }
      
      rafId = requestAnimationFrame(updateStats);
    };
    
    // Start monitoring
    rafId = requestAnimationFrame(updateStats);
    
    // Clean up on unmount
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Calculate frame time
  const frameTimeMs = stats.fps > 0 ? (1000 / stats.fps).toFixed(1) : '—';
  
  // Calculate average FPS
  const avgFps = stats.fpsHistory.length > 0 
    ? (stats.fpsHistory.reduce((sum, fps) => sum + fps, 0) / stats.fpsHistory.length).toFixed(1) 
    : '—';
  
  // Calculate percentage of target FPS
  const fpsPercentage = stats.fps > 0 
    ? Math.min(100, Math.round((stats.fps / targetFps) * 100))
    : 0;
  
  // Determine status color
  const getStatusColor = () => {
    if (stats.fps >= targetFps * 0.9) return 'text-green-500'; // 90%+ of target is green
    if (stats.fps >= targetFps * 0.7) return 'text-yellow-500'; // 70%+ of target is yellow
    return 'text-red-500'; // Below 70% is red
  };

  return (
    <div className="fixed bottom-0 left-0 z-40 p-2 bg-black/80 text-white rounded-tr-lg text-xs font-mono">
      <h3 className="font-bold mb-1 text-blue-300">Canvas Pool Performance</h3>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div>Current FPS:</div>
        <div className={getStatusColor()}>{stats.fps} FPS ({frameTimeMs} ms)</div>
        
        <div>Average FPS:</div>
        <div>{avgFps} FPS</div>
        
        <div>Target:</div>
        <div className="flex items-center gap-1">
          <span>{targetFps} FPS</span>
          <div className="w-20 h-2 bg-gray-700 rounded-full ml-1">
            <div 
              className={`h-full rounded-full ${getStatusColor().replace('text-', 'bg-')}`}
              style={{ width: `${fpsPercentage}%` }}
            />
          </div>
        </div>
        
        {stats.memoryUsageMB > 0 && (
          <>
            <div>Memory:</div>
            <div>{stats.memoryUsageMB} MB</div>
          </>
        )}
      </div>
    </div>
  );
};

export default PerformanceOptimizationStatus;