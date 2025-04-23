import { createRoot } from "react-dom/client";
import App from "./App";
import { Providers } from "./contexts";
import "./index.css";

// Load OpenCV.js from CDN - we just reference it here, actual loading will happen in worker
document.head.innerHTML += `
  <title>Camera Feed with OpenCV Processing</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
`;

createRoot(document.getElementById("root")!).render(
  <Providers>
    <App />
  </Providers>
);
