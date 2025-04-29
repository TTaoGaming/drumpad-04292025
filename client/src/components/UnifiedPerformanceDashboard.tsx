import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  LineChart, 
  MinimizeIcon, 
  MaximizeIcon, 
  BarChart2Icon, 
  ClockIcon,
  CpuIcon,
  LayersIcon,
  RefreshCwIcon,
  ActivityIcon
} from "lucide-react";
import { addListener, EventType } from '@/lib/eventBus';
import { PerformanceMetrics } from '@/lib/types';

interface UnifiedPerformanceDashboardProps {
  targetFps: number;
}

interface ModuleTimingData {
  name: string;
  duration: number;
  color: string;
}

/**
 * Unified Performance Dashboard
 * 
 * A comprehensive dashboard that shows all performance metrics in one place:
 * - FPS metrics (current, average, min, max)
 * - Canvas pool utilization
 * - Module timings
 * - Memory usage
 * - Frame processing breakdown
 */
const UnifiedPerformanceDashboard: React.FC<UnifiedPerformanceDashboardProps> = ({ 
  targetFps 
}) => {
  // State for performance metrics
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [fpsData, setFpsData] = useState({
    current: 0,
    average: 0,
    min: Infinity,
    max: 0,
    history: [] as number[]
  });
  
  // State for canvas pool metrics
  const [canvasPool, setCanvasPool] = useState({
    size: 0,
    created: 0,
    reused: 0,
    efficiency: 0
  });
  
  // State for module timings
  const [moduleTimings, setModuleTimings] = useState<ModuleTimingData[]>([
    { name: 'Frame Capture', duration: 0, color: '#4285F4' },
    { name: 'MediaPipe', duration: 0, color: '#EA4335' },
    { name: 'Contour Tracking', duration: 0, color: '#FBBC05' },
    { name: 'ROI Processing', duration: 0, color: '#34A853' },
    { name: 'Rendering', duration: 0, color: '#8AB4F8' }
  ]);
  
  // Debug current state
  useEffect(() => {
    console.log('Module timings updated:', moduleTimings);
  }, [moduleTimings]);
  
  // State for memory usage
  const [memoryUsage, setMemoryUsage] = useState({
    total: 0,
    used: 0
  });
  
  // State for performance metrics
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  
  // Update FPS calculation
  const calculateFPS = useCallback((timestamp: number): number => {
    // Store the last timestamp to calculate FPS
    const lastTimestamp = (window as any)._lastFpsTimestamp || 0;
    const frameCount = (window as any)._frameCount || 0;
    
    if (lastTimestamp === 0) {
      // First call, just store the timestamp
      (window as any)._lastFpsTimestamp = timestamp;
      (window as any)._frameCount = 0;
      return 0;
    }
    
    // Calculate time difference
    const elapsed = timestamp - lastTimestamp;
    
    // If more than 1 second has passed, calculate FPS
    if (elapsed > 1000) {
      const fps = Math.round((frameCount * 1000) / elapsed);
      
      // Reset counters
      (window as any)._lastFpsTimestamp = timestamp;
      (window as any)._frameCount = 0;
      
      return fps;
    }
    
    // Increment frame count
    (window as any)._frameCount = frameCount + 1;
    return 0;
  }, []);
  
  // Calculate canvas pool efficiency
  const calculateEfficiency = useCallback((): number => {
    const total = canvasPool.created + canvasPool.reused;
    if (total === 0) return 0;
    return Math.round((canvasPool.reused / total) * 100);
  }, [canvasPool.created, canvasPool.reused]);
  
  // Format large numbers with commas
  const formatNumber = useCallback((num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }, []);
  
  // Format time in ms with appropriate precision
  const formatTime = useCallback((time: number): string => {
    if (time < 0.1) return '<0.1ms';
    if (time < 1) return time.toFixed(1) + 'ms';
    if (time < 10) return time.toFixed(1) + 'ms';
    return Math.round(time) + 'ms';
  }, []);
  
  // Format memory size
  const formatMemory = useCallback((bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }, []);
  
  // Effect for updating canvas pool metrics
  useEffect(() => {
    // Poll canvas pool info and FPS data every 500ms
    const intervalId = setInterval(() => {
      // Update canvas pool metrics
      if ((window as any).canvasPoolInfo) {
        const created = (window as any).canvasPoolInfo.created || 0;
        const reused = (window as any).canvasPoolInfo.reused || 0;
        
        setCanvasPool({
          size: (window as any).canvasPoolInfo.size || 0,
          created,
          reused,
          efficiency: created + reused > 0 ? Math.round((reused / (created + reused)) * 100) : 0
        });
      }
      
      // Get current FPS from performance.now() if available
      const now = performance.now();
      const fps = calculateFPS(now);
      if (fps > 0) {
        setFpsData(prev => {
          const newHistory = [...prev.history, fps].slice(-60); // Keep the last 60 readings
          const avg = newHistory.length > 0 
            ? Math.round(newHistory.reduce((a, b) => a + b, 0) / newHistory.length) 
            : 0;
          
          return {
            current: fps,
            average: avg,
            min: Math.min(prev.min, fps),
            max: Math.max(prev.max, fps),
            history: newHistory
          };
        });
      }
      
      // Update memory usage if available
      if ((performance as any).memory) {
        setMemoryUsage({
          total: (performance as any).memory.jsHeapSizeLimit,
          used: (performance as any).memory.usedJSHeapSize
        });
      }
    }, 500);
    
    // Set up event listeners for canvas pool metrics
    const canvasPoolListener = addListener(
      EventType.CANVAS_POOL_UPDATED,
      (data) => {
        console.log('Canvas pool event received:', data);
        if (data) {
          setCanvasPool({
            size: data.size || 0,
            created: data.created || 0,
            reused: data.reused || 0,
            efficiency: data.efficiency || 0
          });
        }
      }
    );
    
    // Set up event listeners for performance metrics
    const frameProcessedListener = addListener(
      EventType.FRAME_PROCESSED, 
      (metrics: PerformanceMetrics) => {
        console.log('Frame processed event received in dashboard:', metrics);
        if (metrics) {
          console.log('Performance metrics received:', metrics);
          
          // Log the detailed module timings
          console.log('Module Timings:', metrics.moduleTimings);
          
          setPerformanceMetrics(metrics);
          
          // Update FPS data
          const newFps = metrics.fps || 0;
          setFpsData(prev => {
            const newHistory = [...prev.history.slice(-59), newFps];
            const sum = newHistory.reduce((a, b) => a + b, 0);
            const avg = sum / Math.max(1, newHistory.length);
            
            return {
              current: newFps,
              average: Math.round(avg * 10) / 10,
              min: Math.min(prev.min === Infinity ? newFps : prev.min, newFps || Infinity),
              max: Math.max(prev.max, newFps || 0),
              history: newHistory
            };
          });
          
          // Process the new module timings data
          const defaultColors = [
            '#4285F4', // Blue
            '#EA4335', // Red
            '#FBBC05', // Yellow
            '#34A853', // Green
            '#8AB4F8'  // Light blue
          ];
          
          // Initialize with predefined colors for predefined modules
          const moduleColorMap = new Map<string, string>([
            ['frameCapture', defaultColors[0]],
            ['frameProcessing', defaultColors[1]],
            ['workerCommunication', defaultColors[2]],
            ['rendering', defaultColors[3]],
            ['preprocessing', defaultColors[4]]
          ]);
          
          // Create new module timings array from the metrics data
          const newModuleTimings: ModuleTimingData[] = [];
          
          // Process the module timings from the performance metrics
          if (metrics.moduleTimings && metrics.moduleTimings.length > 0) {
            console.log('Processing module timings:', metrics.moduleTimings);
            
            metrics.moduleTimings.forEach((timing, index) => {
              // Get color from map or generate a random one if not exist
              let color = moduleColorMap.get(timing.name);
              if (!color) {
                // Generate random color for new modules
                color = '#' + Math.floor(Math.random()*16777215).toString(16);
                moduleColorMap.set(timing.name, color);
              }
              
              // Format module name for display
              const displayName = timing.name
                .replace(/([A-Z])/g, ' $1') // Add space before capitals
                .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
                
              newModuleTimings.push({
                name: displayName,
                duration: timing.duration,
                color
              });
            });
          }
          
          setModuleTimings(newModuleTimings);
        }
      }
    );
    
    return () => {
      clearInterval(intervalId);
      frameProcessedListener.remove();
      canvasPoolListener.remove();
    };
  }, [calculateFPS]);
  
  // Determine if we're meeting our target FPS
  const fpsPercentage = Math.min(100, (fpsData.average / targetFps) * 100);
  
  // If minimized, show only a small floating indicator
  if (!expanded) {
    return (
      <Card className="fixed bottom-4 right-4 p-2 rounded-full cursor-pointer bg-black bg-opacity-80 shadow-lg border-gray-700 z-50 flex items-center space-x-2"
          onClick={() => setExpanded(true)}>
        <ActivityIcon className="h-5 w-5 text-green-400" />
        <span className="text-white text-sm font-mono">
          {fpsData.current} FPS
        </span>
        <MaximizeIcon className="h-4 w-4 text-gray-400" />
      </Card>
    );
  }
  
  // Calculate total frame time
  const totalFrameTime = moduleTimings.reduce((total, module) => total + module.duration, 0);
  const frameTimeColor = totalFrameTime > (1000 / targetFps) ? 'text-red-400' : 'text-green-400';
  
  return (
    <Card className="fixed bottom-4 right-4 p-3 text-xs w-96 z-50 bg-black bg-opacity-95 text-white shadow-lg border-gray-700 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <div className="font-bold text-base flex items-center gap-1">
          <CpuIcon className="h-4 w-4" /> Performance Dashboard
        </div>
        <div className="flex space-x-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 text-gray-400 hover:text-white"
            onClick={() => setExpanded(false)}>
            <MinimizeIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-2 bg-gray-800">
          <TabsTrigger value="overview" className="text-xs">
            <div className="flex items-center">
              <BarChart2Icon className="mr-1 h-3 w-3" />
              Overview
            </div>
          </TabsTrigger>
          <TabsTrigger value="modules" className="text-xs">
            <div className="flex items-center">
              <ClockIcon className="mr-1 h-3 w-3" />
              Modules
            </div>
          </TabsTrigger>
          <TabsTrigger value="memory" className="text-xs">
            <div className="flex items-center">
              <LayersIcon className="mr-1 h-3 w-3" />
              Resources
            </div>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="m-0">
          {/* FPS Section */}
          <div className="mb-3">
            <div className="flex justify-between">
              <span className="text-gray-400">FPS (Target: {targetFps})</span>
              <span className={fpsData.average >= targetFps * 0.9 ? 'text-green-400' : 'text-yellow-400'}>
                {fpsData.current} FPS
              </span>
            </div>
            <Progress value={fpsPercentage} className="h-1 mt-1" />
            
            <div className="grid grid-cols-3 gap-1 mt-2 text-xs">
              <div className="bg-gray-800 p-1 rounded">
                <div className="text-gray-400">Avg FPS</div>
                <div className="font-mono text-right">{fpsData.average}</div>
              </div>
              <div className="bg-gray-800 p-1 rounded">
                <div className="text-gray-400">Min</div>
                <div className="font-mono text-right">
                  {fpsData.min === Infinity ? 0 : fpsData.min}
                </div>
              </div>
              <div className="bg-gray-800 p-1 rounded">
                <div className="text-gray-400">Max</div>
                <div className="font-mono text-right">{fpsData.max}</div>
              </div>
            </div>
          </div>
          
          <Separator className="my-2 bg-gray-700" />
          
          {/* Frame time breakdown - simplified version */}
          <div className="mb-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Frame Time</span>
              <span className={frameTimeColor}>
                {formatTime(totalFrameTime)}
              </span>
            </div>
            
            <div className="h-2 w-full bg-gray-800 rounded-sm mt-1 overflow-hidden">
              {moduleTimings.map((module, index) => {
                // Calculate width percentage based on proportion of total time
                const widthPercent = totalFrameTime > 0 
                  ? (module.duration / totalFrameTime) * 100 
                  : 0;
                
                return (
                  <div 
                    key={index}
                    style={{ 
                      width: `${widthPercent}%`, 
                      backgroundColor: module.color,
                      height: '100%',
                      float: 'left'
                    }}
                    title={`${module.name}: ${formatTime(module.duration)}`}
                  />
                );
              })}
            </div>
            
            <div className="flex flex-wrap gap-1 mt-2">
              {moduleTimings.map((module, index) => (
                <div key={index} className="flex items-center">
                  <div 
                    className="w-2 h-2 rounded-full mr-1" 
                    style={{ backgroundColor: module.color }}
                  />
                  <span className="text-xs text-gray-400">
                    {module.name.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <Separator className="my-2 bg-gray-700" />
          
          {/* Canvas Pool Section - simplified */}
          <div className="mb-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Canvas Pooling</span>
              <span className={canvasPool.efficiency > 70 ? 'text-green-400' : 'text-yellow-400'}>
                {canvasPool.efficiency}% Efficient
              </span>
            </div>
            <Progress value={canvasPool.efficiency} className="h-1 mt-1" />
            
            <div className="flex mt-1 text-xs text-gray-500 justify-between">
              <span>Pool Size: {canvasPool.size}</span>
              <span>Created: {formatNumber(canvasPool.created)}</span>
              <span>Reused: {formatNumber(canvasPool.reused)}</span>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="modules" className="m-0">
          <div className="text-xs text-gray-400 mb-2">Module Processing Times</div>
          
          {moduleTimings.map((module, index) => (
            <div key={index} className="mb-3">
              <div className="flex justify-between">
                <span className="text-gray-300">{module.name}</span>
                <span 
                  className={module.duration > 10 ? 'text-yellow-400' : 'text-green-400'}
                >
                  {formatTime(module.duration)}
                </span>
              </div>
              <div className="mt-1 h-1 bg-gray-800 rounded-sm overflow-hidden">
                <div 
                  style={{ 
                    width: `${Math.min(100, (module.duration / (1000/60)) * 100)}%`,
                    backgroundColor: module.color,
                    height: '100%'
                  }} 
                />
              </div>
            </div>
          ))}
          
          <Separator className="my-2 bg-gray-700" />
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Total Frame Time</span>
            <span className={frameTimeColor}>
              {formatTime(totalFrameTime)} ({Math.round(1000 / Math.max(1, totalFrameTime))} FPS)
            </span>
          </div>
          
          <div className="mt-3 text-gray-500 text-xs">
            <div className="flex items-center">
              <RefreshCwIcon className="h-3 w-3 mr-1" />
              Budget: {formatTime(1000 / targetFps)} per frame
            </div>
            <div className="mt-1 text-2xs">
              * Hover over bars to see timing details
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="memory" className="m-0">
          {/* Memory Usage */}
          <div className="mb-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Memory Usage</span>
              <span className={
                memoryUsage.used / memoryUsage.total < 0.7 
                  ? 'text-green-400' 
                  : memoryUsage.used / memoryUsage.total < 0.9 
                    ? 'text-yellow-400' 
                    : 'text-red-400'
              }>
                {memoryUsage.total > 0 
                  ? formatMemory(memoryUsage.used) + ' / ' + formatMemory(memoryUsage.total)
                  : 'Not available'
                }
              </span>
            </div>
            {memoryUsage.total > 0 && (
              <Progress 
                value={(memoryUsage.used / memoryUsage.total) * 100} 
                className="h-1 mt-1" 
              />
            )}
          </div>
          
          <Separator className="my-2 bg-gray-700" />
          
          {/* Canvas Statistics */}
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-2">Canvas Pool Statistics</div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Created</div>
                <div className="font-mono text-right">{formatNumber(canvasPool.created)}</div>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Reused</div>
                <div className="font-mono text-right">{formatNumber(canvasPool.reused)}</div>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Pool Size</div>
                <div className="font-mono text-right">{canvasPool.size}</div>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Efficiency</div>
                <div className="font-mono text-right">{canvasPool.efficiency}%</div>
              </div>
            </div>
          </div>
          
          <Separator className="my-2 bg-gray-700" />
          
          {/* Optimization Status */}
          <div className="mt-2 text-gray-400 text-xs">
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-green-400 mr-1" />
              <span>Direct pixel copy active</span>
            </div>
            <div className="flex items-center mt-1">
              <div className="w-2 h-2 rounded-full bg-green-400 mr-1" />
              <span>Canvas pooling active</span>
            </div>
            <div className="flex items-center mt-1">
              <div className="w-2 h-2 rounded-full bg-green-400 mr-1" />
              <span>Frame throttling active ({targetFps} FPS target)</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default UnifiedPerformanceDashboard;