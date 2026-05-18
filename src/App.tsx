import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";

function App() {
  useEffect(() => {
    const viewerParams = new URLSearchParams(window.location.search);
    if (!viewerParams.has("v")) {
      viewerParams.set("v", String(Date.now()));
    }
    window.location.replace(`/viewer/?${viewerParams.toString()}`);
  }, []);

  return (
    <main className="redirect-shell">
      <div className="redirect-card">
        <p>Opening Project Management Board...</p>
      </div>
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found.");
}

createRoot(root).render(<App />);
