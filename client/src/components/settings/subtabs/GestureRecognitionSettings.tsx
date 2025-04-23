import React from 'react';
import PinchGestureSettings from './PinchGestureSettings';

const GestureRecognitionSettings: React.FC = () => {
  return (
    <div className="space-y-4">
      <PinchGestureSettings />
    </div>
  );
};

export default GestureRecognitionSettings;