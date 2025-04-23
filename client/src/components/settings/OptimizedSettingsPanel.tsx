import React, { useState, useEffect, useCallback, memo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { EventType, dispatch, addListener } from '@/lib/eventBus';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettingsWorker } from '@/contexts/SettingsWorkerContext';

// Import settings content components
import HandTrackingSettings from './tabs/HandTrackingSettings';
import MarkerTrackingSettings from './tabs/MarkerTrackingSettings';
import DebuggingSettings from './tabs/DebuggingSettings';
import GettingStartedSettings from './tabs/GettingStartedSettings';

export type SettingsTab = 'getting-started' | 'marker-tracking' | 'hand-tracking' | 'debugging';

// Fixed panel width - no resizing
const PANEL_WIDTH = 380;

// Use memo for tab components to reduce re-renders
const MemoizedGettingStartedSettings = memo(GettingStartedSettings);
const MemoizedMarkerTrackingSettings = memo(MarkerTrackingSettings);
const MemoizedHandTrackingSettings = memo(HandTrackingSettings);
const MemoizedDebuggingSettings = memo(DebuggingSettings);

const OptimizedSettingsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('getting-started');
  const { worker, updateSetting } = useSettingsWorker();
  
  // Memoized handler to avoid unnecessary re-creation
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as SettingsTab);
    
    // Dispatch event for tab change, using the settings worker
    if (worker) {
      updateSetting('ui', 'activeTab', value);
    } else {
      // Fallback to event bus if worker is not available
      dispatch(EventType.SETTINGS_TAB_CHANGE, { tab: value });
    }
  }, [worker, updateSetting]);

  const handleCloseSettings = useCallback(() => {
    setIsOpen(false);
    dispatch(EventType.SETTINGS_PANEL_CLOSE, {});
  }, []);

  // Listen for events to open/close the settings panel
  useEffect(() => {
    // Listen for open settings panel event (from controls overlay)
    const openListener = addListener(EventType.SETTINGS_PANEL_OPEN, () => {
      setIsOpen(true);
    });
    
    // Listen for close settings panel event
    const closeListener = addListener(EventType.SETTINGS_PANEL_CLOSE, () => {
      setIsOpen(false);
    });
    
    return () => {
      openListener.remove();
      closeListener.remove();
    };
  }, []);
  
  // Don't render anything when closed to save memory and CPU
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed right-0 top-0 bottom-16 z-30 flex h-[calc(100vh-64px)]"
      style={{ width: `${PANEL_WIDTH}px` }}
    >
      {/* Main panel with memoized children */}
      <div className="flex-1 bg-black/85 backdrop-blur-md text-white rounded-l-lg shadow-xl animate-in slide-in-from-right duration-300 overflow-hidden flex flex-col border-l border-white/5">
        {/* Header with title and close button */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-gray-900/50">
          <h3 className="font-semibold text-base">Settings</h3>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleCloseSettings}
            className="h-7 w-7 text-white hover:bg-white/10 rounded-full"
          >
            <X size={15} />
          </Button>
        </div>
        
        {/* Main tabs */}
        <Tabs 
          defaultValue="getting-started" 
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid grid-cols-4 px-4 pt-2 bg-transparent border-b border-white/10">
            <TabsTrigger 
              value="getting-started"
              className={cn(
                "h-9 rounded-none border-b-2 data-[state=active]:border-white border-transparent",
                "bg-transparent data-[state=active]:bg-transparent hover:bg-gray-800/40",
                "text-white/60 data-[state=active]:text-white transition-colors font-medium"
              )}
            >
              Get Started
            </TabsTrigger>
            <TabsTrigger 
              value="marker-tracking"
              className={cn(
                "h-9 rounded-none border-b-2 data-[state=active]:border-white border-transparent",
                "bg-transparent data-[state=active]:bg-transparent hover:bg-gray-800/40",
                "text-white/60 data-[state=active]:text-white transition-colors font-medium"
              )}
            >
              Markers
            </TabsTrigger>
            <TabsTrigger 
              value="hand-tracking"
              className={cn(
                "h-9 rounded-none border-b-2 data-[state=active]:border-white border-transparent",
                "bg-transparent data-[state=active]:bg-transparent hover:bg-gray-800/40",
                "text-white/60 data-[state=active]:text-white transition-colors font-medium"
              )}
            >
              Hands
            </TabsTrigger>
            <TabsTrigger 
              value="debugging"
              className={cn(
                "h-9 rounded-none border-b-2 data-[state=active]:border-white border-transparent",
                "bg-transparent data-[state=active]:bg-transparent hover:bg-gray-800/40",
                "text-white/60 data-[state=active]:text-white transition-colors font-medium"
              )}
            >
              Debug
            </TabsTrigger>
          </TabsList>
          
          {/* Scrollable content area - only render active tab content */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full">
              <div className="px-4 py-4">
                {/* Tab content with memoized components */}
                <TabsContent value="getting-started" className="m-0 p-0">
                  <MemoizedGettingStartedSettings />
                </TabsContent>
                
                <TabsContent value="marker-tracking" className="m-0 p-0">
                  <MemoizedMarkerTrackingSettings />
                </TabsContent>
                
                <TabsContent value="hand-tracking" className="m-0 p-0">
                  <MemoizedHandTrackingSettings />
                </TabsContent>
                
                <TabsContent value="debugging" className="m-0 p-0">
                  <MemoizedDebuggingSettings />
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
        </Tabs>
        
        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/10 text-xs text-white/50 bg-gray-900/50">
          <p className="leading-relaxed">
            Changes to settings are applied immediately. Using worker thread for better performance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OptimizedSettingsPanel;