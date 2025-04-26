import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Load OpenCV.js from CDN
document.head.innerHTML += `
  <title>Camera Feed with OpenCV Processing</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <script async src="https://docs.opencv.org/master/opencv.js" onload="console.log('OpenCV.js loaded successfully')"></script>
`;

// Set up a check to verify OpenCV is loaded
const checkOpenCVReady = () => {
  if (window.cv && typeof window.cv.ORB === 'function') {
    console.log('OpenCV is ready with ORB support');
    document.dispatchEvent(new Event('opencv-ready'));
  } else {
    console.log('Waiting for OpenCV to load completely...');
    setTimeout(checkOpenCVReady, 500);
  }
};

// Start checking for OpenCV after a short delay
setTimeout(checkOpenCVReady, 1000);

createRoot(document.getElementById("root")!).render(<App />);
