import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { EventType, dispatch, addListener } from '@/lib/eventBus';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

/**
 * Finger names for mapping index to readable name
 */
const FINGER_NAMES = [
  'Thumb',
  'Index',
  'Middle',
  'Ring',
  'Pinky'
];

/**
 * Simplified representation of finger joint sections
 */
const JOINT_NAMES = [
  'MCP (Knuckle)',
  'PIP (Middle)',
  'DIP (Tip)'
];

// Initial default thresholds for each finger
// Format: [straightThreshold, bentThreshold]
const DEFAULT_THRESHOLDS = {
  thumb: { pip: [5, 40], dip: [5, 40] },
  index: { pip: [5, 60], dip: [5, 60] },
  middle: { pip: [5, 60], dip: [5, 60] },
  ring: { pip: [5, 60], dip: [5, 60] },
  pinky: { pip: [5, 60], dip: [5, 60] }
};

type JointType = 'flex';
type FingerType = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

/**
 * Finger Flexion Settings Component
 * 
 * Allows configuration of finger joint angle thresholds for gesture recognition
 * For each finger, two joints are measured and can be configured for threshold detection
 */
const FingerFlexionSettings: React.FC = () => {
  // Global enable/disable finger flexion detection
  const [isEnabled, setIsEnabled] = useState(true);
  
  // Per-finger enable/disable
  const [enabledFingers, setEnabledFingers] = useState<{
    [finger in FingerType]: boolean
  }>({
    thumb: true,
    index: true,
    middle: true,
    ring: false,  // Disabled by default to save performance
    pinky: false  // Disabled by default to save performance
  });
  
  // Currently selected finger tab
  const [activeFingerTab, setActiveFingerTab] = useState<FingerType>('index');
  
  // Real-time angle measurements from hand tracking
  const [currentAngles, setCurrentAngles] = useState<{
    [finger in FingerType]: {
      flex: number | null  // Combined flexion angle (replaces separate pip/dip)
    }
  }>({
    thumb: { flex: null },
    index: { flex: null },
    middle: { flex: null },
    ring: { flex: null },
    pinky: { flex: null }
  });
  
  // Simplified threshold settings - one combined flexion value per finger
  const [thresholds, setThresholds] = useState({
    thumb: { 
      flex: { min: 5, max: 40 }
    },
    index: { 
      flex: { min: 5, max: 60 }
    },
    middle: { 
      flex: { min: 5, max: 60 }
    },
    ring: { 
      flex: { min: 5, max: 60 }
    },
    pinky: { 
      flex: { min: 5, max: 60 }
    }
  });
  
  // Toggle specific finger
  const toggleFinger = (finger: FingerType) => {
    setEnabledFingers(prev => ({
      ...prev,
      [finger]: !prev[finger]
    }));
  };
  
  // Send settings to the application
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'gestures',
      setting: 'fingerFlexion',
      value: {
        enabled: isEnabled,
        enabledFingers,
        thresholds
      }
    });
  }, [isEnabled, enabledFingers, thresholds]);
  
  // Listen for real-time angle measurements
  useEffect(() => {
    const listener = addListener(EventType.SETTINGS_VALUE_CHANGE, (data: {
      section: string;
      setting: string;
      value: any;
    }) => {
      if (data.section === 'gestures' && data.setting === 'fingerFlexionAngles') {
        setCurrentAngles(data.value);
      }
    });
    
    return () => {
      listener.remove();
    };
  }, []);
  
  // Update threshold values for the currently selected finger
  const handleFlexThresholdChange = (
    type: 'min' | 'max',
    value: number
  ) => {
    setThresholds(prev => {
      const newThresholds = { ...prev };
      // Ensure constraints: min < max
      if (type === 'min' && value < newThresholds[activeFingerTab].flex.max) {
        newThresholds[activeFingerTab].flex.min = value;
      } else if (type === 'max' && value > newThresholds[activeFingerTab].flex.min) {
        newThresholds[activeFingerTab].flex.max = value;
      }
      return newThresholds;
    });
  };
  
  // Get status badge for current angle measurement
  const getStatusBadge = (finger: FingerType) => {
    const angle = currentAngles[finger].flex;
    const threshold = thresholds[finger].flex;
    
    if (angle === null) {
      return <Badge variant="outline" className="text-xs bg-gray-800/50">No data</Badge>;
    }
    
    if (angle < threshold.min) {
      return <Badge variant="default" className="text-xs bg-green-600/80">Straight</Badge>;
    } else if (angle > threshold.max) {
      return <Badge variant="default" className="text-xs bg-blue-600/80">Bent</Badge>;
    } else {
      return <Badge variant="outline" className="text-xs bg-yellow-600/50">In-between</Badge>;
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h5 className="text-sm font-medium">Finger Flexion</h5>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={14} className="text-white/60 hover:text-white/80 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p className="text-xs">
                  Measures the combined flexion angle of finger joints and detects when fingers 
                  are straight or bent. Enable only the specific fingers you need to save performance.
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
      
      {/* Per-finger enable/disable section */}
      <div className={isEnabled ? "space-y-1 border-b border-white/10 pb-3" : "space-y-1 border-b border-white/10 pb-3 opacity-50 pointer-events-none"}>
        <Label className="text-xs font-medium">Active Fingers</Label>
        <p className="text-[10px] text-white/60 mb-2">
          Enable only the fingers you need to track. Disabling unused fingers improves performance.
        </p>
        <div className="grid grid-cols-5 gap-2">
          {(['thumb', 'index', 'middle', 'ring', 'pinky'] as FingerType[]).map((finger) => (
            <div key={finger} className="flex flex-col items-center gap-1">
              <Switch 
                checked={enabledFingers[finger]}
                onCheckedChange={() => toggleFinger(finger)}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-indigo-500 data-[state=checked]:to-purple-600"
              />
              <span className="text-[10px]">{FINGER_NAMES[['thumb', 'index', 'middle', 'ring', 'pinky'].indexOf(finger)]}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className={isEnabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
        {/* Finger tabs */}
        <Tabs 
          value={activeFingerTab} 
          onValueChange={(v) => setActiveFingerTab(v as FingerType)} 
          className="w-full"
        >
          <TabsList className="grid grid-cols-5 w-full h-8 bg-black/20">
            <TabsTrigger value="thumb" className="text-xs px-1">Thumb</TabsTrigger>
            <TabsTrigger value="index" className="text-xs px-1">Index</TabsTrigger>
            <TabsTrigger value="middle" className="text-xs px-1">Middle</TabsTrigger>
            <TabsTrigger value="ring" className="text-xs px-1">Ring</TabsTrigger>
            <TabsTrigger value="pinky" className="text-xs px-1">Pinky</TabsTrigger>
          </TabsList>
          
          {/* Content for each finger tab */}
          {(['thumb', 'index', 'middle', 'ring', 'pinky'] as FingerType[]).map((finger) => (
            <TabsContent key={finger} value={finger} className={`pt-3 space-y-4 ${enabledFingers[finger] ? '' : 'opacity-50'}`}>
              <div className="text-sm font-medium mb-2 flex justify-between items-center">
                <span>{FINGER_NAMES[['thumb', 'index', 'middle', 'ring', 'pinky'].indexOf(finger)]} Finger Flexion</span>
                {!enabledFingers[finger] && 
                  <Badge variant="outline" className="text-xs bg-gray-800/50">Disabled</Badge>
                }
              </div>
              
              {/* Combined Flexion Measurement */}
              <div className="pt-2 pb-2 border-t border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-medium">Finger Flexion</p>
                    <p className="text-[10px] text-white/60 mt-0.5">
                      Combined measurement of finger bending
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-80">
                      {currentAngles[finger].flex !== null 
                        ? `${Math.round(currentAngles[finger].flex as number)}°` 
                        : '--°'}
                    </span>
                    {getStatusBadge(finger)}
                  </div>
                </div>
                
                {/* Threshold sliders */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Straight Threshold</Label>
                    <span className="text-xs opacity-80">Below {thresholds[finger].flex.min}°</span>
                  </div>
                  <Slider
                    min={0}
                    max={30}
                    step={1}
                    value={[thresholds[finger].flex.min]}
                    onValueChange={(value) => handleFlexThresholdChange('min', value[0])}
                    className="flex-1"
                  />
                  
                  <div className="flex justify-between items-center mt-3">
                    <Label className="text-xs">Bent Threshold</Label>
                    <span className="text-xs opacity-80">Above {thresholds[finger].flex.max}°</span>
                  </div>
                  <Slider
                    min={30}
                    max={90}
                    step={1}
                    value={[thresholds[finger].flex.max]}
                    onValueChange={(value) => handleFlexThresholdChange('max', value[0])}
                    className="flex-1"
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        
        <div className="pt-2 text-[10px] italic opacity-60">
          Simplified flexion measurement improves performance while still detecting finger movement.
          For best results, enable only the fingers you need to track.
        </div>
      </div>
    </div>
  );
};

export default FingerFlexionSettings;