// Type definitions for OpenCV.js
declare namespace cv {
  const CV_8UC1: number;
  const CV_32SC2: number;
  const COLOR_RGBA2GRAY: number;
  const FILLED: number;
  const ORB_HARRIS_SCORE: number;

  function matFromImageData(imageData: ImageData): Mat;
  function cvtColor(src: Mat, dst: Mat, code: number): void;
  function drawContours(image: Mat, contours: MatVector, contourIdx: number, color: Scalar, thickness: number): void;

  class Mat {
    rows: number;
    cols: number;
    data: Uint8Array | Int32Array | Float32Array;
    data32S: Int32Array;
    delete(): void;
    static zeros(rows: number, cols: number, type: number): Mat;
  }

  class MatVector {
    size(): number;
    push_back(mat: Mat): void;
    get(idx: number): Mat;
    delete(): void;
  }

  class Point {
    x: number;
    y: number;
    constructor(x: number, y: number);
  }

  class KeyPoint {
    pt: { x: number, y: number };
    size: number;
    angle: number;
    response: number;
    octave: number;
  }

  class KeyPointVector {
    size(): number;
    get(idx: number): KeyPoint;
    delete(): void;
  }

  class Scalar {
    constructor(v0: number, v1?: number, v2?: number, v3?: number);
  }

  class ORB {
    constructor(
      nfeatures: number, 
      scaleFactor: number, 
      nlevels: number, 
      edgeThreshold: number, 
      firstLevel: number, 
      WTA_K: number, 
      scoreType: number, 
      patchSize: number, 
      fastThreshold: number
    );
    detectAndCompute(image: Mat, mask: Mat, keypoints: KeyPointVector, descriptors: Mat): void;
    delete(): void;
  }
}

// Declare global cv object
declare const cv: typeof cv;

// Declare OpenCV ready callback
interface Window {
  onOpenCVReady: () => void;
}