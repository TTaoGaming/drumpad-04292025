import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventType, dispatch } from '@/lib/eventBus';
import PerformanceSettings from '../subtabs/PerformanceSettings';
import DataFlowDiagram from '@/components/DataFlowDiagram';

const DebuggingSettings: React.FC = () => {
  const [showPerformanceMetrics, setShowPerformanceMetrics] = useState(true);
  const [showFPS, setShowFPS] = useState(true);
  const [logLevel, setLogLevel] = useState('info');
  const [consoleLines, setConsoleLines] = useState(50);
  
  const handleSettingsChange = () => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'debugging',
      value: {
        showPerformanceMetrics,
        showFPS,
        logLevel,
        consoleLines
      }
    });
  };
  
  const clearAllLogs = () => {
    dispatch(EventType.LOG, {
      message: 'All logs cleared by user',
      type: 'info'
    });
    // Additional event to actually clear logs
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'debugging',
      setting: 'clearLogs',
      value: true
    });
  };
  
  return (
    <div className="px-1 py-2">
      <h3 className="text-lg font-semibold mb-4">Debugging</h3>
      
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="logging">Logging</TabsTrigger>
          <TabsTrigger value="developer">Developer</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance" className="space-y-5">
          <div>
            <h4 className="text-sm font-medium mb-2">Display Options</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Performance Overlay</Label>
                <Switch 
                  checked={showPerformanceMetrics}
                  onCheckedChange={(checked) => {
                    setShowPerformanceMetrics(checked);
                    handleSettingsChange();
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show FPS Counter</Label>
                <Switch 
                  checked={showFPS}
                  onCheckedChange={(checked) => {
                    setShowFPS(checked);
                    handleSettingsChange();
                  }}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-4 pt-2 border-t border-white/10">
            {/* Performance Settings Component */}
            <PerformanceSettings />
          </div>
          
          <div className="pt-2 border-t border-white/10">
            <h4 className="text-sm font-medium mb-3">Application Data Flow</h4>
            <DataFlowDiagram />
          </div>
        </TabsContent>
        
        <TabsContent value="logging" className="space-y-4">
          <h4 className="text-sm font-medium mb-2">Logging Settings</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logLevel" className="text-xs">Log Level</Label>
              <Select 
                value={logLevel} 
                onValueChange={(value) => {
                  setLogLevel(value);
                  handleSettingsChange();
                }}
              >
                <SelectTrigger id="logLevel" className="w-full h-8 text-xs bg-black/30 border-white/20">
                  <SelectValue placeholder="Select log level" />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border-white/20">
                  <SelectItem value="debug" className="text-xs">Debug (Verbose)</SelectItem>
                  <SelectItem value="info" className="text-xs">Info (Default)</SelectItem>
                  <SelectItem value="warning" className="text-xs">Warning</SelectItem>
                  <SelectItem value="error" className="text-xs">Error Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="consoleLines" className="text-xs">Console History Size</Label>
                <span className="text-xs opacity-80">{consoleLines} lines</span>
              </div>
              <Slider
                id="consoleLines"
                min={10}
                max={200}
                step={10}
                value={[consoleLines]}
                onValueChange={(value) => {
                  setConsoleLines(value[0]);
                  handleSettingsChange();
                }}
                className="flex-1"
              />
            </div>
            
            <Button 
              variant="destructive" 
              size="sm"
              className="w-full mt-2 bg-red-900/50 hover:bg-red-800/50"
              onClick={clearAllLogs}
            >
              Clear Console
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="developer" className="space-y-4">
          <h4 className="text-sm font-medium mb-2">Developer Options</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Debug Overlays</Label>
              <Switch />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-xs">Export Diagnostic Data</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Export
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DebuggingSettings;