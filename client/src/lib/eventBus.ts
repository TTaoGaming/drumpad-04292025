/**
 * Event Bus - A simple pub/sub system for communication between components
 */

export enum EventType {
  CAMERA_STATUS_CHANGE = 'camera-status-change',
  FULLSCREEN_CHANGE = 'fullscreen-change', 
  FRAME_PROCESSED = 'frame-processed',
  LOG = 'log',
  NOTIFICATION = 'notification',
  OPENCV_STATUS = 'opencv-status',
  PIPELINE_STATUS = 'pipeline-status'
}

type EventCallback = (data: any) => void;

interface EventListener {
  type: EventType;
  callback: EventCallback;
  id: string;
  remove: () => void;
}

const listeners: EventListener[] = [];

/**
 * Adds an event listener
 * @param type The event type to listen for
 * @param callback Function to call when the event is triggered
 * @returns An object with a remove method to remove the listener
 */
export function addListener(type: EventType, callback: EventCallback): EventListener {
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  
  const listener: EventListener = {
    type,
    callback,
    id,
    remove: () => {
      const index = listeners.findIndex(l => l.id === id);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  };
  
  listeners.push(listener);
  return listener;
}

/**
 * Dispatches an event to all registered listeners
 * @param type The event type to dispatch
 * @param data Data to pass to the listeners
 */
export function dispatch(type: EventType, data: any): void {
  listeners
    .filter(listener => listener.type === type)
    .forEach(listener => {
      try {
        listener.callback(data);
      } catch (err) {
        console.error(`Error in event listener for ${type}:`, err);
      }
    });
}

/**
 * Removes all listeners of a specific type
 * @param type The event type to remove
 */
export function removeAllListeners(type: EventType): void {
  const index = listeners.findIndex(l => l.type === type);
  if (index !== -1) {
    listeners.splice(index, 1);
  }
}
