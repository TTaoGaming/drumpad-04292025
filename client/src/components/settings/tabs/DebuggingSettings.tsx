import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addListener, dispatch, EventType } from '../../../lib/eventBus';
import PerformanceSettings from '../subtabs/PerformanceSettings';
import DataFlowDiagram from '../../DataFlowDiagram';

/**
 * Debugging Settings Component
 * 
 * Provides tools and settings for debugging the application, including:
 * - Performance optimization settings
 * - Application architecture visualization
 * - Debug logging settings
 */
const DebuggingSettings = () => {
  const [activeSubtab, setActiveSubtab] = useState('performance');
  
  const handleSubtabChange = (value: string) => {
    setActiveSubtab(value);
    dispatch(EventType.SETTINGS_SUBTAB_CHANGE, {
      tab: 'debugging',
      subtab: value
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-2xl font-bold text-foreground">
        Debugging Tools
      </div>
      
      <div className="text-muted-foreground">
        These settings are designed for advanced users who want to optimize performance 
        or understand how the application works under the hood.
      </div>
      
      <Tabs 
        value={activeSubtab} 
        onValueChange={handleSubtabChange}
        className="space-y-4"
      >
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="architecture">Architecture</TabsTrigger>
          <TabsTrigger value="logging">Logging</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance" className="space-y-4">
          <PerformanceSettings />
        </TabsContent>
        
        <TabsContent value="architecture" className="space-y-4">
          <div className="text-xl font-semibold text-foreground mb-4">
            Application Architecture
          </div>
          
          <div className="text-sm text-muted-foreground mb-8">
            This diagram shows how data flows through the application, from webcam input to 
            hand tracking and gesture recognition.
          </div>
          
          <DataFlowDiagram />
        </TabsContent>
        
        <TabsContent value="logging" className="space-y-4">
          <div className="text-xl font-semibold text-foreground mb-4">
            Debug Logging
          </div>
          
          <div className="text-sm text-muted-foreground mb-8">
            Configure logging settings to help diagnose issues.
          </div>
          
          <div className="p-6 rounded-lg bg-card text-center">
            <p className="text-muted-foreground">Logging settings coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DebuggingSettings;