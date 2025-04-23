import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataFlowDiagram from "@/components/DataFlowDiagram";
import PerformanceSettings from "@/components/settings/subtabs/PerformanceSettings";

const DebuggingSettings = () => {
  const [activeTab, setActiveTab] = useState('performance');
  
  return (
    <div className="space-y-4">
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="architecture">Architecture</TabsTrigger>
          <TabsTrigger value="logging">Logging</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance" className="space-y-4 mt-4">
          <PerformanceSettings />
        </TabsContent>
        
        <TabsContent value="architecture" className="space-y-4 mt-4">
          <DataFlowDiagram />
        </TabsContent>
        
        <TabsContent value="logging" className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground">
            Logging settings coming soon...
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DebuggingSettings;