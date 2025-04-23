import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { EventType, addListener, dispatch } from '@/lib/eventBus';
import { HandData, PerformanceMetrics } from '@/lib/types';

// Define the app state interface
interface AppState {
  // Camera and status states
  isCameraRunning: boolean;
  isFullscreen: boolean;
  isOpenCVReady: boolean;
  isMediaPipelineReady: boolean;
  
  // Data states
  handData?: HandData;
  performanceMetrics?: PerformanceMetrics;
  resolution: { width: number; height: number };
  
  // UI and feedback states
  logs: Array<{
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
    timestamp: Date;
  }>;
  notifications: Array<{
    id: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
    timestamp: Date;
  }>;
}

// Define action types for state updates
type AppAction = 
  | { type: 'CAMERA_STATUS_CHANGE'; payload: { isRunning: boolean; resolution?: { width: number; height: number } } }
  | { type: 'FULLSCREEN_CHANGE'; payload: { isFullscreen: boolean } }
  | { type: 'OPENCV_STATUS_CHANGE'; payload: { isReady: boolean } }
  | { type: 'MEDIA_PIPELINE_STATUS_CHANGE'; payload: { isReady: boolean } }
  | { type: 'UPDATE_HAND_DATA'; payload: { handData?: HandData } }
  | { type: 'UPDATE_PERFORMANCE_METRICS'; payload: { metrics?: PerformanceMetrics } }
  | { type: 'ADD_LOG'; payload: { message: string; type: 'info' | 'error' | 'success' | 'warning' } }
  | { type: 'ADD_NOTIFICATION'; payload: { message: string; type: 'info' | 'error' | 'success' | 'warning' } }
  | { type: 'REMOVE_NOTIFICATION'; payload: { id: string } };

// Initial state
const initialState: AppState = {
  isCameraRunning: false,
  isFullscreen: false,
  isOpenCVReady: false,
  isMediaPipelineReady: false,
  resolution: { width: 640, height: 480 },
  logs: [],
  notifications: []
};

// Reducer function
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'CAMERA_STATUS_CHANGE':
      return {
        ...state,
        isCameraRunning: action.payload.isRunning,
        ...(action.payload.resolution ? { resolution: action.payload.resolution } : {})
      };
    
    case 'FULLSCREEN_CHANGE':
      return {
        ...state,
        isFullscreen: action.payload.isFullscreen
      };
    
    case 'OPENCV_STATUS_CHANGE':
      return {
        ...state,
        isOpenCVReady: action.payload.isReady
      };
    
    case 'MEDIA_PIPELINE_STATUS_CHANGE':
      return {
        ...state,
        isMediaPipelineReady: action.payload.isReady
      };
    
    case 'UPDATE_HAND_DATA':
      return {
        ...state,
        handData: action.payload.handData
      };
    
    case 'UPDATE_PERFORMANCE_METRICS':
      return {
        ...state,
        performanceMetrics: action.payload.metrics
      };
    
    case 'ADD_LOG':
      return {
        ...state,
        logs: [
          ...state.logs,
          {
            message: action.payload.message,
            type: action.payload.type,
            timestamp: new Date()
          }
        ].slice(-100) // Keep only the last 100 logs
      };
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [
          ...state.notifications,
          {
            id: uuidv4(),
            message: action.payload.message,
            type: action.payload.type,
            timestamp: new Date()
          }
        ]
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload.id)
      };
    
    default:
      return state;
  }
}

// Create contexts
const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<React.Dispatch<AppAction> | undefined>(undefined);

// Global reference to dispatch function for use outside React components
let globalDispatch: React.Dispatch<AppAction> | null = null;

// Provider component
interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Set global dispatch reference
  useEffect(() => {
    globalDispatch = dispatch;
    
    // EventBus listeners for various events
    const cameraStatusListener = addListener(
      EventType.CAMERA_STATUS_CHANGE,
      (data) => {
        dispatch({ 
          type: 'CAMERA_STATUS_CHANGE', 
          payload: { 
            isRunning: data.isRunning,
            ...(data.resolution ? { resolution: data.resolution } : {})
          } 
        });
      }
    );
    
    const fullscreenListener = addListener(
      EventType.FULLSCREEN_CHANGE,
      (data) => {
        dispatch({ 
          type: 'FULLSCREEN_CHANGE', 
          payload: { isFullscreen: data.isFullscreen } 
        });
      }
    );
    
    const opencvStatusListener = addListener(
      EventType.OPENCV_STATUS,
      (data) => {
        dispatch({ 
          type: 'OPENCV_STATUS_CHANGE', 
          payload: { isReady: data.isReady } 
        });
      }
    );
    
    const pipelineStatusListener = addListener(
      EventType.PIPELINE_STATUS,
      (data) => {
        dispatch({ 
          type: 'MEDIA_PIPELINE_STATUS_CHANGE', 
          payload: { isReady: data.isReady } 
        });
      }
    );
    
    const frameProcessedListener = addListener(
      EventType.FRAME_PROCESSED,
      (data) => {
        if (data.handData) {
          dispatch({ 
            type: 'UPDATE_HAND_DATA', 
            payload: { handData: data.handData } 
          });
        }
        
        if (data.performance) {
          dispatch({ 
            type: 'UPDATE_PERFORMANCE_METRICS', 
            payload: { metrics: data.performance } 
          });
        }
      }
    );
    
    const logListener = addListener(
      EventType.LOG,
      (data) => {
        dispatch({ 
          type: 'ADD_LOG', 
          payload: { 
            message: data.message, 
            type: data.type || 'info' 
          } 
        });
      }
    );
    
    const notificationListener = addListener(
      EventType.NOTIFICATION,
      (data) => {
        dispatch({ 
          type: 'ADD_NOTIFICATION', 
          payload: { 
            message: data.message, 
            type: data.type || 'info' 
          } 
        });
      }
    );
    
    // Cleanup all listeners when component unmounts
    return () => {
      cameraStatusListener.remove();
      fullscreenListener.remove();
      opencvStatusListener.remove();
      pipelineStatusListener.remove();
      frameProcessedListener.remove();
      logListener.remove();
      notificationListener.remove();
      globalDispatch = null;
    };
  }, []);
  
  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

// Custom hooks to access app state and dispatch
export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

export function useAppDispatch() {
  const context = useContext(AppDispatchContext);
  if (context === undefined) {
    throw new Error('useAppDispatch must be used within an AppStateProvider');
  }
  return context;
}

// For use outside React components
export function dispatchAppAction(action: AppAction) {
  if (globalDispatch) {
    globalDispatch(action);
  } else {
    console.error('Attempted to dispatch an app action outside of React component tree');
  }
}

// Helper functions for common dispatches
export const AppStateActions = {
  addLog: (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    dispatch(EventType.LOG, { message, type });
  },
  
  addNotification: (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    dispatch(EventType.NOTIFICATION, { message, type });
  },
  
  updateCameraStatus: (isRunning: boolean, resolution?: { width: number; height: number }) => {
    dispatch(EventType.CAMERA_STATUS_CHANGE, { isRunning, resolution });
  },
  
  toggleFullscreen: (isFullscreen: boolean) => {
    dispatch(EventType.FULLSCREEN_CHANGE, { isFullscreen });
  },
  
  updateOpenCVStatus: (isReady: boolean) => {
    dispatch(EventType.OPENCV_STATUS, { isReady });
  },
  
  updatePipelineStatus: (isReady: boolean) => {
    dispatch(EventType.PIPELINE_STATUS, { isReady });
  }
};