🎹 **ModularDrumpad AI Assistant Guide (Medium)**

## Response Format
- Begin each response with a unique, random emoji to signal context retention
- Classify all changes as Small (few lines), Medium (single component), or Large (multiple files)
- Include "Related Components" sections for better planning
- When answering, first explain which existing patterns were followed
- Present alternative approaches as options with ratings (1-100) including pros and cons
- Break large edits into chunks to avoid errors

## Development Principles
- Follow KISS (Keep It Simple, Stupid) - avoid unnecessary complexity
- Apply DRY (Don't Repeat Yourself) - reuse existing patterns and code
- Embrace YAGNI (You Aren't Gonna Need It) - implement only what's explicitly requested
- Enforce "Performance First" - optimize critical paths early
- Maintain "Clean Module Boundaries" between Plugins, Core, and Services
- Ensure "Data Flow Clarity" with publisher/subscriber pattern
- Before writing code, analyze at least 3 similar functions/components in the codebase
- Match existing naming patterns, coding styles, and implementation approaches exactly

## Table of Contents
1. [Response Format](#response-format) - Guidelines for structuring responses
2. [Development Principles](#development-principles) - Core development philosophy
3. [Project Status Summary](#project-status-summary) - Current implementation status
4. [Current Development Priorities](#current-development-priorities) - Focus areas
5. [Codebase Structure Guide](#codebase-structure-guide) - Directory and file organization
6. [Project Architecture Overview](#project-architecture-overview) - System architecture diagram
7. [File Structure and Pattern Reference](#file-structure-and-pattern-reference) - Module organization patterns
   - [Module Organization Pattern](#module-organization-pattern) - Standard module structure
   - [Standard File Components](#standard-file-components) - Common file types
   - [Implementation Pattern Examples](#implementation-pattern-examples) - Code examples for implementation
   - [Abstract Factory Pattern Example](#abstract-factory-pattern-example) - Factory pattern implementation
   - [Service Pattern Reference](#service-pattern-reference) - Service implementation pattern
   - [Tab Component Pattern](#tab-component-pattern) - UI Tab implementation pattern
8. [Data Flow Pattern Reference](#data-flow-pattern-reference) - Publisher/subscriber implementation
9. [Implementation Rules](#implementation-rules) - Code organization standards
10. [Error Handling Best Practices](#error-handling-best-practices) - Exception management
11. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid) - Frequent issues and solutions
12. [Library Integration References](#library-integration-references) - External library usage patterns
13. [One Euro Filter Implementation](#one-euro-filter-implementation) - Signal smoothing algorithm
14. [Plugin Architecture Patterns](#plugin-architecture-patterns) - Plugin system design
15. [Marker State Management Pattern](#marker-state-management-pattern) - State tracking system
16. [Testing Methodology](#testing-methodology) - Unit and integration testing approaches
17. [Performance Optimization Guidelines](#performance-optimization-guidelines) - Performance tuning
18. [Common Implementation Issues and Solutions](#common-implementation-issues-and-solutions) - Troubleshooting
19. [Documentation Standards](#documentation-standards) - Documentation requirements
20. [Quick Reference to MODULAR_DRUMPAD_GUIDE.md](#quick-reference-to-modular_drumpad_guidemd) - Main guide links
21. [Troubleshooting Checklist for Common Errors](#troubleshooting-checklist-for-common-errors) - Error resolution

## Project Status Summary
- **Core Infrastructure**: 80% Complete - Plugin system, visualization layers, pub/sub framework
- **Marker System**: 60% Complete - OpenCV integration, basic detection, visualization
- **Hand Tracking**: 50% Complete - MediaPipe integration, basic visualization
- **Audio System**: 30% Complete - Basic Web Audio API integration
- **Advanced Features**: 15% Complete - Core infrastructure supports development

## Current Development Priorities
1. Implement One Euro Filter for marker position smoothing
2. Complete marker ID recognition with OCR
3. Implement marker state management system
4. Develop hand-marker interaction detection
5. Build comprehensive sound mapping system

## Codebase Structure Guide

### Directory Structure
```
/ModularDrumpad
├── /index.html               # Main application entry point
├── /js
│   ├── /config               # Configuration settings
│   │   └── config.js         # Main configuration object
│   ├── /core                 # Core infrastructure
│   │   ├── /camera           # Camera access and frame handling
│   │   ├── /marker           # Marker detection and state tracking
│   │   ├── /event            # Publisher/subscriber implementation
│   │   └── /util             # Utility functions
│   ├── /filters              # Signal processing filters
│   │   └── OneEuroFilter.js  # [TODO] One Euro Filter implementation
│   ├── /plugins              # Plugin implementations
│   │   ├── HandTracking.js   # MediaPipe hand tracking plugin
│   │   ├── MarkerVisual.js   # Marker visualization plugin
│   │   └── MidiOutput.js     # MIDI communication plugin
│   ├── /services             # Service layer implementations
│   │   ├── /audio            # Audio processing services
│   │   └── /visual           # Visualization services
│   └── /workers              # Web Worker implementations
├── /css                      # Styling
├── /assets                   # Static assets (images, sounds)
├── /test                     # Standalone test files
│   └── one-euro-filter.html  # [TODO] Filter test implementation
└── /docs                     # Documentation
```

### Key File References
- **Core Pipeline**: `js/core/CorePipeline.js` - Main processing pipeline
- **Plugin Manager**: `js/core/PluginManager.js` - Plugin registration and lifecycle
- **Marker Detection**: `js/core/marker/MarkerDetector.js` - OpenCV marker detection
- **Visualization Manager**: `js/services/visual/VisualizationManager.js` - Canvas layers

## Project Architecture Overview

```
┌─────────────────────────────────────────────┐
│                  Core Pipeline              │
│  ┌───────────────┐  ┌────────────┐  ┌─────────┐ │
│  │  Camera       │→ │  Marker    │→ │ Marker  │ │
│  │ Publisher     │  │  Detector  │  │ State   │ │
│  └───────────────┘  └────────────┘  └─────────┘ │
└─────────────────────┬───────────────────────────┘
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

## File Structure and Pattern Reference

### Module Organization Pattern

Each module in ModularDrumpad follows a consistent organization pattern:

```
/ModuleNameFolder
├── index.js                  # Exports from all files in the module
├── IModuleName.js            # Interface definition 
├── ModuleNameDTO.js          # Data Transfer Object (immutable)
├── ModuleNamePublisher.js    # Publisher for this module's output
├── strategies/               # Strategy implementations
│   ├── BasicModuleStrategy.js
│   └── AdvancedModuleStrategy.js
└── utils/                    # Module-specific utilities
```

### Standard File Components

1. **Interface Files** (`IModuleName.js`)
   - Define method contracts without implementations
   - Document expected inputs and outputs
   - Include TypeScript-like parameter comments

2. **DTO Files** (`ModuleNameDTO.js`)
   - Immutable data structures for inter-module communication
   - Include timestamp for performance tracking
   - Use Object.freeze() to prevent modification

3. **Publisher Files** (`ModuleNamePublisher.js`)
   - Implement pub/sub pattern
   - Include method to add and remove observers
   - Manage subscription lifecycle

4. **Strategy Files** (`strategies/Strategy.js`)
   - Implement interface requirements
   - Accept configuration in constructor
   - Support runtime reconfiguration

### Implementation Pattern Examples

**Interface Example**:
```javascript
/**
 * @interface IMarkerDetector
 * Defines the contract for marker detection strategies
 */
export class IMarkerDetector {
  /**
   * Initialize the detector
   * @param {Object} config Configuration options
   * @returns {Promise} Resolves when initialization is complete
   */
  init(config) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Detect markers in an image
   * @param {ImageData} imageData Raw image data from canvas
   * @param {number} width Image width
   * @param {number} height Image height
   * @returns {Array<MarkerDTO>} Detected markers
   */
  detectMarkers(imageData, width, height) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Release resources
   */
  dispose() {
    throw new Error('Method not implemented');
  }
}
```

**DTO Example**:
```javascript
/**
 * MarkerDTO - Data Transfer Object for marker detection results
 */
export class MarkerDTO {
  constructor(id, position, corners, confidence) {
    this._id = id;
    this._position = { ...position };
    this._corners = corners.map(corner => ({ ...corner }));
    this._confidence = confidence;
    this._timestamp = performance.now();
    
    // Make immutable
    Object.freeze(this._position);
    Object.freeze(this._corners);
    Object.freeze(this);
  }
  
  get id() { return this._id; }
  get position() { return this._position; }
  get corners() { return this._corners; }
  get confidence() { return this._confidence; }
  get timestamp() { return this._timestamp; }
}
```

**Publisher Example**:
```javascript
/**
 * MarkerPublisher - Publishes marker detection results to subscribers
 */
export class MarkerPublisher {
  constructor() {
    this._subscribers = [];
  }
  
  /**
   * Subscribe to marker detection events
   * @param {Function} callback Function to call when markers are detected
   * @returns {Function} Unsubscribe function
   */
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
  
  /**
   * Publish marker detection results to all subscribers
   * @param {Array<MarkerDTO>} markers Detected markers
   */
  publish(markers) {
    // Clone array to prevent modification
    const frozenMarkers = Object.freeze([...markers]);
    
    this._subscribers.forEach(callback => {
      try {
        callback(frozenMarkers);
      } catch (error) {
        console.error('Error in marker subscriber:', error);
      }
    });
  }
}
```

**Strategy Example**:
```javascript
/**
 * OpenCVMarkerDetector - Marker detection using OpenCV
 * @implements {IMarkerDetector}
 */
export class OpenCVMarkerDetector {
  constructor(config = {}) {
    this.config = {
      adaptiveThreshold: true,
      thresholdValue: 127,
      minSize: 20,
      maxSize: 1000,
      ...config
    };
    
    this.initialized = false;
  }
  
  async init() {
    if (this.initialized) return;
    
    // Wait for OpenCV to be ready
    if (!window.cv) {
      throw new Error('OpenCV is not loaded');
    }
    
    this.initialized = true;
  }
  
  detectMarkers(imageData, width, height) {
    if (!this.initialized) {
      throw new Error('Detector not initialized');
    }
    
    // Create source matrix
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    const binary = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    
    try {
      // Image processing
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Apply threshold
      if (this.config.adaptiveThreshold) {
        cv.adaptiveThreshold(
          gray, binary, 255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY_INV,
          11, 2
        );
      } else {
        cv.threshold(
          gray, binary,
          this.config.thresholdValue, 255,
          cv.THRESH_BINARY_INV
        );
      }
      
      // Find contours
      cv.findContours(
        binary, contours, hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );
      
      // Process contours and return markers
      const markers = [];
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const marker = this.processContour(contour, width, height);
        if (marker) {
          markers.push(marker);
        }
        contour.delete();
      }
      
      return markers;
    } finally {
      // Clean up resources
      src.delete();
      gray.delete();
      binary.delete();
      contours.delete();
      hierarchy.delete();
    }
  }
  
  processContour(contour, width, height) {
    // Process contour to extract marker information
    // Implementation details...
  }
  
  dispose() {
    // Clean up any resources
    this.initialized = false;
  }
}
```

### Abstract Factory Pattern Example

```javascript
/**
 * MarkerDetectorFactory - Creates marker detector strategies
 */
export class MarkerDetectorFactory {
  /**
   * Create a marker detector based on strategy name
   * @param {string} strategyName Name of the strategy
   * @param {Object} config Configuration for the strategy
   * @returns {IMarkerDetector} Detector instance
   */
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

### Service Pattern Reference

The ModularDrumpad uses a service-based architecture for many core features. When working with services, follow these guidelines:

1. Services are created through factories and accessed through service managers
2. Services implement a standard lifecycle (init, start, stop, dispose)
3. Services should be testable in isolation
4. Use the adapter pattern for cross-cutting concerns

All services follow a standard pattern with these core components:

```javascript
/**
 * ExampleService - Template for service implementation
 */
export class ExampleService {
  constructor(config = {}) {
    // Default configuration with overrides
    this.config = {
      enabled: true,
      refreshRate: 60,
      ...config
    };
    
    // State initialization
    this.isInitialized = false;
    this.isRunning = false;
    
    // Event handlers
    this.eventHandlers = {};
    
    // Bind methods to maintain context
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.handleEvent = this.handleEvent.bind(this);
  }
  
  /**
   * Initialize the service
   * @returns {Promise} Resolves when initialization is complete
   */
  async init() {
    if (this.isInitialized) return;
    
    try {
      // Service-specific initialization
      await this.initializeResources();
      
      // Register event listeners
      this.registerEventListeners();
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize service: ${error.message}`);
    }
  }
  
  /**
   * Start the service
   */
  start() {
    if (!this.isInitialized) {
      throw new Error('Service must be initialized before starting');
    }
    
    if (this.isRunning) return;
    
    // Service-specific start logic
    this.startProcessing();
    
    this.isRunning = true;
  }
  
  /**
   * Stop the service
   */
  stop() {
    if (!this.isRunning) return;
    
    // Service-specific stop logic
    this.stopProcessing();
    
    this.isRunning = false;
  }
  
  /**
   * Register an event handler
   * @param {string} eventType Type of event to handle
   * @param {Function} handler Function to call when event occurs
   * @returns {Function} Function to unregister handler
   */
  on(eventType, handler) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    
    this.eventHandlers[eventType].push(handler);
    
    // Return unsubscribe function
    return () => {
      this.eventHandlers[eventType] = 
        this.eventHandlers[eventType].filter(h => h !== handler);
    };
  }
  
  /**
   * Handle an event by notifying all registered handlers
   * @param {string} eventType Type of event
   * @param {Object} eventData Event data
   */
  handleEvent(eventType, eventData) {
    if (!this.eventHandlers[eventType]) return;
    
    const handlers = this.eventHandlers[eventType];
    handlers.forEach(handler => {
      try {
        handler(eventData);
      } catch (error) {
        console.error(`Error in ${eventType} handler:`, error);
      }
    });
  }
  
  /**
   * Update service configuration
   * @param {Object} newConfig New configuration values
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // Apply configuration changes if necessary
    if (this.isRunning) {
      this.applyConfigChanges();
    }
  }
  
  /**
   * Clean up resources used by the service
   */
  dispose() {
    if (this.isRunning) {
      this.stop();
    }
    
    // Unregister event listeners
    this.unregisterEventListeners();
    
    // Release resources
    this.releaseResources();
    
    this.isInitialized = false;
  }
  
  // Service-specific methods to be implemented
  async initializeResources() {}
  registerEventListeners() {}
  unregisterEventListeners() {}
  startProcessing() {}
  stopProcessing() {}
  applyConfigChanges() {}
  releaseResources() {}
}
```

#### Service Access Pattern

Services are accessed through a consistent pattern:

```javascript
// Get service instance
const registry = new ServiceRegistry();
const exampleService = registry.getService('exampleService');

// Handle service events
const unsubscribe = exampleService.on('dataUpdate', data => {
  // Process data
});

// When done with the service
unsubscribe();
```

### Service Initialization and Lazy Loading Patterns

When implementing services that depend on resources that might not be immediately available (such as audio contexts, media devices, or other services), use the Resilient Lazy Loading Pattern:

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

#### Key Lazy Loading Principles:

1. **On-demand Initialization**: Only attempt to initialize when a service method is called
2. **Progressive Retries**: Implement reasonable retry limits with increasing delays
3. **Dependency Resolution**: Check for dependencies before initializing
4. **Graceful Degradation**: UI should remain functional even if services aren't available
5. **Cleanup Handling**: Properly dispose resources if initialization is abandoned

#### Implementation Examples:

Audio plugins in ModularDrumpad use lazy loading to handle initialization timing issues:

```javascript
// Example from PlayStopTransportPlugin.js
async play() {
  if (!this.audio && !(await this.ensureAudioInitialized())) {
    // Handle unavailable audio gracefully
    return;
  }
  
  this.audio.transport.start();
}

async ensureAudioInitialized() {
  if (this.initAttempts >= this.maxInitAttempts) return false;
  
  if (!window.app?.audio?.transport) {
    this.initAttempts++;
    // Retry with delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.ensureAudioInitialized();
  }
  
  this.audio = window.app.audio;
  return true;
}
```

#### Lessons Learned:

1. **Timing is Critical**: Components may initialize in unexpected orders
2. **UI Independence**: UI components should not depend on backend services being ready
3. **Status Clarity**: Clearly communicate initialization status to users
4. **Retry Limits**: Set reasonable retry limits to prevent infinite loops
5. **Feedback Loops**: Provide visual feedback during initialization attempts
6. **Graceful Recovery**: Design components to recover when dependencies become available
7. **Test Delayed Initialization**: Test components with deliberately delayed initialization

### Tab Component Pattern

The ModularDrumpad project uses a consistent pattern for all UI tabs in the configuration system:

```javascript
/**
 * BaseTab - Abstract base class for all configuration tabs
 */
export class BaseTab {
  constructor(name) {
    this.name = name;
    this.active = false;
  }
  
  /**
   * Render the tab content
   * @returns {HTMLElement} The rendered tab content
   */
  render() {
    // Should be implemented by subclasses
    throw new Error('render() must be implemented by subclasses');
  }
  
  /**
   * Called when the tab is activated/selected
   */
  onActivate() {
    this.active = true;
    // Additional activation logic in subclasses
  }
  
  /**
   * Called when the tab is deactivated/unselected
   */
  onDeactivate() {
    this.active = false;
    // Cleanup logic in subclasses
  }
}
```

#### Tab Implementation Pattern

All configuration tabs follow this implementation pattern:

```javascript
/**
 * ExampleTab - Configuration tab for example features
 */
export class ExampleTab extends BaseTab {
  constructor(configSection) {
    super('Example Tab');
    
    // Store configuration section for this tab
    this.configSection = configSection || {
      // Default configuration values
      enabled: true,
      param1: 10,
      param2: "default"
    };
    
    // Define category metadata
    this.category = {
      name: 'Example',
      icon: 'settings',
      description: 'Configure example settings'
    };
  }
  
  render() {
    const container = document.createElement('div');
    container.className = 'config-tab-content';
    
    // Create tab header with title and description
    container.innerHTML = `
      <div class="config-header">
        <h2>
          <span class="material-symbols-outlined">${this.category.icon}</span>
          ${this.category.name}
        </h2>
        <p class="config-description">${this.category.description}</p>
      </div>
      
      <!-- Configuration Controls -->
      <div class="config-section">
        <h3>Settings</h3>
        <div class="config-controls">
          ${this.createToggleControl('enabled', 'Enable Feature')}
          ${this.createRangeControl('param1', 'Parameter 1', 0, 100, 1)}
          <!-- More controls -->
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="config-actions">
        <button class="config-button revert-btn" id="example-revert-btn">
          <span class="material-symbols-outlined">restart_alt</span>
          Revert to Defaults
        </button>
        <button class="config-button apply-btn" id="example-apply-btn">
          <span class="material-symbols-outlined">check</span>
          Apply Changes
        </button>
      </div>
    `;
    
    // Attach event listeners after DOM is ready
    setTimeout(() => {
      const revertBtn = document.getElementById('example-revert-btn');
      const applyBtn = document.getElementById('example-apply-btn');
      
      if (revertBtn) {
        revertBtn.addEventListener('click', this.handleRevert.bind(this));
      }
      if (applyBtn) {
        applyBtn.addEventListener('click', this.handleApply.bind(this));
      }
    }, 0);
    
    return container;
  }
  
  // Helper methods for creating controls
  createToggleControl(key, label) {
    // Implementation for toggle control
  }
  
  createRangeControl(key, label, min, max, step) {
    // Implementation for range control
  }
  
  // Event handlers
  handleRevert() {
    // Reset to default values
    // Update UI to reflect changes
  }
  
  handleApply() {
    // Apply configuration changes
    // Update running components
  }
  
  // Lifecycle methods
  onActivate() {
    super.onActivate();
    // Load current configuration
    // Setup any required intervals or listeners
  }
  
  onDeactivate() {
    super.onDeactivate();
    // Clean up any intervals or listeners
  }
}
```

#### Tab Registration

Tabs are registered with the UI system at application startup:

```javascript
function initializeConfigTabs() {
  const configManager = window.app.configManager;
  const config = configManager.config;
  
  // Create tab instances
  const tabs = [
    new GeneralTab(config.general),
    new CameraTab(config.camera),
    new MarkerTab(config.marker),
    new HandMeasurementTab(config.handMeasurement),
    // Additional tabs...
  ];
  
  // Register tabs with UI manager
  const tabManager = new TabManager(
    document.getElementById('config-tabs'),
    document.getElementById('config-content')
  );
  
  tabs.forEach(tab => tabManager.addTab(tab));
  
  // Show first tab initially
  tabManager.showTab(0);
}
```

## Data Flow Pattern Reference

```javascript
// 1. Camera captures frames and publishes them
cameraPublisher.publish({
  timestamp: performance.now(),
  imageData: imageData,
  width: canvas.width,
  height: canvas.height
});

// 2. Marker detector subscribes to camera frames
cameraPublisher.subscribe((frameData) => {
  // Process frame to detect markers
  const markers = markerDetector.detectMarkers(frameData);
  
  // Publish detected markers
  markerPublisher.publish(markers);
});

// 3. Marker state tracker subscribes to raw markers
markerPublisher.subscribe((markers) => {
  // Update marker states based on tracking
  const markerStates = markerStateTracker.updateStates(markers);
  
  // Publish updated marker states
  markerStatePublisher.publish(markerStates);
});

// 4. Plugins subscribe to marker states
markerStatePublisher.subscribe((markerStates) => {
  // Process marker states for visualization, audio, etc.
  visualizationPlugin.updateVisualization(markerStates);
  audioPlugin.triggerSounds(markerStates);
});
```

## Implementation Rules
- Follow publisher/subscriber pattern for all communications
- Implement proper cleanup in all dispose() methods
- Use strategy pattern for interchangeable algorithms
- Structure visualization with layer system for z-index control
- Implement One Euro Filter with configurable parameters
- Use async/await for asynchronous operations
- Create factory methods for component initialization

## Error Handling Best Practices
- Implement nested try/catch blocks for OpenCV operations
- Add proper resource cleanup in finally blocks
- Use defensive programming with parameter validation
- Create graceful fallbacks for detection failures
- Implement periodic status logging rather than per-frame
- Add visual indicators for system state in UI

## Common Pitfalls to Avoid
1. **Resource Leaks**
   - Failure to explicitly delete cv.Mat objects
   - Not stopping camera tracks when switching settings
   - Missing cleanup in visualization layers
   - Incomplete teardown in plugin dispose methods

2. **Performance Bottlenecks**
   - Creating objects in hot paths
   - Excessive DOM manipulation
   - Inefficient canvas operations without optimization flags
   - Too many draw operations per frame
   - Missing debounce for high-frequency events

3. **Integration Issues**
   - Plugin conflicts when accessing shared resources
   - Race conditions in initialization sequence
   - Inconsistent event naming across publishers
   - Missing validation when processing events

4. **Camera Handling**
   - Attempting to access video dimensions before element is ready
   - Missing readyState checks before capturing frames
   - Not handling OverconstrainedError for incompatible settings
   - Console log flooding that obscures errors

## Library Integration References

### OpenCV Integration Pattern
```javascript
// Load OpenCV.js asynchronously
function loadOpenCV() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.5.5/opencv.js';
    script.async = true;
    script.onload = () => {
      console.log('OpenCV.js loaded');
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load OpenCV.js'));
    };
    document.head.appendChild(script);
  });
}

// Properly handle OpenCV resources
function processImageWithOpenCV(imageData) {
  // Create source matrix
  const src = cv.matFromImageData(imageData);
  
  // Create destination matrices
  const gray = new cv.Mat();
  const binary = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  
  try {
    // Process image
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, binary, 127, 255, cv.THRESH_BINARY);
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    // Process results
    const result = [];
    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i);
      result.push(processContour(cnt));
      cnt.delete(); // Important: delete each contour
    }
    
    return result;
  } finally {
    // Always clean up all OpenCV resources
    src.delete();
    gray.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
  }
}
```

### MediaPipe Integration Pattern
```javascript
// Initialize MediaPipe Hands
async function initializeHandTracking() {
  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });
  
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  
  hands.onResults(onHandResults);
  
  // Connect to camera
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
  });
  
  await camera.start();
  
  return { hands, camera };
}

// Process hand tracking results
function onHandResults(results) {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    return;
  }
  
  // Apply One Euro Filter to each landmark point
  const filteredLandmarks = results.multiHandLandmarks.map(handLandmarks => 
    handLandmarks.map((landmark, index) => {
      // Get or create filter for this landmark
      const filter = getOrCreateFilter(`hand_${index}`);
      
      // Apply filter to x, y, z coordinates
      return {
        x: filter.x.filter(landmark.x),
        y: filter.y.filter(landmark.y),
        z: filter.z.filter(landmark.z)
      };
    })
  );
  
  // Publish hand tracking results
  handLandmarksPublisher.publish(filteredLandmarks);
}
```

## One Euro Filter Implementation

The One Euro Filter is next on your TODO list. Here's the recommended implementation approach:

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

// Vector3D filter for x,y,z coordinates
class OneEuroFilter3D {
  constructor(config = {}) {
    this.x = new OneEuroFilter(config);
    this.y = new OneEuroFilter(config);
    this.z = new OneEuroFilter(config);
  }
  
  filter(point, timestamp = performance.now()) {
    return {
      x: this.x.filter(point.x, timestamp),
      y: this.y.filter(point.y, timestamp),
      z: this.z.filter(point.z, timestamp)
    };
  }
  
  reset() {
    this.x.reset();
    this.y.reset();
    this.z.reset();
  }
}

// Filter manager for tracking multiple filters
class FilterManager {
  constructor() {
    this.filters = new Map();
  }
  
  getFilter(id, config = {}) {
    if (!this.filters.has(id)) {
      this.filters.set(id, new OneEuroFilter(config));
    }
    return this.filters.get(id);
  }
  
  getFilter3D(id, config = {}) {
    if (!this.filters.has(id)) {
      this.filters.set(id, new OneEuroFilter3D(config));
    }
    return this.filters.get(id);
  }
  
  resetFilter(id) {
    const filter = this.filters.get(id);
    if (filter) {
      filter.reset();
    }
  }
  
  resetAllFilters() {
    this.filters.forEach(filter => filter.reset());
  }
}
```

## Plugin Architecture Patterns

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

## Marker State Management Pattern

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
    
    // Handle markers that disappeared
    this.removeStaleMarkers(detectedMarkers);
    
    // Return current states
    return Array.from(this.markerStates.values());
  }
  
  checkForHandInteraction(marker, handPositions) {
    // Implementation depends on hand tracking data format
    // This is a simplified example
    for (const hand of handPositions) {
      // Use index finger tip (8) as interaction point
      const fingerTip = hand[8]; 
      if (fingerTip) {
        const distance = Math.sqrt(
          Math.pow(fingerTip.x - marker.position.x, 2) +
          Math.pow(fingerTip.y - marker.position.y, 2)
        );
        
        if (distance < this.config.hitThreshold) {
          return true;
        }
      }
    }
    return false;
  }
  
  removeStaleMarkers(currentMarkers) {
    const currentIds = new Set(currentMarkers.map(m => m.id));
    for (const [id, state] of this.markerStates.entries()) {
      if (!currentIds.has(id)) {
        this.markerStates.delete(id);
      }
    }
  }
}
```

## Testing Methodology

### Standalone Testing Pattern

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

## Performance Optimization Guidelines

1. **Canvas Optimization**
   - Use `willReadFrequently: true` for contexts with pixel manipulation
   - Batch similar drawing operations
   - Minimize canvas size changes
   - Consider using multiple smaller canvases for isolated updates

2. **Event System Optimization**
   - Implement event throttling for high-frequency publishers
   - Use object pooling for event data
   - Consider tiered subscription for different update frequencies
   - Debounce visualization updates

3. **Memory Management**
   - Explicitly track and free OpenCV resources
   - Use object pools for frequently created objects
   - Implement proper cleanup in all components
   - Monitor memory usage during development

4. **Rendering Pipeline**
   - Use requestAnimationFrame for smooth animations
   - Implement dirty rectangle tracking
   - Skip processing for invisible elements
   - Batch DOM updates

## Common Implementation Issues and Solutions

### Issue: Marker Jitter
**Solution**: Implement One Euro Filter as described above, with tuned parameters for minCutoff and beta values.

### Issue: Marker Detection Inconsistency
**Solution**: 
1. Improve preprocessing with adaptive thresholding
2. Implement confidence scoring for detected markers
3. Add temporal filtering to maintain detection during brief occlusions

### Issue: High CPU Usage
**Solution**:
1. Reduce processing resolution for detection stages
2. Implement frame skipping when needed
3. Move intensive calculations to Web Workers
4. Use dirty rectangle tracking to minimize canvas updates

### Issue: Memory Leaks with OpenCV
**Solution**:
1. Always use try/finally blocks with CV operations
2. Create helper functions that ensure cleanup
3. Implement periodic garbage collection triggers
4. Add monitoring for CV object counts

## Documentation Standards

- Document challenges encountered alongside solutions
- Structure configuration approaches with examples
- Explain the importance of visual feedback in UI components
- Include "What Worked Well" and "Challenges Encountered" sections
- Provide "Recommendations for Future Modules" section

### What Worked Well Section Guidelines

When documenting what worked well in a module or implementation, include:

- **Architectural Decisions**: Document successful architectural patterns (Publisher/Subscriber, Strategy Pattern, etc.) that provided flexibility and maintainability
- **Performance Optimizations**: Detail specific optimizations that yielded significant improvements (e.g., canvas batching, throttling, adaptive smoothing)
- **Library Integrations**: Note which third-party libraries integrated seamlessly and why they were successful
- **Error Handling Approaches**: Highlight resilient error handling patterns that prevented cascading failures
- **UI/UX Solutions**: Describe interface elements that provided intuitive user experiences
- **Code Organization**: Document file structures or patterns that improved code clarity and team collaboration
- **Testing Methods**: Share effective testing strategies that uncovered important issues early
- **Resource Management**: Detail successful approaches to memory/resource handling, especially for OpenCV and canvas operations
- **Configuration Patterns**: Show how flexible configuration improved adaptability across different environments
- **Cross-Browser Solutions**: Highlight approaches that solved cross-browser compatibility challenges

Each item should include concrete metrics when possible (e.g., "Canvas batching reduced CPU usage by 15%") and reference the specific implementation location.

## Quick Reference to MODULAR_DRUMPAD_GUIDE.md

You can find detailed implementation information in the main guide:

- **Publisher/Subscriber Pattern**: See section "Core Components > Camera System" (lines 75-83)
- **Marker Detection**: See section "Marker Detection" (lines 275-312)
- **Hand Smoothing**: See section "Hand Smoothing" (lines 224-272)
- **Audio System**: See section "Audio System" (lines 315-358)
- **OCR Integration**: See section "OCR Integration" (lines 275-298)
- **Performance Optimization**: See section "Performance Optimization" (lines 360-395)

## Troubleshooting Checklist for Common Errors

1. **Camera Not Starting**
   - Check browser permissions (camera access)
   - Verify video element is in DOM
   - Check for errors in constraints (resolution, frame rate)
   - Ensure proper async/await handling

2. **OpenCV Operations Failing**
   - Verify OpenCV.js is fully loaded before use
   - Check matrix dimensions match expected sizes
   - Ensure all matrices are properly deleted
   - Validate parameter ranges for operations

3. **Hand Tracking Not Working**
   - Confirm MediaPipe assets are loading (check network tab)
   - Verify camera feed is properly connected
   - Check hand confidence thresholds
   - Ensure hands are within camera frame

4. **Audio Not Playing**
   - Check for user interaction (needed for AudioContext)
   - Verify sound buffers are properly loaded
   - Check gain levels and connections
   - Look for disconnected audio nodes

5. **Performance Issues**
   - Monitor FPS in performance panel
   - Check for memory leaks (increasing memory usage)
   - Look for excessive garbage collection
   - Reduce resolution or processing complexity
