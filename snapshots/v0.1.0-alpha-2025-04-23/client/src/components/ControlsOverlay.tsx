import { FC } from "react";
import { Settings } from "lucide-react";
import { dispatch, EventType } from "@/lib/eventBus";
import { stopCamera } from "@/lib/cameraManager";

interface ControlsOverlayProps {
  isCameraRunning: boolean;
  isFullscreen: boolean;
}

const ControlsOverlay: FC<ControlsOverlayProps> = ({ 
  isCameraRunning,
  isFullscreen
}) => {
  const handleStopCamera = () => {
    stopCamera();
    dispatch(EventType.CAMERA_STATUS_CHANGE, { isRunning: false });
  };

  const handleRestartCamera = async () => {
    stopCamera();
    dispatch(EventType.CAMERA_STATUS_CHANGE, { isRunning: false });
    
    // Small delay to ensure camera is fully stopped before restarting
    setTimeout(() => {
      dispatch(EventType.LOG, { message: 'Restarting camera...' });
      const video = document.getElementById('camera-feed') as HTMLVideoElement;
      if (video) {
        dispatch(EventType.CAMERA_STATUS_CHANGE, { isRunning: true });
      }
    }, 500);
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('camera-container');
    
    if (!document.fullscreenElement) {
      if (container?.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any)?.webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any)?.msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
      dispatch(EventType.FULLSCREEN_CHANGE, { isFullscreen: true });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      dispatch(EventType.FULLSCREEN_CHANGE, { isFullscreen: false });
    }
  };

  const toggleSettings = () => {
    dispatch(EventType.SETTINGS_PANEL_OPEN, {});
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
      <div className="flex justify-center">
        <div className="bg-black/60 backdrop-blur-md rounded-full px-6 py-3 flex items-center space-x-4">
          {isCameraRunning && (
            <button 
              id="stop-camera" 
              className="rounded-full w-12 h-12 flex items-center justify-center bg-status-error"
              onClick={handleStopCamera}
              title="Stop Camera"
            >
              <span className="material-icons">videocam_off</span>
            </button>
          )}
          
          {isCameraRunning && (
            <button 
              id="restart-camera" 
              className="rounded-full w-12 h-12 flex items-center justify-center bg-status-info"
              onClick={handleRestartCamera}
              title="Restart Camera"
            >
              <span className="material-icons">refresh</span>
            </button>
          )}
          
          <button 
            id="fullscreen-toggle" 
            className="rounded-full w-12 h-12 flex items-center justify-center bg-primary"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <span className="material-icons">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
          
          <button 
            id="settings-toggle" 
            className="rounded-full w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors"
            onClick={toggleSettings}
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlsOverlay;
