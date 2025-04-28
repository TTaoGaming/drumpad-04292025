import React from 'react';
import PinchGestureSettings from './PinchGestureSettings';
import HandConfidenceSettings from './HandConfidenceSettings';

const GestureRecognitionSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <HandConfidenceSettings />
      <PinchGestureSettings />
    </div>
  );
};

export default GestureRecognitionSettings;