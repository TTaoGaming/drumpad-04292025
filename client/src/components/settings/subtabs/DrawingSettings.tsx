/**
 * Drawing Settings Panel
 * 
 * Allows configuration of drawing parameters like:
 * - Drawing mode (free drawing or ROI selection)
 * - Stroke color and width
 * - Fill color and opacity for ROIs
 * - Path smoothing
 * - Auto-close for ROI paths
 * - Feature visualization options
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { EventType, dispatch } from '@/lib/eventBus';
import { DrawingSettings as IDrawingSettings } from '@/components/DrawingCanvas';
import orbFeatureDetector from '@/lib/orbFeatureDetector';

const DrawingSettings: React.FC = () => {
  // Use educational number blocks color for index finger (RED = 1)
  const [settings, setSettings] = useState<IDrawingSettings>({
    enabled: true,
    mode: 'roi',
    strokeColor: '#FF0000', // Red - index finger color (1)
    fillColor: '#FF0000', // Red - index finger color (1)
    strokeWidth: 3,
    fillOpacity: 0.2,
    autoClose: true,
    smoothing: true,
    showFeatures: true
  });
  
  const [featureCount, setFeatureCount] = useState(0);

  // Update global state when settings change
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'drawing',
      setting: 'drawingSettings',
      value: settings
    });
  }, [settings]);
  
  // Update feature count periodically
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Count total features across all ROIs
      const rois = orbFeatureDetector.getROIs();
      const totalFeatures = rois.reduce((sum, roi) => sum + roi.features.length, 0);
      setFeatureCount(totalFeatures);
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Handle changes to individual settings
  const handleSettingChange = (settingName: keyof IDrawingSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [settingName]: value
    }));
  };

  // Clear the canvas
  const handleClearCanvas = () => {
    // Clear all paths
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'drawing',
      setting: 'clearCanvas',
      value: true
    });
    
    // Also clear all ROIs in the feature detector
    orbFeatureDetector.clearROIs();
    
    // Reset the clear command after a short delay
    setTimeout(() => {
      dispatch(EventType.SETTINGS_VALUE_CHANGE, {
        section: 'drawing',
        setting: 'clearCanvas',
        value: false
      });
    }, 100);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Drawing Settings</CardTitle>
          <CardDescription>
            Configure the drawing behavior for pinch gestures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/disable drawing */}
          <div className="flex items-center justify-between">
            <Label htmlFor="drawing-enabled">Enable Drawing</Label>
            <Switch 
              id="drawing-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => handleSettingChange('enabled', checked)}
            />
          </div>
          
          <Separator />
          
          {/* Drawing mode selection */}
          <div className="space-y-2">
            <Label>Drawing Mode</Label>
            <RadioGroup 
              value={settings.mode} 
              onValueChange={(value) => handleSettingChange('mode', value)}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="free" id="free" />
                <Label htmlFor="free">Free Drawing</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="roi" id="roi" />
                <Label htmlFor="roi">ROI Selection</Label>
              </div>
            </RadioGroup>
          </div>
          
          <Separator />
          
          {/* Stroke settings */}
          <div className="space-y-2">
            <Label>Stroke Width</Label>
            <div className="flex items-center space-x-2">
              <Slider 
                value={[settings.strokeWidth]} 
                min={1} 
                max={10} 
                step={1}
                onValueChange={(value) => handleSettingChange('strokeWidth', value[0])}
              />
              <span className="w-8 text-center">{settings.strokeWidth}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="stroke-color">Stroke Color</Label>
            <div className="flex items-center space-x-2">
              <Input 
                id="stroke-color"
                type="color" 
                value={settings.strokeColor}
                onChange={(e) => handleSettingChange('strokeColor', e.target.value)}
                className="w-12 h-8 p-0"
              />
              <span>{settings.strokeColor}</span>
            </div>
          </div>
          
          {/* Fill settings (only for ROI mode) */}
          {settings.mode === 'roi' && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="fill-color">Fill Color</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    id="fill-color"
                    type="color" 
                    value={settings.fillColor}
                    onChange={(e) => handleSettingChange('fillColor', e.target.value)}
                    className="w-12 h-8 p-0"
                  />
                  <span>{settings.fillColor}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Fill Opacity</Label>
                <div className="flex items-center space-x-2">
                  <Slider 
                    value={[settings.fillOpacity * 100]} 
                    min={0} 
                    max={100} 
                    step={5}
                    onValueChange={(value) => handleSettingChange('fillOpacity', value[0] / 100)}
                  />
                  <span className="w-12 text-center">{Math.round(settings.fillOpacity * 100)}%</span>
                </div>
              </div>
            </>
          )}
          
          <Separator />
          
          {/* Path settings */}
          <div className="flex items-center justify-between">
            <Label htmlFor="smoothing">Path Smoothing</Label>
            <Switch 
              id="smoothing"
              checked={settings.smoothing}
              onCheckedChange={(checked) => handleSettingChange('smoothing', checked)}
            />
          </div>
          
          {settings.mode === 'roi' && (
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-close">Auto-Close Path</Label>
              <Switch 
                id="auto-close"
                checked={settings.autoClose}
                onCheckedChange={(checked) => handleSettingChange('autoClose', checked)}
              />
            </div>
          )}
          
          {/* Feature visualization settings - only shown in ROI mode */}
          {settings.mode === 'roi' && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Feature Detection</h3>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-features">Show Feature Points</Label>
                  <Switch 
                    id="show-features"
                    checked={settings.showFeatures}
                    onCheckedChange={(checked) => handleSettingChange('showFeatures', checked)}
                  />
                </div>
                
                <div className="p-3 bg-black/20 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/70">Total detected features:</span>
                    <span className="text-sm font-medium">{featureCount}</span>
                  </div>
                  
                  <div className="mt-2 text-xs text-white/60">
                    Features are detected within your ROI selections. Draw closed shapes to define regions of interest.
                  </div>
                </div>
              </div>
            </>
          )}
          
          <Separator />
          
          {/* Actions */}
          <Button 
            variant="destructive" 
            onClick={handleClearCanvas}
            className="w-full"
          >
            Clear Canvas
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DrawingSettings;