import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { EventType, dispatch } from '@/lib/eventBus';
import { Card, CardContent } from '@/components/ui/card';

export type MarkerTrackingSubTab = 'detection' | 'tracking' | 'regions';

const MarkerTrackingSettings: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<MarkerTrackingSubTab>('detection');

  const handleSubTabChange = (value: string) => {
    setActiveSubTab(value as MarkerTrackingSubTab);
    
    // Dispatch event for subtab change
    dispatch(EventType.SETTINGS_SUBTAB_CHANGE, { 
      mainTab: 'marker-tracking',
      subTab: value 
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-md font-medium mb-2">Marker Tracking Settings</h4>
      
      {/* Sub-tabs for Marker Tracking */}
      <Tabs 
        defaultValue="detection" 
        value={activeSubTab}
        onValueChange={handleSubTabChange}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 bg-black/20">
          <TabsTrigger 
            value="detection"
            className={cn(
              "text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
            )}
          >
            Detection
          </TabsTrigger>
          <TabsTrigger 
            value="tracking"
            className={cn(
              "text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
            )}
          >
            Tracking
          </TabsTrigger>
          <TabsTrigger 
            value="regions"
            className={cn(
              "text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
            )}
          >
            Regions
          </TabsTrigger>
        </TabsList>
        
        {/* Sub-tab content */}
        <TabsContent value="detection" className="mt-2 bg-black/20 p-3 rounded-md">
          <Card className="bg-black/20 border-0">
            <CardContent className="p-4">
              <p className="text-xs text-white/70">
                Marker detection settings will be available here.
                This feature is coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tracking" className="mt-2 bg-black/20 p-3 rounded-md">
          <Card className="bg-black/20 border-0">
            <CardContent className="p-4">
              <p className="text-xs text-white/70">
                Marker tracking settings will be available here.
                This feature is coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="regions" className="mt-2 bg-black/20 p-3 rounded-md">
          <Card className="bg-black/20 border-0">
            <CardContent className="p-4">
              <p className="text-xs text-white/70">
                Region of interest settings will be available here.
                This feature is coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarkerTrackingSettings;