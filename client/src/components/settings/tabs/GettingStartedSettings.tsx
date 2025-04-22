import React from 'react';

const GettingStartedSettings: React.FC = () => {
  return (
    <div className="px-1 py-2">
      <h3 className="text-lg font-semibold mb-4">Getting Started</h3>
      
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Welcome!</h4>
          <p className="text-sm opacity-80">
            This computer vision application uses your webcam to track hand movements
            and recognize gestures for interactive control.
          </p>
        </div>
        
        <div>
          <h4 className="text-sm font-medium mb-2">Quick Start Guide</h4>
          <ol className="list-decimal list-inside text-sm opacity-80 space-y-2">
            <li>Click "Start Camera" to enable your webcam</li>
            <li>Position your hand in view of the camera</li>
            <li>Use the settings panel (where you are now) to customize tracking</li>
            <li>Try different gestures like pinching or grabbing</li>
          </ol>
        </div>
        
        <div>
          <h4 className="text-sm font-medium mb-2">Settings Overview</h4>
          <ul className="list-disc list-inside text-sm opacity-80 space-y-2">
            <li><strong>Markers tab:</strong> Settings for feature tracking on surfaces</li>
            <li><strong>Hands tab:</strong> Configure hand tracking visualization and gestures</li>
            <li><strong>Debug tab:</strong> Display performance metrics and diagnostics</li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-sm font-medium mb-2">System Requirements</h4>
          <ul className="list-disc list-inside text-sm opacity-80 space-y-1">
            <li>Modern web browser (Chrome recommended)</li>
            <li>Webcam access</li>
            <li>Reasonable processor (for real-time tracking)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GettingStartedSettings;