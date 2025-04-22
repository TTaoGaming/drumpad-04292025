import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { EventType, dispatch } from '@/lib/eventBus';
import OneEuroFilterSettings from '../subtabs/OneEuroFilterSettings';
import HandLandmarksSettings from '../subtabs/HandLandmarksSettings';
import GestureRecognitionSettings from '../subtabs/GestureRecognitionSettings';

export type HandTrackingSubTab = 'landmarks' | 'filters' | 'gestures';

const HandTrackingSettings: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<HandTrackingSubTab>('landmarks');

  const handleSubTabChange = (value: string) => {
    setActiveSubTab(value as HandTrackingSubTab);
    
    // Dispatch event for subtab change
    dispatch(EventType.SETTINGS_SUBTAB_CHANGE, { 
      mainTab: 'hand-tracking',
      subTab: value 
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-md font-medium mb-2">Hand Tracking Settings</h4>
      
      {/* Sub-tabs for Hand Tracking */}
      <Tabs 
        defaultValue="landmarks" 
        value={activeSubTab}
        onValueChange={handleSubTabChange}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 bg-black/20">
          <TabsTrigger 
            value="landmarks"
            className={cn(
              "text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
            )}
          >
            Landmarks
          </TabsTrigger>
          <TabsTrigger 
            value="filters"
            className={cn(
              "text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
            )}
          >
            Filters
          </TabsTrigger>
          <TabsTrigger 
            value="gestures"
            className={cn(
              "text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
            )}
          >
            Gestures
          </TabsTrigger>
        </TabsList>
        
        {/* Sub-tab content */}
        <TabsContent value="landmarks" className="mt-2 bg-black/20 p-3 rounded-md">
          <HandLandmarksSettings />
        </TabsContent>
        
        <TabsContent value="filters" className="mt-2 bg-black/20 p-3 rounded-md">
          <OneEuroFilterSettings />
        </TabsContent>
        
        <TabsContent value="gestures" className="mt-2 bg-black/20 p-3 rounded-md">
          <GestureRecognitionSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HandTrackingSettings;