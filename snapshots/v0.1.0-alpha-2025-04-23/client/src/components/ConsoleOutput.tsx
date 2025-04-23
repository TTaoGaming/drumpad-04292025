import { FC, useEffect, useRef, useState } from "react";

interface LogEntry {
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  timestamp: Date;
}

interface ConsoleOutputProps {
  logs: LogEntry[];
}

const ConsoleOutput: FC<ConsoleOutputProps> = ({ logs }) => {
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-hide the console after 5 seconds if no camera is running
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!document.getElementById('camera-feed')?.srcObject) {
        setIsVisible(false);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      id="console-output" 
      ref={containerRef}
      className={`absolute bottom-20 left-4 right-4 max-h-32 overflow-y-auto bg-surface/90 backdrop-blur-sm rounded-lg p-2 transform transition-transform duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      } pointer-events-none`}
    >
      <div className="text-sm font-mono">
        <div className="text-status-info">[System] Initializing components...</div>
        <div id="console-log-container">
          {logs.map((log, index) => {
            let className;
            switch (log.type) {
              case 'error':
                className = 'text-status-error';
                break;
              case 'success':
                className = 'text-status-success';
                break;
              case 'warning':
                className = 'text-status-warning';
                break;
              default:
                className = 'text-status-info';
            }
            
            return (
              <div key={index} className={className}>
                {`[${log.type.charAt(0).toUpperCase() + log.type.slice(1)}] ${log.message}`}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConsoleOutput;
