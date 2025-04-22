import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { EventType, dispatch } from '@/lib/eventBus';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export type DebuggingSubTab = 'performance' | 'visualization' | 'logging';

const DebuggingSettings: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<DebuggingSubTab>('performance');
  const [showFps, setShowFps] = useState(true);
  const [showTracking, setShowTracking] = useState(true);
  const [showProcessingTime, setShowProcessingTime] = useState(false);

  const handleSubTabChange = (value: string) => {
    setActiveSubTab(value as DebuggingSubTab);
    
    // Dispatch event for subtab change
    dispatch(EventType.SETTINGS_SUBTAB_CHANGE, { 
      mainTab: 'debugging',
      subTab: value 
    });
  };

  const handleToggleChange = (setting: string, value: boolean) => {
    // Dispatch setting change event
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'debugging',
      setting,
      value
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-md font-medium mb-2">Debugging Settings</h4>
      
      {/* Sub-tabs for Debugging */}
      <Tabs 
        defaultValue="performance" 
        value={activeSubTab}
        onValueChange={handleSubTabChange}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 bg-black/20">
          <TabsTrigger 
            value="performance"
            className={cn(
              "text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
            )}
          >
            Performance
          </TabsTrigger>
          <TabsTrigger 
            value="visualization"
            className={cn(
              "text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
            )}
          >
            Visualization
          </TabsTrigger>
          <TabsTrigger 
            value="logging"
            className={cn(
              "text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
            )}
          >
            Logging
          </TabsTrigger>
        </TabsList>
        
        {/* Sub-tab content */}
        <TabsContent value="performance" className="mt-2 bg-black/20 p-3 rounded-md">
          <Card className="bg-black/20 border-0">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Show FPS Counter</Label>
                  <p className="text-[10px] text-white/70">Display frames per second</p>
                </div>
                <Switch 
                  checked={showFps}
                  onCheckedChange={(checked) => {
                    setShowFps(checked);
                    handleToggleChange('showFps', checked);
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Show Processing Time</Label>
                  <p className="text-[10px] text-white/70">Display per-module processing time</p>
                </div>
                <Switch 
                  checked={showProcessingTime}
                  onCheckedChange={(checked) => {
                    setShowProcessingTime(checked);
                    handleToggleChange('showProcessingTime', checked);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="visualization" className="mt-2 bg-black/20 p-3 rounded-md">
          <Card className="bg-black/20 border-0">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Show Tracking Visualization</Label>
                  <p className="text-[10px] text-white/70">Display tracking points and connections</p>
                </div>
                <Switch 
                  checked={showTracking}
                  onCheckedChange={(checked) => {
                    setShowTracking(checked);
                    handleToggleChange('showTracking', checked);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="logging" className="mt-2 bg-black/20 p-3 rounded-md">
          <Card className="bg-black/20 border-0">
            <CardContent className="p-4">
              <p className="text-xs text-white/70">
                Logging settings will be available here.
                This feature is coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DebuggingSettings;