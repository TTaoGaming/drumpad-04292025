import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { EventType, dispatch, addListener } from '@/lib/eventBus';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

/**
 * Performance Settings Component
 * 
 * Allows users to customize performance-related settings to optimize
 * the application based on their hardware capabilities
 */
const PerformanceSettings: React.FC = () => {
  // UI Update throttling
  const [throttleUIUpdates, setThrottleUIUpdates] = useState(true);
  const [uiUpdateInterval, setUIUpdateInterval] = useState(200); // milliseconds
  
  // Frame processing
  const [processEveryNthFrame, setProcessEveryNthFrame] = useState(3); // Every 3rd frame
  
  // Landmark filtering
  const [applyLandmarkFiltering, setApplyLandmarkFiltering] = useState(true);
  
  // Performance preset
  const [performancePreset, setPerformancePreset] = useState<'balanced' | 'performance' | 'quality'>('balanced');
  
  // Update settings when changed
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'throttling',
      value: {
        enabled: throttleUIUpdates,
        interval: uiUpdateInterval
      }
    });
  }, [throttleUIUpdates, uiUpdateInterval]);
  
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'frameProcessing',
      value: {
        processEveryNth: processEveryNthFrame
      }
    });
  }, [processEveryNthFrame]);
  
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'landmarkFiltering',
      value: {
        enabled: applyLandmarkFiltering
      }
    });
  }, [applyLandmarkFiltering]);
  
  // Apply performance presets
  const applyPreset = (preset: 'balanced' | 'performance' | 'quality') => {
    setPerformancePreset(preset);
    
    switch (preset) {
      case 'performance':
        setThrottleUIUpdates(true);
        setUIUpdateInterval(500); // Longer interval
        setProcessEveryNthFrame(5); // Process fewer frames
        setApplyLandmarkFiltering(true);
        break;
      case 'balanced':
        setThrottleUIUpdates(true);
        setUIUpdateInterval(200); // Medium interval
        setProcessEveryNthFrame(3); // Process every 3rd frame
        setApplyLandmarkFiltering(true);
        break;
      case 'quality':
        setThrottleUIUpdates(false);
        setUIUpdateInterval(100); // Short interval
        setProcessEveryNthFrame(1); // Process every frame
        setApplyLandmarkFiltering(true);
        break;
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h5 className="text-sm font-medium">Performance Settings</h5>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={14} className="text-white/60 hover:text-white/80 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p className="text-xs">
                  Adjust settings to optimize performance on your device. Higher performance settings 
                  may reduce visual quality but improve responsiveness.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Performance Presets */}
      <div className="space-y-2 pb-3">
        <Label className="text-xs mb-2">Performance Preset</Label>
        <div className="grid grid-cols-3 gap-2">
          <button
            className={`px-2 py-1.5 rounded-md text-xs ${
              performancePreset === 'performance' 
                ? 'bg-green-700/70 text-white' 
                : 'bg-gray-800/50 text-white/70 hover:bg-gray-800/80'
            }`}
            onClick={() => applyPreset('performance')}
          >
            Performance
          </button>
          <button
            className={`px-2 py-1.5 rounded-md text-xs ${
              performancePreset === 'balanced' 
                ? 'bg-blue-700/70 text-white' 
                : 'bg-gray-800/50 text-white/70 hover:bg-gray-800/80'
            }`}
            onClick={() => applyPreset('balanced')}
          >
            Balanced
          </button>
          <button
            className={`px-2 py-1.5 rounded-md text-xs ${
              performancePreset === 'quality' 
                ? 'bg-purple-700/70 text-white' 
                : 'bg-gray-800/50 text-white/70 hover:bg-gray-800/80'
            }`}
            onClick={() => applyPreset('quality')}
          >
            Quality
          </button>
        </div>
        <p className="text-[10px] text-white/60 mt-1">
          Choose a preset or customize individual settings below.
        </p>
      </div>
      
      <Separator className="bg-white/10" />
      
      {/* UI Update Throttling */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs">Throttle UI Updates</Label>
            <p className="text-[10px] text-white/60">
              Batch visual updates to reduce lag
            </p>
          </div>
          <Switch 
            checked={throttleUIUpdates}
            onCheckedChange={setThrottleUIUpdates}
          />
        </div>
        
        {throttleUIUpdates && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Update Interval</Label>
              <span className="text-xs opacity-80">{uiUpdateInterval} ms</span>
            </div>
            <Slider
              min={50}
              max={500}
              step={50}
              value={[uiUpdateInterval]}
              onValueChange={(value) => setUIUpdateInterval(value[0])}
              className="flex-1"
              disabled={!throttleUIUpdates}
            />
            <p className="text-[10px] text-white/60 mt-1">
              Longer intervals (higher values) improve performance but may feel less responsive.
            </p>
          </div>
        )}
      </div>
      
      {/* Frame Processing */}
      <div className="space-y-3 pt-2">
        <div className="space-y-0.5">
          <Label className="text-xs">Process Every Nth Frame</Label>
          <p className="text-[10px] text-white/60">
            Skip frames to reduce processing load
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs opacity-80">Every {processEveryNthFrame} frame{processEveryNthFrame > 1 ? 's' : ''}</span>
          </div>
          <Slider
            min={1}
            max={10}
            step={1}
            value={[processEveryNthFrame]}
            onValueChange={(value) => setProcessEveryNthFrame(value[0])}
            className="flex-1"
          />
          <p className="text-[10px] text-white/60 mt-1">
            Higher values significantly improve performance but may make movements appear less smooth.
          </p>
        </div>
      </div>
      
      {/* Landmark Filtering */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs">Apply Landmark Filtering</Label>
            <p className="text-[10px] text-white/60">
              Smooth hand movement but adds processing
            </p>
          </div>
          <Switch 
            checked={applyLandmarkFiltering}
            onCheckedChange={setApplyLandmarkFiltering}
          />
        </div>
      </div>
      
      {/* Data Flow Visualization */}
      <div className="space-y-3 pt-4 border-t border-white/10">
        <Label className="text-xs">Data Flow Visualization</Label>
        <div className="bg-black/30 p-3 rounded-md font-mono text-xs whitespace-pre text-white/80 overflow-x-auto">
{`
  Webcam → MediaPipe → LandmarkFilter → Angle Calc → State Detect → UI
    ↑                                      ↓           ↓
    └──────────────────── FPS Control ─────┴───────────┘
`}
        </div>
        <p className="text-[10px] text-white/60 mt-1">
          The performance settings control how often each step in this flow is executed.
        </p>
      </div>
    </div>
  );
};

export default PerformanceSettings;