import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Data Flow Diagram Component
 * 
 * Displays a visual representation of the application's data flow architecture
 * using ASCII art and tables for simplicity and compatibility
 */
const DataFlowDiagram = () => {
  const [viewType, setViewType] = useState('ascii');
  
  return (
    <div className="space-y-4">
      <Tabs value={viewType} onValueChange={setViewType} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ascii">ASCII Diagram</TabsTrigger>
          <TabsTrigger value="table">Component Table</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ascii" className="mt-4">
          <div className="bg-card rounded-md overflow-auto p-6">
            <pre className="font-mono text-xs whitespace-pre text-card-foreground">
{`
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  User Browser  │  │  Camera Feed   │  │  MediaPipe     │  │  Landmark      │
│  Interface     │◄─┼─Input          │◄─┼─Hand Tracking  │◄─┼─Visualization  │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                   │                   │         
        ▼                   ▼                   ▼                   ▼         
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  Event Bus     │  │  Frame         │  │  1€ Filter     │  │  Finger        │
│  Messaging     │◄─┼─Processing     │◄─┼─Smoothing      │◄─┼─Tracking       │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                   │                   │         
        ▼                   ▼                   ▼                   ▼         
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  Settings      │  │  Performance   │  │  Gesture       │  │  Knuckle       │
│  Panel         │◄─┼─Optimization   │◄─┼─Recognition    │◄─┼─Ruler          │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘
`}
            </pre>
          </div>
          
          <div className="text-xs text-muted-foreground mt-4">
            <p className="mb-2">The diagram shows the flow of data through the main components:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>User interface captures webcam input</li>
              <li>MediaPipe processes video frames to detect hand landmarks</li>
              <li>1€ Filter smooths landmarks to reduce jitter</li>
              <li>Visualization components render the hand skeleton</li>
              <li>Gesture detection analyzes finger positions</li>
              <li>Event Bus enables communication between components</li>
              <li>Settings panel controls behavior of all components</li>
            </ol>
          </div>
        </TabsContent>
        
        <TabsContent value="table" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-2 text-left">Component</th>
                  <th className="border border-border p-2 text-left">Purpose</th>
                  <th className="border border-border p-2 text-left">Inputs</th>
                  <th className="border border-border p-2 text-left">Outputs</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border p-2 font-medium">Camera Manager</td>
                  <td className="border border-border p-2">Handles webcam access and provides video feed</td>
                  <td className="border border-border p-2">User camera permission</td>
                  <td className="border border-border p-2">Video stream, camera events</td>
                </tr>
                <tr>
                  <td className="border border-border p-2 font-medium">MediaPipe Handler</td>
                  <td className="border border-border p-2">Processes video frames to detect hand landmarks</td>
                  <td className="border border-border p-2">Video frames</td>
                  <td className="border border-border p-2">Hand landmark coordinates</td>
                </tr>
                <tr>
                  <td className="border border-border p-2 font-medium">1€ Filter</td>
                  <td className="border border-border p-2">Smooths hand landmarks to reduce jitter</td>
                  <td className="border border-border p-2">Raw landmark coordinates</td>
                  <td className="border border-border p-2">Filtered landmark coordinates</td>
                </tr>
                <tr>
                  <td className="border border-border p-2 font-medium">Hand Visualization</td>
                  <td className="border border-border p-2">Renders hand skeleton with rainbow coloring</td>
                  <td className="border border-border p-2">Filtered landmarks, connections</td>
                  <td className="border border-border p-2">Canvas rendering</td>
                </tr>
                <tr>
                  <td className="border border-border p-2 font-medium">Finger Tracking</td>
                  <td className="border border-border p-2">Calculates joint angles and finger states</td>
                  <td className="border border-border p-2">Filtered landmarks</td>
                  <td className="border border-border p-2">Finger flexion angles, states</td>
                </tr>
                <tr>
                  <td className="border border-border p-2 font-medium">Knuckle Ruler</td>
                  <td className="border border-border p-2">Calculates hand measurements for calibration</td>
                  <td className="border border-border p-2">Hand landmarks</td>
                  <td className="border border-border p-2">Distance measurements</td>
                </tr>
                <tr>
                  <td className="border border-border p-2 font-medium">Event Bus</td>
                  <td className="border border-border p-2">Provides pub/sub messaging between components</td>
                  <td className="border border-border p-2">Events from all components</td>
                  <td className="border border-border p-2">Event dispatches to subscribers</td>
                </tr>
                <tr>
                  <td className="border border-border p-2 font-medium">Performance Optimizer</td>
                  <td className="border border-border p-2">Controls processing rates and UI updates</td>
                  <td className="border border-border p-2">User settings, system metrics</td>
                  <td className="border border-border p-2">Throttling parameters</td>
                </tr>
                <tr>
                  <td className="border border-border p-2 font-medium">Settings Panel</td>
                  <td className="border border-border p-2">User interface for configuring all components</td>
                  <td className="border border-border p-2">User interactions, event updates</td>
                  <td className="border border-border p-2">Configuration changes</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="text-xs text-muted-foreground mt-4">
            <p>The architecture follows a mediator pattern using the Event Bus to decouple components. This enables:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Independent component development and testing</li>
              <li>Easy addition of new processing modules</li>
              <li>Runtime reconfiguration without component rewiring</li>
              <li>Performance optimization through selective processing</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="bg-muted/40 p-4 rounded-md mt-6">
        <h4 className="text-sm font-medium mb-2">Technical Details</h4>
        <p className="text-xs text-muted-foreground">
          The application uses React for UI rendering, MediaPipe for ML-based hand detection,
          and a custom implementation of the 1€ Filter algorithm for signal smoothing.
          All processing happens client-side in the browser for privacy and low latency.
        </p>
      </div>
    </div>
  );
};

export default DataFlowDiagram;