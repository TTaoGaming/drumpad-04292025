import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { EventType, dispatch } from '@/lib/eventBus';
import { Plus, Trash2 } from 'lucide-react';

const GestureRecognitionSettings: React.FC = () => {
  const [gestureRecognitionEnabled, setGestureRecognitionEnabled] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [showVisualizations, setShowVisualizations] = useState(true);
  
  // Update app state when settings change
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'gestureRecognition',
      value: {
        enabled: gestureRecognitionEnabled,
        confidenceThreshold,
        showVisualizations
      }
    });
  }, [gestureRecognitionEnabled, confidenceThreshold, showVisualizations]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-sm font-medium">Gesture Recognition</h5>
          <p className="text-xs text-white/70">Detect hand gestures</p>
        </div>
        <Switch 
          checked={gestureRecognitionEnabled}
          onCheckedChange={setGestureRecognitionEnabled}
        />
      </div>
      
      <div className={gestureRecognitionEnabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="confidenceThreshold" className="text-xs">Confidence Threshold</Label>
            <span className="text-xs opacity-80">{(confidenceThreshold * 100).toFixed(0)}%</span>
          </div>
          <Slider
            id="confidenceThreshold"
            min={0.5}
            max={0.95}
            step={0.05}
            value={[confidenceThreshold]}
            onValueChange={(value) => setConfidenceThreshold(value[0])}
            className="flex-1"
          />
          <p className="text-[10px] opacity-70">
            Higher values reduce false positives
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show Gesture Visualizations</Label>
          <Switch 
            checked={showVisualizations}
            onCheckedChange={setShowVisualizations}
          />
        </div>
        
        <Card className="bg-black/20 border-0">
          <CardContent className="p-3">
            <div className="flex justify-between items-center mb-2">
              <h6 className="text-xs font-medium">Predefined Gestures</h6>
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="h-6 px-2 text-[10px]"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Custom
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-black/30 p-2 rounded-sm">
                <div className="text-xs">Open Palm</div>
                <div className="flex items-center gap-1">
                  <Switch checked={true} disabled />
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-black/30 p-2 rounded-sm">
                <div className="text-xs">Pinch</div>
                <div className="flex items-center gap-1">
                  <Switch checked={true} disabled />
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-black/30 p-2 rounded-sm">
                <div className="text-xs">Fist</div>
                <div className="flex items-center gap-1">
                  <Switch checked={true} disabled />
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-black/30 p-2 rounded-sm">
                <div className="text-xs">Point</div>
                <div className="flex items-center gap-1">
                  <Switch checked={true} disabled />
                </div>
              </div>
            </div>
            
            <p className="text-[10px] italic opacity-70 mt-2">
              Gesture customization coming soon
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GestureRecognitionSettings;