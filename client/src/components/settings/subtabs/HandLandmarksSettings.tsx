import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { EventType, dispatch } from '@/lib/eventBus';

const HandLandmarksSettings: React.FC = () => {
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [landmarkSize, setLandmarkSize] = useState(5);
  const [connectionWidth, setConnectionWidth] = useState(3);
  const [colorScheme, setColorScheme] = useState('rainbow');
  
  // Update app state when settings change
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'landmarks',
      value: {
        showLandmarks,
        showConnections,
        landmarkSize,
        connectionWidth,
        colorScheme
      }
    });
  }, [showLandmarks, showConnections, landmarkSize, connectionWidth, colorScheme]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-sm font-medium">Hand Landmarks</h5>
          <p className="text-xs text-white/70">Visualization settings</p>
        </div>
      </div>
      
      <div className="space-y-4">
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