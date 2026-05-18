import React from "react";
import { createRoot } from "react-dom/client";
import { Activity, ExternalLink, RefreshCcw } from "lucide-react";
import "./app.css";

function App() {
  const viewerParams = new URLSearchParams(window.location.search);
  viewerParams.set("v", String(Date.now()));
  const viewerUrl = `/viewer/?${viewerParams.toString()}`;

  return (
    <main className="board-shell">
      <header className="board-header">
        <div className="board-title">
          <Activity aria-hidden="true" />
          <div>
            <p>Project Management Board</p>
            <h1>Scratchpad Measurement Dashboard</h1>
          </div>
        </div>
        <nav className="board-actions" aria-label="Dashboard actions">
          <a href="/viewer/" target="dashboard-frame">
            <RefreshCcw aria-hidden="true" />
            Reload
          </a>
          <a href="/viewer/" target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            Open
          </a>
        </nav>
      </header>

      <iframe
        className="dashboard-frame"
        title="Scratchpad measurement dashboard"
        name="dashboard-frame"
        src={viewerUrl}
      />
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found.");
}

createRoot(root).render(<App />);
