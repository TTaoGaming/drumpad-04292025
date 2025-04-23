import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { HandData, Notification, PerformanceMetrics } from '@/lib/types';
import { EventType, addListener, dispatch } from '@/lib/eventBus';

// Define the state interface
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
  notifications: Notification[];
}

// Define action types to make actions strongly typed
type AppAction = 
  | { type: 'CAMERA_STATUS_CHANGE'; payload: { isRunning: boolean; resolution?: { width: number; height: number } } }
  | { type: 'FULLSCREEN_CHANGE'; payload: { isFullscreen: boolean } }
  | { type: 'OPENCV_STATUS_CHANGE'; payload: { isReady: boolean } }
  | { type: 'MEDIA_PIPELINE_STATUS_CHANGE'; payload: { isReady: boolean } }
  | { type: 'UPDATE_HAND_DATA'; payload: { handData?: HandData } }
  | { type: 'UPDATE_PERFORMANCE_METRICS'; payload: { metrics?: PerformanceMetrics } }
  | { type: 'ADD_LOG'; payload: { message: string; type: 'info' | 'error' | 'success' | 'warning' } }
  | { type: 'ADD_NOTIFICATION'; payload: { notification: Notification } }
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

// Create contexts for state and dispatch
const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<React.Dispatch<AppAction> | undefined>(undefined);

// Reducer function to handle state updates
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'CAMERA_STATUS_CHANGE':
      return {
        ...state,
        isCameraRunning: action.payload.isRunning,
        resolution: action.payload.resolution || state.resolution
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
        ]
      };
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload.notification]
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(
          notification => notification.id !== action.payload.id
        )
      };
    
    default:
      return state;
  }
}

// Provider component
interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Bridge between the event bus and the context
  useEffect(() => {
    // Set up listeners for events from the event bus
    const cameraListener = addListener(EventType.CAMERA_STATUS_CHANGE, (data) => {
      dispatch({
        type: 'CAMERA_STATUS_CHANGE',
        payload: {
          isRunning: data.isRunning,
          resolution: data.resolution
        }
      });
    });
    
    const fullscreenListener = addListener(EventType.FULLSCREEN_CHANGE, (data) => {
      dispatch({
        type: 'FULLSCREEN_CHANGE',
        payload: { isFullscreen: data.isFullscreen }
      });
    });
    
    const opencvStatusListener = addListener(EventType.OPENCV_STATUS, (data) => {
      dispatch({
        type: 'OPENCV_STATUS_CHANGE',
        payload: { isReady: data.ready }
      });
    });
    
    const pipelineStatusListener = addListener(EventType.PIPELINE_STATUS, (data) => {
      dispatch({
        type: 'MEDIA_PIPELINE_STATUS_CHANGE',
        payload: { isReady: data.ready }
      });
    });
    
    const logListener = addListener(EventType.LOG, (data) => {
      dispatch({
        type: 'ADD_LOG',
        payload: {
          message: data.message,
          type: data.type
        }
      });
    });
    
    const notificationListener = addListener(EventType.NOTIFICATION, (data) => {
      const notificationId = Date.now().toString();
      
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          notification: {
            id: notificationId,
            message: data.message,
            type: data.type
          }
        }
      });
      
      // Auto-remove notifications after 5 seconds
      setTimeout(() => {
        dispatch({
          type: 'REMOVE_NOTIFICATION',
          payload: { id: notificationId }
        });
      }, 5000);
    });
    
    // Initial log (moved from App.tsx)
    dispatch({
      type: 'ADD_LOG',
      payload: {
        message: 'Application initialized. Click "Start Camera" to begin.',
        type: 'info'
      }
    });
    
    // Clean up all listeners when component unmounts
    return () => {
      cameraListener.remove();
      fullscreenListener.remove();
      opencvStatusListener.remove();
      pipelineStatusListener.remove();
      logListener.remove();
      notificationListener.remove();
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

// Custom hooks to access the state and dispatch
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

// Helper functions to call both the context dispatch and the event bus dispatch
export function dispatchAppAction(action: AppAction) {
  // This function will be used from components that have access to the dispatch context
  const dispatch = useAppDispatch();
  dispatch(action);
}

// Helper to add a log entry
export const addLog = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
  dispatch(EventType.LOG, {
    message,
    type
  });
};

// Helper to add a notification
export const addNotification = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
  dispatch(EventType.NOTIFICATION, {
    message,
    type
  });
};