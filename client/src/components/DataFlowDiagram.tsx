import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * Data Flow Diagram Component
 * 
 * Displays a visual representation of the application's data flow architecture
 * using ASCII art and tables for simplicity and compatibility
 */
const DataFlowDiagram: React.FC = () => {
  const [visType, setVisType] = useState<'ascii' | 'table'>('ascii');
  
  return (
    <div className="space-y-3">
      <Tabs defaultValue="ascii" className="w-full" onValueChange={(v) => setVisType(v as 'ascii' | 'table')}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="ascii">Flow Diagram</TabsTrigger>
          <TabsTrigger value="table">Data Table</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ascii" className="w-full overflow-x-auto">
          <div className="bg-black/30 p-4 rounded-md font-mono text-xs leading-5 whitespace-pre text-white/80 min-w-[700px]">
{`
┌───────────────┐     ┌────────────┐     ┌────────────────┐     ┌───────────────┐
│    Webcam     │────▶│  MediaPipe │────▶│ Landmark Filter │────▶│  Angle Calc   │
│  (30-60 FPS)  │     │(Hand Detect)│     │   (One Euro)    │     │  (PIP Joint)  │
└───────────────┘     └────────────┘     └────────────────┘     └───────────────┘
                                                                        │
                                                                        ▼
┌───────────────┐     ┌────────────┐     ┌────────────────┐     ┌───────────────┐
│   UI Render   │◀────│  EventBus  │◀────│ State Hysteresis│◀────│ State Detect  │
│  (React DOM)  │     │ (Messages) │     │  (Stability)    │     │(Bent/Straight)│
└───────────────┘     └────────────┘     └────────────────┘     └───────────────┘

┌─ Performance Optimization Points ──────────────────────────────────────────────┐
│                                                                                │
│ 1. Frame Processing (Skip frames) - Controls how often a new frame is processed │
│ 2. Landmark Filtering - Smooth but adds processing cost                        │
│ 3. UI Throttling - Batches visual updates to reduce render frequency           │
│ 4. State Hysteresis - Prevents flickering by requiring consistent readings     │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘

┌─ Data Type Flow ─────────────────────────────────────────────────────────────┐
│                                                                              │
│ Video Frame → Hand Landmarks → Filtered Points → Angles → States → UI Events │
│  (Image)     (21 3D points)   (Smoothed XYZ)   (Degrees) (S/B/I)  (React)    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
`}
          </div>
        </TabsContent>
        
        <TabsContent value="table">
          <Table className="border border-white/10 rounded-md">
            <TableCaption>Application Data Flow and Processing Pipeline</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Stage</TableHead>
                <TableHead>Input Data</TableHead>
                <TableHead>Process</TableHead>
                <TableHead>Output Data</TableHead>
                <TableHead>Performance Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">Video Capture</TableCell>
                <TableCell>Camera feed</TableCell>
                <TableCell>Capture frames (30-60 FPS)</TableCell>
                <TableCell>Video frames</TableCell>
                <TableCell className="text-yellow-500">Medium</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-semibold">Hand Detection</TableCell>
                <TableCell>Video frames</TableCell>
                <TableCell>MediaPipe ML model</TableCell>
                <TableCell>21 hand landmarks</TableCell>
                <TableCell className="text-red-500">High</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-semibold">Filtering</TableCell>
                <TableCell>Raw landmarks</TableCell>
                <TableCell>One Euro Filter</TableCell>
                <TableCell>Smooth landmarks</TableCell>
                <TableCell className="text-green-500">Low</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-semibold">Angle Calculation</TableCell>
                <TableCell>Filtered landmarks</TableCell>
                <TableCell>PIP joint angle math</TableCell>
                <TableCell>Finger flexion angles</TableCell>
                <TableCell className="text-green-500">Low</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-semibold">State Detection</TableCell>
                <TableCell>Joint angles</TableCell>
                <TableCell>Threshold comparison</TableCell>
                <TableCell>Finger states (S/B/I)</TableCell>
                <TableCell className="text-green-500">Very Low</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-semibold">Hysteresis</TableCell>
                <TableCell>Raw states</TableCell>
                <TableCell>State stability check</TableCell>
                <TableCell>Stable finger states</TableCell>
                <TableCell className="text-green-500">Very Low</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-semibold">Event System</TableCell>
                <TableCell>State changes</TableCell>
                <TableCell>EventBus dispatch</TableCell>
                <TableCell>UI update events</TableCell>
                <TableCell className="text-yellow-500">Medium</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-semibold">UI Rendering</TableCell>
                <TableCell>Event data</TableCell>
                <TableCell>React DOM updates</TableCell>
                <TableCell>Visual feedback</TableCell>
                <TableCell className="text-yellow-500">Medium</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
      
      <div className="space-y-1 pt-2">
        <h5 className="text-sm font-semibold">Performance Bottlenecks</h5>
        <ul className="text-xs space-y-1 pl-5 list-disc">
          <li><span className="font-medium">MediaPipe Hand Detection</span> - Most computationally expensive step</li>
          <li><span className="font-medium">UI Updates</span> - Frequent DOM changes can cause browser to lag</li>
          <li><span className="font-medium">Event Dispatching</span> - Too many events in quick succession</li>
        </ul>
      </div>
      
      <div className="space-y-1 pt-2">
        <h5 className="text-sm font-semibold">Optimization Techniques</h5>
        <ul className="text-xs space-y-1 pl-5 list-disc">
          <li><span className="font-medium">Frame Skipping</span> - Process every Nth frame instead of every frame</li>
          <li><span className="font-medium">UI Throttling</span> - Batch UI updates to reduce render frequency</li>
          <li><span className="font-medium">Landmark Filtering</span> - Optional but helps prevent jitter</li>
          <li><span className="font-medium">State Hysteresis</span> - Prevents state flickering</li>
        </ul>
      </div>
    </div>
  );
};

export default DataFlowDiagram;