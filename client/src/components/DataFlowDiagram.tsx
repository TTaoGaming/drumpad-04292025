import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * Data Flow Diagram Component
 * 
 * Displays a visual representation of the application's data flow architecture
 * using ASCII art and tables for simplicity and compatibility
 */
const DataFlowDiagram: React.FC = () => {
  const [view, setView] = useState<string>('ascii');
  
  const asciiDiagram = `
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│               │    │               │    │               │
│    Camera     │───▶│   MediaPipe   │───▶│  Hand Tracker │
│    Input      │    │    Worker     │    │               │
│               │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
                            │                     │
                            ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│               │    │               │    │               │
│  ROI-based    │◀───│   EventBus    │───▶│  Performance  │
│  Optimizer    │    │  (Mediator)   │    │   Monitor     │
│               │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
                            │                     │
                            ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│               │    │               │    │               │
│   OpenCV      │◀───│    Canvas     │───▶│   Settings    │
│   Worker      │    │ Visualization │    │    Panel      │
│               │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
`;

  const componentsData = [
    { 
      name: 'Camera Input', 
      description: 'Provides webcam video stream',
      outputs: 'Raw video frames to MediaPipe Worker and visualization canvas'
    },
    { 
      name: 'MediaPipe Worker', 
      description: 'Hand landmark detection using MediaPipe Hands',
      outputs: 'Hand landmark coordinates, connection data'
    },
    { 
      name: 'Hand Tracker', 
      description: 'Processes and filters hand landmarks, applies 1€ filter',
      outputs: 'Filtered hand positions, finger flexion data'
    },
    { 
      name: 'ROI Optimizer', 
      description: 'Adaptive region-of-interest based on hand movement',
      outputs: 'Dynamic processing regions, movement prediction'
    },
    { 
      name: 'EventBus', 
      description: 'Communication mediator between components',
      outputs: 'Events distribution, state updates'
    },
    { 
      name: 'Performance Monitor', 
      description: 'FPS and processing time visualization',
      outputs: 'Real-time performance metrics'
    },
    { 
      name: 'OpenCV Worker', 
      description: 'Computer vision processing (feature extraction, tracking)',
      outputs: 'Processed frames, feature points, tracking data'
    },
    { 
      name: 'Canvas Visualization', 
      description: 'Renders hand landmarks, connections, measurements',
      outputs: 'Visual feedback to user interface'
    },
    { 
      name: 'Settings Panel', 
      description: 'UI for configuring application parameters',
      outputs: 'User configuration options, calibration controls'
    }
  ];

  const dataFlowDescription = [
    { 
      from: 'Camera', 
      to: 'MediaPipe Worker',
      data: 'Raw video frames (480p)',
      frequency: 'Every frame (30-60 FPS)'
    },
    { 
      from: 'MediaPipe Worker', 
      to: 'Hand Tracker',
      data: '21 landmarks per hand, x/y/z coordinates',
      frequency: 'Every processed frame'
    },
    { 
      from: 'Hand Tracker', 
      to: 'EventBus',
      data: 'Filtered landmarks, finger angles, state data',
      frequency: 'Throttled (200ms default)'
    },
    { 
      from: 'ROI Optimizer', 
      to: 'Hand Tracker',
      data: 'Processing region coordinates, movement predictions',
      frequency: 'On movement detection'
    },
    { 
      from: 'EventBus', 
      to: 'Canvas Visualization',
      data: 'Hand data, performance metrics, states',
      frequency: 'On data updates'
    },
    { 
      from: 'EventBus', 
      to: 'Settings Panel',
      data: 'Configuration updates, real-time measurements',
      frequency: 'On state changes'
    },
    { 
      from: 'Canvas Visualization', 
      to: 'User Interface',
      data: 'Visual representation of tracking and measurements',
      frequency: 'Every render frame'
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Application Architecture</CardTitle>
          <CardDescription>
            Visualization of component relationships and data flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={view} onValueChange={setView} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ascii">Diagram</TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="dataflow">Data Flow</TabsTrigger>
            </TabsList>
            
            <TabsContent value="ascii" className="mt-4">
              <div className="bg-black/40 p-4 rounded-md overflow-x-auto">
                <pre className="text-green-400 text-xs font-mono whitespace-pre">
                  {asciiDiagram}
                </pre>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>The application uses a mediator pattern (EventBus) to decouple components and simplify communication.</p>
                <p className="mt-2">The ROI Optimizer enhances performance by focusing processing on regions where hands are detected.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="components" className="mt-4">
              <div className="rounded-md overflow-hidden border border-gray-800">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-gray-900/50 bg-gray-900/20">
                      <TableHead className="text-white">Component</TableHead>
                      <TableHead className="text-white">Description</TableHead>
                      <TableHead className="text-white">Outputs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {componentsData.map((component, index) => (
                      <TableRow key={index} className="hover:bg-gray-900/50">
                        <TableCell className="font-medium">{component.name}</TableCell>
                        <TableCell>{component.description}</TableCell>
                        <TableCell className="text-sm">{component.outputs}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="dataflow" className="mt-4">
              <div className="rounded-md overflow-hidden border border-gray-800">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-gray-900/50 bg-gray-900/20">
                      <TableHead className="text-white">From</TableHead>
                      <TableHead className="text-white">To</TableHead>
                      <TableHead className="text-white">Data</TableHead>
                      <TableHead className="text-white">Frequency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataFlowDescription.map((flow, index) => (
                      <TableRow key={index} className="hover:bg-gray-900/50">
                        <TableCell className="font-medium">{flow.from}</TableCell>
                        <TableCell>{flow.to}</TableCell>
                        <TableCell className="text-sm">{flow.data}</TableCell>
                        <TableCell className="text-sm">{flow.frequency}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataFlowDiagram;