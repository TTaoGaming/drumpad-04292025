/**
 * Drawing Settings Tab
 * 
 * Contains settings for drawing using pinch gestures
 */
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import DrawingSettingsSubtab from '@/components/settings/subtabs/DrawingSettings';

const DrawingSettings: React.FC = () => {
  const handleTabChange = (value: string) => {
    dispatch(EventType.SETTINGS_SUBTAB_CHANGE, { 
      tab: 'drawing', 
      subtab: value 
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Drawing Settings</h2>
        <p className="text-sm text-white/60">
          Configure drawing behavior with pinch gestures
        </p>
      </div>
      
      <Tabs defaultValue="drawing" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-1 h-9 mb-4">
          <TabsTrigger value="drawing" className="text-xs">Drawing Canvas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="drawing" className="mt-0 pt-0">
          <DrawingSettingsSubtab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DrawingSettings;