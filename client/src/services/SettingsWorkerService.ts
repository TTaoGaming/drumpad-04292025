/**
 * Settings Worker Service
 * 
 * This service manages communication with the settings worker thread.
 * It provides a clean interface for other components to interact with,
 * abstracting away the worker message passing details.
 */

import { EventType, dispatch } from '@/lib/eventBus';

export class SettingsWorkerService {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private pendingRequests: Array<{ command: string; data: any }> = [];
  
  /**
   * Initialize the settings worker
   * @param initialSettings Optional initial settings state
   */
  constructor(initialSettings?: any) {
    this.initWorker(initialSettings);
  }
  
  /**
   * Create and initialize the worker
   */
  private initWorker(initialSettings?: any) {
    try {
      // Create the worker
      this.worker = new Worker(
        new URL('../workers/settings-worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      // Set up message handler
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      
      // Initialize the worker with settings
      this.worker.postMessage({
        command: 'init',
        data: { settings: initialSettings }
      });
      
      // Log error
      this.worker.onerror = (error) => {
        console.error('Settings worker error:', error);
        dispatch(EventType.LOG, {
          message: `Settings worker error: ${error.message}`,
          type: 'error'
        });
      };
    } catch (error) {
      console.error('Failed to create settings worker:', error);
      dispatch(EventType.LOG, {
        message: 'Failed to create settings worker, falling back to main thread',
        type: 'error'
      });
    }
  }
  
  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent) {
    const { type, changes, settings } = event.data;
    
    switch (type) {
      case 'ready':
        console.log('Settings worker is ready');
        break;
        
      case 'init-complete':
        this.isReady = true;
        
        // Process any pending requests
        if (this.pendingRequests.length > 0) {
          for (const request of this.pendingRequests) {
            this.sendToWorker(request.command, request.data);
          }
          this.pendingRequests = [];
        }
        
        // Notify that the worker is ready
        dispatch(EventType.LOG, {
          message: 'Settings worker initialized',
          type: 'info'
        });
        break;
        
      case 'settings-changed':
        // Forward changes to the event bus for components to react
        if (changes) {
          Object.entries(changes).forEach(([section, sectionChanges]) => {
            Object.entries(sectionChanges as any).forEach(([setting, value]) => {
              dispatch(EventType.SETTINGS_VALUE_CHANGE, {
                section,
                setting,
                value
              });
            });
          });
        }
        break;
        
      case 'settings-state':
        // Full settings state received
        if (settings) {
          // This could be used to restore or sync settings
          console.log('Received full settings state from worker');
        }
        break;
        
      default:
        console.warn('Unknown message from settings worker:', event.data);
    }
  }
  
  /**
   * Send a command to the worker
   * @param command The command to send
   * @param data Additional data for the command
   */
  private sendToWorker(command: string, data?: any) {
    if (!this.worker) {
      console.warn('Settings worker not available');
      return;
    }
    
    if (!this.isReady) {
      // Queue the request until worker is ready
      this.pendingRequests.push({ command, data });
      return;
    }
    
    this.worker.postMessage({ command, data });
  }
  
  /**
   * Update a setting value
   * @param section The settings section
   * @param setting The specific setting to update
   * @param value The new value
   */
  public updateSetting(section: string, setting: string, value: any) {
    this.sendToWorker('update-setting', { section, setting, value });
  }
  
  /**
   * Get the full settings state
   * This will cause the worker to send back the settings-state message
   */
  public getSettings() {
    this.sendToWorker('get-settings');
  }
  
  /**
   * Force a UI update from the worker
   */
  public requestUIUpdate() {
    this.sendToWorker('request-ui-update');
  }
  
  /**
   * Dispose of the worker when no longer needed
   */
  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

// Create a singleton instance for the app to use
let settingsWorkerServiceInstance: SettingsWorkerService | null = null;

export function getSettingsWorkerService(initialSettings?: any): SettingsWorkerService {
  if (!settingsWorkerServiceInstance) {
    settingsWorkerServiceInstance = new SettingsWorkerService(initialSettings);
  }
  return settingsWorkerServiceInstance;
}