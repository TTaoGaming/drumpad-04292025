import { EventType, dispatch } from './eventBus';
import { Point } from './types';

// Define marker states
export enum MarkerState {
  DEFAULT = 'DEFAULT',
  TAP = 'TAP',
  ENGAGED = 'ENGAGED',
  RELEASE = 'RELEASE',
}

// Letter codes for state visualization
export const StateLetterCode = {
  [MarkerState.DEFAULT]: 'D',
  [MarkerState.TAP]: 'T',
  [MarkerState.ENGAGED]: 'E',
  [MarkerState.RELEASE]: 'R',
};

// Marker state data
interface MarkerStateData {
  id: string;
  state: MarkerState;
  position: Point;
  lastPosition: Point;
  stateEnteredAt: number;
  occludedAt?: number;
  engagementDuration: number;  // Time threshold for TAP -> ENGAGED
  releaseTimeout: number;      // How long to show RELEASE state
  touchedRecently: boolean;
}

// Configuration options
export interface MarkerStateConfig {
  engagementDuration: number;  // milliseconds before TAP becomes ENGAGED
  releaseTimeout: number;      // milliseconds to show RELEASE state
}

export class MarkerStateManager {
  private static instance: MarkerStateManager;
  private markerStates: Map<string, MarkerStateData> = new Map();
  
  // Default configuration
  private config: MarkerStateConfig = {
    engagementDuration: 500, // 500ms for TAP -> ENGAGED transition
    releaseTimeout: 300,     // 300ms for RELEASE state duration
  };
  
  private constructor() {
    // Private constructor for singleton
  }
  
  static getInstance(): MarkerStateManager {
    if (!MarkerStateManager.instance) {
      MarkerStateManager.instance = new MarkerStateManager();
    }
    return MarkerStateManager.instance;
  }
  
  // Update configuration
  updateConfig(config: Partial<MarkerStateConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[MarkerStateManager] Updated configuration:', this.config);
  }
  
  // Get state letter code for a marker
  getStateLetterCode(markerId: string): string {
    const markerData = this.markerStates.get(markerId);
    if (!markerData) return StateLetterCode[MarkerState.DEFAULT];
    return StateLetterCode[markerData.state];
  }
  
  // Update a marker's state based on tracking results
  updateMarkerState(roiId: string, data: any): { id: string; state: MarkerState; stateCode: string } {
    const now = Date.now();
    let markerData = this.markerStates.get(roiId);
    
    if (!markerData) {
      // Initialize new marker data
      markerData = {
        id: roiId,
        state: MarkerState.DEFAULT,
        position: data.centerOfMass || { x: 0.5, y: 0.5 },
        lastPosition: data.centerOfMass || { x: 0.5, y: 0.5 },
        stateEnteredAt: now,
        engagementDuration: this.config.engagementDuration,
        releaseTimeout: this.config.releaseTimeout,
        touchedRecently: false
      };
      this.markerStates.set(roiId, markerData);
    }
    
    // Update position if available
    if (data.centerOfMass) {
      markerData.lastPosition = { ...markerData.position };
      markerData.position = data.centerOfMass;
    }
    
    // Handle state transitions
    let newState = markerData.state;
    
    switch (markerData.state) {
      case MarkerState.DEFAULT:
        // If marker becomes occluded, transition to TAP
        if (data.isOccluded) {
          newState = MarkerState.TAP;
          markerData.occludedAt = now;
        }
        break;
        
      case MarkerState.TAP:
        // If marker is no longer occluded, go back to DEFAULT
        if (!data.isOccluded) {
          newState = MarkerState.DEFAULT;
        } 
        // If marker has been in TAP state for engagementDuration, transition to ENGAGED
        else if (now - markerData.stateEnteredAt >= markerData.engagementDuration) {
          newState = MarkerState.ENGAGED;
        }
        break;
        
      case MarkerState.ENGAGED:
        // If marker is no longer occluded, transition to RELEASE
        if (!data.isOccluded) {
          newState = MarkerState.RELEASE;
        }
        break;
        
      case MarkerState.RELEASE:
        // After releaseTimeout, go back to DEFAULT
        if (now - markerData.stateEnteredAt >= markerData.releaseTimeout) {
          newState = MarkerState.DEFAULT;
        }
        break;
    }
    
    // If state has changed, update and dispatch event
    if (newState !== markerData.state) {
      const prevState = markerData.state;
      markerData.state = newState;
      markerData.stateEnteredAt = now;
      
      // Dispatch state change event
      dispatch(EventType.MARKER_STATE_CHANGED, {
        markerId: roiId,
        prevState,
        newState,
        position: markerData.position,
        stateCode: StateLetterCode[newState]
      });
      
      console.log(`[MarkerStateManager] Marker ${roiId} state changed: ${prevState} -> ${newState}`);
    }
    
    return {
      id: roiId,
      state: markerData.state,
      stateCode: StateLetterCode[markerData.state]
    };
  }
  
  // Get the current state of a marker
  getMarkerState(markerId: string): MarkerState {
    const markerData = this.markerStates.get(markerId);
    if (!markerData) return MarkerState.DEFAULT;
    return markerData.state;
  }
  
  // Reset a marker's state to DEFAULT
  resetMarkerState(markerId: string): void {
    const markerData = this.markerStates.get(markerId);
    if (markerData) {
      const prevState = markerData.state;
      markerData.state = MarkerState.DEFAULT;
      markerData.stateEnteredAt = Date.now();
      
      dispatch(EventType.MARKER_STATE_CHANGED, {
        markerId,
        prevState,
        newState: MarkerState.DEFAULT,
        position: markerData.position,
        stateCode: StateLetterCode[MarkerState.DEFAULT]
      });
    }
  }
  
  // Clear all marker states
  clearAllMarkerStates(): void {
    this.markerStates.clear();
  }
}

// Export singleton instance
export default MarkerStateManager.getInstance(); 