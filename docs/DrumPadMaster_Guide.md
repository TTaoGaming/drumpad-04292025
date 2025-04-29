# DrumPadMaster MVP Implementation Guide

## 1. Overview

DrumPadMaster is a web-based virtual drumpad that uses hand tracking technology to create an interactive musical experience. This MVP focuses on a pinch/lasso gesture to create a high-texture arbitrary marker, track it, and implement state logic with occlusion timing to trigger audio and MIDI outputs.

## 2. Core Architecture

### Service-Oriented Publisher/Subscriber Pattern

The application follows a modular service-oriented architecture with a publisher/subscriber pattern for event handling:

```
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│    EventBus         │◄────┤    Camera Service   │
│    Service          │     │                     │
│                     │     └─────────────────────┘
│   Central Event     │
│   Routing System    │     ┌─────────────────────┐
│                     │     │                     │
└─────┬─────▲─────┬───┘     │  HandTracking       │
      │     │     │         │  Service            │
      │     │     │         │                     │
      │     │     │         └─────────────────────┘
      │     │     │
      │     │     │         ┌─────────────────────┐
      │     │     └────────►│                     │
      │     │               │  Marker Service     │
      │     └───────────────┤                     │
      │                     └─────────────────────┘
      │
      │                     ┌─────────────────────┐
      └────────────────────►│                     │
                            │  Audio Service      │
                            │                     │
                            └─────────────────────┘
```

## 3. MVP Core Requirements

1. **Pinch/Lasso Region of Interest (ROI)**
   - Detect hand landmarks using MediaPipe
   - Identify pinch gesture between thumb and index finger
   - Create a region of interest based on the gesture

2. **Marker Tracking**
   - Track an arbitrary high-texture marker
   - Calculate position and orientation of the marker
   - Handle occlusion (when the marker is temporarily hidden)

3. **State Management with Occlusion Timing**
   - Define marker states: DEFAULT, TAP, ENGAGED, RELEASED
   - Manage state transitions based on detection and occlusion timing
   - Trigger appropriate events for each state transition

4. **Audio and MIDI Output**
   - Play different sounds based on marker states
   - Generate MIDI signals for external music software
   - Provide controls for volume and sound selection

## 4. Implementation Details

### 4.1 Service Interfaces

Each service follows a consistent interface pattern:

```typescript
interface IService {
  initialize(): Promise<void>;  // Set up resources
  dispose(): void;              // Clean up resources
}

// Extended by specific services
interface ICameraService extends IService {
  startCamera(): Promise<void>;
  stopCamera(): void;
  // ...other methods
}
```

### 4.2 Marker State Management

The marker state transitions follow this pattern:

```
┌─────────────┐                         ┌────────────┐
│             │      Hand Contact       │            │
│   DEFAULT   ├────────────────────────►│    HIT     │
│             │                         │            │
└──────┬──────┘                         └──────┬─────┘
       │                                        │
       │ Marker                                 │ Sustained
       │ Detected                               │ Contact
       │                                        ▼
       │                                 ┌────────────┐
       │                                 │            │
       │                                 │  ENGAGED   │
       │                                 │            │
       ▼                                 └──────┬─────┘
┌─────────────┐                                 │
│             │                                 │ Contact
│  OCCLUDED   │                                 │ Removed
│             │                                 │
└──────┬──────┘                                 │
       │                                        ▼
       │ Marker                         ┌────────────┐
       │ Re-detected                    │            │
       └───────────────────────────────►│  RELEASED  │
                                        │            │
                                        └────────────┘
```

#### State Transition Rules

1. **DEFAULT → HIT**: Initial hand contact with marker
2. **HIT → ENGAGED**: Sustained contact (>300ms)
3. **ENGAGED → RELEASED**: Contact removed
4. **DEFAULT → OCCLUDED**: Marker not detected for >occlusionToleranceMs (default: 500ms)
5. **OCCLUDED → DEFAULT**: Marker re-detected

### 4.3 Pinch/Lasso ROI Detection

```typescript
// Detect pinch gesture between thumb and index finger
function detectPinchGesture(hand: HandData): boolean {
  // Thumb tip is landmark 4, index finger tip is landmark 8
  const thumbTip = hand.landmarks[4];
  const indexTip = hand.landmarks[8];
  
  // Calculate distance between thumb and index finger
  const distance = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) +
    Math.pow(thumbTip.y - indexTip.y, 2) +
    Math.pow(thumbTip.z - indexTip.z, 2)
  );
  
  // If distance is below threshold, consider it a pinch
  return distance < PINCH_THRESHOLD;
}

// Create ROI from pinch gesture
function createROIFromPinch(hand: HandData): Region {
  // Use the position between thumb and index as center of ROI
  const thumbTip = hand.landmarks[4];
  const indexTip = hand.landmarks[8];
  
  const centerX = (thumbTip.x + indexTip.x) / 2;
  const centerY = (thumbTip.y + indexTip.y) / 2;
  
  // Create a region with appropriate size
  return {
    x: centerX - ROI_SIZE/2,
    y: centerY - ROI_SIZE/2,
    width: ROI_SIZE,
    height: ROI_SIZE
  };
}
```

## 5. Implementation Steps

### Step 1: Set Up Core Services

1. **EventBus Service**: Central event handling system
2. **Camera Service**: Webcam access and video streaming
3. **HandTracking Service**: MediaPipe integration for hand tracking
4. **Marker Service**: Marker detection and state management
5. **Audio Service**: Sound playback based on marker states

### Step 2: Implement Pinch/Lasso Detection

1. Process hand landmarks from MediaPipe
2. Detect pinch gesture between thumb and index finger
3. Create a region of interest (ROI) based on the pinch gesture
4. Visualize the ROI on the canvas

### Step 3: Implement Marker Tracking

1. Detect high-texture markers within the ROI
2. Track marker position and orientation
3. Handle marker occlusion with timing logic
4. Publish marker tracking events via EventBus

### Step 4: Implement State Management

1. Define marker states (DEFAULT, HIT, ENGAGED, RELEASED, OCCLUDED)
2. Implement state transition logic based on interaction and timing
3. Add visual feedback for different states
4. Publish state change events via EventBus

### Step 5: Implement Audio/MIDI Output

1. Load sound samples for different marker states
2. Play sounds in response to state changes
3. Implement MIDI output functionality
4. Add controls for volume and sound selection

## 6. Service Registration System

To ensure proper service registration and initialization:

```typescript
// Service registry singleton
class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, IService> = new Map();

  private constructor() {}

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  // Register a service
  public register<T extends IService>(serviceType: string, service: T): void {
    if (this.services.has(serviceType)) {
      const existingService = this.services.get(serviceType);
      if (existingService) {
        existingService.dispose();
      }
    }
    this.services.set(serviceType, service);
  }

  // Get a service
  public get<T extends IService>(serviceType: string): T {
    const service = this.services.get(serviceType) as T;
    if (!service) {
      throw new Error(`Service of type ${serviceType} is not registered.`);
    }
    return service;
  }

  // Initialize all services in correct order
  public async initializeAll(): Promise<void> {
    // Define initialization order
    const initOrder = [
      ServiceTypes.EVENT_BUS,
      ServiceTypes.CAMERA,
      ServiceTypes.HAND_TRACKING,
      ServiceTypes.MARKER_TRACKING,
      ServiceTypes.AUDIO
    ];
    
    // Initialize services in order
    for (const serviceType of initOrder) {
      if (this.services.has(serviceType)) {
        await this.services.get(serviceType)!.initialize();
      }
    }
  }
}
```

## 7. Marker Detection Logic

The marker detection system focuses on tracking high-texture regions:

```typescript
class MarkerDetector {
  // Track a marker in the frame
  detectMarker(imageData: ImageData, roi: Region): MarkerData | null {
    // Convert to grayscale for feature detection
    const grayImage = this.convertToGrayscale(imageData);
    
    // Detect features in ROI
    const features = this.detectFeatures(grayImage, roi);
    
    if (features.length < MIN_FEATURES) {
      return null; // Not enough features for reliable tracking
    }
    
    // Calculate marker position from features
    const position = this.calculateCentroid(features);
    
    // Generate unique ID based on feature pattern
    const id = this.generateMarkerId(features);
    
    return {
      id,
      x: position.x,
      y: position.y,
      width: roi.width,
      height: roi.height,
      confidence: this.calculateConfidence(features),
      state: MarkerState.DEFAULT,
      lastSeenTimestamp: performance.now()
    };
  }
}
```

## 8. Occlusion Logic

The occlusion handling system manages marker visibility:

```typescript
class OcclusionHandler {
  private occlusionToleranceMs: number;
  private markerLastSeen: Map<string, number> = new Map();
  
  constructor(occlusionToleranceMs = 500) {
    this.occlusionToleranceMs = occlusionToleranceMs;
  }
  
  // Update marker timestamp when detected
  markSeen(markerId: string): void {
    this.markerLastSeen.set(markerId, performance.now());
  }
  
  // Check if marker is occluded
  isOccluded(markerId: string): boolean {
    const lastSeen = this.markerLastSeen.get(markerId);
    if (lastSeen === undefined) return true;
    
    return performance.now() - lastSeen > this.occlusionToleranceMs;
  }
  
  // Get occlusion duration
  getOcclusionDuration(markerId: string): number {
    const lastSeen = this.markerLastSeen.get(markerId);
    if (lastSeen === undefined) return Infinity;
    
    return performance.now() - lastSeen;
  }
}
```

## 9. Audio Integration

The audio system responds to marker state changes:

```typescript
class AudioEngine {
  private context: AudioContext;
  private sounds: Map<string, AudioBuffer> = new Map();
  private gainNode: GainNode;
  
  constructor() {
    this.context = new AudioContext();
    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.context.destination);
  }
  
  // Load sounds for different marker states
  async loadSounds(): Promise<void> {
    await Promise.all([
      this.loadSound('default', 'audio/drums/kick.wav'),
      this.loadSound('hit', 'audio/drums/snare.wav'),
      this.loadSound('engaged', 'audio/drums/hihat.wav'),
      this.loadSound('released', 'audio/drums/tom.wav')
    ]);
  }
  
  // Play sound for marker state
  playSound(state: MarkerState): void {
    const soundKey = state.toLowerCase();
    const buffer = this.sounds.get(soundKey);
    
    if (!buffer) return;
    
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    source.start(0);
  }
  
  // Set volume
  setVolume(volume: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }
}
```

## 10. Performance Optimization

To ensure smooth performance, implement these optimizations:

1. **Throttle Processing**: Skip frames when CPU usage is high
2. **Minimize DOM Updates**: Batch UI updates
3. **Use Canvas for Rendering**: Avoid DOM manipulation for visualization
4. **Optimize Detection Area**: Focus processing on regions of interest
5. **Implement Frame Skipping**: Process every Nth frame

## 11. Testing and Debugging

For effective testing and debugging:

1. **Visual Debugging**: Add visualization for hand tracking and markers
2. **Performance Monitoring**: Track FPS and processing times
3. **State Visualization**: Display current marker states
4. **Console Logging**: Log key events and state transitions
5. **Error Handling**: Implement robust error handling with user feedback

## 12. Future Extensions

After completing the MVP, consider these extensions:

1. **Multiple Markers**: Track and interact with multiple markers
2. **Advanced Gestures**: Add more gestures beyond pinch/lasso
3. **Effect Processing**: Add audio effects like reverb or delay
4. **Custom Sound Packs**: Allow users to upload custom sounds
5. **Persistence**: Save and load marker configurations

---

This guide provides a comprehensive framework for implementing the DrumPadMaster MVP with the specific features you requested: pinch/lasso ROI detection, arbitrary marker tracking, state management with occlusion timing, and audio/MIDI output.