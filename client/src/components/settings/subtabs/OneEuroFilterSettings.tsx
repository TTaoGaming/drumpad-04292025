import React, { useState, useEffect } from 'react';
import { DEFAULT_FILTER_OPTIONS } from '@/lib/oneEuroFilter';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { EventType, dispatch } from '@/lib/eventBus';
import { RotateCcw } from 'lucide-react';

interface FilterSettings {
  minCutoff: number;
  beta: number;
  dcutoff: number;
}

const OneEuroFilterSettings: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [minCutoff, setMinCutoff] = useState(DEFAULT_FILTER_OPTIONS.minCutoff);
  const [beta, setBeta] = useState(DEFAULT_FILTER_OPTIONS.beta);
  const [dcutoff, setDcutoff] = useState(DEFAULT_FILTER_OPTIONS.dcutoff);
  
  // Update parent component when settings change
  useEffect(() => {
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'filters',
      setting: 'oneEuroFilter',
      value: {
        enabled: isEnabled,
        params: { minCutoff, beta, dcutoff }
      }
    });
  }, [isEnabled, minCutoff, beta, dcutoff]);
  
  // Reset to default values
  const handleReset = () => {
    setMinCutoff(DEFAULT_FILTER_OPTIONS.minCutoff);
    setBeta(DEFAULT_FILTER_OPTIONS.beta);
    setDcutoff(DEFAULT_FILTER_OPTIONS.dcutoff);
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
              onValueChange={(value) => setMinCutoff(value[0])}
              className="flex-1"
            />
            <Input
              type="number"
              value={minCutoff}
              onChange={(e) => setMinCutoff(parseFloat(e.target.value) || 0.1)}
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
              onValueChange={(value) => setBeta(value[0])}
              className="flex-1"
            />
            <Input
              type="number"
              value={beta}
              onChange={(e) => setBeta(parseFloat(e.target.value) || 0.001)}
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
              onValueChange={(value) => setDcutoff(value[0])}
              className="flex-1"
            />
            <Input
              type="number"
              value={dcutoff}
              onChange={(e) => setDcutoff(parseFloat(e.target.value) || 0.1)}
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