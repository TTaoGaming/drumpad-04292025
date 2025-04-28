/**
 * Hand Confidence Settings Component
 * 
 * Allows users to configure confidence thresholds for hand detection and tracking.
 */
import React, { useState, useEffect } from 'react';
import { Separator } from '../../ui/separator';
import { Slider } from '../../ui/slider';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { addListener, dispatch, EventType } from '@/lib/eventBus';

const HandConfidenceSettings = () => {
  // Hand detection confidence settings
  const [settings, setSettings] = useState({
    enabled: true, // Whether to use confidence filtering
    detectionConfidence: 0.5, // MediaPipe detection confidence threshold (0-1)
    trackingConfidence: 0.5, // MediaPipe tracking confidence threshold (0-1)
    handPresenceThreshold: 0.7, // Threshold for considering a hand detection valid
    requiredLandmarks: 18, // Minimum number of valid landmarks required (out of 21)
    stabilityFrames: 3, // Number of frames to confirm a hand presence state change
  });

  // Hand presence state from the tracker
  const [handPresence, setHandPresence] = useState({
    isHandPresent: false,
    confidence: 0,
    validLandmarks: 0
  });

  // Listen for hand presence updates from the tracker
  useEffect(() => {
    const handPresenceListener = addListener(
      EventType.SETTINGS_VALUE_CHANGE,
      (data) => {
        if (data.section === 'hands' && data.setting === 'handPresence') {
          setHandPresence(data.value);
        }
      }
    );
    
    return () => {
      handPresenceListener.remove();
    };
  }, []);

  // Update settings in the tracker when changed
  useEffect(() => {
    // Dispatch event to update settings in the tracker
    dispatch(EventType.SETTINGS_VALUE_CHANGE, {
      section: 'hands',
      setting: 'confidenceSettings',
      value: settings
    });
  }, [settings]);

  // Handle toggle for enabled state
  const handleEnabledToggle = (checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      enabled: checked
    }));
  };

  // Handle detection confidence change
  const handleDetectionConfidenceChange = (value: number[]) => {
    setSettings(prev => ({
      ...prev,
      detectionConfidence: value[0]
    }));
  };

  // Handle tracking confidence change
  const handleTrackingConfidenceChange = (value: number[]) => {
    setSettings(prev => ({
      ...prev,
      trackingConfidence: value[0]
    }));
  };

  // Handle hand presence threshold change
  const handleHandPresenceThresholdChange = (value: number[]) => {
    setSettings(prev => ({
      ...prev,
      handPresenceThreshold: value[0]
    }));
  };

  // Handle required landmarks change
  const handleRequiredLandmarksChange = (value: number[]) => {
    setSettings(prev => ({
      ...prev,
      requiredLandmarks: Math.round(value[0])
    }));
  };

  // Handle stability frames change
  const handleStabilityFramesChange = (value: number[]) => {
    setSettings(prev => ({
      ...prev,
      stabilityFrames: Math.round(value[0])
    }));
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Hand Confidence Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure thresholds to improve hand detection accuracy and reduce false positives.
        </p>
      </div>
      
      <Separator />
      
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Enable Confidence Filtering</Label>
          <p className="text-xs text-muted-foreground">
            Filter out low-confidence hand detections to reduce false positives
          </p>
        </div>
        <Switch 
          checked={settings.enabled} 
          onCheckedChange={handleEnabledToggle}
        />
      </div>
      
      {settings.enabled && (
        <>
          {/* Detection Confidence Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Detection Confidence</Label>
              <span className="text-sm">{settings.detectionConfidence.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.detectionConfidence]}
              min={0.1}
              max={0.9}
              step={0.05}
              onValueChange={handleDetectionConfidenceChange}
            />
            <p className="text-xs text-muted-foreground">
              Confidence threshold for initial hand detection (higher = fewer false positives, less sensitivity)
            </p>
          </div>
          
          {/* Tracking Confidence Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tracking Confidence</Label>
              <span className="text-sm">{settings.trackingConfidence.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.trackingConfidence]}
              min={0.1}
              max={0.9}
              step={0.05}
              onValueChange={handleTrackingConfidenceChange}
            />
            <p className="text-xs text-muted-foreground">
              Confidence threshold for continuing to track a detected hand (higher = more stable tracking)
            </p>
          </div>
          
          {/* Hand Presence Threshold Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Hand Presence Threshold</Label>
              <span className="text-sm">{settings.handPresenceThreshold.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.handPresenceThreshold]}
              min={0.3}
              max={0.95}
              step={0.05}
              onValueChange={handleHandPresenceThresholdChange}
            />
            <p className="text-xs text-muted-foreground">
              Threshold for considering a hand detection valid (higher = fewer false detections)
            </p>
          </div>
          
          {/* Required Landmarks Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Required Valid Landmarks</Label>
              <span className="text-sm">{settings.requiredLandmarks} / 21</span>
            </div>
            <Slider
              value={[settings.requiredLandmarks]}
              min={10}
              max={21}
              step={1}
              onValueChange={handleRequiredLandmarksChange}
            />
            <p className="text-xs text-muted-foreground">
              Minimum number of valid landmarks required for a hand to be considered present
            </p>
          </div>
          
          {/* Stability Frames Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Stability Frames</Label>
              <span className="text-sm">{settings.stabilityFrames}</span>
            </div>
            <Slider
              value={[settings.stabilityFrames]}
              min={1}
              max={10}
              step={1}
              onValueChange={handleStabilityFramesChange}
            />
            <p className="text-xs text-muted-foreground">
              Number of consistent frames required to change hand presence state (higher = more stable but more latency)
            </p>
          </div>
          
          {/* Current Hand State Display */}
          <div className="bg-secondary p-4 rounded-md">
            <div className="mb-2 font-semibold">Current Hand Status</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <div className="text-sm">State:</div>
                <div className={`font-mono px-2 py-1 rounded ${handPresence.isHandPresent 
                  ? 'bg-green-500/20 text-green-500' 
                  : 'bg-red-500/20 text-red-500'}`}>
                  {handPresence.isHandPresent ? 'DETECTED' : 'NONE'}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm">Landmarks:</div>
                <div className="font-mono px-2 py-1 rounded bg-primary/20">
                  {handPresence.validLandmarks}/21
                </div>
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <div className="text-sm">Confidence:</div>
                <div className="font-mono px-2 py-1 rounded bg-primary/20 flex-1">
                  <div className="w-full bg-gray-300 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${handPresence.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HandConfidenceSettings;