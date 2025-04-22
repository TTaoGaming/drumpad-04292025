import React, { useState, useEffect } from 'react';
import { DEFAULT_FILTER_OPTIONS } from '@/lib/oneEuroFilter';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';

interface FilterSettingsPanelProps {
  onSettingsChange: (settings: {
    minCutoff: number;
    beta: number;
    dcutoff: number;
  }) => void;
}

const FilterSettingsPanel: React.FC<FilterSettingsPanelProps> = ({ onSettingsChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [minCutoff, setMinCutoff] = useState(DEFAULT_FILTER_OPTIONS.minCutoff);
  const [beta, setBeta] = useState(DEFAULT_FILTER_OPTIONS.beta);
  const [dcutoff, setDcutoff] = useState(DEFAULT_FILTER_OPTIONS.dcutoff);
  
  // Update parent component when settings change
  useEffect(() => {
    onSettingsChange({ minCutoff, beta, dcutoff });
  }, [minCutoff, beta, dcutoff, onSettingsChange]);
  
  // Reset to default values
  const handleReset = () => {
    setMinCutoff(DEFAULT_FILTER_OPTIONS.minCutoff);
    setBeta(DEFAULT_FILTER_OPTIONS.beta);
    setDcutoff(DEFAULT_FILTER_OPTIONS.dcutoff);
  };
  
  return (
    <div className={`fixed right-0 top-1/4 transform transition-transform duration-300 z-30 
      ${isOpen ? 'translate-x-0' : 'translate-x-[calc(100%-40px)]'}`}>
      
      {/* Toggle button */}
      <Button 
        variant="default"
        size="icon"
        className="absolute left-0 top-4 h-10 w-10 shadow-lg rounded-l-md rounded-r-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronRight size={20} /> : <Settings size={20} />}
      </Button>
      
      {/* Panel */}
      <div className="bg-black/80 backdrop-blur-sm text-white p-4 rounded-l-lg shadow-lg w-80">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg">1€ Filter Settings</h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleReset}
            className="text-xs"
          >
            Reset
          </Button>
        </div>
        
        <div className="space-y-6">
          {/* Min Cutoff */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="minCutoff">Min Cutoff Frequency</Label>
              <span className="text-sm opacity-80">{minCutoff.toFixed(2)}</span>
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
                className="w-16 text-xs text-center bg-black/50"
                min={0.1}
                max={5.0}
                step={0.1}
              />
            </div>
            <p className="text-xs opacity-70">
              Lower values = smoother but more lag (0.1 to 5.0)
            </p>
          </div>
          
          {/* Beta */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="beta">Speed Coefficient (Beta)</Label>
              <span className="text-sm opacity-80">{beta.toFixed(3)}</span>
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
                className="w-16 text-xs text-center bg-black/50"
                min={0.001}
                max={0.1}
                step={0.001}
              />
            </div>
            <p className="text-xs opacity-70">
              Higher values = less lag on fast movements (0.001 to 0.1)
            </p>
          </div>
          
          {/* Dcutoff */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="dcutoff">Derivative Cutoff</Label>
              <span className="text-sm opacity-80">{dcutoff.toFixed(2)}</span>
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
                className="w-16 text-xs text-center bg-black/50"
                min={0.1}
                max={5.0}
                step={0.1}
              />
            </div>
            <p className="text-xs opacity-70">
              Smoothing for speed calculation (0.1 to 5.0)
            </p>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-white/20 text-xs opacity-70">
          <p>
            The 1€ Filter reduces jitter while preserving quick movements.
            It adapts smoothing based on motion speed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FilterSettingsPanel;