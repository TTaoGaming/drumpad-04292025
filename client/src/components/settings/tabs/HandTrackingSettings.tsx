import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OneEuroFilterSettings from '../subtabs/OneEuroFilterSettings';
import HandLandmarksSettings from '../subtabs/HandLandmarksSettings';
import GestureRecognitionSettings from '../subtabs/GestureRecognitionSettings';

const HandTrackingSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('landmarks');

  return (
    <div className="px-1 py-2">
      <h3 className="text-lg font-semibold mb-4">Hand Tracking</h3>
      
      <Tabs defaultValue="landmarks" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full h-9 bg-black/20">
          <TabsTrigger value="landmarks" className="text-xs px-2">Landmarks</TabsTrigger>
          <TabsTrigger value="filters" className="text-xs px-2">Filters</TabsTrigger>
          <TabsTrigger value="gestures" className="text-xs px-2">Gestures</TabsTrigger>
        </TabsList>
        
        <TabsContent value="landmarks" className="pt-4">
          <HandLandmarksSettings />
        </TabsContent>
        
        <TabsContent value="filters" className="pt-4">
          <OneEuroFilterSettings />
        </TabsContent>
        
        <TabsContent value="gestures" className="pt-4">
          <GestureRecognitionSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HandTrackingSettings;