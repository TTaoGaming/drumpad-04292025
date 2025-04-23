import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { EventType, dispatch, addListener } from '@/lib/eventBus';

const HandLandmarksSettings: React.FC = () => {
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [landmarkSize, setLandmarkSize] = useState(5);
  const [connectionWidth, setConnectionWidth] = useState(3);
  const [colorScheme, setColorScheme] = useState('rainbow');
  const [showFingertips, setShowFingertips] = useState(true);
  
  // State for fingertip positions
  const [fingertipPositions, setFingertipPositions] = useState<{
    thumb: { x: number, y: number, z: number } | null;
    index: { x: number, y: number, z: number } | null;
    middle: { x: number, y: number, z: number } | null;
    ring: { x: number, y: number, z: number } | null;
    pinky: { x: number, y: number, z: number } | null;
  }>({
    thumb: null,
    index: null,
    middle: null,
    ring: null,
    pinky: null
  });
  
  // Update app state when settings change
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'handLandmarks',
      value: {
        showLandmarks,
        showConnections,
        landmarkSize,
        connectionWidth,
        colorScheme,
        showFingertips
      }
    });
  }, [showLandmarks, showConnections, landmarkSize, connectionWidth, colorScheme, showFingertips]);
  
  // Listen for fingertip position updates
  useEffect(() => {
    const listener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'handLandmarks' && data.setting === 'fingertipPositions') {
          setFingertipPositions(data.value);
        }
      }
    );
    
    return () => {
      listener.remove();
    };
  }, []);
  
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
      
      {/* Fingertip Positions Section */}
      <div className="pt-4 mt-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h5 className="text-sm font-medium">Fingertip Positions</h5>
            <p className="text-xs text-white/70">Real-time fingertip coordinates (normalized 0-1)</p>
          </div>
          <Switch 
            checked={showFingertips}
            onCheckedChange={setShowFingertips}
          />
        </div>
        
        {showFingertips && (
          <Card className="bg-black/30 border-white/10 p-2">
            <div className="space-y-2">
              {/* Fingertip position data display */}
              {Object.entries(fingertipPositions).map(([finger, position]) => (
                <div key={finger} className="grid grid-cols-4 items-center text-xs">
                  <div className="font-medium capitalize">{finger}</div>
                  <div className="text-center">
                    <span className="opacity-70">X:</span> {position ? position.x.toFixed(3) : '--'}
                  </div>
                  <div className="text-center">
                    <span className="opacity-70">Y:</span> {position ? position.y.toFixed(3) : '--'}
                  </div>
                  <div className="text-center">
                    <span className="opacity-70">Z:</span> {position ? position.z.toFixed(3) : '--'}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default HandLandmarksSettings;