/**
 * ROI Debug Canvas
 * 
 * A debug canvas that displays the contents of a specific ROI and implements
 * ORB feature tracking to follow objects as they move or rotate.
 */
import React, { useRef, useEffect, useState } from 'react';
import { EventType, addListener } from '@/lib/eventBus';
import { RegionOfInterest } from '@/lib/types';
import { getVideoFrame } from '@/lib/cameraManager';
import { 
  extractORBFeatures, 
  saveReferenceFeatures, 
  matchFeatures,
  clearReferenceFeatures,
  referenceFeatures,
  ORBFeature,
  TrackingResult
} from '@/lib/orbTracking';

interface ROIDebugCanvasProps {
  roiId?: string;
  width: number;
  height: number;
  visible: boolean;
}

const ROIDebugCanvas: React.FC<ROIDebugCanvasProps> = ({ 
  roiId = "1", 
  width = 200, 
  height = 200,
  visible = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [roi, setRoi] = useState<RegionOfInterest | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingResult, setTrackingResult] = useState<TrackingResult | null>(null);
  const [referenceImageData, setReferenceImageData] = useState<ImageData | null>(null);
  const [currentImageData, setCurrentImageData] = useState<ImageData | null>(null);
  const [showFeatures, setShowFeatures] = useState(true);
  const [orbStatus, setOrbStatus] = useState<string>('Initializing...');
  const [isOpenCVReady, setIsOpenCVReady] = useState<boolean>(false);
  
  // Use our improved OpenCV loader
  useEffect(() => {
    const initializeOpenCV = async () => {
      // Import the OpenCV loader dynamically
      const { isOpenCVReady: checkReady, waitForOpenCV, setupOpenCVEventListener } = await import('../lib/opencvLoader');
      
      // Check if OpenCV is already available
      if (checkReady()) {
        console.log('OpenCV is already ready in ROIDebugCanvas!');
        setIsOpenCVReady(true);
        setOrbStatus('OpenCV loaded and ready');
        return;
      }
      
      // Set up a listener for when OpenCV becomes ready
      const cleanupListener = setupOpenCVEventListener(() => {
        console.log('OpenCV has become ready in ROIDebugCanvas!');
        setIsOpenCVReady(true);
        setOrbStatus('OpenCV loaded and ready');
      });
      
      // Also try to wait for OpenCV directly
      try {
        await waitForOpenCV();
        console.log('OpenCV is now ready in ROIDebugCanvas (via waitForOpenCV)');
        setIsOpenCVReady(true);
        setOrbStatus('OpenCV loaded and ready');
      } catch (err) {
        console.error('Error waiting for OpenCV:', err);
        setOrbStatus('Error loading OpenCV');
      }
      
      // Return cleanup function for the event listener
      return () => {
        cleanupListener();
      };
    };
    
    // Start the initialization process
    initializeOpenCV();
  }, []);

  // Extract ROI content from video frame
  const extractROIContent = () => {
    const canvas = canvasRef.current;
    if (!canvas || !roi) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Get video frame
    const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
    if (!videoElement || !videoElement.videoWidth) return;
    
    // Get frame data
    const frameData = getVideoFrame(videoElement);
    if (!frameData) return;
    
    // Create a temporary canvas to draw the video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Draw the video frame to temp canvas
    tempCtx.putImageData(frameData, 0, 0);

    // Calculate scaling factors between display size and actual video size
    // This is critical for correctly mapping ROI coordinates to video frame coordinates
    const displayElement = document.querySelector('.camera-view') as HTMLElement;
    if (!displayElement) {
      console.warn("Could not find camera display element for scaling calculation");
      return;
    }
    
    const displayWidth = displayElement.clientWidth;
    const displayHeight = displayElement.clientHeight;
    
    const scaleX = videoElement.videoWidth / displayWidth;
    const scaleY = videoElement.videoHeight / displayHeight;
    
    // Only log scaling info occasionally to avoid console spam
    if (Math.random() < 0.01) { // Log ~1% of the time
      console.log(`Coordinate scaling: display(${displayWidth}x${displayHeight}) to video(${videoElement.videoWidth}x${videoElement.videoHeight})`);
      console.log(`Scale factors: x=${scaleX.toFixed(2)}, y=${scaleY.toFixed(2)}`);
    }

    // Calculate ROI center and radius
    if (roi.points.length > 2) {
      // Calculate center of the ROI (assuming it's a circle)
      let sumX = 0, sumY = 0;
      for (const point of roi.points) {
        // Scale the point coordinates from display size to video frame size
        sumX += point.x * scaleX;
        sumY += point.y * scaleY;
      }
      const centerX = sumX / roi.points.length;
      const centerY = sumY / roi.points.length;
      
      // Calculate average radius from all points - scale this too
      let totalRadius = 0;
      for (const point of roi.points) {
        const scaledX = point.x * scaleX;
        const scaledY = point.y * scaleY;
        
        const distToCenter = Math.sqrt(
          Math.pow(scaledX - centerX, 2) + 
          Math.pow(scaledY - centerY, 2)
        );
        totalRadius += distToCenter;
      }
      const radius = totalRadius / roi.points.length;
      
      // Log radius calculation for debugging (limit frequency to reduce console spam)
      if (Math.random() < 0.05) { // Log ~5% of the time
        console.log(`ROI Debug: Average radius calculated from ${roi.points.length} points = ${radius.toFixed(2)}px`);
        console.log(`Scaled center coordinates: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
      }
      
      // Draw a red circle on the temp canvas to show what we're extracting
      tempCtx.strokeStyle = 'red';
      tempCtx.lineWidth = 2;
      tempCtx.beginPath();
      tempCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      tempCtx.stroke();

      // Extract the ROI region
      // We'll extract a square region that contains the circle
      const extractSize = radius * 2;
      const sourceX = Math.max(0, centerX - radius);
      const sourceY = Math.max(0, centerY - radius);
      const sourceWidth = Math.min(extractSize, videoElement.videoWidth - sourceX);
      const sourceHeight = Math.min(extractSize, videoElement.videoHeight - sourceY);
      
      // Log some debug info about extraction sizes and positions
      console.log(`[ROIDebugCanvas] Extracting region: x=${sourceX.toFixed(0)}, y=${sourceY.toFixed(0)}, w=${sourceWidth.toFixed(0)}, h=${sourceHeight.toFixed(0)}`);
      
      // Create an ImageData object for the extracted region
      const roiImageData = tempCtx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);
      
      // Store the current image data for feature extraction
      setCurrentImageData(roiImageData);
      
      // Log if we're in tracking mode to help debug issues
      if (isTracking) {
        console.log(`[ROIDebugCanvas] Tracking is active for ROI ${roiId}, image data updated: ${roiImageData.width}x${roiImageData.height}`);
      }
      
      // Draw the extracted region to our debug canvas
      ctx.drawImage(
        tempCanvas,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, width, height
      );
      
      // If tracking is enabled, perform feature extraction and matching
      let result: TrackingResult | null = null;
      
      if (isTracking && roiId && currentImageData) {
        try {
          // Check if OpenCV is available in the worker
          console.log('[ROIDebugCanvas] Worker-based OpenCV status check:', {
            isOpenCVReady: isOpenCVReady,
            trackingStatus: isTracking ? 'active' : 'inactive',
            roiId,
            referenceExists: referenceFeatures.has(roiId),
            imageDataSize: currentImageData ? `${currentImageData.width}x${currentImageData.height}` : 'none',
            orbFeaturesCount: referenceFeatures.get(roiId)?.keypoints?.size() || 0
          });
        
          // Try getting OpenCV from window context as fallback
          const cv = typeof window !== 'undefined' ? (window as any).cv : undefined;
          console.log('[ROIDebugCanvas] Direct OpenCV availability check:', {
            cvExists: !!cv,
            cvORB: cv ? typeof cv.ORB : 'cv not loaded',
            cvMatExists: cv ? typeof cv.Mat : 'cv not loaded',
            windowCV: typeof window !== 'undefined' ? !!(window as any).cv : 'no window'
          });
          
          // If we need to use the fallback (direct window.cv) approach
          if (!cv || typeof cv.ORB !== 'function') {
            setOrbStatus('OpenCV not loaded - waiting...');
            console.log('[ROIDebugCanvas] OpenCV not available in main thread');
            
            // Force capture reference features after timeout if needed
            if (!referenceFeatures.has(roiId) && currentImageData) {
              if (!window._tracking_timeout_set) {
                window._tracking_timeout_set = true;
                console.log('[ROIDebugCanvas] Setting up force capture timeout');
                setTimeout(() => {
                  console.log('[ROIDebugCanvas] Force timeout triggered - attempting manual capture');
                  captureReferenceFeatures();
                  window._tracking_timeout_set = false;
                }, 5000);
              }
            }
          } else {
            // Use async/await with OpenCV feature extraction and matching
            const processFeatures = async () => {
              setOrbStatus('Extracting ORB features...');
              try {
                // More detailed logging for debugging
                console.log('[ROIDebugCanvas] Starting feature extraction on image data:', {
                  width: roiImageData.width,
                  height: roiImageData.height,
                  maxFeatures: 500,
                  isOpenCVReady: typeof window !== 'undefined' && !!(window as any).cv
                });
                
                // Extract features
                const features = await extractORBFeatures(roiImageData, 500);
                
                console.log('[ROIDebugCanvas] Feature extraction result:', {
                  success: !!features,
                  featureCount: features ? features.keypoints.size() : 0
                });
                
                if (!features) {
                  setOrbStatus('Failed to extract features');
                  return null;
                }
                
                if (features.keypoints.size() > 0) {
                  // If we don't have reference features yet, set them now
                  // This happens automatically the first time tracking is enabled for a new ROI
                  const hasReference = referenceFeatures.has(roiId);
                  
                  if (!hasReference && features.keypoints.size() > 10) {
                    // First time - save as reference
                    saveReferenceFeatures(roiId, features);
                    setReferenceImageData(roiImageData);
                    setOrbStatus(`Captured ${features.keypoints.size()} reference features`);
                    console.log(`Auto-captured reference for tracking ROI ${roiId} with ${features.keypoints.size()} features`);
                    
                    // Create a new feature set for matching (since we just used this one as reference)
                    try {
                      const newFeatures = await extractORBFeatures(roiImageData, 500);
                      if (newFeatures) {
                        const matchResult = await matchFeatures(roiId, newFeatures);
                        newFeatures.keypoints.delete();
                        newFeatures.descriptors.delete();
                        return matchResult;
                      }
                    } catch (err) {
                      console.error('Error extracting features for matching:', err);
                      setOrbStatus('Error extracting matching features');
                    }
                  } else {
                    // Match features with reference
                    setOrbStatus('Matching features...');
                    const matchResult = await matchFeatures(roiId, features);
                    
                    if (matchResult && matchResult.isTracked) {
                      setOrbStatus(`Tracking: ${matchResult.inlierCount} matches (${(matchResult.confidence * 100).toFixed(0)}%)`);
                    } else {
                      setOrbStatus('Object lost - move slower');
                    }
                    
                    return matchResult;
                  }
                }
                
                // Clean up OpenCV resources
                if (features) {
                  features.keypoints.delete();
                  features.descriptors.delete();
                }
              } catch (err) {
                console.error('Error in feature processing:', err);
                setOrbStatus('Error processing features');
              }
              
              return null;
            };
            
            // Execute async processing and update result when done
            processFeatures().then(matchResult => {
              if (matchResult) {
                // Update the local result variable
                result = matchResult;
                setTrackingResult(matchResult);
                
                // Only log occasionally to reduce console spam
                if (Math.random() < 0.05 && matchResult && typeof matchResult.confidence === 'number') {
                  console.log(`Tracking ROI ${roiId}: ${matchResult.isTracked ? 'TRACKED' : 'LOST'} - Confidence: ${(matchResult.confidence * 100).toFixed(1)}%`);
                }
                
                // Re-draw with the new tracking result
                requestAnimationFrame(() => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return;
                  
                  // Draw tracking results if available
                  if (matchResult.isTracked && showFeatures) {
                    // Draw box around tracked object
                    ctx.strokeStyle = '#4caf50'; // Green
                    ctx.lineWidth = 2;
                    
                    if (matchResult.corners && matchResult.corners.length === 4) {
                      ctx.beginPath();
                      ctx.moveTo(matchResult.corners[0].x, matchResult.corners[0].y);
                      ctx.lineTo(matchResult.corners[1].x, matchResult.corners[1].y);
                      ctx.lineTo(matchResult.corners[2].x, matchResult.corners[2].y);
                      ctx.lineTo(matchResult.corners[3].x, matchResult.corners[3].y);
                      ctx.closePath();
                      ctx.stroke();
                    }
                    
                    // Draw rotation indicator if available
                    if (matchResult.center && matchResult.rotation) {
                      const rotationLength = 30;
                      const endX = matchResult.center.x + Math.cos(matchResult.rotation) * rotationLength;
                      const endY = matchResult.center.y + Math.sin(matchResult.rotation) * rotationLength;
                      
                      ctx.strokeStyle = '#ffeb3b'; // Yellow
                      ctx.lineWidth = 2;
                      ctx.beginPath();
                      ctx.moveTo(matchResult.center.x, matchResult.center.y);
                      ctx.lineTo(endX, endY);
                      ctx.stroke();
                    }
                  }
                });
              }
            }).catch(err => {
              console.error('Async feature processing error:', err);
            });
            
            // Draw tracking results with any existing result data
            // (this will be updated later when async processing completes)
            if (result?.isTracked && showFeatures) {
              // Draw box around tracked object
              ctx.strokeStyle = '#4caf50'; // Green
              ctx.lineWidth = 2;
              
              if (result.corners && result.corners.length === 4) {
                ctx.beginPath();
                ctx.moveTo(result.corners[0].x, result.corners[0].y);
                ctx.lineTo(result.corners[1].x, result.corners[1].y);
                ctx.lineTo(result.corners[2].x, result.corners[2].y);
                ctx.lineTo(result.corners[3].x, result.corners[3].y);
                ctx.closePath();
                ctx.stroke();
              }
              
              // Draw rotation indicator if available
              if (result.center && result.rotation) {
                const rotationLength = 30;
                const endX = result.center.x + Math.cos(result.rotation) * rotationLength;
                const endY = result.center.y + Math.sin(result.rotation) * rotationLength;
                
                ctx.strokeStyle = '#ffeb3b'; // Yellow
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(result.center.x, result.center.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                
                // Add arrow head
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                  endX - 10 * Math.cos(result.rotation - Math.PI/6),
                  endY - 10 * Math.sin(result.rotation - Math.PI/6)
                );
                ctx.lineTo(
                  endX - 10 * Math.cos(result.rotation + Math.PI/6),
                  endY - 10 * Math.sin(result.rotation + Math.PI/6)
                );
                ctx.closePath();
                ctx.fillStyle = '#ffeb3b';
                ctx.fill();
              }
            }
            
            // Note: The features are cleaned up in the async function now
          }
        } catch (error) {
          setOrbStatus('Error during tracking');
          console.error("Error during feature tracking:", error);
        }
      }
      
      // Add ROI ID label and radius info
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`ROI ID: ${roi.id}`, 10, 20);
      
      // Add tracking status if tracking is enabled
      if (isTracking) {
        const statusX = width - 65;
        if (result && result.isTracked && typeof result.confidence === 'number') {
          ctx.fillStyle = '#4caf50'; // Green
          ctx.fillText('TRACKED', statusX, 20);
          
          // Show confidence and match count
          ctx.font = '12px sans-serif';
          ctx.fillStyle = 'white';
          ctx.fillText(`Confidence: ${(result.confidence * 100).toFixed(0)}%`, 10, 40);
          ctx.fillText(`Matches: ${result.inlierCount}/${result.matchCount}`, 10, 55);
          
          // Show rotation if available
          if (result.rotation) {
            const degrees = ((result.rotation * 180 / Math.PI) % 360).toFixed(0);
            ctx.fillText(`Rotation: ${degrees}°`, 10, 70);
          }
        } else {
          ctx.fillStyle = '#f44336'; // Red
          ctx.fillText('LOST', statusX, 20);
        }
      }
      
      // Add small text with radius and center info
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'white';
      ctx.fillText(`Radius: ${radius.toFixed(1)}px`, 10, height - 25);
      ctx.fillText(`Center: (${centerX.toFixed(0)},${centerY.toFixed(0)})`, 10, height - 10);
      
      // Add circle to show the ROI extraction outline
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(width/2, height/2, width/2 - 5, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw crosshairs at center for alignment reference
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
      ctx.lineWidth = 1;
      
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, height/2);
      ctx.lineTo(width, height/2);
      ctx.stroke();
      
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(width/2, 0);
      ctx.lineTo(width/2, height);
      ctx.stroke();
    }
  };
  
  // Listen for ROI updates
  useEffect(() => {
    const roisListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'drawing' && data.setting === 'activeROIs') {
          const rois = data.value as RegionOfInterest[];
          // Find ROI with ID 1 (we'll just use the first one if nothing matches)
          const targetRoi = rois.find(r => r.id === roiId) || rois[0];
          
          if (targetRoi) {
            setRoi(targetRoi);
            setIsExtracting(true);
            
            // Reset tracking initially when ROI is updated
            setIsTracking(false);
            setTrackingResult(null);
            setReferenceImageData(null);
            
            // Clear any existing reference features
            if (roiId) {
              clearReferenceFeatures(roiId);
            }
            
            // We'll auto-start tracking after a short delay to allow the ROI to stabilize
            setTimeout(() => {
              console.log("[ROIDebugCanvas] Auto-starting tracking for new ROI");
              setOrbStatus('Auto-starting tracking...');
              
              // Check if OpenCV.js is available before starting tracking
              const cvObject = typeof window !== 'undefined' ? (window as any).cv : undefined;
              if (!cvObject || typeof cvObject.ORB !== 'function') {
                console.log('[ROIDebugCanvas] OpenCV.js not fully loaded yet, will continue checking...');
                setOrbStatus('Waiting for OpenCV...');
                
                // Poll for OpenCV availability
                const checkInterval = setInterval(() => {
                  const cv = typeof window !== 'undefined' ? (window as any).cv : undefined;
                  console.log('[ROIDebugCanvas] Checking OpenCV availability:', !!cv, 
                    cv ? typeof cv.ORB : 'undefined');
                  
                  if (cv && typeof cv.ORB === 'function') {
                    console.log('[ROIDebugCanvas] OpenCV now ready, starting tracking');
                    clearInterval(checkInterval);
                    setOrbStatus('OpenCV ready, starting tracking');
                    setIsTracking(true);
                  }
                }, 1000);
                
                // Safety timeout after 10 seconds
                setTimeout(() => {
                  clearInterval(checkInterval);
                  console.log('[ROIDebugCanvas] Forcing tracking start after timeout');
                  setOrbStatus('Starting tracking (loading status uncertain)');
                  setIsTracking(true);
                }, 10000);
              } else {
                console.log('[ROIDebugCanvas] OpenCV available, starting tracking immediately');
                setIsTracking(true);
              }
            }, 500);
          }
        }
      }
    );
    
    // Clean up when component unmounts
    return () => {
      roisListener.remove();
      
      // Clean up tracking resources
      if (roiId) {
        clearReferenceFeatures(roiId);
      }
    };
  }, [roiId]);

  // Set up ROI extraction interval
  useEffect(() => {
    if (!roi || !isExtracting || !visible) return;
    
    // Initial extraction
    extractROIContent();
    
    const extractInterval = setInterval(() => {
      extractROIContent();
    }, 33); // Extract at ~30fps for smoother updates
    
    return () => {
      clearInterval(extractInterval);
    };
  }, [roi, isExtracting, visible]);

  // Capture ORB reference features when the "Track" button is clicked
  const captureReferenceFeatures = () => {
    if (!roiId || !currentImageData) {
      setOrbStatus('No ROI or image data available');
      return;
    }
    
    if (isTracking) {
      // If already tracking, clear tracking data
      setIsTracking(false);
      setTrackingResult(null);
      setReferenceImageData(null);
      clearReferenceFeatures(roiId);
      setOrbStatus('Tracking stopped');
      console.log(`Tracking reset for ROI ${roiId}`);
      return;
    }
    
    // Update the status immediately
    setOrbStatus('Starting capture...');
    
    // Use async IIFE to properly handle async operations
    (async () => {
      try {
        // Check OpenCV availability using our loader
        const { isOpenCVReady, loadOpenCV } = await import('../lib/opencvLoader');
        
        if (!isOpenCVReady()) {
          setOrbStatus('OpenCV not loaded - loading now...');
          console.log('OpenCV not fully loaded yet, trying to load...');
          
          // Try to load OpenCV
          try {
            await loadOpenCV();
            setOrbStatus('OpenCV loaded, extracting features...');
          } catch (err) {
            console.error('Failed to load OpenCV:', err);
            // Continue anyway, as the extraction might still work if OpenCV loads later
          }
        }
        
        // Extract ORB features from current frame (using async version)
        setOrbStatus('Extracting features...');
        const features = await extractORBFeatures(currentImageData, 500);
        
        if (features && features.keypoints.size() > 10) {
          // Save reference features and image
          saveReferenceFeatures(roiId, features);
          setReferenceImageData(currentImageData);
          setIsTracking(true);
          setOrbStatus(`Captured ${features.keypoints.size()} reference features`);
          
          // Log success
          console.log(`Captured reference for tracking ROI ${roiId} with ${features.keypoints.size()} features`);
        } else {
          setOrbStatus('Failed to extract enough features - trying again');
          console.warn(`Failed to extract enough features from ROI ${roiId} for tracking`);
          // We'll set tracking to true anyway, and let the extraction loop keep trying
          setIsTracking(true);
        }
      } catch (error) {
        setOrbStatus('Error capturing features - will retry');
        console.error("Error capturing reference features:", error);
        // We'll set tracking to true anyway, and let the extraction loop keep trying
        setIsTracking(true);
      }
    })();
  };

  // Toggle feature display
  const toggleFeatures = () => {
    setShowFeatures(!showFeatures);
  };
  
  // Force transition from "Auto-starting tracking" state after timeout
  useEffect(() => {
    if (orbStatus === 'Auto-starting tracking...' && isTracking) {
      const timer = setTimeout(() => {
        console.log('[ROIDebugCanvas] Forcing status update from auto-starting state');
        if (orbStatus === 'Auto-starting tracking...') {
          setOrbStatus('Waiting for features...');
          
          // Force feature extraction after another short delay
          setTimeout(() => {
            if (!referenceFeatures.has(roiId || '') && currentImageData) {
              console.log('[ROIDebugCanvas] Forcing manual feature extraction');
              captureReferenceFeatures();
            }
          }, 1000);
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [orbStatus, isTracking, roiId, currentImageData]);

  if (!visible) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      left: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '8px',
      padding: '10px',
      zIndex: 1000,
      color: 'white',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ margin: 0, padding: 0, fontSize: '14px' }}>ROI Debug View</h3>
        {roi && <p style={{ margin: '3px 0 0 0', padding: 0, fontSize: '12px', opacity: 0.8 }}>ROI ID: {roi.id}</p>}
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          border: '1px solid rgba(255, 255, 255, 0.3)',
          backgroundColor: '#222'
        }}
      />
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginTop: '8px',
        gap: '5px' 
      }}>
        <button
          onClick={captureReferenceFeatures}
          style={{
            backgroundColor: isTracking ? '#f44336' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '5px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            flex: 1
          }}
        >
          {isTracking ? 'Reset Tracking' : 'Start Tracking'}
        </button>
        <button
          onClick={toggleFeatures}
          style={{
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '5px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            flex: 1
          }}
        >
          {showFeatures ? 'Hide Features' : 'Show Features'}
        </button>
      </div>
      
      {/* ORB Status */}
      <div style={{
        marginTop: '5px',
        fontSize: '11px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        padding: '5px',
        borderRadius: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isTracking ? '#4caf50' : '#f44336',
            marginRight: '5px'
          }} />
          <span>Status: {orbStatus}</span>
        </div>
      </div>
      
      {trackingResult && isTracking && typeof trackingResult.confidence === 'number' && (
        <div style={{
          marginTop: '5px',
          fontSize: '11px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          padding: '5px',
          borderRadius: '4px'
        }}>
          <div style={{ 
            height: '6px', 
            width: '100%', 
            backgroundColor: '#333',
            borderRadius: '3px',
            marginBottom: '5px'
          }}>
            <div style={{ 
              height: '100%', 
              width: `${trackingResult.confidence * 100}%`,
              backgroundColor: trackingResult.isTracked ? '#4caf50' : '#f44336',
              borderRadius: '3px',
              transition: 'width 0.2s'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Status: {trackingResult.isTracked ? 'Tracked' : 'Lost'}</span>
            <span>Confidence: {(trackingResult.confidence * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ROIDebugCanvas;