import React from 'react';
import { PerformanceData } from '@/lib/types';

interface PerformanceDisplayProps {
  performance?: PerformanceData;
  className?: string;
}

/**
 * PerformanceDisplay component
 * 
 * Shows real-time performance metrics from the processing pipeline
 * including individual module timings and overall FPS
 */
const PerformanceDisplay: React.FC<PerformanceDisplayProps> = ({ 
  performance,
  className
}) => {
  if (!performance) return null;
  
  // Calculate FPS color based on threshold
  const getFpsColor = (fps: number | undefined) => {
    if (!fps) return 'text-red-500';
    if (fps >= 55) return 'text-green-500';
    if (fps >= 30) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  // Format the module name for display
  const formatModuleName = (name: string) => {
    // Remove prefixes like mp, cv
    let formattedName = name.replace(/^(mp|cv)/, '');
    
    // Convert camelCase to Title Case with spaces
    formattedName = formattedName.replace(/([A-Z])/g, ' $1').trim();
    
    // Capitalize first letter
    return formattedName.charAt(0).toUpperCase() + formattedName.slice(1);
  };
  
  return (
    <div className={`bg-black/70 text-white text-sm p-2 rounded ${className}`}>
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-bold">Performance</h3>
        <div className={`font-mono ${getFpsColor(performance.estimatedFps)}`}>
          {performance.estimatedFps} FPS
        </div>
      </div>
      
      <div className="space-y-1">
        {Object.entries(performance)
          .filter(([key]) => !['estimatedFps', 'totalProcessingMs'].includes(key))
          .map(([moduleName, timeMs]) => (
            <div key={moduleName} className="flex justify-between">
              <span>{formatModuleName(moduleName)}:</span>
              <span className="font-mono">{typeof timeMs === 'number' ? timeMs.toFixed(2) : timeMs} ms</span>
            </div>
          ))}
        
        <div className="flex justify-between font-bold border-t border-white/30 pt-1 mt-1">
          <span>Total:</span>
          <span className="font-mono">
            {performance.totalProcessingMs !== undefined 
              ? `${performance.totalProcessingMs.toFixed(2)} ms` 
              : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDisplay;