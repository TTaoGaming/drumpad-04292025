import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Load OpenCV.js from CDN 
document.head.innerHTML += `
  <title>Camera Feed with OpenCV Processing</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <script async src="https://docs.opencv.org/master/opencv.js" onload="onOpenCVReady();" type="text/javascript"></script>
`;

// Define global OpenCV ready callback
(window as any).onOpenCVReady = () => {
  console.log('OpenCV.js loaded and ready in main thread');
  window.dispatchEvent(new Event('opencv-ready'));
};

createRoot(document.getElementById("root")!).render(<App />);
