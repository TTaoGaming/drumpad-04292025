import React, { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addListener, dispatch, EventType } from '../../../lib/eventBus';

/**
 * Performance Settings Component
 * 
 * Allows users to customize performance-related settings to optimize
 * the application based on their hardware capabilities
 */
const PerformanceSettings = () => {
  const [settings, setSettings] = useState({
    throttling: {
      enabled: true,
      interval: 200, // ms
    },
    frameProcessing: {
      processEveryNth: 3, // Process every 3rd frame
    },
    landmarkFiltering: {
      enabled: true,
    }
  });

  // Listen for settings updates from other components
  useEffect(() => {
    const listener = addListener(EventType.SETTINGS_VALUE_CHANGE, (data) => {
      if (data.section === 'performance') {
        setSettings(prev => ({
          ...prev,
          [data.setting]: data.value
        }));
      }
    });

    return () => listener.remove();
  }, []);

  const handleThrottlingChange = (enabled: boolean) => {
    const newThrottling = { ...settings.throttling, enabled };
    setSettings(prev => ({
      ...prev,
      throttling: newThrottling
    }));
    
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'throttling',
      value: newThrottling
    });
  };

  const handleThrottlingIntervalChange = (value: number[]) => {
    const interval = value[0];
    const newThrottling = { ...settings.throttling, interval };
    setSettings(prev => ({
      ...prev,
      throttling: newThrottling
    }));
    
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'throttling',
      value: newThrottling
    });
  };

  const handleFrameSkipChange = (value: string) => {
    const processEveryNth = parseInt(value);
    const newFrameProcessing = { ...settings.frameProcessing, processEveryNth };
    setSettings(prev => ({
      ...prev,
      frameProcessing: newFrameProcessing
    }));
    
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'frameProcessing',
      value: newFrameProcessing
    });
  };

  const handleFilteringChange = (enabled: boolean) => {
    const newFiltering = { ...settings.landmarkFiltering, enabled };
    setSettings(prev => ({
      ...prev,
      landmarkFiltering: newFiltering
    }));
    
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'landmarkFiltering',
      value: newFiltering
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-xl font-semibold text-foreground mb-4">
        Performance Optimization
      </div>
      
      <div className="text-sm text-muted-foreground mb-8">
        These settings allow you to optimize the application's performance based on your hardware capabilities.
        If you experience lag or slowdowns, try adjusting these settings.
      </div>
      
      <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-md font-medium">
            UI Throttling
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="throttling-enabled" className="flex flex-col gap-1">
                  <span>Enable UI Throttling</span>
                  <span className="font-normal text-xs text-muted-foreground">
                    Limits how often UI updates are processed
                  </span>
                </Label>
                <Switch 
                  id="throttling-enabled"
                  checked={settings.throttling.enabled}
                  onCheckedChange={handleThrottlingChange}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">Throttle Interval</Label>
                  <span className="text-sm font-medium">{settings.throttling.interval} ms</span>
                </div>
                <Slider
                  disabled={!settings.throttling.enabled}
                  defaultValue={[settings.throttling.interval]}
                  min={50}
                  max={500}
                  step={50}
                  onValueChange={handleThrottlingIntervalChange}
                />
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>Responsive (50ms)</span>
                  <span>Less UI Load (500ms)</span>
                </div>
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="item-2">
          <AccordionTrigger className="text-md font-medium">
            Frame Processing
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="frame-skip" className="text-sm">Process Every Nth Frame</Label>
                <Select 
                  value={settings.frameProcessing.processEveryNth.toString()}
                  onValueChange={handleFrameSkipChange}
                >
                  <SelectTrigger id="frame-skip">
                    <SelectValue placeholder="Select frame processing rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Process Every Frame (Highest CPU)</SelectItem>
                    <SelectItem value="2">Process Every 2nd Frame</SelectItem>
                    <SelectItem value="3">Process Every 3rd Frame (Balanced)</SelectItem>
                    <SelectItem value="4">Process Every 4th Frame</SelectItem>
                    <SelectItem value="5">Process Every 5th Frame (Lowest CPU)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground pt-1">
                  Higher values reduce CPU usage but may make gesture recognition less responsive
                </p>
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="item-3">
          <AccordionTrigger className="text-md font-medium">
            Landmark Filtering
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="filtering-enabled" className="flex flex-col gap-1">
                  <span>Enable Landmark Filtering</span>
                  <span className="font-normal text-xs text-muted-foreground">
                    Applies smoothing to hand landmarks to reduce jitter
                  </span>
                </Label>
                <Switch 
                  id="filtering-enabled"
                  checked={settings.landmarkFiltering.enabled}
                  onCheckedChange={handleFilteringChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Disabling filtering may improve performance but will result in shakier hand tracking
              </p>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <div className="mt-8 p-4 bg-muted/50 rounded-md">
        <h4 className="text-sm font-medium mb-2">Performance Tips</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li>If you experience lag in the application, try increasing the throttle interval and frame skip value</li>
          <li>Modern computers can usually handle landmark filtering without issues</li>
          <li>For the best balance of performance and responsiveness, use the default settings</li>
          <li>On low-power devices, try disabling filtering and increasing frame skip to 4 or 5</li>
        </ul>
      </div>
    </div>
  );
};

export default PerformanceSettings;