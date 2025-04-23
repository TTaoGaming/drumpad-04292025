import { FC, useState } from "react";

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
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toggleExpanded = () => {
    setIsExpanded(prev => !prev);
  };
  
  return (
    <div className="absolute top-0 left-0 z-20 m-2">
      {/* Collapsible panel with status indicators */}
      <div className="bg-black/70 rounded-lg overflow-hidden">
        {/* Panel header with toggle button */}
        <button 
          onClick={toggleExpanded}
          className="w-full flex items-center justify-between px-3 py-2 text-white text-sm font-medium"
        >
          <div className="flex items-center">
            <span 
              className={`w-2 h-2 rounded-full ${
                isCameraRunning && isOpenCVReady && isMediaPipelineReady 
                  ? 'bg-green-500' 
                  : 'bg-yellow-500'
              } mr-2`}
            />
            <span>System Status</span>
          </div>
          <svg 
            className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Collapsible content */}
        <div 
          className={`overflow-hidden transition-all duration-300 ${
            isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-3 space-y-2 text-white">
            {/* Camera status indicator */}
            <div 
              id="camera-status" 
              className="status-indicator flex items-center"
            >
              <span 
                className={`w-2 h-2 rounded-full ${
                  isCameraRunning ? 'bg-green-500' : 'bg-red-500'
                } mr-2`} 
                id="camera-status-dot"
              />
              <span id="camera-status-text" className="text-sm">
                {isCameraRunning ? 'Camera: Active (480p)' : 'Camera: Off'}
              </span>
            </div>
            
            {/* OpenCV status */}
            <div 
              id="opencv-status" 
              className="status-indicator flex items-center"
            >
              <span 
                className={`w-2 h-2 rounded-full ${
                  isOpenCVReady ? 'bg-green-500' : 'bg-yellow-500'
                } mr-2`} 
              />
              <span id="opencv-status-text" className="text-sm">
                {isOpenCVReady ? 'OpenCV: Ready' : 'OpenCV: Loading'}
              </span>
              {!isOpenCVReady && (
                <div className="ml-2 w-3 h-3 border-t-2 border-white animate-spin rounded-full"></div>
              )}
            </div>
            
            {/* Media Pipeline status */}
            <div 
              id="pipeline-status" 
              className="status-indicator flex items-center"
            >
              <span 
                className={`w-2 h-2 rounded-full ${
                  isMediaPipelineReady ? 'bg-green-500' : 'bg-yellow-500'
                } mr-2`} 
              />
              <span id="pipeline-status-text" className="text-sm">
                {isMediaPipelineReady ? 'Pipeline: Ready' : 'Pipeline: Initializing'}
              </span>
              {!isMediaPipelineReady && (
                <div className="ml-2 w-3 h-3 border-t-2 border-white animate-spin rounded-full"></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusIndicators;
