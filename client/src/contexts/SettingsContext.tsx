import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import { DEFAULT_FILTER_OPTIONS } from '@/lib/oneEuroFilter';
import { DEFAULT_OPTIMIZATION_SETTINGS } from '@/lib/handTrackingOptimizer';

// Define interfaces for different settings groups
interface FilterSettings {
  minCutoff: number;
  beta: number;
  dcutoff: number;
}

interface LandmarksSettings {
  showLandmarks: boolean;
  showConnections: boolean;
  landmarkSize: number;
  connectionWidth: number;
  colorScheme: 'rainbow' | 'single';
}

interface FingerFlexionSettings {
  enabled: boolean;
  enabledFingers: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
  thresholds: {
    thumb: { flex: number };
    index: { flex: number };
    middle: { flex: number };
    ring: { flex: number };
    pinky: { flex: number };
  };
  visualIndicators: boolean;
}

interface PerformanceSettings {
  frameProcessing: {
    processEveryNth: number;
  };
  throttling: {
    enabled: boolean;
    interval: number;
  };
  landmarkFiltering: {
    enabled: boolean;
  };
  roiOptimization: {
    enabled: boolean;
    minROISize: number;
    maxROISize: number;
    velocityMultiplier: number;
    movementThreshold: number;
    maxTimeBetweenFullFrames: number;
  };
}

interface KnuckleRulerSettings {
  enabled: boolean;
  showMeasurement: boolean;
  knuckleDistanceCm: number;
}

// Combine all settings into a single interface
interface AppSettings {
  filter: FilterSettings;
  landmarks: LandmarksSettings;
  fingerFlexion: FingerFlexionSettings;
  performance: PerformanceSettings;
  knuckleRuler: KnuckleRulerSettings;
}

// Define action types for settings updates
type SettingsAction = 
  | { type: 'UPDATE_FILTER_SETTINGS'; payload: Partial<FilterSettings> }
  | { type: 'UPDATE_LANDMARKS_SETTINGS'; payload: Partial<LandmarksSettings> }
  | { type: 'UPDATE_FINGER_FLEXION_SETTINGS'; payload: Partial<FingerFlexionSettings> }
  | { type: 'UPDATE_PERFORMANCE_SETTINGS'; payload: Partial<PerformanceSettings> }
  | { type: 'UPDATE_PERFORMANCE_FRAME_PROCESSING'; payload: Partial<PerformanceSettings['frameProcessing']> }
  | { type: 'UPDATE_PERFORMANCE_THROTTLING'; payload: Partial<PerformanceSettings['throttling']> }
  | { type: 'UPDATE_PERFORMANCE_LANDMARK_FILTERING'; payload: Partial<PerformanceSettings['landmarkFiltering']> }
  | { type: 'UPDATE_PERFORMANCE_ROI_OPTIMIZATION'; payload: Partial<PerformanceSettings['roiOptimization']> }
  | { type: 'UPDATE_KNUCKLE_RULER_SETTINGS'; payload: Partial<KnuckleRulerSettings> };

// Initial state with default values
const initialSettings: AppSettings = {
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
    enabled: false, // Disabled by default for performance
    enabledFingers: {
      thumb: true,
      index: true,
      middle: true,
      ring: true,
      pinky: true
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
      interval: 100
    },
    landmarkFiltering: {
      enabled: true
    },
    roiOptimization: {
      enabled: false, // Disabled by default (caused white flashing)
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
    knuckleDistanceCm: 8.0 // Default knuckle distance in cm
  }
};

// Create contexts for settings state and dispatch
const SettingsContext = createContext<AppSettings | undefined>(undefined);
const SettingsDispatchContext = createContext<React.Dispatch<SettingsAction> | undefined>(undefined);

// Reducer function for settings
function settingsReducer(state: AppSettings, action: SettingsAction): AppSettings {
  switch (action.type) {
    case 'UPDATE_FILTER_SETTINGS':
      return {
        ...state,
        filter: {
          ...state.filter,
          ...action.payload
        }
      };
    
    case 'UPDATE_LANDMARKS_SETTINGS':
      return {
        ...state,
        landmarks: {
          ...state.landmarks,
          ...action.payload
        }
      };
    
    case 'UPDATE_FINGER_FLEXION_SETTINGS':
      return {
        ...state,
        fingerFlexion: {
          ...state.fingerFlexion,
          ...action.payload
        }
      };
    
    case 'UPDATE_PERFORMANCE_SETTINGS':
      return {
        ...state,
        performance: {
          ...state.performance,
          ...action.payload
        }
      };
    
    case 'UPDATE_PERFORMANCE_FRAME_PROCESSING':
      return {
        ...state,
        performance: {
          ...state.performance,
          frameProcessing: {
            ...state.performance.frameProcessing,
            ...action.payload
          }
        }
      };
    
    case 'UPDATE_PERFORMANCE_THROTTLING':
      return {
        ...state,
        performance: {
          ...state.performance,
          throttling: {
            ...state.performance.throttling,
            ...action.payload
          }
        }
      };
    
    case 'UPDATE_PERFORMANCE_LANDMARK_FILTERING':
      return {
        ...state,
        performance: {
          ...state.performance,
          landmarkFiltering: {
            ...state.performance.landmarkFiltering,
            ...action.payload
          }
        }
      };
    
    case 'UPDATE_PERFORMANCE_ROI_OPTIMIZATION':
      return {
        ...state,
        performance: {
          ...state.performance,
          roiOptimization: {
            ...state.performance.roiOptimization,
            ...action.payload
          }
        }
      };
    
    case 'UPDATE_KNUCKLE_RULER_SETTINGS':
      return {
        ...state,
        knuckleRuler: {
          ...state.knuckleRuler,
          ...action.payload
        }
      };
    
    default:
      return state;
  }
}

// Provider component
interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, dispatchSettings] = useReducer(settingsReducer, initialSettings);
  
  // Bridge between event bus and context
  useEffect(() => {
    const settingsChangeListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        // Route settings updates to the appropriate reducer actions
        const { section, setting, value } = data;
        
        switch (section) {
          case 'filter':
            dispatchSettings({
              type: 'UPDATE_FILTER_SETTINGS',
              payload: value
            });
            break;
          
          case 'handLandmarks':
            dispatchSettings({
              type: 'UPDATE_LANDMARKS_SETTINGS',
              payload: value
            });
            break;
          
          case 'gestures':
            if (setting === 'fingerFlexion') {
              dispatchSettings({
                type: 'UPDATE_FINGER_FLEXION_SETTINGS',
                payload: value
              });
            }
            break;
          
          case 'performance':
            if (setting === 'frameProcessing') {
              dispatchSettings({
                type: 'UPDATE_PERFORMANCE_FRAME_PROCESSING',
                payload: value
              });
            } else if (setting === 'throttling') {
              dispatchSettings({
                type: 'UPDATE_PERFORMANCE_THROTTLING',
                payload: value
              });
            } else if (setting === 'landmarkFiltering') {
              dispatchSettings({
                type: 'UPDATE_PERFORMANCE_LANDMARK_FILTERING',
                payload: value
              });
            } else if (setting === 'roiOptimization') {
              dispatchSettings({
                type: 'UPDATE_PERFORMANCE_ROI_OPTIMIZATION',
                payload: value
              });
            } else {
              // Handle generic performance settings updates
              dispatchSettings({
                type: 'UPDATE_PERFORMANCE_SETTINGS',
                payload: { [setting]: value }
              });
            }
            break;
          
          case 'calibration':
            if (setting === 'knuckleRuler') {
              dispatchSettings({
                type: 'UPDATE_KNUCKLE_RULER_SETTINGS',
                payload: value
              });
            }
            break;
          
          default:
            console.warn('Unhandled settings update:', section, setting);
        }
      }
    );
    
    // Cleanup listener when component unmounts
    return () => {
      settingsChangeListener.remove();
    };
  }, []);
  
  return (
    <SettingsContext.Provider value={settings}>
      <SettingsDispatchContext.Provider value={dispatchSettings}>
        {children}
      </SettingsDispatchContext.Provider>
    </SettingsContext.Provider>
  );
}

// Custom hooks to access settings state and dispatch
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export function useSettingsDispatch() {
  const context = useContext(SettingsDispatchContext);
  if (context === undefined) {
    throw new Error('useSettingsDispatch must be used within a SettingsProvider');
  }
  return context;
}

// Helper functions to update settings and notify via event bus
// Using named export object to avoid Fast Refresh incompatibility
export const SettingsActions = {
  updateSettings: (section: string, setting: string, value: any) => {
    // Dispatch using the event bus (the worker will listen for these events)
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section,
      setting,
      value
    });
  }
};