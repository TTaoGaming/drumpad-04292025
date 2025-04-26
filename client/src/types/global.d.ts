// Global declarations for TypeScript

// Extend Window interface to include OpenCV and custom properties
interface Window {
  cv: any;
  _tracking_timeout_set?: boolean;
}