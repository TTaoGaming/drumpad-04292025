import React, { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { EventType, dispatch } from '@/lib/eventBus';

// Import settings content components
import HandTrackingSettings from './tabs/HandTrackingSettings';
import MarkerTrackingSettings from './tabs/MarkerTrackingSettings';
import DebuggingSettings from './tabs/DebuggingSettings';
import GettingStartedSettings from './tabs/GettingStartedSettings';

export type SettingsTab = 'getting-started' | 'marker-tracking' | 'hand-tracking' | 'debugging';

const SettingsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('getting-started');

  const handleTabChange = (value: string) => {
    setActiveTab(value as SettingsTab);
    
    // Dispatch event for tab change
    dispatch(EventType.SETTINGS_TAB_CHANGE, { tab: value });
  };

  const handleOpenSettings = () => {
    setIsOpen(true);
    dispatch(EventType.SETTINGS_PANEL_OPEN, {});
  };

  const handleCloseSettings = () => {
    setIsOpen(false);
    dispatch(EventType.SETTINGS_PANEL_CLOSE, {});
  };

  return (
    <div className="fixed right-0 top-1/4 z-30">
      {/* Settings panel when open */}
      {isOpen && (
        <div className="bg-black/80 backdrop-blur-sm text-white p-4 rounded-l-lg shadow-lg w-96 animate-in slide-in-from-right duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Settings</h3>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleCloseSettings}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <X size={16} />
            </Button>
          </div>
          
          {/* Main tabs */}
          <Tabs 
            defaultValue="getting-started" 
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 mb-4 bg-black/30">
              <TabsTrigger 
                value="getting-started"
                className={cn(
                  "data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
                )}
              >
                Get Started
              </TabsTrigger>
              <TabsTrigger 
                value="marker-tracking"
                className={cn(
                  "data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
                )}
              >
                Markers
              </TabsTrigger>
              <TabsTrigger 
                value="hand-tracking"
                className={cn(
                  "data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
                )}
              >
                Hands
              </TabsTrigger>
              <TabsTrigger 
                value="debugging"
                className={cn(
                  "data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
                )}
              >
                Debug
              </TabsTrigger>
            </TabsList>
            
            {/* Tab content */}
            <TabsContent value="getting-started" className="mt-0">
              <GettingStartedSettings />
            </TabsContent>
            
            <TabsContent value="marker-tracking" className="mt-0">
              <MarkerTrackingSettings />
            </TabsContent>
            
            <TabsContent value="hand-tracking" className="mt-0">
              <HandTrackingSettings />
            </TabsContent>
            
            <TabsContent value="debugging" className="mt-0">
              <DebuggingSettings />
            </TabsContent>
          </Tabs>
          
          <div className="mt-4 pt-4 border-t border-white/20 text-xs opacity-70">
            <p>
              Adjust settings to customize the application behavior.
              Changes are applied immediately.
            </p>
          </div>
        </div>
      )}
      
      {/* Only show the toggle button when panel is closed */}
      {!isOpen && (
        <Button 
          variant="default"
          size="icon"
          className="h-12 w-12 shadow-lg rounded-l-md rounded-r-none bg-black/80 hover:bg-black"
          onClick={handleOpenSettings}
        >
          <Settings size={20} />
        </Button>
      )}
    </div>
  );
};

export default SettingsPanel;