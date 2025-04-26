/**
 * Simple ROI Tracker Component
 * 
 * A simplified component for tracking and displaying circular ROIs.
 * This component uses the SimpleFeatureTracker to track features within ROIs.
 */
import React, { useEffect, useRef, useState } from 'react';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import simpleFeatureTracker, { TrackingResult } from '@/lib/simpleFeatureTracker';
import { DrawingPath } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface SimpleROITrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  width: number;
  height: number;
  visible?: boolean;
}

type ROIStatus = 'initializing' | 'extracting' | 'tracking' | 'lost' | 'error';

interface ROIState {
  id: string;
  status: ROIStatus;
  message?: string;
  result?: TrackingResult;
}

const SimpleROITracker: React.FC<SimpleROITrackerProps> = ({
  videoRef,
  width,
  height,
  visible = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeROIs, setActiveROIs] = useState<Map<string, ROIState>>(new Map());
  const [isVisible, setIsVisible] = useState<boolean>(visible);
  const frameRequestRef = useRef<number | null>(null);
  
  // Handle ROI creation
  useEffect(() => {
    const handleROICreated = (data: { id: string, path: DrawingPath }) => {
      console.log(`[SimpleROITracker] New ROI created: ${data.id}`);
      
      // Add the ROI to the tracker
      simpleFeatureTracker.addROI(data.path);
      
      // Add to our local state
      setActiveROIs(prev => {
        const updated = new Map(prev);
        updated.set(data.id, {
          id: data.id,
          status: 'initializing',
          message: 'Initializing ROI...'
        });
        return updated;
      });
    };
    
    // Handle ROI deletion
    const handleROIDeleted = (data: { id: string }) => {
      console.log(`[SimpleROITracker] ROI deleted: ${data.id}`);
      
      // Remove from tracker
      simpleFeatureTracker.removeROI(data.id);
      
      // Remove from our local state
      setActiveROIs(prev => {
        const updated = new Map(prev);
        updated.delete(data.id);
        return updated;
      });
    };
    
    // Handle ROI updates from the tracker
    const handleROIUpdated = (data: any) => {
      if (!data.id) return;
      
      setActiveROIs(prev => {
        const updated = new Map(prev);
        
        // Update the ROI state based on the update type
        let status: ROIStatus = 'initializing';
        let message = '';
        
        switch (data.status) {
          case 'created':
            status = 'initializing';
            message = 'Initializing ROI...';
            break;
          case 'reference-captured':
            status = 'tracking';
            message = `Ready to track with ${data.featureCount} features`;
            break;
          case 'extraction-failed':
            status = 'error';
            message = data.message || 'Failed to extract features';
            break;
          case 'tracking-success':
            status = 'tracking';
            message = `Tracking with ${data.trackingResult?.confidence * 100 | 0}% confidence`;
            break;
          case 'tracking-lost':
            status = 'lost';
            message = data.message || 'Lost tracking';
            break;
          case 'processing-error':
            status = 'error';
            message = data.error || 'Error processing ROI';
            break;
          default:
            break;
        }
        
        updated.set(data.id, {
          id: data.id,
          status,
          message,
          result: data.trackingResult
        });
        
        return updated;
      });
    };
    
    // Handle drawing completion
    const handleDrawingEnd = (data: { path: DrawingPath }) => {
      if (data.path.mode === 'roi' && data.path.points.length > 5) {
        // Automatically create an ROI when a circular path is completed
        simpleFeatureTracker.addROI(data.path);
        
        // Notify about ROI creation
        dispatch(EventType.ROI_CREATED, {
          id: data.path.id || Date.now().toString(),
          path: data.path
        });
      }
    };
    
    // Subscribe to events
    const listeners = [
      addListener(EventType.ROI_CREATED, handleROICreated),
      addListener(EventType.ROI_DELETED, handleROIDeleted),
      addListener(EventType.ROI_UPDATED, handleROIUpdated),
      addListener(EventType.DRAWING_END, handleDrawingEnd)
    ];
    
    return () => {
      // Cleanup listeners
      listeners.forEach(listener => listener.remove());
    };
  }, []);
  
  // Animation frame for tracking
  useEffect(() => {
    const processFrame = () => {
      if (!videoRef.current || !videoRef.current.videoWidth || activeROIs.size === 0) {
        frameRequestRef.current = requestAnimationFrame(processFrame);
        return;
      }
      
      // Process the current frame
      simpleFeatureTracker.processFrame(videoRef.current);
      
      // Draw tracking visualization
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          simpleFeatureTracker.drawTracking(ctx, canvas.width, canvas.height);
        }
      }
      
      frameRequestRef.current = requestAnimationFrame(processFrame);
    };
    
    frameRequestRef.current = requestAnimationFrame(processFrame);
    
    return () => {
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, [videoRef, activeROIs]);
  
  // Update canvas dimensions when size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [width, height]);
  
  // Handle visibility prop change
  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);
  
  // Reset tracking for all ROIs
  const handleResetTracking = () => {
    // Clear all ROIs and start fresh
    simpleFeatureTracker.clearROIs();
    setActiveROIs(new Map());
  };
  
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };
  
  if (!isVisible) {
    return (
      <Button
        className="absolute top-2 right-2 z-10 bg-blue-600 hover:bg-blue-700 text-white"
        onClick={toggleVisibility}
      >
        Show ROI Tracker
      </Button>
    );
  }
  
  return (
    <div className="absolute top-0 left-0 z-10">
      {/* ROI Debug Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      
      {/* Control Panel */}
      <div className="absolute top-2 right-2 flex flex-col gap-2 p-3 bg-black bg-opacity-70 rounded-lg text-white">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold">ROI Tracker</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleVisibility}
            className="h-6 px-2 text-xs"
          >
            Hide
          </Button>
        </div>
        
        {activeROIs.size > 0 ? (
          <>
            <div className="text-xs max-h-40 overflow-auto">
              {Array.from(activeROIs.values()).map(roi => (
                <div
                  key={roi.id}
                  className={`mb-1 p-1 rounded ${
                    roi.status === 'tracking'
                      ? 'bg-green-800 bg-opacity-50'
                      : roi.status === 'lost'
                      ? 'bg-red-800 bg-opacity-50'
                      : roi.status === 'error'
                      ? 'bg-red-900 bg-opacity-50'
                      : 'bg-yellow-800 bg-opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">ROI {roi.id.slice(-4)}</span>
                    <span
                      className={`text-xs px-1 rounded ${
                        roi.status === 'tracking'
                          ? 'bg-green-600'
                          : roi.status === 'lost'
                          ? 'bg-red-600'
                          : roi.status === 'error'
                          ? 'bg-red-700'
                          : 'bg-yellow-600'
                      }`}
                    >
                      {roi.status}
                    </span>
                  </div>
                  <div className="text-xs mt-1">{roi.message}</div>
                  {roi.result?.confidence !== undefined && (
                    <div className="w-full bg-gray-700 h-1 mt-1 rounded-full overflow-hidden">
                      <div
                        className="bg-green-500 h-full"
                        style={{ width: `${roi.result.confidence * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleResetTracking}
              className="mt-1"
            >
              Reset Tracking
            </Button>
          </>
        ) : (
          <div className="text-xs italic">
            Draw a circle with pinch gesture to create an ROI
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleROITracker;