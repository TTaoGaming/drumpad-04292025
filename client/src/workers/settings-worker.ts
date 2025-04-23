/**
 * Settings Worker
 * 
 * This worker handles settings state and processing to offload work from the main thread.
 * It receives settings updates, processes them, and sends back only necessary UI updates.
 */

// Define types for settings state
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
  colorScheme: string;
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
    thumb: { flex: { min: number; max: number } };
    index: { flex: { min: number; max: number } };
    middle: { flex: { min: number; max: number } };
    ring: { flex: { min: number; max: number } };
    pinky: { flex: { min: number; max: number } };
  };
}

interface PerformanceSettings {
  throttling: {
    enabled: boolean;
    interval: number;
  };
  frameProcessing: {
    processEveryNth: number;
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

interface AppSettings {
  filter: FilterSettings;
  landmarks: LandmarksSettings;
  fingerFlexion: FingerFlexionSettings;
  performance: PerformanceSettings;
  knuckleRuler: KnuckleRulerSettings;
}

// Define type for settings diff tracking
interface SettingsDiff {
  [section: string]: {
    [setting: string]: any;
  };
}

// Store settings state in the worker
const settingsState: AppSettings = {
  filter: {
    minCutoff: 1.0,
    beta: 0.0,
    dcutoff: 1.0
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
      thumb: { flex: { min: 5, max: 30 } },
      index: { flex: { min: 5, max: 30 } },
      middle: { flex: { min: 5, max: 30 } },
      ring: { flex: { min: 5, max: 30 } },
      pinky: { flex: { min: 5, max: 30 } }
    }
  },
  performance: {
    throttling: {
      enabled: true,
      interval: 200
    },
    frameProcessing: {
      processEveryNth: 1
    },
    landmarkFiltering: {
      enabled: true
    },
    roiOptimization: {
      enabled: false,
      minROISize: 0.2,
      maxROISize: 0.5,
      velocityMultiplier: 0.5,
      movementThreshold: 0.03,
      maxTimeBetweenFullFrames: 500
    }
  },
  knuckleRuler: {
    enabled: true,
    showMeasurement: true,
    knuckleDistanceCm: 8.0
  }
};

// Track which settings have changed
let settingsDiff: SettingsDiff = {};

// Throttling for UI updates
let lastUIUpdateTime = 0;
const UI_UPDATE_THROTTLE = 200; // ms

// Handle messages from the main thread
self.onmessage = (event) => {
  const { command, data } = event.data;
  
  switch (command) {
    case 'init':
      // Initialize worker with the current settings state
      if (data && data.settings) {
        Object.assign(settingsState, data.settings);
      }
      self.postMessage({ type: 'init-complete' });
      break;
      
    case 'update-setting':
      // Process a settings update
      handleSettingUpdate(data);
      break;
      
    case 'get-settings':
      // Return the full settings state
      self.postMessage({ 
        type: 'settings-state', 
        settings: settingsState 
      });
      break;
      
    case 'request-ui-update':
      // Force a UI update immediately
      sendUIUpdate(true);
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
  }
};

/**
 * Handle a settings update request
 */
function handleSettingUpdate(data: {section: string, setting: string, value: any}) {
  const { section, setting, value } = data;
  
  // Update the appropriate section of settings
  if (section && setting && value !== undefined) {
    if (section in settingsState) {
      if (setting === '*') {
        // Update the entire section
        settingsState[section as keyof AppSettings] = { 
          ...settingsState[section as keyof AppSettings], 
          ...value 
        };
      } else if (typeof settingsState[section as keyof AppSettings] === 'object') {
        // Update a specific setting with type safety
        const sectionObj = settingsState[section as keyof AppSettings];
        if (sectionObj && setting in sectionObj) {
          // Use type assertion to handle the dynamic property access
          (sectionObj as any)[setting] = value;
        }
      }
      
      // Track this change for the next UI update
      if (!settingsDiff[section]) {
        settingsDiff[section] = {};
      }
      settingsDiff[section][setting] = value;
      
      // Schedule a UI update
      sendUIUpdate();
    } else {
      console.error(`Unknown settings section: ${section}`);
    }
  } else {
    console.error('Invalid settings update data', data);
  }
}

/**
 * Send UI updates back to the main thread, with throttling
 */
function sendUIUpdate(force = false) {
  const now = Date.now();
  
  // Check if we should throttle this update
  if (force || (now - lastUIUpdateTime >= UI_UPDATE_THROTTLE)) {
    // Only send if we have changes to report
    if (Object.keys(settingsDiff).length > 0) {
      self.postMessage({
        type: 'settings-changed',
        changes: { ...settingsDiff },
        timestamp: now
      });
      
      // Reset diff tracking
      settingsDiff = {};
      lastUIUpdateTime = now;
    }
  }
}

// Announce that the worker is ready
self.postMessage({ type: 'ready' });