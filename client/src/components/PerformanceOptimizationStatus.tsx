import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

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
  const [canvasPool, setCanvasPool] = useState({
    size: 0,
    created: 0,
    reused: 0
  });
  
  const [currentFps, setCurrentFps] = useState(0);
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  
  useEffect(() => {
    // Poll canvas pool info and FPS data every 500ms
    const intervalId = setInterval(() => {
      // Update canvas pool metrics
      if ((window as any).canvasPoolInfo) {
        setCanvasPool({
          size: (window as any).canvasPoolInfo.size || 0,
          created: (window as any).canvasPoolInfo.created || 0,
          reused: (window as any).canvasPoolInfo.reused || 0
        });
      }
      
      // Get current FPS from performance.now() if available
      const now = performance.now();
      const fps = calculateFPS(now);
      if (fps > 0) {
        setCurrentFps(fps);
        setFpsHistory(prev => {
          const newHistory = [...prev, fps];
          // Keep the last 20 readings
          return newHistory.slice(-20);
        });
      }
    }, 500);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Calculate FPS based on time difference
  const calculateFPS = (now: number): number => {
    // Store the last timestamp to calculate FPS
    const lastTimestamp = (window as any)._lastFpsTimestamp || 0;
    const frameCount = (window as any)._frameCount || 0;
    
    if (lastTimestamp === 0) {
      // First call, just store the timestamp
      (window as any)._lastFpsTimestamp = now;
      (window as any)._frameCount = 0;
      return 0;
    }
    
    // Calculate time difference
    const elapsed = now - lastTimestamp;
    
    // If more than 1 second has passed, calculate FPS
    if (elapsed > 1000) {
      const fps = Math.round((frameCount * 1000) / elapsed);
      
      // Reset counters
      (window as any)._lastFpsTimestamp = now;
      (window as any)._frameCount = 0;
      
      return fps;
    }
    
    // Increment frame count
    (window as any)._frameCount = frameCount + 1;
    return 0;
  };
  
  // Calculate an efficiency score based on canvas pool reuse rate
  const calculateEfficiency = (): number => {
    const total = canvasPool.created + canvasPool.reused;
    if (total === 0) return 0;
    return Math.round((canvasPool.reused / total) * 100);
  };
  
  // Format large numbers with commas
  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  
  // Calculate average FPS
  const averageFps = fpsHistory.length > 0 
    ? Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) 
    : 0;
  
  const efficiency = calculateEfficiency();
  
  // Determine if we're meeting our target FPS
  const fpsPercentage = Math.min(100, (averageFps / targetFps) * 100);
  
  return (
    <Card className="fixed bottom-4 right-4 p-3 text-xs w-64 z-50 bg-opacity-95 bg-black text-white shadow-lg border-gray-700">
      <div className="font-bold text-sm mb-1">Performance Optimization</div>
      
      <div className="mb-2">
        <div className="flex justify-between">
          <span>FPS (Target: {targetFps})</span>
          <span className={averageFps >= targetFps * 0.9 ? 'text-green-400' : 'text-yellow-400'}>
            {averageFps} FPS
          </span>
        </div>
        <Progress value={fpsPercentage} className="h-1 mt-1" />
      </div>
      
      <div className="mb-2">
        <div className="flex justify-between">
          <span>Canvas Pooling Efficiency</span>
          <span className={efficiency > 70 ? 'text-green-400' : 'text-yellow-400'}>
            {efficiency}%
          </span>
        </div>
        <Progress value={efficiency} className="h-1 mt-1" />
      </div>
      
      <div className="grid grid-cols-3 gap-1 text-xs mt-3">
        <div className="bg-gray-800 p-1 rounded">
          <div className="text-gray-400">Pool Size</div>
          <div className="font-mono text-right">{canvasPool.size}</div>
        </div>
        <div className="bg-gray-800 p-1 rounded">
          <div className="text-gray-400">Created</div>
          <div className="font-mono text-right">{formatNumber(canvasPool.created)}</div>
        </div>
        <div className="bg-gray-800 p-1 rounded">
          <div className="text-gray-400">Reused</div>
          <div className="font-mono text-right">{formatNumber(canvasPool.reused)}</div>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 mt-2">
        Optimization: Direct pixel copy, canvas pooling
      </div>
    </Card>
  );
};

export default PerformanceOptimizationStatus;