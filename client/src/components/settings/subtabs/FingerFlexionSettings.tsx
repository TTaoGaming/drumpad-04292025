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

type JointType = 'pip' | 'dip';
type FingerType = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

/**
 * Finger Flexion Settings Component
 * 
 * Allows configuration of finger joint angle thresholds for gesture recognition
 * For each finger, two joints are measured and can be configured for threshold detection
 */
const FingerFlexionSettings: React.FC = () => {
  // Enable/disable finger flexion detection
  const [isEnabled, setIsEnabled] = useState(true);
  
  // Currently selected finger tab
  const [activeFingerTab, setActiveFingerTab] = useState<FingerType>('index');
  
  // Real-time angle measurements from hand tracking
  const [currentAngles, setCurrentAngles] = useState<{
    [finger in FingerType]: {
      [joint in JointType]: number | null
    }
  }>({
    thumb: { pip: null, dip: null },
    index: { pip: null, dip: null },
    middle: { pip: null, dip: null },
    ring: { pip: null, dip: null },
    pinky: { pip: null, dip: null }
  });
  
  // Threshold settings
  const [thresholds, setThresholds] = useState({
    thumb: { 
      pip: { min: DEFAULT_THRESHOLDS.thumb.pip[0], max: DEFAULT_THRESHOLDS.thumb.pip[1] },
      dip: { min: DEFAULT_THRESHOLDS.thumb.dip[0], max: DEFAULT_THRESHOLDS.thumb.dip[1] }
    },
    index: { 
      pip: { min: DEFAULT_THRESHOLDS.index.pip[0], max: DEFAULT_THRESHOLDS.index.pip[1] },
      dip: { min: DEFAULT_THRESHOLDS.index.dip[0], max: DEFAULT_THRESHOLDS.index.dip[1] }
    },
    middle: { 
      pip: { min: DEFAULT_THRESHOLDS.middle.pip[0], max: DEFAULT_THRESHOLDS.middle.pip[1] },
      dip: { min: DEFAULT_THRESHOLDS.middle.dip[0], max: DEFAULT_THRESHOLDS.middle.dip[1] }
    },
    ring: { 
      pip: { min: DEFAULT_THRESHOLDS.ring.pip[0], max: DEFAULT_THRESHOLDS.ring.pip[1] },
      dip: { min: DEFAULT_THRESHOLDS.ring.dip[0], max: DEFAULT_THRESHOLDS.ring.dip[1] }
    },
    pinky: { 
      pip: { min: DEFAULT_THRESHOLDS.pinky.pip[0], max: DEFAULT_THRESHOLDS.pinky.pip[1] },
      dip: { min: DEFAULT_THRESHOLDS.pinky.dip[0], max: DEFAULT_THRESHOLDS.pinky.dip[1] }
    }
  });
  
  // Send settings to the application
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'gestures',
      setting: 'fingerFlexion',
      value: {
        enabled: isEnabled,
        thresholds
      }
    });
  }, [isEnabled, thresholds]);
  
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
  const handleThresholdChange = (
    joint: JointType,
    type: 'min' | 'max',
    value: number
  ) => {
    setThresholds(prev => {
      const newThresholds = { ...prev };
      // Ensure constraints: min < max
      if (type === 'min' && value < newThresholds[activeFingerTab][joint].max) {
        newThresholds[activeFingerTab][joint].min = value;
      } else if (type === 'max' && value > newThresholds[activeFingerTab][joint].min) {
        newThresholds[activeFingerTab][joint].max = value;
      }
      return newThresholds;
    });
  };
  
  // Get status badge for current angle measurement
  const getStatusBadge = (finger: FingerType, joint: JointType) => {
    const angle = currentAngles[finger][joint];
    const threshold = thresholds[finger][joint];
    
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
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs">
                  Measures the angles between finger joints and detects when fingers 
                  are straight or bent. Each finger can have its own thresholds configured.
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
            <TabsContent key={finger} value={finger} className="pt-3 space-y-4">
              <div className="text-sm font-medium mb-2">
                {FINGER_NAMES[['thumb', 'index', 'middle', 'ring', 'pinky'].indexOf(finger)]} Finger Joints
              </div>
              
              {/* PIP Joint (middle joint) */}
              <div className="pt-2 pb-2 border-t border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-medium">{finger === 'thumb' ? 'MCP (Base)' : 'PIP (Middle Joint)'}</p>
                    <p className="text-[10px] text-white/60 mt-0.5">
                      The second joint of the finger
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-80">
                      {currentAngles[finger].pip !== null 
                        ? `${Math.round(currentAngles[finger].pip as number)}°` 
                        : '--°'}
                    </span>
                    {getStatusBadge(finger, 'pip')}
                  </div>
                </div>
                
                {/* PIP Threshold sliders */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Straight Threshold</Label>
                    <span className="text-xs opacity-80">Below {thresholds[finger].pip.min}°</span>
                  </div>
                  <Slider
                    min={0}
                    max={30}
                    step={1}
                    value={[thresholds[finger].pip.min]}
                    onValueChange={(value) => handleThresholdChange('pip', 'min', value[0])}
                    className="flex-1"
                  />
                  
                  <div className="flex justify-between items-center mt-3">
                    <Label className="text-xs">Bent Threshold</Label>
                    <span className="text-xs opacity-80">Above {thresholds[finger].pip.max}°</span>
                  </div>
                  <Slider
                    min={30}
                    max={90}
                    step={1}
                    value={[thresholds[finger].pip.max]}
                    onValueChange={(value) => handleThresholdChange('pip', 'max', value[0])}
                    className="flex-1"
                  />
                </div>
              </div>
              
              {/* DIP Joint (tip joint) */}
              <div className="pt-3 pb-2 border-t border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-medium">{finger === 'thumb' ? 'IP (Tip)' : 'DIP (Tip Joint)'}</p>
                    <p className="text-[10px] text-white/60 mt-0.5">
                      The joint closest to the fingertip
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-80">
                      {currentAngles[finger].dip !== null 
                        ? `${Math.round(currentAngles[finger].dip as number)}°` 
                        : '--°'}
                    </span>
                    {getStatusBadge(finger, 'dip')}
                  </div>
                </div>
                
                {/* DIP Threshold sliders */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Straight Threshold</Label>
                    <span className="text-xs opacity-80">Below {thresholds[finger].dip.min}°</span>
                  </div>
                  <Slider
                    min={0}
                    max={30}
                    step={1}
                    value={[thresholds[finger].dip.min]}
                    onValueChange={(value) => handleThresholdChange('dip', 'min', value[0])}
                    className="flex-1"
                  />
                  
                  <div className="flex justify-between items-center mt-3">
                    <Label className="text-xs">Bent Threshold</Label>
                    <span className="text-xs opacity-80">Above {thresholds[finger].dip.max}°</span>
                  </div>
                  <Slider
                    min={30}
                    max={90}
                    step={1}
                    value={[thresholds[finger].dip.max]}
                    onValueChange={(value) => handleThresholdChange('dip', 'max', value[0])}
                    className="flex-1"
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        
        <div className="pt-2 text-[10px] italic opacity-60">
          Angle thresholds determine when a finger is considered straight or bent, 
          which can be used for gesture recognition and control inputs.
        </div>
      </div>
    </div>
  );
};

export default FingerFlexionSettings;