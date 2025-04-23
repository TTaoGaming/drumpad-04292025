import { useEffect, useState } from "react";
import { dispatch, EventType, addListener } from "@/lib/eventBus";
import { DEFAULT_OPTIMIZATION_SETTINGS } from "@/lib/handTrackingOptimizer";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

const PerformanceSettings = () => {
  // UI throttling settings
  const [throttling, setThrottling] = useState({
    enabled: true,
    interval: 200, // ms
  });
  
  // Frame processing settings
  const [frameProcessing, setFrameProcessing] = useState({
    processEveryNth: 3, // Process every 3rd frame
  });
  
  // Landmark filtering settings
  const [landmarkFiltering, setLandmarkFiltering] = useState({
    enabled: true,
  });
  
  // ROI optimization settings
  const [roiOptimization, setRoiOptimization] = useState({
    enabled: true,
    minROISize: DEFAULT_OPTIMIZATION_SETTINGS.minROISize,
    maxROISize: DEFAULT_OPTIMIZATION_SETTINGS.maxROISize,
    velocityMultiplier: DEFAULT_OPTIMIZATION_SETTINGS.velocityMultiplier,
    movementThreshold: DEFAULT_OPTIMIZATION_SETTINGS.movementThreshold,
    maxTimeBetweenFullFrames: DEFAULT_OPTIMIZATION_SETTINGS.maxTimeBetweenFullFrames,
  });
  
  // Listen for existing settings when the component mounts
  useEffect(() => {
    const settingsListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'performance') {
          if (data.setting === 'throttling') {
            setThrottling(data.value);
          } else if (data.setting === 'frameProcessing') {
            setFrameProcessing(data.value);
          } else if (data.setting === 'landmarkFiltering') {
            setLandmarkFiltering(data.value);
          } else if (data.setting === 'roiOptimization') {
            setRoiOptimization(data.value);
          }
        }
      }
    );
    
    return () => {
      settingsListener.remove();
    };
  }, []);
  
  // Throttling enabled toggle
  const handleThrottlingToggle = (enabled: boolean) => {
    const newThrottling = { ...throttling, enabled };
    setThrottling(newThrottling);
    
    // Dispatch to update performance settings
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'throttling',
      value: newThrottling
    });
  };
  
  // Throttling interval change
  const handleThrottlingIntervalChange = (values: number[]) => {
    const interval = values[0];
    const newThrottling = { ...throttling, interval };
    setThrottling(newThrottling);
    
    // Dispatch to update performance settings
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'throttling',
      value: newThrottling
    });
  };
  
  // Frame processing change
  const handleFrameProcessingChange = (value: number) => {
    const newFrameProcessing = { processEveryNth: value };
    setFrameProcessing(newFrameProcessing);
    
    // Dispatch to update performance settings
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'frameProcessing',
      value: newFrameProcessing
    });
  };
  
  // Landmark filtering toggle
  const handleLandmarkFilteringToggle = (enabled: boolean) => {
    const newLandmarkFiltering = { enabled };
    setLandmarkFiltering(newLandmarkFiltering);
    
    // Dispatch to update performance settings
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'landmarkFiltering',
      value: newLandmarkFiltering
    });
  };
  
  // ROI optimization toggle
  const handleRoiOptimizationToggle = (enabled: boolean) => {
    const newRoiOptimization = { ...roiOptimization, enabled };
    setRoiOptimization(newRoiOptimization);
    
    // Dispatch to update performance settings
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'roiOptimization',
      value: newRoiOptimization
    });
  };
  
  // ROI optimization settings change
  const handleRoiSettingChange = (
    setting: 'minROISize' | 'maxROISize' | 'velocityMultiplier' | 'movementThreshold' | 'maxTimeBetweenFullFrames',
    values: number[]
  ) => {
    const value = values[0];
    const newRoiOptimization = { ...roiOptimization, [setting]: value };
    setRoiOptimization(newRoiOptimization);
    
    // Dispatch to update performance settings
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'performance',
      setting: 'roiOptimization',
      value: newRoiOptimization
    });
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Performance Settings</CardTitle>
          <CardDescription>
            Optimize the application for your device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="optimization">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="optimization">Optimization Strategy</TabsTrigger>
              <TabsTrigger value="ui">UI Performance</TabsTrigger>
            </TabsList>
            
            <TabsContent value="optimization" className="space-y-5 pt-4">
              {/* ROI-based Optimization */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="roi-optimization" className="text-base">
                      Region of Interest (ROI) Optimization
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Intelligently focus processing on hand movement areas
                    </p>
                  </div>
                  <Switch 
                    id="roi-optimization"
                    checked={roiOptimization.enabled}
                    onCheckedChange={handleRoiOptimizationToggle}
                  />
                </div>
                
                {roiOptimization.enabled && (
                  <div className="space-y-4 pl-2 border-l-2 border-primary/20 ml-2">
                    {/* Min ROI Size */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="min-roi-size">
                          Minimum ROI Size ({(roiOptimization.minROISize * 100).toFixed(0)}%)
                        </Label>
                        <span className="text-sm text-muted-foreground">
                          {(roiOptimization.minROISize * 100).toFixed(0)}% of frame
                        </span>
                      </div>
                      <Slider
                        id="min-roi-size"
                        min={0.1}
                        max={0.5}
                        step={0.05}
                        value={[roiOptimization.minROISize]}
                        onValueChange={(values) => handleRoiSettingChange('minROISize', values)}
                      />
                    </div>
                    
                    {/* Max ROI Size */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="max-roi-size">
                          Maximum ROI Size ({(roiOptimization.maxROISize * 100).toFixed(0)}%)
                        </Label>
                        <span className="text-sm text-muted-foreground">
                          {(roiOptimization.maxROISize * 100).toFixed(0)}% of frame
                        </span>
                      </div>
                      <Slider
                        id="max-roi-size"
                        min={0.3}
                        max={1.0}
                        step={0.05}
                        value={[roiOptimization.maxROISize]}
                        onValueChange={(values) => handleRoiSettingChange('maxROISize', values)}
                      />
                    </div>
                    
                    {/* Movement Threshold */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="movement-threshold">
                          Movement Threshold
                        </Label>
                        <span className="text-sm text-muted-foreground">
                          {(roiOptimization.movementThreshold * 100).toFixed(0)}% movement
                        </span>
                      </div>
                      <Slider
                        id="movement-threshold"
                        min={0.01}
                        max={0.10}
                        step={0.01}
                        value={[roiOptimization.movementThreshold]}
                        onValueChange={(values) => handleRoiSettingChange('movementThreshold', values)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Lower = more updates, Higher = better performance
                      </p>
                    </div>
                    
                    {/* Max time between full frames */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="max-time-between-frames">
                          Full Frame Interval
                        </Label>
                        <span className="text-sm text-muted-foreground">
                          {roiOptimization.maxTimeBetweenFullFrames}ms
                        </span>
                      </div>
                      <Slider
                        id="max-time-between-frames"
                        min={100}
                        max={1000}
                        step={100}
                        value={[roiOptimization.maxTimeBetweenFullFrames]}
                        onValueChange={(values) => handleRoiSettingChange('maxTimeBetweenFullFrames', values)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Force a full frame update every X milliseconds
                      </p>
                    </div>
                  </div>
                )}
                
                <Separator />
                
                {/* Frame Skipping (alternative to ROI) */}
                <div className={`space-y-2 ${roiOptimization.enabled ? 'opacity-50' : ''}`}>
                  <Label className="text-base">Frame Processing</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    {roiOptimization.enabled 
                      ? "Disabled when ROI optimization is active" 
                      : "Process every Nth frame (higher = better performance)"}
                  </p>
                  
                  <RadioGroup 
                    value={frameProcessing.processEveryNth.toString()}
                    onValueChange={(value) => {
                      if (!roiOptimization.enabled) {
                        handleFrameProcessingChange(parseInt(value));
                      }
                    }}
                    className="flex flex-wrap gap-3"
                    disabled={roiOptimization.enabled}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="1" id="frame-1" />
                      <Label htmlFor="frame-1">Every Frame</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="2" id="frame-2" />
                      <Label htmlFor="frame-2">Every 2nd</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="3" id="frame-3" />
                      <Label htmlFor="frame-3">Every 3rd</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="4" id="frame-4" />
                      <Label htmlFor="frame-4">Every 4th</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="5" id="frame-5" />
                      <Label htmlFor="frame-5">Every 5th</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <Separator />
                
                {/* Landmark Filtering */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="landmark-filtering" className="text-base">
                      Landmark Filtering
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Apply 1€ filter to smooth hand movements
                    </p>
                  </div>
                  <Switch 
                    id="landmark-filtering"
                    checked={landmarkFiltering.enabled}
                    onCheckedChange={handleLandmarkFilteringToggle}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="ui" className="space-y-5 pt-4">
              {/* UI Throttling */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ui-throttling" className="text-base">
                      UI Throttling
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Limit update frequency of UI elements
                    </p>
                  </div>
                  <Switch 
                    id="ui-throttling"
                    checked={throttling.enabled}
                    onCheckedChange={handleThrottlingToggle}
                  />
                </div>
                
                {throttling.enabled && (
                  <div className="space-y-2 pl-2 border-l-2 border-primary/20 ml-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="throttling-interval">
                        Throttling Interval
                      </Label>
                      <span className="text-sm text-muted-foreground">
                        {throttling.interval}ms
                      </span>
                    </div>
                    <Slider
                      id="throttling-interval"
                      min={50}
                      max={500}
                      step={50}
                      value={[throttling.interval]}
                      onValueChange={handleThrottlingIntervalChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower = more responsive, Higher = better performance
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceSettings;