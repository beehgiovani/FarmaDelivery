import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initializeFirebaseAnalytics } from "./firebase";
import "./styles.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

void initializeFirebaseAnalytics();
