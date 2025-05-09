import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { EventType, dispatch, addListener } from '@/lib/eventBus';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Knuckle Ruler Settings Component
 * 
 * Allows user to configure the distance between index and pinky knuckles
 * for use in calibration, size estimation, and homography calculations.
 */
const KnuckleRulerSettings: React.FC = () => {
  // Default average adult knuckle distance in cm based on anthropometric data
  const DEFAULT_KNUCKLE_DISTANCE = 8.0;
  
  const [isEnabled, setIsEnabled] = useState(true);
  const [showMeasurement, setShowMeasurement] = useState(true);
  const [knuckleDistance, setKnuckleDistance] = useState(DEFAULT_KNUCKLE_DISTANCE);
  const [realtimePixelDistance, setRealtimePixelDistance] = useState<number | null>(null);
  
  // Update the app when settings change
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'calibration',
      setting: 'knuckleRuler',
      value: {
        enabled: isEnabled,
        showMeasurement: showMeasurement,
        knuckleDistanceCm: knuckleDistance
      }
    });
  }, [isEnabled, showMeasurement, knuckleDistance]);
  
  // Listen for real-time knuckle measurements
  useEffect(() => {
    const listener = addListener(EventType.SETTINGS_VALUE_CHANGE, (data: {
      section: string;
      setting: string;
      value: {
        pixelDistance?: number;
        normalizedDistance?: number;
      }
    }) => {
      if (data.section === 'calibration' && data.setting === 'knuckleRulerRealtime') {
        setRealtimePixelDistance(data.value.pixelDistance || null);
      }
    });
    
    return () => {
      listener.remove();
    };
  }, []);
  
  // Handle slider or input changes
  const handleDistanceChange = (value: number) => {
    // Ensure the value is within reasonable limits (5-12cm covers small to large hands)
    const clampedValue = Math.min(Math.max(value, 5), 12);
    setKnuckleDistance(clampedValue);
  };
  
  // Calculate the real-time centimeter value
  const getRealtimeCentimeters = (): string => {
    if (!realtimePixelDistance || !isEnabled) {
      return "--.--";
    }
    
    // Create calibration factor based on the configured knuckle distance
    // This allows us to convert from pixels to real-world centimeters
    // by using the known reference (knuckle distance in cm)
    
    // For now using simplified conversion
    // In a more complex version, we'd need to account for:
    // - Distance from camera (z-coordinate from MediaPipe)
    // - Camera field of view
    // - Lens distortion
    
    // The pixel-to-cm ratio is based on the configured knuckle distance
    const calculatedCm = (realtimePixelDistance / 100 * (knuckleDistance / 8)).toFixed(1);
    
    // Log debug info for this calculation
    console.log("Realtime measurement:", {
      pixelDistance: realtimePixelDistance,
      knuckleDistanceCm: knuckleDistance,
      calculatedCm
    });
    
    return calculatedCm;
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h5 className="text-sm font-medium">Knuckle Ruler</h5>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={14} className="text-white/60 hover:text-white/80 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs">
                  Sets the distance between index and pinky knuckles for accurate size calibration.
                  Average is ~8cm for adults, but varies by hand size.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch 
          checked={isEnabled}
          onCheckedChange={setIsEnabled}
        />
      </div>
      
      <div className={isEnabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="knuckleDistance" className="text-xs">
              Index-Pinky Knuckle Distance
            </Label>
            <span className="text-xs opacity-80">{knuckleDistance.toFixed(1)} cm</span>
          </div>
          
          <div className="flex gap-2 items-center">
            <Slider
              id="knuckleDistance"
              min={5}
              max={12}
              step={0.1}
              value={[knuckleDistance]}
              onValueChange={(value) => handleDistanceChange(value[0])}
              className="flex-1"
            />
            <Input
              type="number"
              value={knuckleDistance}
              onChange={(e) => handleDistanceChange(parseFloat(e.target.value) || DEFAULT_KNUCKLE_DISTANCE)}
              className="w-14 h-7 text-xs text-center bg-black/50"
              min={5}
              max={12}
              step={0.1}
            />
          </div>
          
          <div className="flex justify-between text-[10px] opacity-70 mt-1">
            <span>Small hands (5cm)</span>
            <span>Average (8cm)</span>
            <span>Large hands (12cm)</span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-white/10 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-white/70">Measured distance in realtime</p>
            <span className="text-xs font-semibold bg-black/30 px-2 py-1 rounded">
              {getRealtimeCentimeters()} cm
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="showMeasurement" className="text-xs">
                Show measurement on knuckles
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info size={12} className="text-white/60 hover:text-white/80 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px]">
                    <p className="text-xs">
                      Displays the distance measurement directly on your hand in the camera view
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch 
              id="showMeasurement"
              checked={showMeasurement}
              onCheckedChange={setShowMeasurement}
            />
          </div>
        </div>
        
        <div className="pt-1 text-[10px] italic opacity-60">
          Used for accurate size estimation and 3D pose calculations.
        </div>
      </div>
    </div>
  );
};

export default KnuckleRulerSettings;