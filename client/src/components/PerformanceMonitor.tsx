import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ReferenceLine } from 'recharts';
import { ChevronUp, ChevronDown, Activity, X } from 'lucide-react';
import { addListener, EventType } from '../lib/eventBus';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface FPSData {
  time: number;
  fps: number;
}

interface PerformanceData {
  moduleId: string;
  duration: number;
}

// Number of data points to keep in history
const MAX_HISTORY = 60;
// Update interval for stats (in ms)
const UPDATE_INTERVAL = 500;

const PerformanceMonitor: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('fps');
  const [showAverage, setShowAverage] = useState(true);
  
  // Performance metrics
  const [currentFPS, setCurrentFPS] = useState<number>(0);
  const [averageFPS, setAverageFPS] = useState<number>(0);
  const [fpsHistory, setFpsHistory] = useState<FPSData[]>([]);
  const [modulePerformance, setModulePerformance] = useState<PerformanceData[]>([]);
  
  // Refs for calculating averages
  const fpsAccumulatorRef = useRef<number[]>([]);
  const performanceRef = useRef<{[key: string]: number[]}>({});
  
  // Toggle monitoring panel
  const togglePanel = () => {
    setIsOpen(!isOpen);
  };
  
  // Toggle expanded view
  const toggleExpanded = () => {
    setIsPanelExpanded(!isPanelExpanded);
  };
  
  // Close the panel
  const closePanel = () => {
    setIsOpen(false);
  };
  
  // Listen for performance data
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    // Listen for performance metrics from MediaPipe processor
    const performanceListener = addListener(EventType.FRAME_PROCESSED, (data) => {
      if (data.performance) {
        // Process FPS data
        if (data.performance.fps) {
          const newFPS = data.performance.fps as number;
          
          // Add to accumulator for average calculation
          fpsAccumulatorRef.current.push(newFPS);
          // Keep only MAX_HISTORY values
          if (fpsAccumulatorRef.current.length > MAX_HISTORY) {
            fpsAccumulatorRef.current.shift();
          }
          
          // Calculate average
          const sum = fpsAccumulatorRef.current.reduce((a, b) => a + b, 0);
          const avg = Math.round(sum / fpsAccumulatorRef.current.length);
          
          // Update state
          setCurrentFPS(Math.round(newFPS));
          setAverageFPS(avg);
          
          // Add to chart history
          const timestamp = Date.now();
          setFpsHistory(prev => {
            const newHistory = [...prev, { time: timestamp, fps: Math.round(newFPS) }];
            // Keep only MAX_HISTORY data points
            if (newHistory.length > MAX_HISTORY) {
              return newHistory.slice(newHistory.length - MAX_HISTORY);
            }
            return newHistory;
          });
        }
        
        // Process each module's performance
        Object.entries(data.performance).forEach(([moduleId, duration]) => {
          // Skip total processing time as it's a sum and fps
          if (moduleId === 'totalProcessingMs' || moduleId === 'fps') return;
          
          // Initialize array if not exist
          if (!performanceRef.current[moduleId]) {
            performanceRef.current[moduleId] = [];
          }
          
          // Add duration to the history
          performanceRef.current[moduleId].push(duration as number);
          
          // Keep only MAX_HISTORY values
          if (performanceRef.current[moduleId].length > MAX_HISTORY) {
            performanceRef.current[moduleId].shift();
          }
        });
        
        // Update module performance state every UPDATE_INTERVAL
        intervalId = setInterval(() => {
          const modules: PerformanceData[] = [];
          
          Object.entries(performanceRef.current).forEach(([moduleId, durations]) => {
            if (durations.length === 0) return;
            
            // Calculate average
            const sum = durations.reduce((a, b) => a + b, 0);
            const avgDuration = sum / durations.length;
            
            modules.push({
              moduleId,
              duration: avgDuration
            });
          });
          
          // Sort by duration (highest first)
          modules.sort((a, b) => b.duration - a.duration);
          
          setModulePerformance(modules);
        }, UPDATE_INTERVAL);
      }
    });
    
    // Cleanup
    return () => {
      performanceListener.remove();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
  
  // Format module ID for better readability
  const formatModuleId = (id: string) => {
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
  
  // Format the tooltip label
  const formatTooltip = (value: number) => {
    return `${value.toFixed(1)} ms`;
  };
  
  return (
    <>
      {/* Toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={togglePanel}
        className="fixed bottom-4 left-4 z-50 bg-black/70 text-white border-gray-700 hover:bg-black/90"
      >
        <Activity size={16} className="mr-1" />
        {currentFPS} FPS
      </Button>
      
      {/* Performance panel */}
      {isOpen && (
        <div 
          className={`fixed bottom-16 left-4 z-50 bg-black/85 backdrop-blur-md text-white rounded-lg shadow-xl border border-white/10 transition-all duration-200 overflow-hidden ${
            isPanelExpanded ? 'w-96 h-80' : 'w-64 h-auto'
          }`}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-3 py-2 border-b border-white/10 bg-gray-900/50">
            <h3 className="font-medium text-sm flex items-center">
              <Activity size={14} className="mr-1" />
              Performance Monitor
            </h3>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleExpanded}
                className="h-6 w-6 text-white hover:bg-white/10 rounded-full"
              >
                {isPanelExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={closePanel}
                className="h-6 w-6 text-white hover:bg-white/10 rounded-full"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-3">
            {/* Simple view - just FPS */}
            {!isPanelExpanded && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-white/70">Current FPS:</div>
                  <div className="font-mono text-sm font-bold">{currentFPS}</div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-white/70">Average FPS:</div>
                  <div className="font-mono text-sm">{averageFPS}</div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-white/70">Frame Time:</div>
                  <div className="font-mono text-sm">{currentFPS > 0 ? (1000 / currentFPS).toFixed(1) : 0} ms</div>
                </div>
              </div>
            )}
            
            {/* Expanded view - tabs with graphs and detailed stats */}
            {isPanelExpanded && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
                  <TabsTrigger value="fps">FPS Graph</TabsTrigger>
                  <TabsTrigger value="modules">Module Times</TabsTrigger>
                </TabsList>
                
                <TabsContent value="fps" className="mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs font-medium">
                      <span className="text-white/70">Current: </span>
                      <span className="font-mono">{currentFPS}</span>
                      <span className="text-white/70 ml-2">Avg: </span>
                      <span className="font-mono">{averageFPS}</span>
                    </div>
                    <div className="flex items-center">
                      <Switch
                        id="show-average"
                        checked={showAverage}
                        onCheckedChange={setShowAverage}
                        className="h-4 w-7 data-[state=checked]:bg-green-600"
                      />
                      <Label htmlFor="show-average" className="ml-1.5 text-xs">
                        Avg Line
                      </Label>
                    </div>
                  </div>
                  
                  <div className="w-full h-40 bg-gray-900/30 rounded-md">
                    {fpsHistory.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fpsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#444" />
                          <XAxis 
                            dataKey="time" 
                            tick={false}
                            axisLine={{ stroke: '#555' }}
                          />
                          <YAxis 
                            domain={[0, 'dataMax + 10']} 
                            allowDataOverflow={true}
                            tick={{ fontSize: 10, fill: '#aaa' }}
                            axisLine={{ stroke: '#555' }}
                          />
                          <Tooltip 
                            formatter={(value) => [`${value} FPS`, 'Frame Rate']}
                            contentStyle={{ 
                              backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                              borderColor: '#444',
                              fontSize: 12 
                            }}
                          />
                          <Bar 
                            dataKey="fps" 
                            fill="#4ade80" 
                            isAnimationActive={false} 
                            label={false}
                          />
                          {/* Average line shown as a reference line */}
                          {showAverage && averageFPS > 0 && (
                            <ReferenceLine 
                              y={averageFPS} 
                              stroke="#ff9800" 
                              strokeWidth={2}
                              strokeDasharray="3 3"
                              label={{
                                position: 'right',
                                value: `${averageFPS}`,
                                fill: '#ff9800',
                                fontSize: 10
                              }}
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-white/30 text-xs">
                        Collecting data...
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-1 text-xs text-white/50 flex justify-between">
                    <div>Target: 60 FPS</div>
                    <div>Last {Math.min(MAX_HISTORY, fpsHistory.length)} frames</div>
                  </div>
                </TabsContent>
                
                <TabsContent value="modules" className="mt-2">
                  <div className="w-full h-40 bg-gray-900/30 rounded-md overflow-y-auto">
                    {modulePerformance.length > 0 ? (
                      <div className="p-1">
                        {modulePerformance.map((module) => (
                          <div key={module.moduleId} className="flex justify-between mb-1.5">
                            <div className="text-xs text-white/80">
                              {formatModuleId(module.moduleId)}:
                            </div>
                            <div className="text-xs font-mono font-medium">
                              {module.duration.toFixed(1)} ms
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-white/30 text-xs">
                        Waiting for module timing data...
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-1 text-xs text-white/50 text-center">
                    Measured processing times per module
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PerformanceMonitor;