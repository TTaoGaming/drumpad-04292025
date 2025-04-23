# Hand Tracking Visualization System - Alpha

A cutting-edge computer vision application that leverages advanced hand tracking and gesture recognition technologies to create an intuitive, interactive user experience.

![Version](https://img.shields.io/badge/version-0.1.0--alpha-blue)

## Features

### Core Functionality
- Real-time hand tracking and landmark visualization
- Smooth hand landmark motion with One Euro filter
- Performance optimization with ROI tracking
- Finger flexion measurement and visualization

### New in Alpha Release
- **Pinch Gesture Detection**: Reliable detection of pinch gestures between thumb and index finger
- **Index Finger Tracking**: Precise coordinate tracking of index fingertip (x, y, z)
- **Visual Feedback**: Dynamic visualization showing pinch state and distance
- **Configurable Settings**: Adjustable thresholds, stability parameters, and active finger selection

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the application: `npm run dev`
4. Open the application in your browser
5. Click "Start Camera" to begin hand tracking
6. Position your hand in view of the camera
7. Try the pinch gesture by bringing your thumb and index finger together

## Settings

### Pinch Gesture Configuration
- **Threshold**: Distance at which a pinch is detected (smaller = tighter pinch required)
- **Release Threshold**: Distance at which a pinch is released (prevents flickering)
- **Stability Frames**: Number of consistent frames required to change pinch state
- **Active Finger**: Select which finger to use for pinching with thumb (index, middle, ring, pinky)

## Usage Tips

For optimal pinch gesture detection:
1. Position your hand approximately 1-2 feet from the camera
2. Face your palm toward the camera
3. Keep your hand within the camera's field of view
4. Make a clear pinching motion between your thumb and index finger
5. Use the Settings panel (Pinch tab) to adjust sensitivity if needed

## Performance Considerations

- The hand tracking uses MediaPipe's hand tracking model
- If performance is slow, try:
  - Disabling the finger flexion feature
  - Using a lower resolution camera
  - Adjusting the performance settings (enable frame skipping)

## Technologies
- React frontend with professional, minimal UI design
- MediaPipe for sophisticated hand landmark detection
- OpenCV for advanced computer vision processing
- Real-time webcam interaction with responsive interface
- Comprehensive settings panel for granular configuration