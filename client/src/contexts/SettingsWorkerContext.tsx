import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { SettingsWorkerService, getSettingsWorkerService } from '@/services/SettingsWorkerService';
import { EventType, addListener } from '@/lib/eventBus';
import { DEFAULT_FILTER_OPTIONS } from '@/lib/oneEuroFilter';
import { DEFAULT_OPTIMIZATION_SETTINGS } from '@/lib/handTrackingOptimizer';

// Initial settings state
const initialSettings = {
  filter: {
    minCutoff: DEFAULT_FILTER_OPTIONS.minCutoff,
    beta: DEFAULT_FILTER_OPTIONS.beta,
    dcutoff: DEFAULT_FILTER_OPTIONS.dcutoff
  },
  landmarks: {
    showLandmarks: true,
    showConnections: true,
    landmarkSize: 4,
    connectionWidth: 2,
    colorScheme: 'rainbow'
  },
  fingerFlexion: {
    enabled: false,
    enabledFingers: {
      thumb: true,
      index: true,
      middle: true,
      ring: false,
      pinky: false
    },
    thresholds: {
      thumb: { flex: 40 },
      index: { flex: 60 },
      middle: { flex: 60 },
      ring: { flex: 60 },
      pinky: { flex: 60 }
    },
    visualIndicators: true
  },
  performance: {
    frameProcessing: {
      processEveryNth: 1
    },
    throttling: {
      enabled: true,
      interval: 200
    },
    landmarkFiltering: {
      enabled: true
    },
    roiOptimization: {
      enabled: false,
      minROISize: DEFAULT_OPTIMIZATION_SETTINGS.minROISize,
      maxROISize: DEFAULT_OPTIMIZATION_SETTINGS.maxROISize,
      velocityMultiplier: DEFAULT_OPTIMIZATION_SETTINGS.velocityMultiplier,
      movementThreshold: DEFAULT_OPTIMIZATION_SETTINGS.movementThreshold,
      maxTimeBetweenFullFrames: DEFAULT_OPTIMIZATION_SETTINGS.maxTimeBetweenFullFrames
    }
  },
  knuckleRuler: {
    enabled: true,
    showMeasurement: true,
    knuckleDistanceCm: 8.0
  }
};

// Create a context for using the settings worker
const SettingsWorkerContext = createContext<{
  worker: SettingsWorkerService | null;
  updateSetting: (section: string, setting: string, value: any) => void;
}>({
  worker: null,
  updateSetting: () => {}
});

// Provider component
interface SettingsWorkerProviderProps {
  children: ReactNode;
}

export function SettingsWorkerProvider({ children }: SettingsWorkerProviderProps) {
  const [worker, setWorker] = useState<SettingsWorkerService | null>(null);
  const didInitRef = useRef(false);
  
  // Initialize the worker once
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    
    // Get the worker service
    const workerService = getSettingsWorkerService(initialSettings);
    setWorker(workerService);
    
    // Initialize with a separate bridge for EventBus -> Worker settings updates
    // This allows components to continue using the existing event bus pattern
    const settingsChangeListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        const { section, setting, value } = data;
        workerService.updateSetting(section, setting, value);
      }
    );
    
    return () => {
      settingsChangeListener.remove();
      if (workerService) {
        workerService.dispose();
      }
    };
  }, []);
  
  // Update a setting via the worker
  const updateSetting = (section: string, setting: string, value: any) => {
    if (worker) {
      worker.updateSetting(section, setting, value);
    }
  };
  
  return (
    <SettingsWorkerContext.Provider value={{ worker, updateSetting }}>
      {children}
    </SettingsWorkerContext.Provider>
  );
}

// Custom hook to use the settings worker
export function useSettingsWorker() {
  const context = useContext(SettingsWorkerContext);
  if (context === undefined) {
    throw new Error('useSettingsWorker must be used within a SettingsWorkerProvider');
  }
  return context;
}