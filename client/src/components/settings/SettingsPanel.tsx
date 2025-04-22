import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { EventType, dispatch, addListener } from '@/lib/eventBus';
import { ScrollArea } from '@/components/ui/scroll-area';

// Import settings content components
import HandTrackingSettings from './tabs/HandTrackingSettings';
import MarkerTrackingSettings from './tabs/MarkerTrackingSettings';
import DebuggingSettings from './tabs/DebuggingSettings';
import GettingStartedSettings from './tabs/GettingStartedSettings';

export type SettingsTab = 'getting-started' | 'marker-tracking' | 'hand-tracking' | 'debugging';

// Default and min/max panel width
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 300;
const MAX_WIDTH = 600;

const SettingsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('getting-started');
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(DEFAULT_WIDTH);

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

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    
    // Add event listeners to window
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  };

  // Handle resize movement
  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaX = startXRef.current - e.clientX;
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + deltaX));
    setPanelWidth(newWidth);
  };

  // Handle resize end
  const handleResizeEnd = () => {
    setIsResizing(false);
    
    // Remove event listeners from window
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
  };

  // Clean up event listeners
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  return (
    <>
      
      {/* Settings panel when open */}
      {isOpen && (
        <div 
          className="fixed right-0 top-0 bottom-16 z-30 flex h-[calc(100vh-64px)]"
          style={{ width: `${panelWidth}px` }}
        >
          {/* Resize handle - mobile style */}
          <div 
            ref={resizeHandleRef}
            className="absolute left-0 top-0 bottom-0 w-8 cursor-ew-resize flex items-center justify-center bg-gray-800/80 hover:bg-gray-700/80 active:bg-gray-600/80 transition-colors z-10 rounded-l-md shadow-lg"
            onMouseDown={handleResizeStart}
          >
            <div className="h-40 w-8 flex flex-col items-center justify-center">
              {/* Resize indicator lines */}
              <div className="h-24 w-2 flex flex-col items-center justify-around py-1">
                <div className="w-1.5 h-5 bg-white/40 rounded-full"></div>
                <div className="w-1.5 h-5 bg-white/40 rounded-full"></div>
                <div className="w-1.5 h-5 bg-white/40 rounded-full"></div>
              </div>
              
              {/* Resize icon */}
              <div className="mt-3 bg-white/20 p-1 rounded-full">
                <GripVertical size={16} className="text-white/70" />
              </div>
              
              {/* Resize text */}
              <div className="mt-3 rotate-90 text-white/50 text-[9px] tracking-wide">
                RESIZE
              </div>
            </div>
          </div>
          
          {/* Main panel */}
          <div className="flex-1 bg-black/80 backdrop-blur-sm text-white rounded-l-lg shadow-lg animate-in slide-in-from-right duration-300 overflow-hidden flex flex-col ml-1">
            {/* Header with title and close button */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
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
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid grid-cols-4 px-4 pt-2 bg-transparent border-b border-white/10 gap-1">
                <TabsTrigger 
                  value="getting-started"
                  className={cn(
                    "h-9 rounded-t-md border-b-2 border-transparent",
                    "bg-transparent data-[state=active]:bg-gray-700/70 hover:bg-gray-800/40",
                    "text-white/70 data-[state=active]:text-white transition-colors"
                  )}
                >
                  Get Started
                </TabsTrigger>
                <TabsTrigger 
                  value="marker-tracking"
                  className={cn(
                    "h-9 rounded-t-md border-b-2 border-transparent",
                    "bg-transparent data-[state=active]:bg-gray-700/70 hover:bg-gray-800/40",
                    "text-white/70 data-[state=active]:text-white transition-colors"
                  )}
                >
                  Markers
                </TabsTrigger>
                <TabsTrigger 
                  value="hand-tracking"
                  className={cn(
                    "h-9 rounded-t-md border-b-2 border-transparent",
                    "bg-transparent data-[state=active]:bg-gray-700/70 hover:bg-gray-800/40",
                    "text-white/70 data-[state=active]:text-white transition-colors"
                  )}
                >
                  Hands
                </TabsTrigger>
                <TabsTrigger 
                  value="debugging"
                  className={cn(
                    "h-9 rounded-t-md border-b-2 border-transparent",
                    "bg-transparent data-[state=active]:bg-gray-700/70 hover:bg-gray-800/40",
                    "text-white/70 data-[state=active]:text-white transition-colors"
                  )}
                >
                  Debug
                </TabsTrigger>
              </TabsList>
              
              {/* Scrollable content area */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full w-full">
                  <div className="px-4 py-4">
                    {/* Tab content */}
                    <TabsContent value="getting-started" className="m-0 p-0">
                      <GettingStartedSettings />
                    </TabsContent>
                    
                    <TabsContent value="marker-tracking" className="m-0 p-0">
                      <MarkerTrackingSettings />
                    </TabsContent>
                    
                    <TabsContent value="hand-tracking" className="m-0 p-0">
                      <HandTrackingSettings />
                    </TabsContent>
                    
                    <TabsContent value="debugging" className="m-0 p-0">
                      <DebuggingSettings />
                    </TabsContent>
                  </div>
                </ScrollArea>
              </div>
            </Tabs>
            
            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/10 text-xs opacity-70">
              <p>
                Adjust settings to customize the application behavior.
                Changes are applied immediately.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsPanel;