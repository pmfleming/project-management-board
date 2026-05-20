import { useEffect, useMemo, useState } from "react";

type ViewerWindow = Window &
  typeof globalThis & {
    SCRATCHPAD_VIEWER_VERSION?: string;
  };

let viewerControllerLoaded = false;

function shellBodyFromDocument(documentText: string): string {
  const parsed = new DOMParser().parseFromString(documentText, "text/html");
  parsed.body.querySelectorAll("script").forEach((script) => script.remove());
  return parsed.body.innerHTML;
}

function ensureViewerStyles(version: string, active: boolean): void {
  const existing = document.querySelector<HTMLLinkElement>('link[data-viewer-styles="true"]');
  if (existing) {
    existing.disabled = !active;
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `/viewer/styles.css?v=${encodeURIComponent(version)}`;
  link.dataset.viewerStyles = "true";
  link.disabled = !active;
  document.head.appendChild(link);
}

function loadViewerController(version: string): void {
  if (viewerControllerLoaded) {
    return;
  }

  viewerControllerLoaded = true;
  const script = document.createElement("script");
  script.src = `/viewer/data-viewer.js?v=${encodeURIComponent(version)}`;
  script.dataset.viewerController = "true";
  script.async = false;
  document.body.appendChild(script);
}

export function ViewerPage({ active }: { active: boolean }) {
  const version = useMemo(() => `20260414-dynamic-${Date.now()}`, []);
  const [shellHtml, setShellHtml] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const host = window.location.hostname;
    if (!["localhost", "127.0.0.1", "::1", ""].includes(host)) {
      document.documentElement.dataset.staticHost = "true";
    }

    (window as ViewerWindow).SCRATCHPAD_VIEWER_VERSION = version;
    ensureViewerStyles(version, active);
  }, [active, version]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/viewer/shell.html?v=${encodeURIComponent(version)}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Viewer shell returned ${response.status}`);
        }
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setShellHtml(shellBodyFromDocument(text));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    if (shellHtml) {
      loadViewerController(version);
    }
  }, [shellHtml, version]);

  if (loadError) {
    return (
      <main className="viewer-load-state">
        <strong>Viewer shell could not be loaded.</strong>
        <code>{loadError}</code>
      </main>
    );
  }

  if (!shellHtml) {
    return (
      <main className="viewer-load-state">
        <strong>Opening scratchpad_</strong>
      </main>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: shellHtml }} />;
}
