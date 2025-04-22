import { FC } from "react";

interface StatusIndicatorsProps {
  isCameraRunning: boolean;
  isOpenCVReady: boolean;
  isMediaPipelineReady: boolean;
}

const StatusIndicators: FC<StatusIndicatorsProps> = ({
  isCameraRunning,
  isOpenCVReady,
  isMediaPipelineReady
}) => {
  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10">
      {/* Left side statuses */}
      <div className="flex flex-col space-y-2">
        {/* Camera status indicator */}
        <div 
          id="camera-status" 
          className="status-indicator flex items-center px-3 py-1 rounded-full bg-surface/80 backdrop-blur-sm"
        >
          <span 
            className={`w-2 h-2 rounded-full ${
              isCameraRunning ? 'bg-status-success' : 'bg-status-error'
            } mr-2`} 
            id="camera-status-dot"
          />
          <span id="camera-status-text">
            {isCameraRunning ? 'Camera: Active (480p)' : 'Camera: Off'}
          </span>
        </div>
        
        {/* Resolution indicator */}
        <div className="status-indicator flex items-center px-3 py-1 rounded-full bg-surface/80 backdrop-blur-sm">
          <span id="resolution-text">Resolution: 480p</span>
        </div>
      </div>
      
      {/* Right side statuses */}
      <div className="flex flex-col space-y-2 items-end">
        {/* OpenCV status */}
        <div 
          id="opencv-status" 
          className={`status-indicator flex items-center px-3 py-1 rounded-full bg-surface/80 backdrop-blur-sm ${
            isOpenCVReady ? 'bg-status-success/20' : ''
          }`}
        >
          {!isOpenCVReady && (
            <div className="loading-spinner mr-2 border-3 border-opacity-30 border-radius-50 border-t-white w-[24px] h-[24px] animate-spin"></div>
          )}
          <span id="opencv-status-text">
            {isOpenCVReady ? 'OpenCV: Ready' : 'OpenCV: Loading'}
          </span>
        </div>
        
        {/* Media Pipeline status */}
        <div 
          id="pipeline-status" 
          className={`status-indicator flex items-center px-3 py-1 rounded-full bg-surface/80 backdrop-blur-sm ${
            isMediaPipelineReady ? 'bg-status-success/20' : ''
          }`}
        >
          {!isMediaPipelineReady && (
            <div className="loading-spinner mr-2 border-3 border-opacity-30 border-radius-50 border-t-white w-[24px] h-[24px] animate-spin"></div>
          )}
          <span id="pipeline-status-text">
            {isMediaPipelineReady ? 'Pipeline: Ready' : 'Pipeline: Initializing'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StatusIndicators;
