# Project Apollo Developer Guide

**Version:** 1.0.0  
**Last Updated:** May 2025  
**Framework:** Modular JavaScript + Computer Vision

## 👨‍💻 Developer Overview

Project Apollo is an evolution of our interactive audio-visual application that uses computer vision to detect markers and hand gestures for triggering sounds. This guide serves as a comprehensive reference for development, incorporating key lessons from previous project iterations.

### Project Status

- **Core Engine**: In development - Camera pipeline, marker detection, audio engine
- **Memory Management**: Optimized with object pooling and resource tracking
- **Architecture**: Service-oriented with publisher/subscriber communication
- **Next Steps**: Complete core services implementation with optimized GC handling

### Common Tasks

- **Adding new sounds**: Modify `js/services/sound-map-service.js`
- **Adjusting marker detection**: Configure in `js/services/vision-service.js`
- **UI customization**: Work with components in `js/components/`
- **Performance optimization**: Review object pooling in `js/utils/object-pool.js`

## 📋 Architecture Overview

### System Architecture

Project Apollo uses a modular service-oriented architecture with these key components:

```
Apollo/
├── js/
│   ├── components/      # UI components (visual elements)
│   ├── services/        # Core application services
│   │   ├── base/        # Base service classes 
│   │   ├── vision/      # Computer vision services
│   │   ├── audio/       # Audio processing services
│   │   └── core/        # Core application services
│   ├── processors/      # Frame and data processors 
│   ├── publishers/      # Event distribution system
│   ├── handlers/        # Command handlers
│   ├── utils/           # Utility functions
│   └── factories/       # Service factories
├── assets/              # Static assets 
└── docs/                # Documentation
```

### Key Components

- **ServiceManager**: Central registry for all services
- **FrameProcessor**: Efficient frame processing pipeline with object pooling
- **CommandHandler**: Action processing through commands
- **Publishers**: Event distribution system (CameraFramePublisher, MarkerPublisher, etc.)
- **ObjectPool**: Resource recycling for garbage collection optimization

### Data Flow

1. **Camera** captures frames
2. **FrameProcessor** processes frames with pooled resources
3. **MarkerDetector** identifies markers using optimized OpenCV operations
4. **MarkerStateTracker** determines interaction states
5. **AudioEngine** generates sound based on marker states

## 💡 Core Design Patterns

### 1. Publisher/Subscriber Pattern

This pattern provides loose coupling between components:

```javascript
class Publisher {
  constructor() {
    this._subscribers = [];
  }
  
  subscribe(callback) {
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

// Usage
const framePublisher = new Publisher();
const unsubscribe = framePublisher.subscribe(frame => {
  processFrame(frame);
});

// Cleanup
unsubscribe();
```

### 2. Service Lifecycle Management

Services follow a consistent lifecycle with proper resource management:

```javascript
class BaseService {
  constructor() {
    this.isInitialized = false;
    this.resources = [];
    this.subscriptions = [];
  }
  
  async initialize() {
    if (this.isInitialized) return this;
    
    try {
      await this._initializeResources();
      this.isInitialized = true;
      return this;
    } catch (error) {
      this._cleanupResources();
      throw new Error(`Failed to initialize ${this.constructor.name}: ${error.message}`);
    }
  }
  
  dispose() {
    if (!this.isInitialized) return;
    
    // Unsubscribe from all events
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
    
    // Release resources
    this._cleanupResources();
    
    this.isInitialized = false;
  }
  
  _registerSubscription(unsubscribe) {
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }
  
  _cleanupResources() {
    this.resources.forEach(resource => {
      if (resource && typeof resource.release === 'function') {
        resource.release();
      }
    });
    this.resources = [];
  }
}
```

### 3. Object Pooling Pattern

Critical for performance and garbage collection optimization:

```javascript
class ObjectPool {
  constructor(factory, initialSize = 10) {
    this.factory = factory;
    this.pool = Array(initialSize).fill().map(() => this.factory());
  }
  
  get() {
    return this.pool.pop() || this.factory();
  }
  
  release(obj) {
    // Clear/reset object state before returning to pool
    if (obj.reset) obj.reset();
    this.pool.push(obj);
  }
}

// Usage example
const rectanglePool = new ObjectPool(() => ({ 
  x: 0, y: 0, width: 0, height: 0,
  reset() { this.x = 0; this.y = 0; this.width = 0; this.height = 0; }
}));

function processFrame() {
  const rect = rectanglePool.get();
  // Use rect
  rectanglePool.release(rect); // Return to pool when done
}
```

### 4. Service Factory Pattern

For managed service creation and dependency resolution:

```javascript
class ServiceFactory {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
  }
  
  register(serviceId, ServiceClass, dependencies = []) {
    this.services.set(serviceId, { 
      ServiceClass, 
      dependencies 
    });
  }
  
  async create(serviceId, config = {}) {
    const serviceInfo = this.services.get(serviceId);
    if (!serviceInfo) {
      throw new Error(`Service ${serviceId} not registered`);
    }
    
    // Check if instance already exists
    if (this.instances.has(serviceId)) {
      return this.instances.get(serviceId);
    }
    
    // Resolve dependencies
    const deps = {};
    for (const depId of serviceInfo.dependencies) {
      deps[depId] = await this.create(depId);
    }
    
    // Create and initialize service
    const service = new serviceInfo.ServiceClass(config, deps);
    await service.initialize();
    
    // Store instance
    this.instances.set(serviceId, service);
    
    return service;
  }
  
  async disposeAll() {
    // Dispose in reverse dependency order
    for (const [serviceId, service] of this.instances) {
      await service.dispose();
    }
    this.instances.clear();
  }
}
```

### 5. Command Pattern

For better testability and separation of concerns:

```javascript
// Command handler
class CommandHandler {
  constructor() {
    this.handlers = new Map();
  }
  
  register(commandType, handler) {
    this.handlers.set(commandType, handler);
  }
  
  execute(command) {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }
    
    return handler(command.payload);
  }
}

// Usage
const commandHandler = new CommandHandler();
commandHandler.register('START_CAMERA', payload => {
  return cameraService.start(payload.deviceId);
});

// Execute command
commandHandler.execute({
  type: 'START_CAMERA',
  payload: { deviceId: 'default' }
});
```

## 🔬 Memory Management

### OpenCV Resource Management

```javascript
function processWithOpenCV(frame) {
  // Allocate OpenCV resources
  const src = cv.matFromImageData(frame);
  const gray = new cv.Mat();
  const binary = new cv.Mat();
  
  try {
    // Process frame
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, binary, 127, 255, cv.THRESH_BINARY);
    return processResults(binary);
  } finally {
    // ALWAYS release resources, even if exceptions occur
    src.delete();
    gray.delete();
    binary.delete();
  }
}
```

### Canvas Optimization

```javascript
// Create optimized canvas context
function createOptimizedContext(canvas, options = {}) {
  return canvas.getContext('2d', {
    alpha: options.alpha ?? false,             // Disable alpha when not needed
    willReadFrequently: options.willReadFrequently ?? true,  // Optimize for pixel manipulation
    desynchronized: options.desynchronized ?? true      // Reduce latency when possible
  });
}

// Batch drawing operations
function drawMultipleShapes(ctx, shapes) {
  ctx.beginPath();
  for (const shape of shapes) {
    // Add shape to path
  }
  ctx.fill(); // Single fill operation instead of multiple
}

// Skip invisible elements
function optimizedDraw(ctx, element, drawFn) {
  if (!element.isVisible()) {
    return; // Skip drawing if not visible
  }
  drawFn(ctx);
}
```

### Frame Processing Pipeline

```javascript
class FrameProcessor {
  constructor(config = {}) {
    this.config = {
      processingInterval: 30, // ms between processing
      scaleFactor: 0.5,       // Scale frames for detection
      ...config
    };
    
    this.lastProcessTime = 0;
    this.framePool = new ObjectPool(() => new ImageData(320, 240));
    this.resultPool = new ObjectPool(() => ({ 
      markers: [], 
      timestamp: 0 
    }));
  }
  
  processFrame(rawFrame, timestamp) {
    // Check if we should process this frame
    if (timestamp - this.lastProcessTime < this.config.processingInterval) {
      return null;
    }
    
    this.lastProcessTime = timestamp;
    
    // Get frame from pool
    const frame = this.framePool.get();
    
    // Scale and process frame
    this._scaleFrame(rawFrame, frame);
    
    // Detect markers
    const result = this.resultPool.get();
    result.timestamp = timestamp;
    this._detectMarkers(frame, result.markers);
    
    // Release frame back to pool
    this.framePool.release(frame);
    
    return result;
  }
  
  releaseResult(result) {
    // Clear arrays
    result.markers.length = 0;
    // Return to pool
    this.resultPool.release(result);
  }
}
```

## 🧩 Service Implementation

### Camera Service

```javascript
class CameraService extends BaseService {
  constructor(config = {}, deps = {}) {
    super();
    
    this.config = {
      width: 640,
      height: 480,
      deviceId: null,
      ...config
    };
    
    this.deps = deps;
    this.stream = null;
    this.videoElement = document.createElement('video');
    this.framePublisher = new Publisher();
  }
  
  async _initializeResources() {
    // Configure video element
    this.videoElement.width = this.config.width;
    this.videoElement.height = this.config.height;
    this.videoElement.autoplay = true;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    
    // Start camera with retry mechanism
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        await this._startCamera();
        // Track resource for cleanup
        this.resources.push({
          release: () => {
            if (this.stream) {
              this.stream.getTracks().forEach(track => track.stop());
              this.stream = null;
            }
          }
        });
        return;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  async _startCamera() {
    const constraints = {
      video: {
        width: { ideal: this.config.width },
        height: { ideal: this.config.height }
      }
    };
    
    if (this.config.deviceId) {
      constraints.video.deviceId = { exact: this.config.deviceId };
    }
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Video element not ready after timeout'));
        }, 5000);
        
        this.videoElement.onloadedmetadata = () => {
          clearTimeout(timeoutId);
          this.videoElement.play().then(resolve);
        };
      });
      
      // Start frame capture
      this._startFrameCapture();
      
    } catch (error) {
      throw new Error(`Failed to access camera: ${error.message}`);
    }
  }
  
  _startFrameCapture() {
    // Create canvas for frame capture
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    // Capture frames
    const captureFrame = () => {
      if (!this.isInitialized) return;
      
      ctx.drawImage(this.videoElement, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      this.framePublisher.publish({
        imageData,
        timestamp: performance.now(),
        width: canvas.width,
        height: canvas.height
      });
      
      requestAnimationFrame(captureFrame);
    };
    
    requestAnimationFrame(captureFrame);
  }
  
  // Public API
  
  async switchCamera(deviceId) {
    this.config.deviceId = deviceId;
    
    // Stop current stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Start with new device
    return this._startCamera();
  }
  
  getAvailableCameras() {
    return navigator.mediaDevices.enumerateDevices()
      .then(devices => devices.filter(device => device.kind === 'videoinput'));
  }
  
  subscribeToFrames(callback) {
    return this._registerSubscription(
      this.framePublisher.subscribe(callback)
    );
  }
}
```

### Marker Detection Service

```javascript
class MarkerDetectionService extends BaseService {
  constructor(config = {}, deps = {}) {
    super();
    
    this.config = {
      detectionInterval: 30, // ms
      minMarkerSize: 20,     // px
      ...config
    };
    
    this.deps = deps;
    this.lastDetectionTime = 0;
    this.isProcessing = false;
    
    // Object pools
    this.markerPool = new ObjectPool(() => ({
      id: -1,
      corners: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ],
      center: { x: 0, y: 0 },
      confidence: 0,
      reset() {
        this.id = -1;
        this.corners.forEach(corner => { corner.x = 0; corner.y = 0; });
        this.center.x = 0;
        this.center.y = 0;
        this.confidence = 0;
      }
    }));
    
    // Publishers
    this.markerPublisher = new Publisher();
  }
  
  async _initializeResources() {
    // Ensure OpenCV is loaded
    if (!window.cv) {
      throw new Error('OpenCV is not loaded');
    }
    
    // Subscribe to camera frames
    if (!this.deps.cameraService) {
      throw new Error('Camera service dependency is missing');
    }
    
    this._registerSubscription(
      this.deps.cameraService.subscribeToFrames(this._onFrame.bind(this))
    );
  }
  
  _onFrame(frame) {
    // Skip if already processing or too soon
    if (this.isProcessing) return;
    
    const now = performance.now();
    if (now - this.lastDetectionTime < this.config.detectionInterval) {
      return;
    }
    
    this.isProcessing = true;
    this.lastDetectionTime = now;
    
    // Process frame
    this._detectMarkers(frame)
      .then(markers => {
        this.markerPublisher.publish({
          markers,
          timestamp: frame.timestamp,
        });
      })
      .catch(error => {
        console.error('Error detecting markers:', error);
      })
      .finally(() => {
        this.isProcessing = false;
      });
  }
  
  async _detectMarkers(frame) {
    // OpenCV-based marker detection with proper resource management
    const src = cv.matFromImageData(frame.imageData);
    const gray = new cv.Mat();
    const markers = [];
    
    try {
      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Detect markers (simplified example)
      // In a real implementation, this would use ArUco or another marker detection algorithm
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      
      cv.findContours(gray, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      // Process detected contours
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        // Filter small contours
        if (area < this.config.minMarkerSize * this.config.minMarkerSize) {
          continue;
        }
        
        // Get marker from pool
        const marker = this.markerPool.get();
        
        // Process contour to extract marker info
        const moments = cv.moments(contour);
        marker.center.x = moments.m10 / moments.m00;
        marker.center.y = moments.m01 / moments.m00;
        
        // Get corners (simplified)
        const rect = cv.minAreaRect(contour);
        const rectPoints = cv.boxPoints(rect);
        for (let j = 0; j < 4; j++) {
          marker.corners[j].x = rectPoints.data32F[j * 2];
          marker.corners[j].y = rectPoints.data32F[j * 2 + 1];
        }
        
        // Assign ID based on position or other characteristics
        marker.id = i + 1;
        marker.confidence = 0.9; // Placeholder
        
        markers.push(marker);
      }
      
      // Clean up OpenCV resources
      contours.delete();
      hierarchy.delete();
      
      return markers;
    } finally {
      // ALWAYS release OpenCV resources
      src.delete();
      gray.delete();
    }
  }
  
  // Public API
  
  subscribeToMarkers(callback) {
    return this._registerSubscription(
      this.markerPublisher.subscribe(callback)
    );
  }
  
  releaseMarkers(markers) {
    markers.forEach(marker => this.markerPool.release(marker));
  }
}
```

## 🎨 Best Practices

### Memory Management

1. **Always Clean Up OpenCV Resources**
   ```javascript
   const mat = new cv.Mat();
   try {
     // Use mat
   } finally {
     mat.delete(); // Always delete, even on error
   }
   ```

2. **Use Object Pooling for Frequent Objects**
   ```javascript
   // Create pools for frequently used objects
   const vectorPool = new ObjectPool(() => ({ x: 0, y: 0 }));
   
   function processManyVectors() {
     const vectors = [];
     for (let i = 0; i < 1000; i++) {
       const vec = vectorPool.get();
       // Use vec
       vectors.push(vec);
     }
     
     // When done with all vectors
     vectors.forEach(vec => vectorPool.release(vec));
   }
   ```

3. **Track and Release Subscriptions**
   ```javascript
   class Component {
     constructor() {
       this.subscriptions = [];
     }
     
     initialize() {
       this.subscriptions.push(
         eventPublisher.subscribe(this.handleEvent)
       );
     }
     
     dispose() {
       // Unsubscribe from all events
       this.subscriptions.forEach(unsub => unsub());
       this.subscriptions = [];
     }
   }
   ```

### Performance Optimization

1. **Canvas Optimization**
   ```javascript
   // For pixel manipulation
   const ctx = canvas.getContext('2d', { willReadFrequently: true });
   
   // For rendering only
   const ctx = canvas.getContext('2d', { alpha: false });
   ```

2. **Batch DOM Operations**
   ```javascript
   // Avoid
   for (let i = 0; i < 100; i++) {
     container.appendChild(document.createElement('div'));
   }
   
   // Better
   const fragment = document.createDocumentFragment();
   for (let i = 0; i < 100; i++) {
     fragment.appendChild(document.createElement('div'));
   }
   container.appendChild(fragment);
   ```

3. **Use RequestAnimationFrame for Visual Updates**
   ```javascript
   function updateVisuals() {
     // Update visuals
     requestAnimationFrame(updateVisuals);
   }
   requestAnimationFrame(updateVisuals);
   ```

4. **Frame Throttling for Processing**
   ```javascript
   const MIN_FRAME_INTERVAL = 30; // ms
   let lastFrameTime = 0;
   
   function processFrame(timestamp) {
     if (timestamp - lastFrameTime < MIN_FRAME_INTERVAL) {
       // Skip this frame
       requestAnimationFrame(processFrame);
       return;
     }
     
     lastFrameTime = timestamp;
     // Process frame
     requestAnimationFrame(processFrame);
   }
   ```

### Error Handling

1. **Centralized Error Handling**
   ```javascript
   class ErrorHandler {
     static handle(error, context = {}) {
       console.error(`Error in ${context.source || 'unknown'}: ${error.message}`, error);
       
       // Log to monitoring service
       if (window.monitoring) {
         window.monitoring.logError(error, context);
       }
       
       // User feedback for critical errors
       if (context.critical) {
         showUserErrorMessage(context.userMessage || 'An error occurred');
       }
     }
   }
   
   // Usage
   try {
     riskyOperation();
   } catch (error) {
     ErrorHandler.handle(error, { 
       source: 'CameraService', 
       critical: true,
       userMessage: 'Camera error, please try again'
     });
   }
   ```

2. **Graceful Degradation**
   ```javascript
   class FeatureManager {
     constructor() {
       this.features = {
         camera: { available: false, required: true },
         audio: { available: false, required: true },
         advancedDetection: { available: false, required: false }
       };
     }
     
     async checkFeature(name, checkFn) {
       try {
         this.features[name].available = await checkFn();
       } catch (error) {
         this.features[name].available = false;
         this.features[name].error = error;
       }
       
       return this.features[name].available;
     }
     
     canRunApplication() {
       // Check if all required features are available
       return Object.values(this.features)
         .filter(f => f.required)
         .every(f => f.available);
     }
   }
   ```

## 🔍 Common Patterns & Debugging

### Logging System

```javascript
class LoggingService {
  constructor(config = {}) {
    this.config = {
      level: 'info', // error, warn, info, debug
      groupSimilar: true,
      includeTimestamps: true,
      ...config
    };
    
    this.activeGroups = new Map();
  }
  
  _formatMessage(message) {
    if (!this.config.includeTimestamps) {
      return message;
    }
    
    const timestamp = new Date().toISOString().substring(11, 23);
    return `[${timestamp}] ${message}`;
  }
  
  error(message, ...args) {
    console.error(this._formatMessage(message), ...args);
  }
  
  warn(message, ...args) {
    if (['error', 'warn', 'info', 'debug'].includes(this.config.level)) {
      console.warn(this._formatMessage(message), ...args);
    }
  }
  
  info(message, ...args) {
    if (['info', 'debug'].includes(this.config.level)) {
      console.info(this._formatMessage(message), ...args);
    }
  }
  
  debug(message, ...args) {
    if (this.config.level === 'debug') {
      console.debug(this._formatMessage(message), ...args);
    }
  }
  
  group(groupId, message) {
    if (!this.config.groupSimilar) {
      console.group(this._formatMessage(message));
      return;
    }
    
    if (this.activeGroups.has(groupId)) {
      return;
    }
    
    console.group(this._formatMessage(message));
    this.activeGroups.set(groupId, true);
  }
  
  groupEnd(groupId) {
    if (!this.config.groupSimilar) {
      console.groupEnd();
      return;
    }
    
    if (this.activeGroups.has(groupId)) {
      console.groupEnd();
      this.activeGroups.delete(groupId);
    }
  }
}

// Usage
const log = new LoggingService({ level: 'debug' });

log.group('init', '🚀 Initializing application');
log.info('Loading camera service');
// ... more initialization logs
log.groupEnd('init');
```

### Performance Monitoring

```javascript
class PerformanceMonitor {
  constructor() {
    this.frameTimes = [];
    this.maxSamples = 60;
    this.lastFrameTime = 0;
  }
  
  beginFrame() {
    this.lastFrameTime = performance.now();
  }
  
  endFrame() {
    const now = performance.now();
    const frameDuration = now - this.lastFrameTime;
    
    this.frameTimes.push(frameDuration);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }
  
  getAverageFrameTime() {
    if (this.frameTimes.length === 0) return 0;
    
    const sum = this.frameTimes.reduce((total, time) => total + time, 0);
    return sum / this.frameTimes.length;
  }
  
  getFPS() {
    const avgFrameTime = this.getAverageFrameTime();
    if (avgFrameTime <= 0) return 0;
    
    return 1000 / avgFrameTime;
  }
  
  getMetrics() {
    return {
      fps: this.getFPS().toFixed(1),
      frameTime: this.getAverageFrameTime().toFixed(2),
      samples: this.frameTimes.length
    };
  }
}

// Usage
const monitor = new PerformanceMonitor();

function animationLoop() {
  monitor.beginFrame();
  
  // Render frame
  
  monitor.endFrame();
  
  // Show metrics
  if (frameCount % 30 === 0) {
    console.log('Performance:', monitor.getMetrics());
  }
  
  requestAnimationFrame(animationLoop);
}
```

## 🧪 Testing Methodology

### Isolated Component Testing

Create standalone HTML files to test individual components:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Camera Service Test</title>
  <style>
    body { font-family: sans-serif; }
    #videoContainer { width: 640px; height: 480px; border: 1px solid #ccc; }
    .controls { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Camera Service Test</h1>
  
  <div id="videoContainer"></div>
  
  <div class="controls">
    <button id="startCamera">Start Camera</button>
    <button id="stopCamera">Stop Camera</button>
    <select id="cameraSelect"></select>
  </div>
  
  <div id="stats"></div>
  
  <script type="module">
    import { CameraService } from '../js/services/camera-service.js';
    import { ObjectPool } from '../js/utils/object-pool.js';
    
    // Test implementation
    const videoContainer = document.getElementById('videoContainer');
    const statsElement = document.getElementById('stats');
    const cameraSelect = document.getElementById('cameraSelect');
    
    let cameraService = null;
    
    async function initTest() {
      // Create camera service
      cameraService = new CameraService();
      
      // Add video element to DOM
      videoContainer.appendChild(cameraService.videoElement);
      
      // Populate camera select
      const cameras = await cameraService.getAvailableCameras();
      cameras.forEach(camera => {
        const option = document.createElement('option');
        option.value = camera.deviceId;
        option.text = camera.label || `Camera ${cameraSelect.options.length + 1}`;
        cameraSelect.appendChild(option);
      });
      
      // Event listeners
      document.getElementById('startCamera').addEventListener('click', () => {
        cameraService.initialize().then(() => {
          console.log('Camera initialized');
        }).catch(error => {
          console.error('Camera error:', error);
        });
      });
      
      document.getElementById('stopCamera').addEventListener('click', () => {
        cameraService.dispose();
      });
      
      cameraSelect.addEventListener('change', () => {
        if (cameraService.isInitialized) {
          cameraService.switchCamera(cameraSelect.value);
        }
      });
      
      // Subscribe to frames
      cameraService.framePublisher.subscribe(frame => {
        statsElement.textContent = `Frame: ${frame.width}x${frame.height} @ ${new Date().toISOString().substr(11, 8)}`;
      });
    }
    
    initTest().catch(console.error);
  </script>
</body>
</html>
```

### Visual Feedback Testing

```javascript
class DebugVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isEnabled = true;
  }
  
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  drawMarkers(markers, options = {}) {
    if (!this.isEnabled) return;
    
    const { 
      cornerColor = 'red',
      centerColor = 'blue',
      textColor = 'white',
      lineWidth = 2
    } = options;
    
    markers.forEach(marker => {
      // Draw corners
      this.ctx.strokeStyle = cornerColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(marker.corners[0].x, marker.corners[0].y);
      for (let i = 1; i < marker.corners.length; i++) {
        this.ctx.lineTo(marker.corners[i].x, marker.corners[i].y);
      }
      this.ctx.lineTo(marker.corners[0].x, marker.corners[0].y);
      this.ctx.stroke();
      
      // Draw center
      this.ctx.fillStyle = centerColor;
      this.ctx.beginPath();
      this.ctx.arc(marker.center.x, marker.center.y, 5, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw ID
      this.ctx.fillStyle = textColor;
      this.ctx.font = '16px sans-serif';
      this.ctx.fillText(
        `ID: ${marker.id} (${marker.confidence.toFixed(2)})`,
        marker.center.x + 10,
        marker.center.y + 5
      );
    });
  }
  
  drawPerformanceStats(stats) {
    if (!this.isEnabled) return;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(10, 10, 200, 60);
    
    this.ctx.fillStyle = 'white';
    this.ctx.font = '14px monospace';
    this.ctx.fillText(`FPS: ${stats.fps}`, 20, 30);
    this.ctx.fillText(`Frame Time: ${stats.frameTime} ms`, 20, 50);
    this.ctx.fillText(`Markers: ${stats.markerCount}`, 20, 70);
  }
}
```

## 📝 Code Conventions

### Naming Conventions

- **Classes**: PascalCase (`CameraService`)
- **Methods/Variables**: camelCase (`initializeCamera()`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_WIDTH`)
- **Private Properties**: Prefixed with underscore (`_privateProperty`)
- **Files**: kebab-case.js (`camera-service.js`)

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  env: {
    browser: true,
    es6: true
  },
  extends: 'eslint:recommended',
  rules: {
    // Variable errors (critical)
    'no-undef': 'error',
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    
    // Best practices
    'no-console': ['warn', { 
      allow: ['warn', 'error', 'info', 'debug'] 
    }],
    'no-debugger': 'warn',
    
    // Style (less strict)
    'semi': ['warn', 'always'],
    'comma-dangle': ['warn', 'never'],
  }
};
```

## 🚀 Future Directions

Based on lessons from previous projects, future development should focus on:

1. **Performance Optimization**
   - Complete WebWorker implementation for vision processing
   - Implement adaptive quality settings based on device capabilities
   - Extend object pooling to more components

2. **Feature Expansion**
   - Add hand tracking with MediaPipe integration
   - Implement advanced audio features
   - Add MIDI output capabilities

3. **Developer Experience**
   - Expand debugging and visualization tools
   - Improve error recovery mechanisms
   - Add comprehensive automated testing

## 🔗 Reference Documentation

- [**Architecture Details**](./reference/APOLLO_ARCHITECTURE.md) - Detailed system design
- [**Memory Management**](./reference/MEMORY_MANAGEMENT.md) - GC optimization techniques
- [**Component Registry**](./reference/COMPONENT_REGISTRY.md) - Component reference
- [**Testing Guide**](./reference/TESTING_GUIDE.md) - Component testing methodology 