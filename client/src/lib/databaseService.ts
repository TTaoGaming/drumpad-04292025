import { apiRequest } from './queryClient';
import type { 
  HandData, 
  PerformanceMetrics 
} from './types';

/**
 * Service for interacting with the database API
 */

// Initialize a demo user
let currentUserId: number | null = null;

// Initialize tracking session
let currentTrackingSessionId: number | null = null;
let frameCounter = 0;

/**
 * Initialize the database service by creating a demo user if one doesn't exist
 */
export async function initializeDatabaseService(): Promise<void> {
  try {
    // Create a demo user
    const response = await apiRequest('/api/users', {
      method: 'POST',
    });
    
    if (response.ok) {
      const user = await response.json();
      currentUserId = user.id;
      console.log('Database service initialized with user ID:', currentUserId);
    } else {
      console.error('Failed to initialize database service:', await response.text());
    }
  } catch (error) {
    console.error('Error initializing database service:', error);
  }
}

/**
 * Start a new tracking session
 * @param name Optional name for the session
 * @returns The tracking session ID
 */
export async function startTrackingSession(name?: string): Promise<number | null> {
  if (!currentUserId) {
    console.error('Cannot start tracking session: No user ID');
    return null;
  }
  
  try {
    frameCounter = 0;
    
    const data = {
      userId: currentUserId,
      name: name || `Session ${new Date().toISOString()}`
    };
    
    const response = await apiRequest('/api/tracking-sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      const session = await response.json();
      currentTrackingSessionId = session.id;
      console.log('Started tracking session with ID:', currentTrackingSessionId);
      return currentTrackingSessionId;
    } else {
      console.error('Failed to start tracking session:', await response.text());
      return null;
    }
  } catch (error) {
    console.error('Error starting tracking session:', error);
    return null;
  }
}

/**
 * End a tracking session
 * @param duration Duration of the session in seconds
 * @param notes Optional notes for the session
 */
export async function endTrackingSession(duration?: number, notes?: string): Promise<void> {
  if (!currentTrackingSessionId) {
    console.error('Cannot end tracking session: No session ID');
    return;
  }
  
  try {
    const data = {
      endTime: new Date(),
      duration,
      notes
    };
    
    const response = await apiRequest(`/api/tracking-sessions/${currentTrackingSessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      console.log('Ended tracking session with ID:', currentTrackingSessionId);
      currentTrackingSessionId = null;
      frameCounter = 0;
    } else {
      console.error('Failed to end tracking session:', await response.text());
    }
  } catch (error) {
    console.error('Error ending tracking session:', error);
  }
}

/**
 * Save hand landmark data for the current tracking session
 * @param handData Hand landmark data
 * @param performanceMetrics Performance metrics
 */
export async function saveHandLandmarkData(
  handData: HandData, 
  performanceMetrics?: PerformanceMetrics
): Promise<void> {
  if (!currentTrackingSessionId) {
    console.warn('Cannot save hand landmark data: No active tracking session');
    return;
  }
  
  try {
    const frameNumber = ++frameCounter;
    
    const data = {
      sessionId: currentTrackingSessionId,
      frameNumber,
      handLandmarks: handData.landmarks,
      connections: handData.connections,
      performanceMetrics,
      averageFps: performanceMetrics?.estimatedFps
    };
    
    const response = await apiRequest('/api/hand-landmark-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      console.error('Failed to save hand landmark data:', await response.text());
    }
  } catch (error) {
    console.error('Error saving hand landmark data:', error);
  }
}

/**
 * Create a new region of interest
 * @param name Name of the region
 * @param boundingBox Bounding box coordinates (x, y, width, height)
 */
export async function createRegionOfInterest(
  name: string,
  boundingBox: { x: number, y: number, width: number, height: number }
): Promise<void> {
  if (!currentTrackingSessionId) {
    console.error('Cannot create region of interest: No active tracking session');
    return;
  }
  
  try {
    const data = {
      sessionId: currentTrackingSessionId,
      name,
      boundingBox
    };
    
    const response = await apiRequest('/api/regions-of-interest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      console.error('Failed to create region of interest:', await response.text());
    }
  } catch (error) {
    console.error('Error creating region of interest:', error);
  }
}

/**
 * Get all regions of interest for the current tracking session
 * @returns Array of regions of interest
 */
export async function getRegionsOfInterest(): Promise<any[]> {
  if (!currentTrackingSessionId) {
    console.warn('Cannot get regions of interest: No active tracking session');
    return [];
  }
  
  try {
    const response = await apiRequest(
      `/api/tracking-sessions/${currentTrackingSessionId}/regions-of-interest`,
      { method: 'GET' }
    );
    
    if (response.ok) {
      return await response.json();
    } else {
      console.error('Failed to get regions of interest:', await response.text());
      return [];
    }
  } catch (error) {
    console.error('Error getting regions of interest:', error);
    return [];
  }
}