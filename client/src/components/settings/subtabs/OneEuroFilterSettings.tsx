import React, { useState, useEffect } from 'react';
import { DEFAULT_FILTER_OPTIONS } from '@/lib/oneEuroFilter';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { EventType, dispatch } from '@/lib/eventBus';
import { RotateCcw } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface FilterSettings {
  minCutoff: number;
  beta: number;
  dcutoff: number;
}

// Define filter presets
const PRESETS = {
  responsive: {
    name: "Responsive",
    description: "Default setting optimized for quick movements like finger drumming",
    settings: {
      minCutoff: 2.0,
      beta: 0.01,
      dcutoff: 1.5
    }
  },
  balanced: {
    name: "Balanced",
    description: "Moderate smoothing with decent responsiveness",
    settings: {
      minCutoff: 1.0,
      beta: 0.007,
      dcutoff: 1.0
    }
  },
  smooth: {
    name: "Smooth",
    description: "Maximum smoothing, better for precise slow movements",
    settings: {
      minCutoff: 0.5, 
      beta: 0.004,
      dcutoff: 0.7
    }
  },
  custom: {
    name: "Custom",
    description: "Your own custom filter settings",
    settings: { ...DEFAULT_FILTER_OPTIONS }
  }
};

const OneEuroFilterSettings: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [activePreset, setActivePreset] = useState<'balanced' | 'smooth' | 'responsive' | 'custom'>('responsive');
  const [minCutoff, setMinCutoff] = useState(PRESETS.responsive.settings.minCutoff);
  const [beta, setBeta] = useState(PRESETS.responsive.settings.beta);
  const [dcutoff, setDcutoff] = useState(PRESETS.responsive.settings.dcutoff);
  const [isCustomMode, setIsCustomMode] = useState(false);
  
  // Update parent component when settings change
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'filters',
      setting: 'oneEuro',
      value: {
        enabled: isEnabled,
        preset: activePreset,
        params: { minCutoff, beta, dcutoff }
      }
    });
  }, [isEnabled, activePreset, minCutoff, beta, dcutoff]);
  
  // Apply preset settings
  const applyPreset = (preset: 'balanced' | 'smooth' | 'responsive' | 'custom') => {
    if (preset === 'custom') {
      setIsCustomMode(true);
      // Keep current values when switching to custom
    } else {
      setIsCustomMode(false);
      const settings = PRESETS[preset].settings;
      setMinCutoff(settings.minCutoff);
      setBeta(settings.beta);
      setDcutoff(settings.dcutoff);
    }
    setActivePreset(preset);
  };
  
  // Reset to default responsive values
  const handleReset = () => {
    applyPreset('responsive');
  };

  // Set value and switch to custom mode when sliders are used
  const handleCustomValueChange = (setter: Function, value: number) => {
    setter(value);
    if (!isCustomMode) {
      setIsCustomMode(true);
      setActivePreset('custom');
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h5 className="text-sm font-medium">1€ Filter</h5>
          <p className="text-xs text-white/70">Smooth hand movements</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 text-white/70 hover:text-white"
            onClick={handleReset}
            title="Reset to defaults"
          >
            <RotateCcw size={12} />
          </Button>
          <Switch 
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>
      </div>
      
      <div className={isEnabled ? "space-y-5" : "space-y-5 opacity-50 pointer-events-none"}>
        {/* Presets Section */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Filter Presets</Label>
          <RadioGroup 
            value={activePreset} 
            onValueChange={(value) => applyPreset(value as any)}
            className="gap-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="responsive" id="responsive" className="h-3 w-3" />
              <Label htmlFor="responsive" className="text-xs font-medium">
                Responsive
                <span className="ml-1 text-[10px] text-white/60 font-normal">
                  (Default)
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="balanced" id="balanced" className="h-3 w-3" />
              <Label htmlFor="balanced" className="text-xs font-medium">
                Balanced
                <span className="ml-1 text-[10px] text-white/60 font-normal">
                  (Moderate)
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="smooth" id="smooth" className="h-3 w-3" />
              <Label htmlFor="smooth" className="text-xs font-medium">
                Smooth
                <span className="ml-1 text-[10px] text-white/60 font-normal">
                  (Maximum filtering)
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" className="h-3 w-3" />
              <Label htmlFor="custom" className="text-xs font-medium">
                Custom
                <span className="ml-1 text-[10px] text-white/60 font-normal">
                  (Advanced)
                </span>
              </Label>
            </div>
          </RadioGroup>
          <p className="text-[10px] opacity-70">
            {PRESETS[activePreset].description}
          </p>
        </div>
        
        {/* Divider */}
        <div className="border-t border-white/10 pt-1">
          <h6 className="text-xs font-medium mb-2">Advanced Parameters</h6>
        </div>
        
        {/* Min Cutoff */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="minCutoff" className="text-xs">Min Cutoff</Label>
            <span className="text-xs opacity-80">{minCutoff.toFixed(2)}</span>
          </div>
          <div className="flex gap-2 items-center">
            <Slider
              id="minCutoff"
              min={0.1}
              max={5.0}
              step={0.1}
              value={[minCutoff]}
              onValueChange={(value) => handleCustomValueChange(setMinCutoff, value[0])}
              className="flex-1"
            />
            <Input
              type="number"
              value={minCutoff}
              onChange={(e) => handleCustomValueChange(setMinCutoff, parseFloat(e.target.value) || 0.1)}
              className="w-14 h-7 text-xs text-center bg-black/50"
              min={0.1}
              max={5.0}
              step={0.1}
            />
          </div>
          <p className="text-[10px] opacity-70">
            Lower values = smoother but more lag
          </p>
        </div>
        
        {/* Beta */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="beta" className="text-xs">Speed Coefficient (Beta)</Label>
            <span className="text-xs opacity-80">{beta.toFixed(3)}</span>
          </div>
          <div className="flex gap-2 items-center">
            <Slider
              id="beta"
              min={0.001}
              max={0.1}
              step={0.001}
              value={[beta]}
              onValueChange={(value) => handleCustomValueChange(setBeta, value[0])}
              className="flex-1"
            />
            <Input
              type="number"
              value={beta}
              onChange={(e) => handleCustomValueChange(setBeta, parseFloat(e.target.value) || 0.001)}
              className="w-14 h-7 text-xs text-center bg-black/50"
              min={0.001}
              max={0.1}
              step={0.001}
            />
          </div>
          <p className="text-[10px] opacity-70">
            Higher values = less lag on fast movements
          </p>
        </div>
        
        {/* Dcutoff */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="dcutoff" className="text-xs">Derivative Cutoff</Label>
            <span className="text-xs opacity-80">{dcutoff.toFixed(2)}</span>
          </div>
          <div className="flex gap-2 items-center">
            <Slider
              id="dcutoff"
              min={0.1}
              max={5.0}
              step={0.1}
              value={[dcutoff]}
              onValueChange={(value) => handleCustomValueChange(setDcutoff, value[0])}
              className="flex-1"
            />
            <Input
              type="number"
              value={dcutoff}
              onChange={(e) => handleCustomValueChange(setDcutoff, parseFloat(e.target.value) || 0.1)}
              className="w-14 h-7 text-xs text-center bg-black/50"
              min={0.1}
              max={5.0}
              step={0.1}
            />
          </div>
          <p className="text-[10px] opacity-70">
            Smoothing for speed calculation
          </p>
        </div>
      </div>
      
      <div className="pt-2 text-[10px] italic opacity-60">
        The 1€ Filter reduces jitter while preserving quick movements.
      </div>
    </div>
  );
};

export default OneEuroFilterSettings;