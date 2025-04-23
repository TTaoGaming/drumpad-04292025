import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Load OpenCV.js from CDN - using stable version 4.8.0 instead of master branch
document.head.innerHTML += `
  <title>Camera Feed with OpenCV Processing</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
`;

// Load OpenCV.js
function loadOpenCV() {
  return new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.setAttribute('async', 'true');
    script.setAttribute('type', 'text/javascript');
    // Use a stable version (4.8.0) instead of master which might have breaking changes
    script.setAttribute('src', 'https://docs.opencv.org/4.8.0/opencv.js');
    script.onload = () => {
      console.log('OpenCV.js loaded and ready in main thread');
      window.dispatchEvent(new Event('opencv-ready'));
      resolve();
    };
    document.head.appendChild(script);
  });
}

// Load OpenCV immediately
loadOpenCV();

createRoot(document.getElementById("root")!).render(<App />);
