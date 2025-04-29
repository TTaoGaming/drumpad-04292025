# DrumpadLit Project Reference Guide
*Reference Document - April 17, 2025*

## Project Overview

DrumpadLit is a web-based application that combines computer vision (OpenCV, MediaPipe) with web audio to create an interactive drumpad experience. The application uses marker detection to trigger sounds when markers are detected in the camera view.

### Core Technologies

- **Lit**: Web component framework for building the UI components
- **OpenCV.js**: Computer vision library for image processing and marker detection
- **MediaPipe**: ML-powered computer vision library for hand tracking
- **Web Audio API**: For sound generation and management
- **JavaScript Modules**: ES6 module system for code organization

## Architecture Overview

The application follows a modular architecture with three main layers:

1. **UI Components**: Built with Lit, providing the visual interface
2. **Services Layer**: Core functionality encapsulated in singleton services
3. **Publisher/Subscriber System**: Event-based communication between components

### Key Architectural Patterns

- **Singleton Pattern**: Used for services to ensure single instances
- **Publisher/Subscriber Pattern**: For loose coupling between components
- **Factory Pattern**: Service creation via ServiceFactory
- **Adapter Pattern**: For integrating external libraries
- **Service Locator (Context)**: Through ServiceContext

## Component Structure

The UI is built with Lit components, each with specific responsibilities:

- **DrumApp**: Main application container component
- **CameraView**: Handles camera display and frame capture
- **ControlBar**: Provides user controls for the application
- **SettingsPanel**: Configuration interface for all application settings
- **MarkerVisual**: Visual representation of detected markers
- **GridDetector**: Components for detecting and visualizing grid patterns

## Service Architecture

Services are organized as singletons with clear responsibilities:

- **BaseService**: Parent class with common service functionality
- **ConfigService**: Manages application configuration and settings
- **CameraService**: Handles camera access and frame processing
- **AudioService**: Manages audio playback and configuration
- **OpenCVService**: Wrapper for OpenCV.js functionality
- **MediaPipeService**: Wrapper for MediaPipe functionality
- **MarkerDetectorService**: Analyzes frames to detect markers
- **SoundMapService**: Maps detected markers to sounds
- **PipelineMediatorService**: Orchestrates the detection pipeline process

## Initialization Flow

1. DOM loads, triggering the initialization process
2. ServiceFactory creates core services (config, camera, audio)
3. DrumApp component is mounted to the DOM
4. Optional services are initialized (OpenCV, MediaPipe)
5. Components connect to services via the Publisher/Subscriber system

## Lessons Learned

### Singleton Pattern Implementation

- **Key Insight**: Always initialize properties within constructor
- **Best Practice**: Check property existence to prevent undefined errors
- **Issue Found**: Early returns in constructors without proper initialization
- **Solution**: Move singleton instance checks to BaseService

### Service Dependencies Management

- **Challenge**: Circular dependencies between services causing initialization problems
- **Solution**: Use loose coupling via publishers/subscribers
- **Recommendation**: Implement late initialization for dependencies
- **Improvement**: Service factory should manage dependency order

### Error Recovery Strategies

- **Critical Area**: Camera API requires special error handling 
- **Best Practice**: Use try-catch with specific error messages
- **Improvement**: Implement defensive coding around browser APIs
- **Lesson**: Services should have clear error states and recovery paths

### Web Workers for Performance

- **Observation**: Computer vision tasks can block the main thread
- **Solution**: Offload heavy processing to WebWorkers
- **Implementation**: Create worker-based services for detection pipelines
- **Benefit**: Improved UI responsiveness during intensive processing

### Component Communication

- **Success**: The Publisher/Subscriber pattern provided clean separation
- **Benefit**: Easy to add features by subscribing to existing events
- **Improvement**: More granular events for specific state changes
- **Recommendation**: Continue using events over direct method calls

## Performance Optimizations

1. **Canvas Operations**: Use `willReadFrequently: true` for canvases with pixel manipulation
2. **Object Pooling**: Implement for frequently created/destroyed objects
3. **Web Workers**: Move CPU-intensive operations off the main thread
4. **Lazy Loading**: Initialize services on-demand rather than upfront
5. **Memory Management**: Properly dispose unused resources
6. **Frame Processing**: Skip frames when device is struggling

## SOLID Architecture Guidelines

### Applied Successfully

- **Single Responsibility**: Services have clear, focused responsibilities
- **Dependency Inversion**: ServiceFactory creates concrete implementations
- **Interface Segregation**: Publishers emit specific events

### Areas for Improvement

- **Open/Closed**: Make services more extensible through middleware
- **Liskov Substitution**: Create formal interfaces for services
- **Dependency Injection**: Improve constructor-based injection

## Testing Methodology

- **Isolated Components**: Create standalone HTML tests for individual components
- **Visual Feedback**: Implement visual indicators to confirm correct functionality
- **Manual Testing**: Focus on visual confirmation of detection accuracy
- **Performance Profiling**: Use browser dev tools to identify bottlenecks

## Known Issues and Limitations

1. **Camera Error Handling**: Needs improvement for permission rejection
2. **Singleton Implementation**: Some services may have initialization issues
3. **Service Dependencies**: Some circular dependencies exist
4. **Mobile Performance**: Heavy processing can be slow on mobile devices
5. **Error Recovery**: Services need better error recovery mechanisms

## Future Improvements

1. **Refactor Service Initialization**: Implement proper dependency injection
2. **Improve Error Handling**: Better user-facing error messages and recovery
3. **Optimize Mobile Performance**: Reduce processing load on mobile devices
4. **Enhance Marker Detection**: Improve accuracy and performance
5. **Add Music Orchestration**: Connect marker states to more complex audio patterns

## Developer Guidelines

### Code Organization

- **Components**: Place in `js/components/` directory
- **Services**: Place in `js/services/` directory
- **Utilities**: Place in `js/utils/` directory
- **Workers**: Place in `js/workers/` directory

### Naming Conventions

- **Components**: Use kebab-case for custom elements (e.g., `drum-app`)
- **Services**: Use PascalCase with Service suffix (e.g., `AudioService`)
- **Methods**: Use camelCase for methods and properties
- **Events**: Use kebab-case for custom events

### Development Workflow

1. **Local Development**: Use `npm start` to run the development server
2. **Linting**: Use `npm run lint` to check code quality
3. **Testing**: Create standalone test HTML files for component testing
4. **Debugging**: Enable dev mode with `?dev` URL parameter

## Critical Success Factors

1. **Publisher/Subscriber Pattern**: Enabled clean component communication
2. **Configuration Service**: Centralized settings management 
3. **Component Architecture**: Lit components provided good performance
4. **Service Singletons**: When properly implemented, provided consistent state

## Recommendations for Moving Forward

1. **Review Service Initialization**: Fix singleton pattern issues
2. **Implement Proper Error Recovery**: Focus on camera and audio services
3. **Add Visual Feedback**: For marker detection and processing status
4. **Optimize Performance**: Focus on mobile device optimization
5. **Complete Marker Detection**: Finalize marker tracking and state management

---

*Document prepared for transitioning to earlier working version - April 2025* 