# Replit Tectangle Drumpad V1

## Project Overview

A web-based virtual drumpad that uses hand tracking technology to allow users to play digital drum sounds by moving their hands in the air. The application uses computer vision to detect and track hand movements, enabling a touchless musical interface that responds to precise finger positions and gestures.

## Technology Stack Specification

### Frontend
- **React 18+**: Use functional components with hooks
- **TypeScript 5+**: Strict type checking enabled
- **Vite**: For fast development and bundling
- **Tailwind CSS**: For responsive UI design
- **Shadcn UI**: For quick component implementation
- **Wouter**: Lightweight routing (if needed)

### Computer Vision
- **MediaPipe Hands (CDN)**: Load directly from CDN using these URLs:
  ```javascript
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'
  ```

### Audio
- **Web Audio API**: For audio generation and low-latency playback
- **Tone.js** (optional): For more advanced audio capabilities

## Detailed Component Specifications

### 1. App Component (`App.tsx`)
- Main container for the application
- Manages application state
- Implements the following layout:
  ```jsx
  <div className="flex flex-col h-screen bg-gray-900 text-white">
    <Header />
    <main className="flex-1 flex">
      <CameraView />
      <DrumpadInterface />
    </main>
    <ControlPanel />
  </div>
  ```

### 2. Camera Component (`CameraView.tsx`)
- Renders the camera feed for user positioning
- Specifications:
  ```typescript
  interface CameraViewProps {
    width: number;
    height: number;
    enabled: boolean;
  }
  ```
- Implementation pattern:
  ```javascript
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      // Set video source and start tracking
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };
  ```

### 3. Hand Tracker Component (`HandTracker.tsx`)
- Implements MediaPipe hand tracking using direct CDN loading
- Use this proven loader pattern:
  ```typescript
  const loadExternalScript = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = (error) => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  };
  ```
- HandTracker configuration:
  ```javascript
  const handTrackerConfig = {
    maxNumHands: 2,
    modelComplexity: 1,  // 0 for better performance, 1 for accuracy
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  };
  ```
- Event emission for hand position:
  ```typescript
  interface HandData {
    landmarks: { x: number, y: number, z: number }[];
    handedness: 'Left' | 'Right';
    confidence: number;
  }
  ```

### 4. Drumpad Interface (`DrumpadInterface.tsx`)
- Renders virtual drum pads on a canvas overlay
- Define drum pad grid:
  ```typescript
  interface DrumPad {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    sound: string;
    label: string;
    isActive: boolean;
  }
  
  const DEFAULT_DRUM_PADS: DrumPad[] = [
    { id: 'kick', x: 0.2, y: 0.7, width: 0.15, height: 0.15, color: '#FF5252', sound: 'kick.mp3', label: 'Kick', isActive: false },
    { id: 'snare', x: 0.4, y: 0.7, width: 0.15, height: 0.15, color: '#FFEB3B', sound: 'snare.mp3', label: 'Snare', isActive: false },
    { id: 'hihat', x: 0.6, y: 0.7, width: 0.15, height: 0.15, color: '#4CAF50', sound: 'hihat.mp3', label: 'Hi-Hat', isActive: false },
    { id: 'tom1', x: 0.2, y: 0.5, width: 0.15, height: 0.15, color: '#2196F3', sound: 'tom1.mp3', label: 'Tom 1', isActive: false },
    { id: 'tom2', x: 0.4, y: 0.5, width: 0.15, height: 0.15, color: '#9C27B0', sound: 'tom2.mp3', label: 'Tom 2', isActive: false },
    { id: 'crash', x: 0.6, y: 0.5, width: 0.15, height: 0.15, color: '#FFC107', sound: 'crash.mp3', label: 'Crash', isActive: false },
  ];
  ```
- Canvas drawing implementation:
  ```javascript
  const drawDrumPads = (ctx: CanvasRenderingContext2D) => {
    drumPads.forEach(pad => {
      // Convert normalized coordinates to pixel values
      const x = pad.x * canvasRef.current.width;
      const y = pad.y * canvasRef.current.height;
      const width = pad.width * canvasRef.current.width;
      const height = pad.height * canvasRef.current.height;
      
      // Draw pad with glow effect if active
      ctx.save();
      if (pad.isActive) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = pad.color;
        ctx.globalAlpha = 0.9;
      } else {
        ctx.globalAlpha = 0.7;
      }
      
      ctx.fillStyle = pad.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      
      // Draw rounded rectangle
      roundRect(ctx, x, y, width, height, 10, true, true);
      
      // Draw label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pad.label, x + width/2, y + height/2);
      
      ctx.restore();
    });
  };
  
  // Helper function for drawing rounded rectangles
  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: boolean, stroke: boolean) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };
  ```

### 5. Audio Engine (`AudioEngine.ts`)
- Create an audio context and manage sound loading
- Implementation pattern:
  ```typescript
  class AudioEngine {
    private context: AudioContext;
    private sounds: Map<string, AudioBuffer> = new Map();
    
    constructor() {
      this.context = new AudioContext();
    }
    
    async loadSounds(soundUrls: Record<string, string>): Promise<void> {
      const loadPromises = Object.entries(soundUrls).map(async ([id, url]) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.sounds.set(id, audioBuffer);
      });
      
      await Promise.all(loadPromises);
    }
    
    playSound(id: string, volume: number = 1.0): void {
      const buffer = this.sounds.get(id);
      if (!buffer) return;
      
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      
      const gainNode = this.context.createGain();
      gainNode.gain.value = volume;
      
      source.connect(gainNode);
      gainNode.connect(this.context.destination);
      
      source.start(0);
    }
  }
  ```
- Audio file URLs:
  ```javascript
  const DRUM_SOUNDS = {
    'kick': 'https://freesound.org/data/previews/250/250547_4486188-lq.mp3',
    'snare': 'https://freesound.org/data/previews/387/387186_7255534-lq.mp3',
    'hihat': 'https://freesound.org/data/previews/436/436565_9019244-lq.mp3',
    'tom1': 'https://freesound.org/data/previews/232/232783_4221356-lq.mp3',
    'tom2': 'https://freesound.org/data/previews/232/232781_4221356-lq.mp3',
    'crash': 'https://freesound.org/data/previews/436/436093_9019244-lq.mp3'
  };
  ```

### 6. Hit Detection Algorithm (`useHitDetection.ts`)
- Implement a custom hook for detecting drum pad hits
- Logic specification:
  ```typescript
  interface HitDetectionOptions {
    padTriggerThreshold: number;   // Z-distance threshold for trigger
    cooldownPeriod: number;        // Time in ms before a pad can be hit again
    fingersToTrack: number[];      // Indices of finger landmarks to use for hit detection
  }
  
  const DEFAULT_OPTIONS: HitDetectionOptions = {
    padTriggerThreshold: -0.1,     // Negative value means pad is "behind" the screen
    cooldownPeriod: 300,           // 300ms cooldown prevents multiple triggers
    fingersToTrack: [8, 12, 16, 20] // Index, middle, ring, pinky fingertips
  };
  
  // Algorithm for hit detection
  const detectHits = (handData: HandData, drumPads: DrumPad[], options: HitDetectionOptions): string[] => {
    const { landmarks } = handData;
    const { padTriggerThreshold, fingersToTrack } = options;
    
    const hitsDetected: string[] = [];
    
    // Check each tracked finger
    fingersToTrack.forEach(fingerIndex => {
      if (fingerIndex >= landmarks.length) return;
      
      const fingerTip = landmarks[fingerIndex];
      
      // Check if the fingertip passed the trigger threshold
      if (fingerTip.z < padTriggerThreshold) {
        // Convert normalized coordinates to match pad format
        const x = fingerTip.x;
        const y = fingerTip.y;
        
        // Check each drum pad for collision
        drumPads.forEach(pad => {
          if (pad.isActive) return; // Skip if pad is already triggered
          
          // Simple AABB collision detection
          if (
            x >= pad.x && x <= pad.x + pad.width &&
            y >= pad.y && y <= pad.y + pad.height
          ) {
            hitsDetected.push(pad.id);
          }
        });
      }
    });
    
    return hitsDetected;
  };
  ```

### 7. Visual Feedback System (`useVisualFeedback.ts`)
- Create animations when drums are hit
- Implementation:
  ```typescript
  const triggerPadAnimation = (padId: string, duration: number = 500) => {
    // Find the pad
    const padIndex = drumPads.findIndex(p => p.id === padId);
    if (padIndex === -1) return;
    
    // Set pad to active state
    const updatedPads = [...drumPads];
    updatedPads[padIndex] = { ...updatedPads[padIndex], isActive: true };
    setDrumPads(updatedPads);
    
    // Reset after animation completes
    setTimeout(() => {
      const resetPads = [...drumPads];
      resetPads[padIndex] = { ...resetPads[padIndex], isActive: false };
      setDrumPads(resetPads);
    }, duration);
  };
  ```

### 8. Performance Monitor (`PerformanceMonitor.tsx`)
- Track and display FPS and processing times
- Implementation:
  ```typescript
  interface PerformanceMetrics {
    fps: number;
    processingTime: number;
    handDetectionTime: number;
  }
  
  const PerformanceMonitor: React.FC<{ metrics: PerformanceMetrics }> = ({ metrics }) => {
    return (
      <div className="absolute top-0 right-0 bg-black bg-opacity-50 p-2 text-xs text-white">
        <div>FPS: {metrics.fps.toFixed(1)}</div>
        <div>Processing: {metrics.processingTime.toFixed(1)}ms</div>
        <div>Hand Detection: {metrics.handDetectionTime.toFixed(1)}ms</div>
      </div>
    );
  };
  ```

### 9. Control Panel (`ControlPanel.tsx`)
- UI for adjusting settings and selecting sounds
- Implement with these controls:
  ```jsx
  <div className="bg-gray-800 p-4 border-t border-gray-700">
    <div className="flex flex-wrap gap-4 justify-center">
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        onClick={toggleCamera}
      >
        {isCameraRunning ? 'Stop Camera' : 'Start Camera'}
      </button>
      
      <div className="flex items-center">
        <label className="mr-2 text-sm">Sensitivity:</label>
        <input 
          type="range" 
          min="0.05" 
          max="0.3" 
          step="0.05" 
          value={sensitivity} 
          onChange={(e) => setSensitivity(parseFloat(e.target.value))} 
          className="w-32"
        />
      </div>
      
      <div className="flex items-center">
        <label className="mr-2 text-sm">Volume:</label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.1" 
          value={volume} 
          onChange={(e) => setVolume(parseFloat(e.target.value))} 
          className="w-32"
        />
      </div>
      
      <select 
        className="px-3 py-2 bg-gray-700 rounded border border-gray-600"
        value={drumkitId}
        onChange={(e) => setDrumkitId(e.target.value)}
      >
        <option value="standard">Standard Kit</option>
        <option value="electronic">Electronic Kit</option>
        <option value="acoustic">Acoustic Kit</option>
      </select>
    </div>
  </div>
  ```

## Project Setup Instructions

1. **Initial Project Structure**:
   ```
   /src
     /components
       App.tsx
       CameraView.tsx
       ControlPanel.tsx
       DrumpadInterface.tsx
       HandTracker.tsx
       PerformanceMonitor.tsx
     /hooks
       useAudio.ts
       useHandTracking.ts
       useHitDetection.ts
       useVisualFeedback.ts
     /lib
       AudioEngine.ts
       types.ts
       utils.ts
     /assets
       /sounds
         kick.mp3
         snare.mp3
         hihat.mp3
         tom1.mp3
         tom2.mp3
         crash.mp3
     main.tsx
     index.css
   ```

2. **Start with the hand tracking integration**:
   - Implement the CDN loading strategy for MediaPipe
   - Set up basic hand tracking and visualization
   - Add the camera feed component

3. **Add the drum pad visualization**:
   - Create the initial grid of drum pads
   - Implement proper scaling based on screen size
   - Add labels and color coding

4. **Implement hit detection**:
   - Use the fingertip z-coordinate to detect "hitting" through a virtual plane
   - Add collision detection with the drum pad grid
   - Add cooldown periods to prevent multiple hits

5. **Integrate audio**:
   - Set up the audio engine
   - Load and configure drum sounds
   - Implement the playback mechanism

6. **Add visual feedback**:
   - Create animations for active drum pads
   - Add visual indicators for hits
   - Implement optional particle effects for impact visualization

7. **Implement controls and settings**:
   - Create the settings panel
   - Add volume and sensitivity controls
   - Implement kit selection

## Testing Benchmarks

1. **Performance Targets**:
   - Maintain 30+ FPS on mid-range devices
   - Audio latency under 100ms from gesture to sound
   - CPU usage under 50% on mobile devices

2. **User Interaction Tests**:
   - Verify hit detection consistency across different lighting conditions
   - Test accuracy of pad triggering with different hand positions
   - Measure and minimize false positives/negatives

## Optimizations for MediaPipe

1. **Reduce Model Complexity**:
   ```javascript
   // In HandTracker.tsx
   const hands = new window.Hands({
     locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
   });
   
   hands.setOptions({
     modelComplexity: 0,         // Use 0 instead of 1 for better performance
     maxNumHands: 1,             // Limit to one hand if possible
     minDetectionConfidence: 0.6,
     minTrackingConfidence: 0.5
   });
   ```

2. **Implement Frame Skipping**:
   ```javascript
   // Process every 2nd frame for better performance
   let frameCount = 0;
   
   const processFrame = async () => {
     frameCount++;
     if (frameCount % 2 === 0) {
       // Process this frame
       await hands.send({image: videoElement});
     }
     
     // Request next frame
     requestAnimationFrame(processFrame);
   };
   ```

---

This enhanced specification provides concrete implementation details to guide the development of the Replit Tectangle Drumpad V1 application, focusing on creating a performant, user-friendly virtual drumming experience.