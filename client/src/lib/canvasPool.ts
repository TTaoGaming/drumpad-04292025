/**
 * Canvas Pool Utility
 * 
 * Provides a reusable pool of canvas elements to reduce memory allocations
 * and garbage collection pressure in real-time processing.
 */

// Store pre-created canvas elements that can be reused
const canvasPool: HTMLCanvasElement[] = [];
const contextPool = new Map<HTMLCanvasElement, CanvasRenderingContext2D>();

// Maximum size of the pool to prevent excessive memory usage
const MAX_POOL_SIZE = 10;

/**
 * Get a canvas from the pool or create a new one if none are available
 * @param width Desired width of the canvas
 * @param height Desired height of the canvas
 * @returns A canvas element with the specified dimensions
 */
export function getCanvas(width: number, height: number): HTMLCanvasElement {
  let canvas = canvasPool.pop();
  
  if (!canvas) {
    canvas = document.createElement('canvas');
    // Create and store the context to avoid repeated calls to getContext
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      contextPool.set(canvas, ctx);
    }
  }
  
  // Set dimensions (even if reused, we need to ensure correct dimensions)
  canvas.width = width;
  canvas.height = height;
  
  return canvas;
}

/**
 * Get the 2D context for a canvas from the pool
 * This is faster than repeatedly calling getContext()
 * @param canvas Canvas element to get context for
 * @returns The 2D rendering context
 */
export function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = contextPool.get(canvas);
  if (ctx) {
    return ctx;
  }
  
  // If context isn't in the pool, get it directly and store it
  const newCtx = canvas.getContext('2d', { willReadFrequently: true });
  if (newCtx) {
    contextPool.set(canvas, newCtx);
    return newCtx;
  }
  
  return null;
}

/**
 * Return a canvas to the pool for reuse
 * @param canvas Canvas element to return to the pool
 */
export function returnCanvas(canvas: HTMLCanvasElement): void {
  // Only add to pool if we haven't reached maximum size
  if (canvasPool.length < MAX_POOL_SIZE) {
    // Clear the canvas to free memory and prevent visual artifacts
    const ctx = getContext(canvas);
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvasPool.push(canvas);
  }
  // If pool is full, let the canvas be garbage collected
}

/**
 * Create ImageData with pooled canvas
 * Efficiently creates ImageData without allocating a new canvas each time
 * @param width Width of the ImageData to create
 * @param height Height of the ImageData to create
 * @returns New ImageData object
 */
export function createImageData(width: number, height: number): ImageData | null {
  const canvas = getCanvas(width, height);
  const ctx = getContext(canvas);
  
  if (!ctx) return null;
  
  const imageData = ctx.createImageData(width, height);
  returnCanvas(canvas);
  
  return imageData;
}