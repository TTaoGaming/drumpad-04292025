import { useEffect, useState, useRef } from 'react';

interface FpsCounterProps {
  className?: string;
}

/**
 * A minimal FPS counter component that displays the current frames per second
 * in the bottom left corner of the screen
 */
const FpsCounter: React.FC<FpsCounterProps> = ({ className }) => {
  const [fps, setFps] = useState<number>(0);
  const frameTimeRef = useRef<number[]>([]);
  const frameCountRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(performance.now());
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Function to calculate and update FPS
    const calculateFps = () => {
      const now = performance.now();
      const frameTime = now - lastUpdateTimeRef.current;
      lastUpdateTimeRef.current = now;
      
      // Track last 20 frames for averaging
      frameTimeRef.current.push(frameTime);
      if (frameTimeRef.current.length > 20) {
        frameTimeRef.current.shift();
      }
      
      frameCountRef.current++;
      
      // Update FPS display every 500ms (2x per second)
      if (now - lastUpdateTimeRef.current > 500 || frameCountRef.current % 30 === 0) {
        const avgFrameTime = frameTimeRef.current.reduce((sum, time) => sum + time, 0) / 
                            frameTimeRef.current.length;
        const currentFps = Math.round(1000 / avgFrameTime);
        setFps(currentFps || 0); // Avoid NaN or Infinity
      }
      
      // Request next animation frame
      animationFrameRef.current = requestAnimationFrame(calculateFps);
    };
    
    // Start the FPS calculation loop
    animationFrameRef.current = requestAnimationFrame(calculateFps);
    
    // Clean up on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Style for different FPS ranges
  const getFpsColor = () => {
    if (fps >= 55) return 'text-green-500';
    if (fps >= 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={`fixed bottom-2 left-2 z-50 px-2 py-1 bg-black/70 rounded-sm font-mono text-sm ${className}`}>
      <span className={getFpsColor()}>
        {fps} <span className="text-xs text-white/80">fps</span>
      </span>
    </div>
  );
};

export default FpsCounter;