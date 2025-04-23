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
  const [settings, setSettings] = useState({
    enabled: true,
    showVisualizer: true,
    threshold: 0.07, // Normalized distance threshold for pinch detection (0-1)
    releaseThreshold: 0.10, // Higher threshold to prevent flickering (hysteresis)
    stabilityFrames: 3, // Number of frames to confirm a pinch state change
    activeFinger: 'index' as 'index' | 'middle' | 'ring' | 'pinky' // Which finger to use for pinching with thumb
  });
  
  // Pinch state info from the tracker
  const [pinchState, setPinchState] = useState({
    isPinching: false,
    distance: 0
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
    setSettings(prev => ({
      ...prev,
      threshold: value[0]
    }));
  };
  
  // Handle release threshold change
  const handleReleaseThresholdChange = (value: number[]) => {
    setSettings(prev => ({
      ...prev,
      releaseThreshold: value[0]
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
              min={settings.threshold}
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
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm">Distance:</div>
                <div className="font-mono px-2 py-1 rounded bg-primary/20">
                  {pinchState.distance.toFixed(3)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PinchGestureSettings;