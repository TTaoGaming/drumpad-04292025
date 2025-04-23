import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { EventType, dispatch } from '@/lib/eventBus';
import PinchGestureSettings from './PinchGestureSettings';

const GestureRecognitionSettings: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [detectionConfidence, setDetectionConfidence] = useState(0.8);
  const [recognizeType, setRecognizeType] = useState('pinch');
  const [showGestureMarkers, setShowGestureMarkers] = useState(true);
  const [activeGestureTab, setActiveGestureTab] = useState('general');
  
  // Update app state when settings change
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'gestureRecognition',
      value: {
        enabled: isEnabled,
        detectionConfidence,
        recognizeType,
        showGestureMarkers
      }
    });
  }, [isEnabled, detectionConfidence, recognizeType, showGestureMarkers]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-sm font-medium">Gesture Recognition</h5>
          <p className="text-xs text-white/70">Recognize hand gestures</p>
        </div>
        <Switch 
          checked={isEnabled}
          onCheckedChange={setIsEnabled}
        />
      </div>
      
      <Tabs 
        defaultValue="general" 
        value={activeGestureTab} 
        onValueChange={setActiveGestureTab}
        className={isEnabled ? "" : "opacity-50 pointer-events-none"}
      >
        <TabsList className="grid grid-cols-2 mb-2">
          <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
          <TabsTrigger value="pinch" className="text-xs">Pinch Gesture</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="detectionConfidence" className="text-xs">Detection Confidence</Label>
              <span className="text-xs opacity-80">{(detectionConfidence * 100).toFixed(0)}%</span>
            </div>
            <Slider
              id="detectionConfidence"
              min={0.5}
              max={0.99}
              step={0.01}
              value={[detectionConfidence]}
              onValueChange={(value) => setDetectionConfidence(value[0])}
              className="flex-1"
            />
            <p className="text-[10px] opacity-70">
              Higher values mean fewer false positives
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="gestureType" className="text-xs">Gesture Type</Label>
            <Select 
              value={recognizeType} 
              onValueChange={(value) => {
                setRecognizeType(value);
                if (value === 'pinch') {
                  setActiveGestureTab('pinch');
                }
              }}
            >
              <SelectTrigger id="gestureType" className="w-full h-8 text-xs bg-black/30 border-white/20">
                <SelectValue placeholder="Select gesture type" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20">
                <SelectItem value="pinch" className="text-xs">Pinch</SelectItem>
                <SelectItem value="grab" className="text-xs">Grab</SelectItem>
                <SelectItem value="point" className="text-xs">Point</SelectItem>
                <SelectItem value="open-palm" className="text-xs">Open Palm</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] opacity-70">
              Type of gesture to recognize
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show Gesture Markers</Label>
            <Switch 
              checked={showGestureMarkers}
              onCheckedChange={setShowGestureMarkers}
            />
          </div>
          
          <div className="pt-2 text-[10px] italic opacity-60">
            Gesture recognition is used to define selection regions and actions.
          </div>
        </TabsContent>
        
        <TabsContent value="pinch" className="space-y-4">
          <PinchGestureSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GestureRecognitionSettings;