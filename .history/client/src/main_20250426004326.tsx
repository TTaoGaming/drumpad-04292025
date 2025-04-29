import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Don't load OpenCV.js here - it should be loaded in the worker
document.head.innerHTML += `
  <title>Camera Feed with OpenCV Processing</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
`;

createRoot(document.getElementById("root")!).render(<App />);
