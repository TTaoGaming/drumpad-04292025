import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { EventType, dispatch } from '@/lib/eventBus';
import { Separator } from '@/components/ui/separator';

const HandLandmarksSettings: React.FC = () => {
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [landmarkSize, setLandmarkSize] = useState(5);
  const [connectionWidth, setConnectionWidth] = useState(3);
  const [colorScheme, setColorScheme] = useState('rainbow');
  
  // MediaPipe confidence settings (higher values = less false detections)
  const [detectionConfidence, setDetectionConfidence] = useState(0.5);
  const [trackingConfidence, setTrackingConfidence] = useState(0.5);
  
  // Update app state when visualization settings change
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'handLandmarks',
      value: {
        showLandmarks,
        showConnections,
        landmarkSize,
        connectionWidth,
        colorScheme
      }
    });
  }, [showLandmarks, showConnections, landmarkSize, connectionWidth, colorScheme]);
  
  // Update confidence settings separately
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'handTracking',
      setting: 'confidence',
      value: {
        minDetectionConfidence: detectionConfidence,
        minTrackingConfidence: trackingConfidence
      }
    });
  }, [detectionConfidence, trackingConfidence]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-sm font-medium">Hand Landmarks</h5>
          <p className="text-xs text-white/70">Visualization settings</p>
        </div>
      </div>
      
      {/* Confidence Thresholds Section */}
      <div className="space-y-4 bg-black/20 p-3 rounded-md">
        <div>
          <h6 className="text-sm font-medium">Confidence Thresholds</h6>
          <p className="text-xs text-white/70">Higher values reduce false detections but may miss hands</p>
        </div>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="detectionConfidence" className="text-xs">Detection Confidence</Label>
              <span className="text-xs opacity-80">{detectionConfidence.toFixed(2)}</span>
            </div>
            <Slider
              id="detectionConfidence"
              min={0.2}
              max={0.9}
              step={0.05}
              value={[detectionConfidence]}
              onValueChange={(value) => setDetectionConfidence(value[0])}
              className="flex-1"
            />
            <p className="text-xs text-white/50">Initial hand detection threshold</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="trackingConfidence" className="text-xs">Tracking Confidence</Label>
              <span className="text-xs opacity-80">{trackingConfidence.toFixed(2)}</span>
            </div>
            <Slider
              id="trackingConfidence"
              min={0.2}
              max={0.9}
              step={0.05}
              value={[trackingConfidence]}
              onValueChange={(value) => setTrackingConfidence(value[0])}
              className="flex-1"
            />
            <p className="text-xs text-white/50">Threshold for maintaining hand tracking</p>
          </div>
        </div>
      </div>
      
      <Separator className="my-2 bg-white/10" />
      
      {/* Visualization Settings */}
      <div className="space-y-4">
        <div>
          <h6 className="text-sm font-medium">Visualization</h6>
        </div>
        
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show Landmarks</Label>
          <Switch 
            checked={showLandmarks}
            onCheckedChange={setShowLandmarks}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show Connections</Label>
          <Switch 
            checked={showConnections}
            onCheckedChange={setShowConnections}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="landmarkSize" className="text-xs">Landmark Size</Label>
            <span className="text-xs opacity-80">{landmarkSize}px</span>
          </div>
          <Slider
            id="landmarkSize"
            min={1}
            max={10}
            step={1}
            value={[landmarkSize]}
            onValueChange={(value) => setLandmarkSize(value[0])}
            className="flex-1"
            disabled={!showLandmarks}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="connectionWidth" className="text-xs">Connection Width</Label>
            <span className="text-xs opacity-80">{connectionWidth}px</span>
          </div>
          <Slider
            id="connectionWidth"
            min={1}
            max={10}
            step={1}
            value={[connectionWidth]}
            onValueChange={(value) => setConnectionWidth(value[0])}
            className="flex-1"
            disabled={!showConnections}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="colorScheme" className="text-xs">Color Scheme</Label>
          <Select 
            value={colorScheme} 
            onValueChange={setColorScheme}
          >
            <SelectTrigger className="w-full h-8 text-xs bg-black/30 border-white/20">
              <SelectValue placeholder="Select color scheme" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-white/20">
              <SelectItem value="rainbow" className="text-xs">Rainbow (Per Finger)</SelectItem>
              <SelectItem value="single" className="text-xs">Single Color</SelectItem>
              <SelectItem value="depth" className="text-xs">Depth-based</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default HandLandmarksSettings;