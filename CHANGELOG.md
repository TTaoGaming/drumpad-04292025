# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0-alpha] - 2025-04-23

### Added
- Pinch gesture recognition between thumb and index finger
- Real-time distance measurement between thumb and fingertip
- Pinch state visualization with color-coded indicators
- Index fingertip position tracking with coordinate display
- Settings panel for configuring pinch gesture parameters:
  - Adjustable distance thresholds
  - Hysteresis to prevent flickering
  - Stability frames setting
  - Active finger selection
- Visual elements:
  - Crosshair indicator for index fingertip
  - Distance measurement between thumb and finger
  - Status indicator for pinch state
  - Coordinate display (X, Y, Z) for fingertip

### Changed
- Simplified settings UI to focus on implemented features
- Renamed settings tabs for clarity
- Updated pinch thresholds for better reliability:
  - Pinch threshold: 0.07 (was 0.05)
  - Release threshold: 0.10 (was 0.07)

### Optimized
- Memory usage by removing unused UI elements
- Performance considerations for pinch detection