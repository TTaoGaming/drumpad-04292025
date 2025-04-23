import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { EventType, dispatch } from '@/lib/eventBus';

const MarkerTrackingSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [enableMarkerTracking, setEnableMarkerTracking] = useState(true);
  const [markerAlgorithm, setMarkerAlgorithm] = useState('orb');
  const [markerThreshold, setMarkerThreshold] = useState(50);
  const [markerMaxFeatures, setMarkerMaxFeatures] = useState(500);
  
  const handleSettingsChange = () => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'markerTracking',
      value: {
        enabled: enableMarkerTracking,
        algorithm: markerAlgorithm,
        threshold: markerThreshold,
        maxFeatures: markerMaxFeatures
      }
    });
  };

  return (
    <div className="px-1 py-2">
      <h3 className="text-lg font-semibold mb-4">Marker Tracking</h3>
      
      <div className="mb-4 flex items-center justify-between">
        <Label className="text-sm">Enable Marker Tracking</Label>
        <Switch 
          checked={enableMarkerTracking}
          onCheckedChange={(checked) => {
            setEnableMarkerTracking(checked);
            handleSettingsChange();
          }}
        />
      </div>
      
      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full h-9 bg-black/20">
          <TabsTrigger value="general" className="text-xs px-2">General</TabsTrigger>
          <TabsTrigger value="features" className="text-xs px-2">Features</TabsTrigger>
          <TabsTrigger value="roi" className="text-xs px-2">ROI</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="markerAlgorithm" className="text-xs">Feature Detection Algorithm</Label>
            <Select 
              value={markerAlgorithm} 
              onValueChange={(value) => {
                setMarkerAlgorithm(value);
                handleSettingsChange();
              }}
            >
              <SelectTrigger id="markerAlgorithm" className="w-full h-8 text-xs bg-black/30 border-white/20">
                <SelectValue placeholder="Select algorithm" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20">
                <SelectItem value="orb" className="text-xs">ORB (Oriented FAST and Rotated BRIEF)</SelectItem>
                <SelectItem value="akaze" className="text-xs">AKAZE</SelectItem>
                <SelectItem value="sift" className="text-xs">SIFT (Scale-Invariant Feature Transform)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] opacity-70">
              ORB is fast but less robust. SIFT is slower but more accurate.
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="markerThreshold" className="text-xs">Detection Threshold</Label>
              <span className="text-xs opacity-80">{markerThreshold}</span>
            </div>
            <Slider
              id="markerThreshold"
              min={10}
              max={100}
              step={1}
              value={[markerThreshold]}
              onValueChange={(value) => {
                setMarkerThreshold(value[0]);
                handleSettingsChange();
              }}
              className="flex-1"
            />
            <p className="text-[10px] opacity-70">
              Higher values result in fewer features but more precision.
            </p>
          </div>
        </TabsContent>
        
        <TabsContent value="features" className="pt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="markerMaxFeatures" className="text-xs">Maximum Features</Label>
              <span className="text-xs opacity-80">{markerMaxFeatures}</span>
            </div>
            <Slider
              id="markerMaxFeatures"
              min={100}
              max={2000}
              step={100}
              value={[markerMaxFeatures]}
              onValueChange={(value) => {
                setMarkerMaxFeatures(value[0]);
                handleSettingsChange();
              }}
              className="flex-1"
            />
            <p className="text-[10px] opacity-70">
              More features can improve tracking but may reduce performance.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Feature Visualization</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Switch id="showFeatures" />
                <Label htmlFor="showFeatures" className="text-xs">Show Features</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="showMatches" />
                <Label htmlFor="showMatches" className="text-xs">Show Matches</Label>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="roi" className="pt-4 space-y-4">
          <p className="text-sm opacity-80 mb-2">
            Define Regions of Interest (ROI) using the pinch gesture.
          </p>
          
          <div className="flex items-center space-x-2">
            <Switch id="enableROI" />
            <Label htmlFor="enableROI" className="text-xs">Enable ROI Selection</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch id="showROI" />
            <Label htmlFor="showROI" className="text-xs">Highlight Active ROIs</Label>
          </div>
          
          <button className="text-xs bg-red-800/50 hover:bg-red-700/50 px-3 py-1 rounded">
            Clear All ROIs
          </button>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarkerTrackingSettings;