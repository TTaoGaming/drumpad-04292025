# ModularDrumpad Reference Guide (April 17, 2025)

## Project Overview

ModularDrumpad is a web-based interactive music creation application combining:
- Camera input and computer vision (OpenCV.js)
- Hand gesture tracking (MediaPipe)
- Marker detection and OCR (Tesseract.js)
- Web Audio API for sound generation
- Web MIDI API for external control

## Architecture

The application follows a modular publisher/subscriber architecture:

```
┌─────────────────────────────────────────────┐
│                  Core Pipeline              │
│  ┌───────────┐  ┌────────────┐  ┌─────────┐ │
│  │  Camera   │→ │  Marker    │→ │ Marker  │ │
│  │ Publisher │  │  Detector  │  │ State   │ │
│  └───────────┘  └────────────┘  └─────────┘ │
└─────────────────────┬───────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────┐
│                 Plugin System               │
│  ┌────────────┐  ┌───────────┐  ┌─────────┐ │
│  │ Hand       │  │ Marker    │  │ MIDI    │ │
│  │ Tracking   │  │ Visual    │  │ Output  │ │
│  └────────────┘  └───────────┘  └─────────┘ │
└─────────────────────┬───────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────┐
│                  Audio Pipeline             │
│  ┌────────────┐  ┌───────────┐  ┌─────────┐ │
│  │ Soundmap   │  │ Parameter │  │ Player  │ │
│  │ Publisher  │  │ Publisher │  │ Strategy│ │
│  └────────────┘  └───────────┘  └─────────┘ │
└─────────────────────────────────────────────┘
```

## Key Architectural Principles

### 1. Publisher/Subscriber Model
```javascript
class Publisher {
  constructor() {
    this._subscribers = [];
  }
  
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this._subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this._subscribers = this._subscribers.filter(cb => cb !== callback);
    };
  }
  
  publish(data) {
    // Clone data to prevent modification
    const frozenData = Object.freeze({...data});
    
    this._subscribers.forEach(callback => {
      try {
        callback(frozenData);
      } catch (error) {
        console.error('Error in subscriber:', error);
      }
    });
  }
}
```

### 2. Plugin Architecture
```javascript
class PluginManager {
  constructor({ core, audio, debugPanel, config }) {
    this.core = core;
    this.audio = audio;
    this.debugPanel = debugPanel;
    this.config = config;
    this.plugins = [];
  }
  
  register(plugin) {
    this.plugins.push(plugin);
    plugin.init({
      core: this.core,
      audio: this.audio,
      debugPanel: this.debugPanel,
      config: this.config
    });
  }
  
  disposePlugins() {
    this.plugins.forEach(plugin => {
      if (plugin.dispose) {
        plugin.dispose();
      }
    });
    this.plugins = [];
  }
}
```

### 3. Strategy Pattern
```javascript
// Factory example
class MarkerDetectorFactory {
  static create(strategyName, config = {}) {
    switch (strategyName) {
      case 'OpenCV':
        return new OpenCVMarkerDetector(config);
      case 'SimpleBlob':
        return new SimpleBlobDetector(config);
      case 'ArUco':
        return new ArUcoDetector(config);
      case 'OCR':
        return new OCRMarkerDetector(config);
      default:
        throw new Error(`Unknown marker detector strategy: ${strategyName}`);
    }
  }
}
```

### 4. Service Pattern
```javascript
class ExampleService {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      refreshRate: 60,
      ...config
    };
    
    this.isInitialized = false;
    this.isRunning = false;
    this.eventHandlers = {};
  }
  
  async init() {
    if (this.isInitialized) return;
    
    try {
      await this.initializeResources();
      this.registerEventListeners();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize service: ${error.message}`);
    }
  }
  
  start() {
    if (!this.isInitialized) {
      throw new Error('Service must be initialized before starting');
    }
    
    if (this.isRunning) return;
    this.startProcessing();
    this.isRunning = true;
  }
  
  stop() {
    if (!this.isRunning) return;
    this.stopProcessing();
    this.isRunning = false;
  }
  
  dispose() {
    if (this.isRunning) {
      this.stop();
    }
    
    this.unregisterEventListeners();
    this.releaseResources();
    this.isInitialized = false;
  }
}
```

## Lessons Learned

### 1. Resource Management

#### OpenCV Resources
OpenCV objects must be explicitly deleted to prevent memory leaks:

```javascript
function processImageWithOpenCV(imageData) {
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const binary = new cv.Mat();
  
  try {
    // Process image
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, binary, 127, 255, cv.THRESH_BINARY);
    
    // Return results
    return processResults(binary);
  } finally {
    // Always clean up all resources
    src.delete();
    gray.delete();
    binary.delete();
  }
}
```

#### Media Resources

```javascript
class CameraManager {
  async switchCamera(deviceId) {
    // Stop the old track before creating a new one
    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }
    
    // Create new track
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: deviceId ? { exact: deviceId } : undefined }
    });
    
    this.videoTrack = stream.getVideoTracks()[0];
    this.videoElement.srcObject = stream;
  }
  
  dispose() {
    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }
    
    if (this.videoElement.srcObject) {
      this.videoElement.srcObject = null;
    }
  }
}
```

### 2. Initialization Timing Issues

Use lazy loading and resilient initialization for components with dependencies:

```javascript
class ResilientService {
  constructor() {
    this.isInitialized = false;
    this.initAttempts = 0;
    this.maxInitAttempts = 5;
  }
  
  async ensureInitialized() {
    // Already initialized
    if (this.isInitialized) return true;
    
    // Check dependencies
    if (!this.areDependenciesAvailable()) {
      this.initAttempts++;
      if (this.initAttempts >= this.maxInitAttempts) {
        console.warn('Max initialization attempts reached');
        return false;
      }
      
      // Retry with delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return this.ensureInitialized();
    }
    
    // Initialize with dependencies
    try {
      await this.initializeWithDependencies();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize:', error);
      return false;
    }
  }
  
  async performAction() {
    if (!await this.ensureInitialized()) {
      // Handle graceful degradation
      return;
    }
    
    // Perform action with initialized service
  }
}
```

### 3. Performance Optimizations

#### Canvas Optimization

```javascript
// Create optimized context
const ctx = canvas.getContext('2d', {
  alpha: true,
  willReadFrequently: true // For pixel manipulation
});

// Batch drawing operations
function drawMultiplePoints(ctx, points) {
  ctx.beginPath();
  for (const point of points) {
    ctx.moveTo(point.x + point.radius, point.y);
    ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
  }
  ctx.fill(); // Single fill operation
}

// Skip invisible elements
function draw(ctx, canvas) {
  if (!canvas.offsetParent) {
    // Element not visible, skip drawing
    return;
  }
  
  // Proceed with drawing
}
```

#### Event Throttling

```javascript
// Throttle high-frequency events
function createThrottledPublisher(basePublisher, interval = 16) {
  let lastPublishTime = 0;
  let pendingData = null;
  
  return {
    publish: function(data) {
      const now = performance.now();
      pendingData = data;
      
      if (now - lastPublishTime >= interval) {
        basePublisher.publish(pendingData);
        lastPublishTime = now;
        pendingData = null;
      }
    },
    
    subscribe: basePublisher.subscribe.bind(basePublisher)
  };
}
```

### 4. Marker State Management

Tracking marker states (DEFAULT, HIT, ENGAGED, RELEASED):

```javascript
// Marker states
const MARKER_STATE = {
  DEFAULT: 0,  // Detected but not interacted with
  HIT: 1,      // Just touched/interacted with
  ENGAGED: 2,  // Continuous interaction
  RELEASED: 3  // Just released from interaction
};

class MarkerStateTracker {
  constructor(config = {}) {
    this.config = {
      hitThreshold: 10,        // Distance threshold for hit detection (px)
      releaseThreshold: 20,    // Distance threshold for release detection (px)
      engagementTime: 100,     // Min time to transition from HIT to ENGAGED (ms)
      releaseTime: 200,        // Min time without interaction to trigger RELEASED (ms)
      ...config
    };
    
    this.markerStates = new Map(); // marker ID -> state data
    this.lastUpdateTime = performance.now();
  }
  
  updateStates(detectedMarkers, handPositions = []) {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Process each detected marker
    detectedMarkers.forEach(marker => {
      // Get or create state for this marker
      let state = this.markerStates.get(marker.id);
      if (!state) {
        state = {
          id: marker.id,
          position: { ...marker.position },
          state: MARKER_STATE.DEFAULT,
          lastInteractionTime: 0,
          interactionDuration: 0
        };
        this.markerStates.set(marker.id, state);
      }
      
      // Update position
      state.position = { ...marker.position };
      
      // Check for hand interaction
      const isInteracting = this.checkForHandInteraction(marker, handPositions);
      
      // Update state based on interaction
      if (isInteracting) {
        state.lastInteractionTime = currentTime;
        state.interactionDuration += deltaTime;
        
        if (state.state === MARKER_STATE.DEFAULT) {
          state.state = MARKER_STATE.HIT;
        } else if (state.state === MARKER_STATE.HIT && 
                  state.interactionDuration >= this.config.engagementTime) {
          state.state = MARKER_STATE.ENGAGED;
        }
      } else {
        // Not interacting
        const timeSinceInteraction = currentTime - state.lastInteractionTime;
        
        if ((state.state === MARKER_STATE.HIT || state.state === MARKER_STATE.ENGAGED) && 
            timeSinceInteraction >= this.config.releaseTime) {
          state.state = MARKER_STATE.RELEASED;
          // Reset after briefly showing RELEASED state
          setTimeout(() => {
            const currentState = this.markerStates.get(marker.id);
            if (currentState && currentState.state === MARKER_STATE.RELEASED) {
              currentState.state = MARKER_STATE.DEFAULT;
              currentState.interactionDuration = 0;
            }
          }, 100);
        }
      }
    });
    
    // Return current states
    return Array.from(this.markerStates.values());
  }
}
```

### 5. One Euro Filter Implementation

For smooth marker and hand tracking:

```javascript
class OneEuroFilter {
  constructor(config = {}) {
    this.config = {
      frequency: 60,         // Hz - expected frame rate
      minCutoff: 1.0,        // minimum cutoff frequency
      beta: 0.0,             // cutoff slope
      derivativeCutoff: 1.0, // derivative cutoff frequency
      ...config
    };
    
    this.x = null;           // previous filtered value
    this.dx = null;          // previous filtered derivative
    this.lastTime = null;    // last update timestamp
  }
  
  /**
   * Apply filter to new value
   * @param {number} value - New input value
   * @param {number} timestamp - Current timestamp in ms
   * @returns {number} Filtered value
   */
  filter(value, timestamp = performance.now()) {
    // Initialize on first call
    if (this.x === null) {
      this.x = value;
      this.dx = 0;
      this.lastTime = timestamp;
      return value;
    }
    
    // Compute delta time
    const dt = Math.max(1.0, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;
    
    // Calculate alpha based on cutoff frequency
    const alpha = this.calculateAlpha(dt, this.config.minCutoff);
    const alphaDeriv = this.calculateAlpha(dt, this.config.derivativeCutoff);
    
    // Estimate derivative
    const dxRaw = (value - this.x) / dt;
    
    // Filter derivative
    this.dx = this.exponentialSmoothing(alphaDeriv, dxRaw, this.dx);
    
    // Adjust cutoff based on derivative
    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(this.dx);
    const alphaModified = this.calculateAlpha(dt, cutoff);
    
    // Filter value
    this.x = this.exponentialSmoothing(alphaModified, value, this.x);
    
    return this.x;
  }
  
  /**
   * Calculate alpha parameter based on cutoff
   * @private
   */
  calculateAlpha(dt, cutoff) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }
  
  /**
   * Apply exponential smoothing
   * @private
   */
  exponentialSmoothing(alpha, rawValue, filteredValue) {
    return alpha * rawValue + (1.0 - alpha) * filteredValue;
  }
  
  /**
   * Reset filter state
   */
  reset() {
    this.x = null;
    this.dx = null;
    this.lastTime = null;
  }
}
```

## Common Pitfalls and Solutions

### 1. Resource Leaks

**Problem**: Missing cleanup for OpenCV resources, media tracks, event listeners.

**Solution**:
- Always use try/finally blocks with OpenCV operations
- Implement dispose methods for all components
- Track and unsubscribe from all event subscriptions
- Stop media tracks when switching cameras or disposing

### 2. Initialization Race Conditions

**Problem**: Components depending on services that aren't ready yet.

**Solution**:
- Implement resilient initialization with retries
- Use lazy loading pattern for dependencies
- Provide graceful degradation when services aren't available
- Check readiness before performing operations

### 3. Memory Usage

**Problem**: High memory usage and garbage collection pauses.

**Solution**:
- Reuse objects instead of creating new ones in hot paths
- Implement object pooling for frequently created objects
- Use `new cv.Mat()` only when necessary, reuse matrices
- Monitor memory in the performance panel during development

### 4. Performance Issues

**Problem**: Frame rate drops and high CPU usage.

**Solution**:
- Implement dirty rectangle tracking to minimize drawing
- Use `requestAnimationFrame` for rendering synchronization
- Skip processing for invisible elements
- Throttle high-frequency events and publishers
- Apply smaller processing resolution for mobile devices

## Core Component Reference

### Camera System
- `js/core/camera/CameraPublisher.js` - Publishes camera frames

### Marker Detection
- `js/core/marker/MarkerDetector.js` - OpenCV-based detection
- `js/core/marker/MarkerStateTracker.js` - State tracking

### Hand Tracking
- `js/plugins/HandTracking.js` - MediaPipe integration

### Visualization
- `js/services/visual/VisualizationManager.js` - Layered rendering

### Audio System
- `js/services/audio/AudioPlayer.js` - Web Audio implementation

## Plugin Development Guide

### Standard Plugin Interface

```javascript
class SomePlugin {
  constructor(config) {
    this.config = {
      enabled: true,
      // plugin-specific defaults
      ...config
    };
    this.initialized = false;
  }
  
  init({ core, audio, debugPanel, config }) {
    if (this.initialized) return;
    
    // Store references
    this.core = core;
    this.audio = audio;
    
    // Subscribe to events
    this.unsubscribeFunctions = [];
    this.unsubscribeFunctions.push(
      core.markerStatePublisher.subscribe(this.handleMarkerStates.bind(this))
    );
    
    // Initialize plugin-specific resources
    
    this.initialized = true;
  }
  
  dispose() {
    if (!this.initialized) return;
    
    // Unsubscribe from all events
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    this.unsubscribeFunctions = [];
    
    // Clean up resources
    
    this.initialized = false;
  }
  
  // Plugin-specific methods
}
```

### Plugin Registration

```javascript
// In main.js or similar initialization code
function initializePlugins(config) {
  const pluginManager = new PluginManager({
    core: corePipeline,
    audio: audioSystem,
    debugPanel: debugPanel,
    config: config
  });
  
  // Create and register plugins based on config
  Object.entries(config.plugins).forEach(([pluginName, pluginConfig]) => {
    if (!pluginConfig.enabled) return;
    
    const PluginClass = pluginRegistry[pluginName];
    if (!PluginClass) {
      console.warn(`Plugin ${pluginName} not found in registry`);
      return;
    }
    
    const plugin = new PluginClass(pluginConfig);
    pluginManager.register(plugin);
  });
  
  return pluginManager;
}
```

## Testing Methodology

### Standalone HTML Test Files

Create isolated test files for key components:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Module Test: One Euro Filter</title>
  <style>
    canvas { border: 1px solid #ccc; }
    .controls { margin: 20px 0; }
    .visualization { display: flex; }
  </style>
</head>
<body>
  <h1>One Euro Filter Test</h1>
  
  <div class="controls">
    <label>
      Min Cutoff: <input type="range" id="minCutoff" min="0.1" max="5" step="0.1" value="1.0">
      <span id="minCutoffValue">1.0</span>
    </label>
    <br>
    <label>
      Beta: <input type="range" id="beta" min="0" max="1" step="0.01" value="0.0">
      <span id="betaValue">0.0</span>
    </label>
  </div>
  
  <div class="visualization">
    <canvas id="rawCanvas" width="500" height="200"></canvas>
    <canvas id="filteredCanvas" width="500" height="200"></canvas>
  </div>
  
  <script src="../js/filters/OneEuroFilter.js"></script>
  <script>
    // Test implementation
    const rawCanvas = document.getElementById('rawCanvas');
    const filteredCanvas = document.getElementById('filteredCanvas');
    const rawCtx = rawCanvas.getContext('2d');
    const filteredCtx = filteredCanvas.getContext('2d');
    
    // Create filter
    let filter = new OneEuroFilter();
    
    // Setup UI controls
    document.getElementById('minCutoff').addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById('minCutoffValue').textContent = value;
      filter.config.minCutoff = value;
    });
    
    // Visualization and testing code...
  </script>
</body>
</html>
```

## Debug Overlay

The Debug Overlay provides monitoring tools:

```javascript
// Updating OCR Statistics
if (window.app?.debugOverlay?.debugTab) {
    window.app.debugOverlay.debugTab.updateOcrStats(
        detectedId,      // The ID that was detected
        confidenceScore  // Confidence percentage (0-100)
    );
    
    window.app.debugOverlay.debugTab.updateOcrTime(
        processingTimeMs // Processing time in milliseconds
    );
}

// Updating Marker Statistics
if (window.app?.debugOverlay?.debugTab) {
    window.app.debugOverlay.debugTab.updateMarkerStats(
        totalMarkers,    // Total number of markers detected
        identifiedMarkers // Number of markers with identified IDs
    );
}

// Performance Metrics
if (window.app?.debugOverlay?.debugTab) {
    window.app.debugOverlay.debugTab.updatePerformanceMetrics(
        fps,            // Frames per second
        frameTimeMs,    // Average frame time in milliseconds
        memoryUsageBytes // Optional memory usage in bytes
    );
}
```

## Future Development Recommendations

1. **Resilient Service Management**:
   - Implement a central service registry with dependency resolution
   - Add service health monitoring for better diagnostics
   - Improve error recovery for failed services

2. **Performance Optimization**:
   - Move intensive processing to Web Workers
   - Implement WebGL-based visualization for better performance
   - Add adaptive quality settings based on device capabilities

3. **User Experience Improvements**:
   - Add more visual feedback for system state
   - Implement guided setup for marker placement
   - Provide better diagnostics for camera and detection issues

4. **Advanced Audio Features**:
   - Implement audio effect chains
   - Add support for dynamic sample loading
   - Improve MIDI integration with external devices

## Troubleshooting Guide

### Camera Issues
- Check browser permissions
- Verify video constraints are supported
- Ensure proper async/await handling
- Check camera tracks are properly released

### OpenCV Operations
- Verify OpenCV.js is fully loaded
- Check for missing resource cleanup
- Validate input formats and ranges
- Use try/finally for all operations

### Hand Tracking
- Check MediaPipe assets are loaded
- Verify camera feed is properly connected
- Adjust confidence thresholds
- Check browser support

### Performance Issues
- Monitor FPS using performance tools
- Check for memory leaks
- Reduce resolution or processing frequency
- Profile and optimize hot paths 