import { useEffect, useRef } from "react";
import { dispatch, EventType } from "@/lib/eventBus";
import { startCamera, stopCamera } from "@/lib/cameraManager";

interface CameraViewProps {
  isCameraRunning: boolean;
}

const CameraView = ({ isCameraRunning }: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleStartCamera = async () => {
    try {
      if (videoRef.current) {
        const stream = await startCamera(videoRef.current);
        dispatch(EventType.CAMERA_STATUS_CHANGE, { isRunning: true });
        dispatch(EventType.LOG, { message: 'Requesting camera access...' });
      }
    } catch (error) {
      if (error instanceof Error) {
        dispatch(EventType.LOG, { message: `Camera access error: ${error.message}`, type: 'error' });
        dispatch(EventType.NOTIFICATION, { message: 'Camera access denied or not available', type: 'error' });
      }
    }
  };

  // Clean up camera when component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        stopCamera(videoRef.current);
      }
    };
  }, []);

  return (
    <>
      <video 
        ref={videoRef}
        id="camera-feed" 
        className="camera-feed w-full h-full object-cover" 
        autoPlay 
        playsInline
      />
      
      {/* Camera is off overlay */}
      {!isCameraRunning && (
        <div id="camera-off-overlay" className="absolute inset-0 flex flex-col items-center justify-center bg-background">
          <span className="material-icons text-6xl mb-4">videocam_off</span>
          <p className="text-xl">Camera is currently off</p>
          <button 
            id="start-camera" 
            className="mt-6 px-6 py-3 bg-primary text-white rounded-full flex items-center"
            onClick={handleStartCamera}
          >
            <span className="material-icons mr-2">videocam</span>
            Start Camera
          </button>
        </div>
      )}
    </>
  );
};

export default CameraView;
