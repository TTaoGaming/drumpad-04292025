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
  
  // Return an empty component - no visible UI for the performance monitor
  return null;
};

export default PerformanceMonitor;