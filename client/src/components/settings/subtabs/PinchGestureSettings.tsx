/**
 * Pinch Gesture Settings Component
 * 
 * Allows users to configure settings for the pinch gesture recognition.
 */
import React, { useState, useEffect } from 'react';
import { Separator } from '../../ui/separator';
import { Slider } from '../../ui/slider';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addListener, dispatch, EventType } from '@/lib/eventBus';

const PinchGestureSettings = () => {
  // Pinch gesture settings
  const initialThreshold = 0.05;
  const [settings, setSettings] = useState({
    enabled: true,
    showVisualizer: true,
    threshold: initialThreshold, // Normalized distance threshold for pinch detection (0-1)
    releaseThreshold: initialThreshold + 0.02, // Higher threshold to prevent flickering (hysteresis)
    stabilityFrames: 3, // Number of frames to confirm a pinch state change
    activeFinger: 'index' as 'index' | 'middle' | 'ring' | 'pinky' // Which finger to use for pinching with thumb
  });
  
  // Pinch state info from the tracker
  const [pinchState, setPinchState] = useState({
    isPinching: false,
    distance: 0,
    pendingState: null as boolean | null,
    stableCount: 0,
    stabilityFrames: 3
  });
  
  // Listen for pinch state updates from the tracker
  useEffect(() => {
    const pinchStateListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'gestures' && data.setting === 'pinchState') {
          setPinchState(data.value);
        }
      }
    );
    
    return () => {
      pinchStateListener.remove();
    };
  }, []);
  
  // Update settings in the tracker when changed
  useEffect(() => {
    // Dispatch event to update settings in the tracker
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'gestures',
      setting: 'pinchGesture',
      value: settings
    });
  }, [settings]);
  
  // Handle toggle for enabled state
  const handleEnabledToggle = (checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      enabled: checked
    }));
  };
  
  // Handle toggle for visualizer
  const handleVisualizerToggle = (checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      showVisualizer: checked
    }));
  };
  
  // Handle threshold change
  const handleThresholdChange = (value: number[]) => {
    const newThreshold = value[0];
    setSettings(prev => {
      // Ensure release threshold is at least equal to the pinch threshold
      const newReleaseThreshold = Math.max(prev.releaseThreshold, newThreshold + 0.02);
      return {
        ...prev,
        threshold: newThreshold,
        releaseThreshold: newReleaseThreshold
      };
    });
  };
  
  // Handle release threshold change
  const handleReleaseThresholdChange = (value: number[]) => {
    // Ensure release threshold is greater than pinch threshold
    const newReleaseThreshold = Math.max(value[0], settings.threshold + 0.01);
    setSettings(prev => ({
      ...prev,
      releaseThreshold: newReleaseThreshold
    }));
  };
  
  // Handle stability frames change
  const handleStabilityFramesChange = (value: number[]) => {
    setSettings(prev => ({
      ...prev,
      stabilityFrames: Math.round(value[0])
    }));
  };
  
  // Handle active finger change
  const handleActiveFingerChange = (value: string) => {
    setSettings(prev => ({
      ...prev,
      activeFinger: value as 'index' | 'middle' | 'ring' | 'pinky'
    }));
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Pinch Gesture Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure pinch gesture recognition between the thumb and another finger.
        </p>
      </div>
      
      <Separator />
      
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Enable Pinch Gesture Recognition</Label>
          <p className="text-xs text-muted-foreground">
            Detects when your thumb and finger are pinched together
          </p>
        </div>
        <Switch 
          checked={settings.enabled} 
          onCheckedChange={handleEnabledToggle}
        />
      </div>
      
      {settings.enabled && (
        <>
          {/* Visualizer Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Visualizer</Label>
              <p className="text-xs text-muted-foreground">
                Display visual indicators for the pinch gesture 
              </p>
            </div>
            <Switch 
              checked={settings.showVisualizer} 
              onCheckedChange={handleVisualizerToggle}
            />
          </div>
          
          {/* Active Finger Selection */}
          <div className="space-y-2">
            <Label>Active Finger for Pinch</Label>
            <Select value={settings.activeFinger} onValueChange={handleActiveFingerChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select finger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="index">Index Finger</SelectItem>
                <SelectItem value="middle">Middle Finger</SelectItem>
                <SelectItem value="ring">Ring Finger</SelectItem>
                <SelectItem value="pinky">Pinky Finger</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select which finger to use for pinching with the thumb
            </p>
          </div>
          
          {/* Threshold Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pinch Threshold</Label>
              <span className="text-sm">{settings.threshold.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.threshold]}
              min={0.02}
              max={0.15}
              step={0.01}
              onValueChange={handleThresholdChange}
            />
            <p className="text-xs text-muted-foreground">
              Distance threshold for pinch detection (smaller value = closer pinch required)
            </p>
          </div>
          
          {/* Release Threshold Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Release Threshold</Label>
              <span className="text-sm">{settings.releaseThreshold.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.releaseThreshold]}
              min={settings.threshold + 0.01}  // Ensure at least 0.01 gap between thresholds
              max={0.2}
              step={0.01}
              onValueChange={handleReleaseThresholdChange}
            />
            <p className="text-xs text-muted-foreground">
              Distance threshold for pinch release (prevents flickering when fingers are near threshold)
            </p>
          </div>
          
          {/* Stability Frames Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Stability Frames</Label>
              <span className="text-sm">{settings.stabilityFrames}</span>
            </div>
            <Slider
              value={[settings.stabilityFrames]}
              min={1}
              max={10}
              step={1}
              onValueChange={handleStabilityFramesChange}
            />
            <p className="text-xs text-muted-foreground">
              Number of consistent frames required to change pinch state (higher = more stable but more latency)
            </p>
          </div>
          
          {/* Current Pinch State Display */}
          <div className="bg-secondary p-4 rounded-md">
            <div className="mb-2 font-semibold">Current Pinch Status</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <div className="text-sm">State:</div>
                <div className={`font-mono px-2 py-1 rounded ${pinchState.isPinching 
                  ? 'bg-green-500/20 text-green-500' 
                  : 'bg-red-500/20 text-red-500'}`}>
                  {pinchState.isPinching ? 'PINCHING' : 'INACTIVE'}
                  {pinchState.pendingState !== null && (
                    <span className="ml-1 text-xs">
                      {pinchState.pendingState ? '(→on)' : '(→off)'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm">Distance:</div>
                <div className="font-mono px-2 py-1 rounded bg-primary/20">
                  {pinchState.distance.toFixed(3)}
                </div>
              </div>
            </div>
            
            {/* Stability Information */}
            {pinchState.pendingState !== null && (
              <div className="mt-2 border-t border-primary/10 pt-2">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">Stability Counter:</div>
                  <div className="flex items-center">
                    <div className="h-1.5 w-full bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden mr-2">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-200"
                        style={{ width: `${(pinchState.stableCount / pinchState.stabilityFrames) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-mono">
                      {pinchState.stableCount}/{pinchState.stabilityFrames}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Thresholds Display */}
            <div className="mt-3 pt-3 border-t border-primary/10">
              <div className="text-sm font-medium mb-2">Current Threshold Settings</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <div className="text-xs text-muted-foreground">Pinch Threshold</div>
                  <div className="font-mono text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-500">
                    {settings.threshold.toFixed(3)}
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="text-xs text-muted-foreground">Release Threshold</div>
                  <div className="font-mono text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-500">
                    {settings.releaseThreshold.toFixed(3)}
                  </div>
                </div>
              </div>
              
              {/* Visual Gauge */}
              <div className="mt-2 relative h-4 w-full bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div className="absolute inset-0 flex items-center">
                  {/* Pinch threshold marker */}
                  <div 
                    className="absolute h-full w-0.5 bg-blue-500 z-20"
                    style={{ left: `${(settings.threshold / 0.2) * 100}%` }}
                  ></div>
                  {/* Release threshold marker */}
                  <div 
                    className="absolute h-full w-0.5 bg-purple-500 z-20"
                    style={{ left: `${(settings.releaseThreshold / 0.2) * 100}%` }}
                  ></div>
                  {/* Current distance marker */}
                  <div 
                    className="absolute h-full w-1 bg-orange-500 z-10"
                    style={{ left: `${(pinchState.distance / 0.2) * 100}%` }}
                  ></div>
                </div>
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 opacity-20"></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0.00</span>
                <span>0.10</span>
                <span>0.20</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PinchGestureSettings;