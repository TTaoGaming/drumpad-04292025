import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Info, RotateCw, Settings } from 'lucide-react';

const GettingStartedSettings: React.FC = () => {
  return (
    <div className="space-y-4">
      <h4 className="text-md font-medium mb-2">Getting Started</h4>
      
      <div className="space-y-4">
        <Card className="bg-black/20 border-0">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Camera className="h-5 w-5 mt-0.5 text-blue-400" />
              <div>
                <h5 className="font-medium text-sm">Step 1: Start the Camera</h5>
                <p className="text-xs text-white/70 mt-1">
                  Begin by clicking the "Start Camera" button in the control panel.
                  Allow camera permissions when prompted by your browser.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-black/20 border-0">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Settings className="h-5 w-5 mt-0.5 text-green-400" />
              <div>
                <h5 className="font-medium text-sm">Step 2: Configure Settings</h5>
                <p className="text-xs text-white/70 mt-1">
                  Adjust tracking and visualization settings based on your needs.
                  Each tab contains different configuration options.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-black/20 border-0">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <RotateCw className="h-5 w-5 mt-0.5 text-purple-400" />
              <div>
                <h5 className="font-medium text-sm">Step 3: Use the Application</h5>
                <p className="text-xs text-white/70 mt-1">
                  Once configured, your movements will be tracked and responded to 
                  according to your settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-center mt-4">
          <Button 
            variant="outline" 
            size="sm"
            className="text-xs bg-white/10 border-white/20 hover:bg-white/20"
          >
            <Info className="mr-1 h-3 w-3" />
            View Full Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GettingStartedSettings;