import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

type JsonRecord = Record<string, unknown>;

interface MeasurementTask {
  id: string;
  category: string;
  title: string;
  commands?: string[][];
  output_artifacts?: string[];
}

interface MeasurementCatalog {
  tasks?: MeasurementTask[];
  [key: string]: unknown;
}

interface MeasurementRun {
  id: string;
  selector: string;
  task_ids: string[];
  status: string;
  created_at: number;
  exit_code: number | null;
  duration_seconds: number | null;
  artifacts: string[];
  current_task_id: string | null;
  current_task_detail: string | null;
  completed_tasks: number;
  total_tasks: number;
  completed_task_ids: string[];
  failed_task_ids: string[];
  last_update_at: number;
  started_at?: number;
  finished_at?: number;
  log_path?: string;
  error?: string;
  [key: string]: unknown;
}

const repoRoot = resolve(process.cwd());
const scratchpadRoot = resolve(process.env.SCRATCHPAD_ROOT ?? join(repoRoot, "..", "scratchpad"));
const analysisRoot = join(scratchpadRoot, "target", "analysis");
const runsPath = join(analysisRoot, "measurement_runs.json");
const logDir = join(analysisRoot, "logs");
const commandTimeoutMs = Number(process.env.PMB_COMMAND_TIMEOUT_MS ?? 30 * 60 * 1000);

let runs: MeasurementRun[] = loadRuns().map((run) =>
  ["queued", "running"].includes(run.status)
    ? {
        ...run,
        status: "interrupted",
        finished_at: Date.now() / 1000,
        error: "Project Management Board restarted before this run completed.",
      }
    : run,
);
let activeRun: MeasurementRun | null = null;
saveRuns();

function projectBoardPlugin(): Plugin {
  return {
    name: "project-management-board-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        try {
          if (req.method === "GET" && url.pathname === "/viewer") {
            res.writeHead(302, { Location: "/viewer/" });
            res.end();
            return;
          }
          if (req.method === "GET" && url.pathname === "/viewer/") {
            return sendFile(res, join(repoRoot, "public", "viewer", "index.html"));
          }
          if (url.pathname.startsWith("/target/analysis/")) {
            return serveAnalysisArtifact(url.pathname, res);
          }
          if (url.pathname.startsWith("/api/")) {
            await handleApi(req, res, url);
            return;
          }
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
          return;
        }
        next();
      });
    },
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/catalog") {
    sendJson(res, 200, await getCatalog());
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/runs") {
    sendJson(res, 200, runs);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/app-package") {
    sendJson(res, 200, await runJsonCommand([pythonPath(), "scripts/splens.py", "telemetry"]));
    return;
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/run/") && url.pathname.endsWith("/log")) {
    const runId = decodeURIComponent(url.pathname.slice("/api/run/".length, -"/log".length));
    const run = runs.find((item) => item.id === runId);
    if (!run?.log_path || !existsSync(run.log_path)) {
      sendJson(res, 404, { error: "run log not found" });
      return;
    }
    sendFile(res, run.log_path, "text/plain; charset=utf-8");
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/app-package/clear-buffers") {
    const script = [
      "import json, sys",
      "from pathlib import Path",
      `sys.path.insert(0, ${JSON.stringify(join(scratchpadRoot, "..", "scratchpad-performance-lens", "src", "scratchpad_performance_lens", "tools"))})`,
      "from app_package import clear_app_package_buffers",
      "print(json.dumps(clear_app_package_buffers()))",
    ].join("; ");
    const payload = await runJsonCommand([pythonPath(), "-c", script]);
    const clearResult =
      typeof payload.clear_result === "object" && payload.clear_result !== null
        ? (payload.clear_result as JsonRecord)
        : {};
    const blocked = Boolean(clearResult.blocked);
    sendJson(res, blocked ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/run/")) {
    await startRun(url.pathname, res);
    return;
  }
  sendJson(res, 404, { error: "unknown endpoint" });
}

async function startRun(pathname: string, res: ServerResponse): Promise<void> {
  const selector = selectorFromPath(pathname);
  if (!selector) {
    sendJson(res, 404, { error: "unknown endpoint" });
    return;
  }
  const catalog = await getCatalog();
  const tasks = selectedTasks(catalog.tasks ?? [], selector);
  if (tasks.length === 0) {
    sendJson(res, 404, { error: "no matching tasks" });
    return;
  }
  if (activeRun) {
    sendJson(res, 409, {
      error: "a dashboard refresh is already running",
      active_run_id: activeRun.id,
      active_status: activeRun.status,
    });
    return;
  }
  const run = {
    id: `run-${timestamp()}-${runs.length + 1}`,
    selector,
    task_ids: tasks.map((task) => task.id),
    status: "queued",
    created_at: Date.now() / 1000,
    exit_code: null,
    duration_seconds: null,
    artifacts: [],
    current_task_id: null,
    current_task_detail: null,
    completed_tasks: 0,
    total_tasks: tasks.length,
    completed_task_ids: [],
    failed_task_ids: [],
    last_update_at: Date.now() / 1000,
  };
  runs.push(run);
  activeRun = run;
  saveRuns();
  runTaskBatch(run.id, tasks).catch((error) => {
    updateRun(run.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finished_at: Date.now() / 1000,
      last_update_at: Date.now() / 1000,
    });
    activeRun = null;
  });
  sendJson(res, 202, { run_id: run.id, status: "queued" });
}

async function runTaskBatch(runId: string, tasks: MeasurementTask[]): Promise<void> {
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${runId}.log`);
  const started = Date.now() / 1000;
  updateRun(runId, { status: "running", started_at: started, log_path: logPath });
  const completed: string[] = [];
  const failed: string[] = [];
  const artifacts: string[] = [];
  let exitCode = 0;

  writeFileSync(logPath, "", "utf8");
  for (const task of tasks) {
    updateRun(runId, {
      current_task_id: task.id,
      current_task_detail: null,
      completed_tasks: completed.length,
      completed_task_ids: [...completed],
      failed_task_ids: [...failed],
      last_update_at: Date.now() / 1000,
    });
    appendLog(logPath, `## ${task.id} - ${task.title}\n`);
    let taskExit = 0;
    for (const rawCommand of task.commands ?? []) {
      const command = normalizeCommand(rawCommand);
      appendLog(logPath, `$ ${command.join(" ")}\n`);
      const result = await runLoggedCommand(command, logPath, (line) => {
        updateRun(runId, {
          current_task_id: task.id,
          current_task_detail: progressDetail(line),
          completed_tasks: completed.length,
          completed_task_ids: [...completed],
          failed_task_ids: [...failed],
          last_update_at: Date.now() / 1000,
        });
      });
      appendLog(logPath, `\nexit=${result.code}\n\n`);
      if (result.code !== 0) {
        taskExit = result.code;
        if (exitCode === 0) {
          exitCode = result.code;
        }
        break;
      }
    }
    artifacts.push(...(task.output_artifacts ?? []));
    if (taskExit === 0) {
      completed.push(task.id);
    } else {
      failed.push(task.id);
      appendLog(logPath, `Task ${task.id} failed with exit=${taskExit}; continuing remaining tasks.\n\n`);
    }
    updateRun(runId, {
      completed_tasks: completed.length,
      completed_task_ids: [...completed],
      failed_task_ids: [...failed],
      last_update_at: Date.now() / 1000,
    });
  }

  const finished = Date.now() / 1000;
  updateRun(runId, {
    status: exitCode === 0 ? "completed" : "failed",
    exit_code: exitCode,
    finished_at: finished,
    duration_seconds: Math.round((finished - started) * 1000) / 1000,
    artifacts: [...new Set(artifacts)].sort(),
    current_task_id: null,
    current_task_detail: null,
    completed_tasks: completed.length,
    completed_task_ids: completed,
    failed_task_ids: failed,
    total_tasks: tasks.length,
    last_update_at: finished,
  });
  activeRun = null;
}

function runLoggedCommand(
  command: string[],
  logPath: string,
  onLine: (line: string) => void,
): Promise<{ code: number }> {
  return new Promise((resolvePromise) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: scratchpadRoot,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      appendLog(logPath, `\nCommand timed out after ${commandTimeoutMs}ms and was stopped.\n`);
      if (!settled) {
        settled = true;
        resolvePromise({ code: 124 });
      }
    }, commandTimeoutMs);
    const capture = (chunk: Buffer) => {
      const text = chunk.toString();
      appendLog(logPath, text);
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) {
          onLine(line);
        }
      }
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolvePromise({ code: code ?? 1 });
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      appendLog(logPath, `${error.message}\n`);
      if (!settled) {
        settled = true;
        resolvePromise({ code: 1 });
      }
    });
  });
}

async function getCatalog(): Promise<MeasurementCatalog> {
  const catalogPath = join(analysisRoot, "measurement_catalog.json");
  if (existsSync(catalogPath)) {
    return JSON.parse(readFileSync(catalogPath, "utf8"));
  }
  return runJsonCommand([pythonPath(), "scripts/measurement_catalog.py", "--mode", "analysis"]);
}

function selectedTasks(tasks: MeasurementTask[], selector: string): MeasurementTask[] {
  if (selector === "all") {
    return tasks;
  }
  if (selector.startsWith("category/")) {
    const category = selector.slice("category/".length);
    return tasks.filter((task) => task.category === category);
  }
  if (selector.startsWith("item/")) {
    const id = selector.slice("item/".length);
    return tasks.filter((task) => task.id === id);
  }
  return [];
}

function selectorFromPath(pathname: string): string {
  if (pathname === "/api/run/all") {
    return "all";
  }
  if (pathname.startsWith("/api/run/category/")) {
    return `category/${decodeURIComponent(pathname.slice("/api/run/category/".length))}`;
  }
  if (pathname.startsWith("/api/run/item/")) {
    return `item/${decodeURIComponent(pathname.slice("/api/run/item/".length))}`;
  }
  return "";
}

function normalizeCommand(rawCommand: string[]): string[] {
  const command = [...rawCommand];
  if (command[0]?.endsWith("python.exe") && !existsSync(resolve(scratchpadRoot, command[0]))) {
    command[0] = pythonPath();
  }
  return command;
}

function pythonPath(): string {
  const venvPython =
    process.platform === "win32"
      ? join(scratchpadRoot, ".venv", "Scripts", "python.exe")
      : join(scratchpadRoot, ".venv", "bin", "python");
  return existsSync(venvPython) ? venvPython : "python";
}

function runJsonCommand(command: string[]): Promise<JsonRecord> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: scratchpadRoot,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Command failed with exit ${code}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reject(new Error(`Command did not return JSON: ${message}`));
      }
    });
  });
}

function loadRuns(): MeasurementRun[] {
  if (!existsSync(runsPath)) {
    return [];
  }
  try {
    const payload = JSON.parse(readFileSync(runsPath, "utf8"));
    return Array.isArray(payload) ? (payload as MeasurementRun[]) : [];
  } catch {
    return [];
  }
}

function saveRuns(): void {
  mkdirSync(dirname(runsPath), { recursive: true });
  writeFileSync(runsPath, `${JSON.stringify(runs.slice(-100), null, 2)}\n`, "utf8");
}

function updateRun(runId: string, changes: Partial<MeasurementRun>): void {
  const index = runs.findIndex((run) => run.id === runId);
  if (index !== -1) {
    runs[index] = { ...runs[index], ...changes };
    if (activeRun?.id === runId) {
      activeRun = runs[index];
    }
    saveRuns();
  }
}

function appendLog(logPath: string, text: string): void {
  writeFileSync(logPath, text, { encoding: "utf8", flag: "a" });
}

function progressDetail(line: string): string {
  const detail = line.trim().replace(/\s+/g, " ");
  return detail.length > 160 ? `${detail.slice(0, 157)}...` : detail;
}

function timestamp(): string {
  const value = new Date();
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}${pad(
    value.getHours(),
  )}${pad(value.getMinutes())}${pad(value.getSeconds())}`;
}

function serveAnalysisArtifact(pathname: string, res: ServerResponse): void {
  const relative = decodeURIComponent(pathname.slice("/target/analysis/".length));
  const candidate = normalize(join(analysisRoot, relative));
  if (!candidate.startsWith(`${normalize(analysisRoot)}${sep}`) && candidate !== normalize(analysisRoot)) {
    sendJson(res, 400, { error: "invalid analysis path" });
    return;
  }
  sendFile(res, candidate);
}

function sendFile(res: ServerResponse, path: string, contentType = contentTypeFor(path)): void {
  if (!existsSync(path)) {
    sendJson(res, 404, { error: "file not found" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  createReadStream(path).pipe(res);
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
  setCors(res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": body.length,
  });
  res.end(body);
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function contentTypeFor(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".log") || path.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export default defineConfig({
  plugins: [react(), projectBoardPlugin()],
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: [repoRoot, scratchpadRoot],
    },
  },
  preview: {
    port: 4173,
  },
});
