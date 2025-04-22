/**
 * One Euro Filter Implementation
 * Based on the paper "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems"
 * 
 * This filter helps smooth jittery input signals (like hand tracking) while preserving quick movements.
 * It adjusts the cutoff frequency based on speed - slower movements get more smoothing.
 */

interface FilterOptions {
  // Minimum cutoff frequency
  minCutoff: number;
  
  // Speed coefficient (beta)
  // Higher values reduce lag for fast movements
  beta: number;
  
  // Cutoff slope
  // Controls how quickly the filter adjusts with motion speed
  dcutoff: number;
}

export interface OneEuroFilterState {
  x: number[];
  dx: number[];
  lastTime: number | null;
  rate: number;
}

/**
 * Default filter parameters, tuned for hand tracking
 */
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  // Minimum cutoff - lower values smooth more but increase lag
  minCutoff: 1.0,
  
  // Beta - higher values reduce lag on faster movements
  beta: 0.007,
  
  // Derivative cutoff - low-pass filter for speed (usually leave this alone)
  dcutoff: 1.0
};

/**
 * Low pass filter implementation
 */
class LowPassFilter {
  private x: number;
  private alpha: number = 0;
  private initialized: boolean = false;

  constructor() {
    this.x = 0;
  }

  /**
   * Sets the filter's alpha parameter
   * alpha is related to the cutoff frequency (fc): alpha = 1 / (1 + tau/dt) where tau = 1/(2*PI*fc)
   */
  public setAlpha(alpha: number): void {
    this.alpha = alpha;
  }

  /**
   * Filter the input value with the low-pass filter
   */
  public filter(value: number): number {
    if (!this.initialized) {
      this.x = value;
      this.initialized = true;
      return this.x;
    }
    
    // Weighted average between previous value and new value
    this.x = this.alpha * value + (1.0 - this.alpha) * this.x;
    return this.x;
  }

  /**
   * Get the current filter value without updating
   */
  public get value(): number {
    return this.x;
  }
  
  /**
   * Reset the filter
   */
  public reset(): void {
    this.initialized = false;
  }
}

/**
 * One Euro Filter implementation for smoothing noisy signals
 */
export class OneEuroFilter {
  private options: FilterOptions;
  private x: LowPassFilter = new LowPassFilter();
  private dx: LowPassFilter = new LowPassFilter();
  private lastTime: number | null = null;
  private rate: number = 1.0; // Default sample rate (s)
  
  constructor(options: Partial<FilterOptions> = {}) {
    // Apply default options with any overrides
    this.options = {
      ...DEFAULT_FILTER_OPTIONS,
      ...options
    };
  }
  
  /**
   * Calculate the alpha value for the low-pass filter based on cutoff frequency
   */
  private computeAlpha(cutoff: number): number {
    // Alpha calcuation based on cutoff frequency and timestep
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / this.rate;
    return 1.0 / (1.0 + tau / te);
  }
  
  /**
   * Update the filter with a new value and timestamp
   */
  public filter(value: number, timestamp?: number): number {
    // Use current time if no timestamp provided
    if (timestamp === undefined) {
      timestamp = performance.now() / 1000.0; // Convert to seconds
    }
    
    // Initialize time if this is the first call
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      this.x.setAlpha(1.0); // Pass through first value
      return this.x.filter(value);
    }
    
    // Calculate time delta and update sample rate
    const dt = timestamp - this.lastTime;
    if (dt > 0) this.rate = 1.0 / dt;
    this.lastTime = timestamp;
    
    // Calculate cutoff based on speed (derivative)
    const dvalue = this.dx.value === 0 ? 
      0.0 : (value - this.x.value) * this.rate;
      
    // Apply low-pass filter to derivative with fixed cutoff
    this.dx.setAlpha(this.computeAlpha(this.options.dcutoff));
    const edvalue = this.dx.filter(dvalue);
    
    // Adjust cutoff frequency based on movement speed
    const cutoff = this.options.minCutoff + this.options.beta * Math.abs(edvalue);
    
    // Apply adaptive low-pass filter to the position
    this.x.setAlpha(this.computeAlpha(cutoff));
    return this.x.filter(value);
  }
  
  /**
   * Update filter parameters
   */
  public updateOptions(options: Partial<FilterOptions>): void {
    this.options = {
      ...this.options,
      ...options
    };
  }
  
  /**
   * Reset the filter
   */
  public reset(): void {
    this.x.reset();
    this.dx.reset();
    this.lastTime = null;
  }
  
  /**
   * Get current filter state for saving/restoring
   */
  public getState(): { options: FilterOptions, lastTime: number | null } {
    return {
      options: { ...this.options },
      lastTime: this.lastTime
    };
  }
}

/**
 * Filter Factory for creating/managing multiple filters, such as x,y,z coordinates
 */
export class OneEuroFilterArray {
  private filters: OneEuroFilter[] = [];
  private dimensions: number;
  
  constructor(dimensions: number, options: Partial<FilterOptions> = {}) {
    this.dimensions = dimensions;
    
    // Create a filter for each dimension
    for (let i = 0; i < dimensions; i++) {
      this.filters.push(new OneEuroFilter(options));
    }
  }
  
  /**
   * Apply filters to an array of values
   */
  public filter(values: number[], timestamp?: number): number[] {
    if (values.length !== this.dimensions) {
      throw new Error(`Expected ${this.dimensions} values, got ${values.length}`);
    }
    
    // Apply each filter to its corresponding value
    return values.map((value, i) => this.filters[i].filter(value, timestamp));
  }
  
  /**
   * Update options for all filters
   */
  public updateOptions(options: Partial<FilterOptions>): void {
    this.filters.forEach(filter => filter.updateOptions(options));
  }
  
  /**
   * Reset all filters
   */
  public reset(): void {
    this.filters.forEach(filter => filter.reset());
  }
}