import { FC, useState, useEffect, useRef } from "react";

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
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [isOptimized, setIsOptimized] = useState(false);
  const optimizationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // Effect to handle optimization progress when camera is running
  useEffect(() => {
    if (isCameraRunning && isOpenCVReady && isMediaPipelineReady && !isOptimized) {
      // Start the optimization timer
      startTimeRef.current = Date.now();
      
      // Automatically expand the panel when warm-up starts
      setIsExpanded(true);
      
      // Clear any existing timer
      if (optimizationTimerRef.current) {
        clearInterval(optimizationTimerRef.current);
      }
      
      // Create a timer that updates progress every 100ms
      optimizationTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const targetTime = 10000; // 10 seconds for full optimization
        
        // Calculate progress as a percentage
        const progress = Math.min(100, Math.floor((elapsed / targetTime) * 100));
        setOptimizationProgress(progress);
        
        // If we've reached 100%, clear the timer and mark as optimized
        if (progress >= 100) {
          if (optimizationTimerRef.current) {
            clearInterval(optimizationTimerRef.current);
            optimizationTimerRef.current = null;
          }
          setIsOptimized(true);
          
          // Auto-collapse panel after optimization is complete (with a slight delay)
          setTimeout(() => {
            setIsExpanded(false);
          }, 2000);
        }
      }, 100);
      
      // Cleanup the timer on unmount
      return () => {
        if (optimizationTimerRef.current) {
          clearInterval(optimizationTimerRef.current);
          optimizationTimerRef.current = null;
        }
      };
    } else if (!isCameraRunning) {
      // Reset optimization state when camera is turned off
      setOptimizationProgress(0);
      setIsOptimized(false);
      if (optimizationTimerRef.current) {
        clearInterval(optimizationTimerRef.current);
        optimizationTimerRef.current = null;
      }
    }
  }, [isCameraRunning, isOpenCVReady, isMediaPipelineReady, isOptimized]);
  
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
            isExpanded ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'
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
            
            {/* Performance optimization warm-up progress */}
            {isCameraRunning && isOpenCVReady && isMediaPipelineReady && (!isOptimized || optimizationProgress < 100) && (
              <div id="optimization-status" className="status-indicator">
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full ${
                    optimizationProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                  } mr-2`} />
                  <span className="text-sm">
                    {optimizationProgress >= 100 
                      ? 'Performance: Optimized' 
                      : `Warm-up: ${optimizationProgress}%`}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="mt-1 w-full bg-gray-700 rounded-full h-1.5">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-100 ease-out"
                    style={{ width: `${optimizationProgress}%` }}
                  />
                </div>
                
                {/* Hint about why this is happening */}
                {optimizationProgress > 0 && optimizationProgress < 100 && (
                  <p className="text-xs text-blue-300/70 mt-1">
                    System is optimizing for best performance
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusIndicators;
