# Tectangle Drumpad (MDP 90a) Reference Guide

## Project Overview

The Tectangle Drumpad (version 0.90a) is an interactive web-based application that combines computer vision, audio processing, and real-time interaction to create a virtual drumpad or musical interface. The system uses webcam input to detect AR markers and/or hand movements, which trigger sounds when "hit" or interacted with.

## Core Components

### 1. Detection System
- **ArUcoDetector**: Computer vision system that detects ArUco markers (special visual patterns) in the camera feed
- **MarkerTracker**: Tracks the position of detected markers across video frames
- **HitDetector**: Determines when a marker has been "hit" based on hand movements
- **MediapipeHandTracker**: Implements hand tracking using Google's MediaPipe framework

### 2. Audio System
- **WebAudioPlayer**: Core audio engine built on the Web Audio API
- **SoundLibrary**: Collection of audio samples organized by instrument type (Drums, Piano, Organ, Harp, Xylo)
- **Metronome**: Provides timing with optional network synchronization

### 3. Recording & Looping
- **AudioStreamRecorder**: Records audio output to a file
- **LoopEventRecorder**: Records hit events for playback and looping
- **Quantization**: Aligns recorded hits to a musical grid

### 4. User Interface
- **Main Video Interface**: Camera feed with marker visualization overlay
- **Control Buttons**: Record, loop, audio toggle, settings
- **Settings Drawer**: Configuration options for detection, audio, and other parameters
- **Tune Drawer**: Sound library selection and customization

## Key Features

1. **Marker-Based Triggering**: Visual markers in the real world act as virtual drum pads
2. **Hand Tracking**: Detect hand movements to trigger sounds without physical markers
3. **Multiple Sound Libraries**: Switch between different instrument sounds (drums, piano, etc.)
4. **Recording & Looping**: Capture performances and create musical loops
5. **Metronome with Network Sync**: Keep time with optional synchronization to internet time
6. **Calibration Tools**: Fine-tune marker detection and timing

## Technical Architecture

The application follows a modular architecture with clear interfaces:

1. **Interface Definitions**: `I*.js` files define abstract interfaces (IMetronome, ICamera, IHitDetector, etc.)
2. **Concrete Implementations**: Classes implement these interfaces (Metronome, BrowserCamera, HitDetectorFixedVolume)
3. **Central App Controller**: TectangleDrumpadApp orchestrates all components
4. **Configuration System**: Central config.js for application settings

## Lessons Learned

### What Worked Well

1. **Modular Architecture**
   - Interface-based design allowed easy swapping of components
   - Clear separation of concerns made debugging easier
   - Component isolation simplified testing individual pieces

2. **Performance Optimization**
   - Using an offscreen canvas with reduced resolution for detection improved frame rate
   - WebAudio API provided low-latency audio response
   - Performance debugging tools helped identify bottlenecks

3. **Progressive Enhancement**
   - Core functionality worked with just marker detection
   - Hand tracking added as an enhancement but not required
   - Metronome with network sync provided optional timing features

### Challenges Encountered

1. **Camera API Limitations**
   - Browser camera API inconsistencies across devices/browsers
   - Frame rate limitations on some devices affecting detection quality
   - Mobile camera orientation issues requiring special handling

2. **Audio Timing Precision**
   - Web Audio timing jitter when system under heavy load
   - Metronome drift requiring periodic network resynchronization
   - Sound loading delays affecting initial audio playback

3. **Detection Reliability**
   - Lighting conditions significantly impacting marker detection
   - Hand tracking accuracy varying across different backgrounds and lighting conditions
   - Finding the optimal detection scale (resolution) for performance vs. accuracy

4. **Browser Compatibility**
   - MediaPipe compatibility issues in some browsers
   - WebAudio implementation differences between browsers
   - Performance variations across devices

## Implementation Details

### Detection Pipeline

1. Camera feed is captured and displayed on the main canvas
2. Each frame is downscaled to an offscreen canvas for performance
3. ArUco marker detection is performed on the downscaled image
4. Detected markers are scaled back to full resolution coordinates
5. MarkerTracker updates the internal state of known markers
6. Hand position is checked against marker positions to detect "hits"
7. Hit events trigger sounds via the audio system

### Audio System

1. WebAudio context initialized on user interaction (browser requirement)
2. Sound samples loaded from sound libraries based on current selection
3. Hits trigger playback of appropriate samples
4. Volume can be determined by velocity of hand movement
5. Recording captures audio output as a stream
6. Loop system can record and play back hit events

### Metronome Implementation

1. Uses setInterval for timing with reasonable precision
2. Optional network synchronization via worldtimeapi.org
3. Provides visual and audible indications of beat
4. Customizable BPM and volume
5. Can serve as timing reference for quantization

## Knowledge Transfer

### Key Configuration Settings

The `config.js` file contains critical settings that affect application behavior:

- **DETECTION_SCALE**: Resolution scaling for marker detection (performance vs. accuracy)
- **HIT_DEBOUNCE_MS**: Minimum time between successive hits on the same marker
- **MARKER_MISSING_TIMEOUT_MS**: How long a marker remains active after disappearing
- **METRONOME_ENABLED**: Toggle metronome functionality
- **METRONOME_NETWORK_SYNC**: Enable/disable synchronization with network time
- **QUANT_** settings: Control musical quantization parameters

### Sound Management

Sound libraries are defined in `soundLibrary.js` with mappings between marker IDs and audio file paths. The current implementation supports multiple instrument types that can be switched at runtime.

### Custom Markers

The system is designed to work with the ARUCO_MIP_36h12 marker dictionary. Custom markers can be created using AR marker generator tools and mapped to specific sounds in the configuration.

## Future Development Recommendations

1. **Performance Enhancements**
   - Implement adaptive detection scaling based on device capabilities
   - Move marker detection to a Web Worker to prevent UI blocking
   - Add option for lower quality audio on performance-constrained devices

2. **Feature Additions**
   - Multiple user support with networked session sharing
   - Integration with MIDI output for external instrument control
   - More advanced looping controls (overdubbing, multiple loop tracks)
   - Support for effects processing (reverb, delay, filters)

3. **Usability Improvements**
   - Better visual feedback for hits and timing
   - Improved mobile support with responsive design
   - Setup wizard for first-time users
   - Expanded marker and instrument library

4. **Reliability Enhancements**
   - Fallback detection methods when lighting conditions are poor
   - Automatic calibration routines for timing and detection
   - Better error handling and recovery

## Troubleshooting Guide

### Common Issues

1. **No Camera Access**
   - Check browser permissions
   - Ensure no other application is using the camera
   - Try a different browser if issues persist

2. **Poor Detection Performance**
   - Improve lighting conditions
   - Use high-contrast markers
   - Reduce DETECTION_SCALE for better performance at the cost of accuracy
   - Ensure camera is stable and markers are within frame

3. **Audio Problems**
   - Verify audio initialization via user gesture (browser requirement)
   - Check sound file paths in soundLibrary.js
   - Confirm audio output device is working
   - Try alternative sound libraries if specific sounds don't play

4. **Timing Issues**
   - Calibrate metronome using the timing calibration tool
   - Adjust METRONOME_MANUAL_OFFSET if needed
   - Disable network sync if internet connection is unstable

### Performance Optimization

1. Reduce video resolution in BrowserCamera configuration
2. Lower DETECTION_SCALE value in config.js
3. Disable hand tracking if only using marker detection
4. Close other browser tabs and applications
5. Use a dedicated graphics card if available

## Conclusion

The Tectangle Drumpad (MDP 90a) represents a sophisticated implementation of marker-based musical interaction using web technologies. Its modular architecture provides flexibility for future enhancements, while the current feature set offers a robust platform for creative musical expression. When reverting to older versions, it's important to maintain the core architectural principles and carefully test detection and audio components to ensure reliable operation. 