Okay, here is the design document drafted with a clear separation for you, the developer, and the AI coding assistant, incorporating the latest plan details (pinch-draw circle, contour tracking, threshold occlusion, simple states, multiple pinch IDs, mid-range performance focus).

Drumpad Design Document: Gemini Edition 2.5 Flash

Version: 2.5 (Flash Edition)
Last Updated: April 28, 2025 8pm

Section for Developers: Your Drumpad Gemini Explained Simply

Welcome to the Drumpad Gemini project! Your mission is to make everyday physical objects act like musical buttons or touchpads just by using your hand and a mid-range smartphone. Forget special markers; if a surface has some clear edges or texture, we want to make it interactive!

The Big Idea:

We're building an app that uses your phone's camera to see your hand. With a special hand gesture (a pinch where you also draw a shape), you'll point at a physical spot (like a card or a section of a table) and define a virtual circle around it on your screen. From that moment on, the app will watch that specific circle as it moves with the object. When you cover that circle with your hand, BAM! It triggers a sound or sends a message (like a webhook). Uncover it, and it's ready to go again.

Think of it like this:

You Point & Draw: You make a pinch shape with your fingers and drag your finger along a surface. The app sees this and remembers the path you drew.

The Virtual Button Appears: When you finish the drawing, the app calculates a perfect circle based on where you drew and puts that circle on top of the physical object in its camera view.

The App Watches the Edges: The app continuously looks inside that circle for prominent edges or outlines of the physical surface. It follows these edges to know exactly where your virtual button (the circle) is, even if the object moves.

You Cover It: You physically cover the circle with your hand. The app notices that it can no longer see those edges inside the circle.

ACTION!: When the app detects that enough of the edges are covered up (hitting a certain threshold), it triggers a "HIT" signal. This plays a sound or sends a webhook.

Ready Again: When you move your hand, and the edges become visible again, it signals a "RELEASED" state, making the virtual button ready for the next hit.

The Team of Helpers (Our App's Structure):

Our app is built like a team where each member has one job and talks to the others by sending messages through a central system (the "Event Bus"):

The Eye (Camera Service): Gets the video from the camera and shares it.

The Hand Reader (Hand Tracking Service): Finds your hand in the video, tells us where your fingers are, smooths out shaky movements, and spots your pinch gesture.

The Artist (Drawing Service / Logic): Sees your finger's path while you pinch and calculates the final circle (its center and size) based on your drawing.

The Edge Watcher (Surface Tracking Service - using Contour Detection): Takes the circle the Artist made, finds the physical edges under it, and keeps watching and following those edges as the object moves.

The Interaction Judge (State Management Logic): Looks at the Hand Reader's info (where's the hand?) and the Edge Watcher's info (can we still see the edges?). It decides if the virtual button is being covered or is clear.

The Announcer & Messenger (Audio/Webhook Services): Hears the Interaction Judge's decision ("It's covered!") and makes a sound or sends a webhook message.

The Message Post Office (Event Bus Service): The central hub where all the helpers send and receive messages.

Why This Approach (Focusing on Mid-Range Phones & Ease):

Pinch-Draw: Gives you a clear way to show the app exactly what area you want to control.

Contour Tracking: Looking for edges instead of complex textures (like ORB) is often faster and simpler for mobile phones. It's a good balance for the MVP.

Covering = Hit: Using simple occlusion (covering the edges) as the main trigger is straightforward for the app to detect reliably.

Building Blocks: We're reusing proven ideas from past versions (Services, Event Bus, Hand Tracking, Audio) to make building faster.

What You Need to Do:

Your job is to work with the AI assistant to build each of these "helpers" (Services) and connect them using the Event Bus. You'll focus on getting the core flow working: see hand -> pinch-draw -> circle appears -> circle tracks -> cover circle -> sound/webhook triggers. The AI will help with the code details for each part, especially the trickier computer vision and math bits.

Section for AI Coding Assistant: Technical Blueprint & Implementation Guide

Project Name: Drumpad Gemini (Gemini Edition 2.5 Flash)
Target Platform: Web Browser (Mid-range Smartphone Performance Focus)
Architecture: Service-Oriented Publisher/Subscriber (EventBus)
Core Libraries: MediaPipe Hands, OpenCV.js (primarily for Contour Detection), Web Audio API, Webhooks (Fetch API).
MVP Interaction: Pinch-Draw Gesture defines Circle ROI -> Contour Tracking follows Circle -> Covering Circle (Contour Threshold) triggers HIT state -> HIT state triggers Audio/Webhook. Multiple pinch finger combinations yield distinct Marker IDs.
MVP States: DEFAULT → HIT (on occlusion threshold) → RELEASED → DEFAULT.
Future: MPE controls, Long Press.

References for AI:

DrumPadMaster MVP Implementation Guide: General MVP structure, Service interface pattern, Audio integration concept, Performance/Testing sections.

APOLLO_DEV_GUIDE.md: Robust Service Lifecycle (initialize/dispose), Service Factory/Registry, Object Pooling, Memory Management (especially OpenCV), Performance (Frame Throttling, Canvas), Error Handling, Logging patterns.

MDP_REFERENCE_20250417.md: Publisher/Subscriber pattern, Service Pattern, Marker State Management concept (adapt state names), One Euro Filter, Resource Management (OpenCV, Media).

MDP_AI_CODING_GUIDE.md: Coding conventions, Publisher/Subscriber implementation details, One Euro Filter implementation details, Marker State Management pattern (adapt state names).

Replit_Tectangle_Drumpad_V1.md: MediaPipe CDN loading, Web Audio loading/playback examples, basic Hit Detection concept (adapt logic), React structure (for UI component ideas, though core is framework agnostic).

4R_REFERENCE_20250417.md: Service Architecture, UI Component patterns (adapt), Performance Optimization, Error Handling, Browser Compatibility (additional insights).

Core Services & Responsibilities (for AI Implementation):

EventBusService: Central event routing. Implement Publisher/Subscriber pattern. (Ref: MDP_REFERENCE, MDP_AI_CODING_GUIDE).

CameraService: Access webcam (getUserMedia), stream to hidden <video>, draw frames to <canvas>, publish frame data (imageData, width, height, timestamp). Handle permissions, device selection. (Ref: APOLLO_DEV_GUIDE, 4R_REFERENCE). Implement robust initialize and dispose (stop tracks).

HandTrackingService: Subscribe to camera frames. Load MediaPipe Hands (CDN). Process frames (hands.send()). Receive results (onResults). Extract landmarks. Apply One Euro Filter to smooth landmark positions. Detect Pinch Gesture (thumb-index distance). Detect which fingers are pinching (thumb+index, thumb+middle, etc.) to assign a unique Marker ID based on the finger combination. Publish smoothed hand landmarks, pinch status, and detected pinch Marker ID. (Ref: Replit_Tectangle_Drumpad_V1.md for MediaPipe basics; MDP_AI_CODING_GUIDE, MDP_REFERENCE for filter).

DrawingService: Subscribe to smoothed hand landmarks and pinch status. When pinch is true, record the position of a specific finger (e.g., index tip, landmark 8) for each frame. When pinch becomes false or after a timeout, calculate the Centroid and a Radius for the final circle based on the recorded points. Calculate the radius simply (e.g., average distance from centroid, radius of bounding circle). Publish the final Circle ROI (id, center: {x, y}, radius). Reset recorded points.

SurfaceTrackingService: Subscribe to the Circle ROI published by DrawingService.

Initialization: When a new Circle ROI is received: Store the circle data (id, center, radius). Capture the image data from the camera frame within or around this circle. Analyze this initial image to find prominent contours using OpenCV.js (cv.findContours). Store these initial contours or a descriptor of them as the tracking target.

Tracking Loop: Subscribe to subsequent camera frames. In each new frame, within or around the area where the circle was last seen, find prominent contours. Attempt to match these contours to the initial target contours (e.g., based on shape, area, position relative to each other). Estimate the new position and potentially scale/rotation of the group of tracked contours to update the center and radius of the virtual circle. Prioritize performance and simplicity over perfect robustness. Track the most prominent or closest contours. Use Object Pooling for contour vectors and other temporary objects.

Occlusion Detection (Contour Threshold): Continuously monitor the health of the tracking. Calculate a metric based on the tracked contours (e.g., number of matched contours, total area of matched contours, or a confidence score from contour matching). If this metric drops below a defined percentage threshold (e.g., 40-50%) of the initial tracked contour metric, publish an OCCLUDED signal for this circle id. If it rises back above a threshold, publish a CLEARED signal.

Publish the updated Circle ROI data (id, center, radius, trackingConfidence).

Memory: Strictly delete OpenCV Mat objects (cv.Mat) and cv.MatVector using try...finally. (Ref: APOLLO_DEV_GUIDE, MDP_REFERENCE).

StateService: Subscribe to OCCLUDED and CLEARED signals from SurfaceTrackingService. Maintain the state (DEFAULT, HIT, RELEASED) for each circle id.

Transition from DEFAULT to HIT when OCCLUDED signal for that ID is received.

Transition from HIT to RELEASED when CLEARED signal for that ID is received.

Transition from RELEASED back to DEFAULT immediately or after a short delay.

Publish state changes (id, newState, oldState).

AudioService: Subscribe to state changes from StateService. Load required audio samples (Web Audio API). Play a specific sound when a circle ID transitions to HIT. Handle AudioContext initialization on user gesture. (Ref: Replit_Tectangle_Drumpad_V1.md, 4R_REFERENCE, MDP_REFERENCE).

WebhookService: Subscribe to state changes from StateService. When a circle ID transitions to HIT, construct a simple webhook request (e.g., POST request with JSON payload including id, state, timestamp) using the fetch API and send it to a configurable URL.

UIService: (Optional for MVP core logic, but needed for visualization). Handle HTML structure, Canvas rendering. Subscribe to CameraService for the video feed (draw to canvas). Subscribe to HandTrackingService (draw landmarks). Subscribe to DrawingService (draw the live line path). Subscribe to SurfaceTrackingService (draw the tracked circle and potentially debug contours/features). Subscribe to StateService (show state text next to circle). Handle user interaction for starting/stopping services, selecting camera.

Performance & Memory Directives for AI:

Frame Throttling: Implement in CameraService or a pre-processor before Hand/Surface Tracking services receive frames. Skip processing frames if needed to maintain ~30 FPS.

OpenCV: ALWAYS wrap OpenCV calls that create cv.Mat or cv.MatVector in try { ... } finally { mat.delete(); ... }. Reuse matrices where possible instead of creating new ones per frame.

Object Pooling: Use ObjectPool (implement if needed) for frequently created small objects (points, circles data, contour vectors if possible).

Canvas: When getting imageData for OpenCV, use ctx.getContext('2d', { willReadFrequently: true }). For drawing, use ctx.getContext('2d', { alpha: false }) and batch drawing calls (ctx.beginPath(), draw multiple shapes, ctx.stroke()/fill()).

Contour Tracking Logic: Keep the contour matching/tracking simple for the MVP (e.g., tracking centroid of largest/closest contour, or matching a few key initial contours). Avoid complex shape descriptors initially.

Step-by-Step Implementation Guide for AI:

Work on these tasks sequentially. Each task might involve code across multiple services/files.

Setup & Core Services:

Create basic index.html structure.

Implement EventBusService (Publisher/Subscriber pattern).

Implement base IService and BaseService patterns (initialize, dispose).

Implement ServiceRegistry to manage service instances and initialization order.

Create initial empty class files for CameraService, HandTrackingService, DrawingService, SurfaceTrackingService, StateService, AudioService, WebhookService, UIService.

Camera & Hand Tracking:

Implement CameraService: Get webcam, stream to video element, draw frames to canvas, publish frames. Include initialize (permissions, start stream) and dispose (stop stream tracks).

Implement HandTrackingService: Load MediaPipe Hands CDN. Subscribe to camera frames. Process frames with MediaPipe. Publish raw hand landmarks. Implement One Euro Filter and apply it to landmarks. Publish smoothed hand landmarks.

Drawing & Circle Definition:

Implement Pinch Detection logic in HandTrackingService: Detect thumb-index distance. Add logic for other finger combinations to get unique pinch IDs. Publish pinch status (true/false) and pinch ID.

Implement DrawingService: Subscribe to smoothed hand landmarks and pinch status. While pinch is true, record the position of the interacting finger (e.g., index tip). When pinch ends, calculate Centroid and Radius of the circle from recorded points (implement simple calculation logic). Publish the final Circle ROI data (id, center, radius).

Surface Tracking (Contour Method):

Implement SurfaceTrackingService: Subscribe to Circle ROI from DrawingService (Initialization step). Capture initial image data within/around the circle. Find prominent contours in this initial image (using OpenCV.js findContours). Store these as the tracking target.

Subscribe SurfaceTrackingService to subsequent camera frames (Tracking loop). In each frame, find prominent contours within a search area. Implement simple logic to match/follow these contours to the initial target contours (e.g., find contours closest to the previous position). Estimate the new circle position/size based on the tracked contours. Publish the updated Circle ROI data (id, center, radius, trackingConfidence based on contour health).

Implement Memory Management for OpenCV objects within SurfaceTrackingService (try...finally).

Implement Object Pooling for temporary objects used in tracking (e.g., point arrays, contour vectors if possible).

Implement Occlusion Detection (Contour Threshold): Measure the health of tracked contours. Publish OCCLUDED/CLEARED signals based on a percentage threshold.

State Management & Triggers:

Implement StateService: Subscribe to OCCLUDED/CLEARED signals from SurfaceTrackingService. Implement the DEFAULT → HIT → RELEASED → DEFAULT state machine for each circle ID. Publish state changes.

Implement AudioService: Load one or two drum sounds. Subscribe to state changes from StateService. Play a sound when a circle ID transitions to HIT.

Implement WebhookService: Subscribe to state changes from StateService. Send a webhook request (using fetch) when a circle ID transitions to HIT.

Implement UIService (Basic Visualization): Subscribe to relevant services to draw hand landmarks, the drawing line, the final/tracked circle, and potentially the state text on the canvas overlay.

Optimization & Refinement:

Implement Frame Throttling logic.

Review OpenCV memory management in SurfaceTrackingService.

Test performance on the target device type.

Tune One Euro Filter parameters, contour detection parameters, circle calculation, and occlusion thresholds.

Refine error handling across services.

This document provides the blueprint. Use the top section for your understanding and communication, and the bottom section as the detailed task list and reference for the AI assistant in Replit. Good luck building Drumpad Gemini!