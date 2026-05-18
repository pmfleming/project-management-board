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
  subcategory: string;
  title: string;
  description: string;
  commands?: string[][];
  output_artifacts?: string[];
  depends_on?: string[];
  expensive?: boolean;
  supports_individual_run?: boolean;
  related_profiles?: string[];
  related_tests?: string[];
  related_modules?: string[];
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
const rustQualityLensRoot = resolve(
  process.env.RUST_QUALITY_LENS_ROOT ?? join(scratchpadRoot, "..", "rust-quality-lens"),
);
const scratchpadPerformanceLensRoot = resolve(
  process.env.SCRATCHPAD_PERFORMANCE_LENS_ROOT ??
    join(scratchpadRoot, "..", "scratchpad-performance-lens"),
);
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
      if (rawCommand[0] === "board-catalog") {
        const outputPath = join(analysisRoot, "measurement_catalog.json");
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, `${JSON.stringify(buildCatalog(), null, 2)}\n`, "utf8");
        appendLog(logPath, `Wrote ${outputPath}\n`);
        artifacts.push("target/analysis/measurement_catalog.json");
        continue;
      }
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
      }, commandEnvironment(rawCommand[0]));
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
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ code: number }> {
  return new Promise((resolvePromise) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: scratchpadRoot,
      shell: false,
      windowsHide: true,
      env,
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
  return buildCatalog();
}

function item(
  task: Omit<MeasurementTask, "commands" | "output_artifacts"> & {
    commands: string[][];
    output_artifacts: string[];
    expensive?: boolean;
    subcategory: string;
    description: string;
    related_profiles?: string[];
    related_tests?: string[];
    related_modules?: string[];
  },
): MeasurementTask {
  return {
    ...task,
    depends_on: [],
    expensive: task.expensive ?? false,
    supports_individual_run: true,
    related_profiles: task.related_profiles ?? [],
    related_tests: task.related_tests ?? [],
    related_modules: task.related_modules ?? [],
  };
}

function buildCatalog(): MeasurementCatalog {
  const tasks: MeasurementTask[] = [
    item({
      id: "quality.hotspots",
      category: "quality",
      subcategory: "hotspots",
      title: "Hotspots",
      description: "Ranks complexity risk without SLOC scoring.",
      commands: [["rqlens", "measure", "hotspots"]],
      output_artifacts: ["target/analysis/hotspots.json"],
    }),
    item({
      id: "quality.clones",
      category: "quality",
      subcategory: "clones",
      title: "Clones",
      description: "Finds repeated code structures.",
      commands: [["rqlens", "measure", "clones"]],
      output_artifacts: ["target/analysis/clones.json"],
    }),
    item({
      id: "quality.escape_hatches",
      category: "quality",
      subcategory: "safety",
      title: "Rust Escape Hatches",
      description:
        "Tracks unsafe, FFI, mutable globals, raw memory, layout/linkage attributes, and lint suppressions.",
      commands: [["rqlens", "measure", "escape-hatches"]],
      output_artifacts: ["target/analysis/rust_escape_hatches.json"],
    }),
    item({
      id: "quality.type_health",
      category: "quality",
      subcategory: "structure",
      title: "Type Health",
      description: "Ranks wide structs, large enums, broad method surfaces, and impl spread.",
      commands: [["rqlens", "measure", "type-health"]],
      output_artifacts: ["target/analysis/type_health.json"],
    }),
    item({
      id: "performance.slowspots",
      category: "performance",
      subcategory: "speed",
      title: "Broad Speed Tests",
      description: "Runs broad benchmark triage.",
      commands: [["splens", "measure", "slowspots"]],
      output_artifacts: ["target/analysis/slowspots.json"],
    }),
    item({
      id: "performance.frame_metrics",
      category: "performance",
      subcategory: "speed",
      title: "120 Hz Frame Metrics",
      description:
        "Measures headless editor frame p50/p95/p99 and phase ownership against the 120 Hz budget.",
      commands: [["splens", "measure", "frame-metrics"]],
      output_artifacts: ["target/analysis/frame_metrics.json"],
      related_profiles: ["ui_render_frame_profile"],
      related_modules: ["src/app/app_state/frame.rs", "src/app/capacity_metrics.rs"],
    }),
    item({
      id: "performance.search",
      category: "performance",
      subcategory: "searching",
      title: "Search Speed",
      description: "Measures search latency scaling.",
      commands: [["splens", "measure", "search"]],
      output_artifacts: ["target/analysis/search_speed.json"],
      related_profiles: ["search_current_app_state", "search_all_tabs", "search_dispatch"],
      related_tests: ["tests/search_tests.rs"],
    }),
    item({
      id: "performance.capacity",
      category: "performance",
      subcategory: "capacity",
      title: "Capacity Reports",
      description:
        "Finds first unusable ceilings for promise-health checks, including the Text Layout boundary.",
      commands: [["splens", "measure", "capacity"]],
      output_artifacts: ["target/analysis/capacity_report.json"],
      expensive: true,
    }),
    item({
      id: "performance.resources",
      category: "performance",
      subcategory: "resources",
      title: "Resource Profiles",
      description:
        "Measures targeted path memory, allocation, elapsed cost, and tab phase breakdowns.",
      commands: [["splens", "measure", "resources"]],
      output_artifacts: ["target/analysis/resource_profiles.json"],
      expensive: true,
    }),
    item({
      id: "performance.flamegraphs",
      category: "performance",
      subcategory: "flamegraphs",
      title: "Flamegraphs",
      description: "Indexes and generates profile SVGs.",
      commands: [["splens", "measure", "flamegraphs"]],
      output_artifacts: ["target/analysis/flamegraphs.json"],
      expensive: true,
    }),
    item({
      id: "performance.report",
      category: "performance",
      subcategory: "review",
      title: "Performance Review",
      description:
        "Combines targeted path probes, ceiling promise-health probes, profiles, scale-target coverage, and scenario gaps.",
      commands: [
        ["splens", "measure", "frame-metrics"],
        ["splens", "measure", "capacity"],
        ["splens", "measure", "speed-report"],
        ["splens", "measure", "performance-review"],
      ],
      output_artifacts: [
        "target/analysis/frame_metrics.json",
        "target/analysis/speed_efficiency_report.json",
        "target/analysis/performance_review.json",
      ],
      expensive: true,
    }),
    item({
      id: "correctness.catalog",
      category: "correctness",
      subcategory: "tests",
      title: "Correctness Catalog",
      description: "Discovers tests by architecture layer.",
      commands: [["rqlens", "measure", "correctness"]],
      output_artifacts: [
        "target/analysis/correctness_review.json",
        "target/analysis/test_catalog.json",
      ],
    }),
    item({
      id: "correctness.all",
      category: "correctness",
      subcategory: "tests",
      title: "All Tests",
      description: "Runs the full Rust test suite.",
      commands: [["rqlens", "measure", "correctness-run"]],
      output_artifacts: ["target/analysis/correctness_review.json"],
      expensive: true,
    }),
    item({
      id: "map.architecture",
      category: "map",
      subcategory: "architecture",
      title: "Architecture Map",
      description: "Refreshes module health and dependency map.",
      commands: [["rqlens", "measure", "map"]],
      output_artifacts: ["target/analysis/map.json"],
    }),
    item({
      id: "map.project_code_metrics",
      category: "map",
      subcategory: "code",
      title: "Project Rust Code Metrics",
      description:
        "Counts application, test, and other Rust code, then samples first-parent GitHub history for line progress.",
      commands: [["splens", "measure", "project-code"]],
      output_artifacts: ["target/analysis/project_code_metrics.json"],
    }),
    item({
      id: "quality.locality_dynamic",
      category: "quality",
      subcategory: "locality",
      title: "Code Locality",
      description:
        "Measures dependency spread, hidden coupling, interface explicitness, and change locality.",
      commands: [["rqlens", "measure", "locality"]],
      output_artifacts: ["target/analysis/locality_metrics.json"],
    }),
    item({
      id: "quality.locality_leverage",
      category: "quality",
      subcategory: "leverage",
      title: "Architecture Leverage",
      description:
        "Measures reach, invariant surface, divergence pressure, and co-change ripple.",
      commands: [["rqlens", "measure", "leverage"]],
      output_artifacts: ["target/analysis/leverage_metrics.json"],
    }),
    item({
      id: "dashboard.catalog",
      category: "map",
      subcategory: "dashboard",
      title: "Measurement Catalog",
      description: "Writes the dashboard task catalog.",
      commands: [["board-catalog"]],
      output_artifacts: ["target/analysis/measurement_catalog.json"],
    }),
  ];
  return {
    version: 1,
    categories: [
      { id: "quality", title: "Quality Review" },
      { id: "performance", title: "Performance Review" },
      { id: "correctness", title: "Correctness Review" },
      { id: "map", title: "Map" },
    ],
    tasks,
  };
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
  if (rawCommand[0] === "rqlens") {
    return addDefaultConfig(
      [pythonPath(), "-m", "rust_quality_lens.cli", ...rawCommand.slice(1)],
      "rqlens.toml",
    );
  }
  if (rawCommand[0] === "splens") {
    return addDefaultConfig(
      [pythonPath(), "-m", "scratchpad_performance_lens.cli", ...rawCommand.slice(1)],
      "splens.toml",
    );
  }
  const command = [...rawCommand];
  if (command[0]?.endsWith("python.exe") && !existsSync(resolve(scratchpadRoot, command[0]))) {
    command[0] = pythonPath();
  }
  return command;
}

function addDefaultConfig(command: string[], configName: string): string[] {
  return command.includes("--config") ? command : [...command, "--config", configName];
}

function commandEnvironment(kind: string): NodeJS.ProcessEnv {
  if (kind === "rqlens") {
    return withPythonPath([join(rustQualityLensRoot, "src")]);
  }
  if (kind === "splens") {
    return withPythonPath([join(scratchpadPerformanceLensRoot, "src")]);
  }
  return process.env;
}

function withPythonPath(paths: string[]): NodeJS.ProcessEnv {
  const delimiter = process.platform === "win32" ? ";" : ":";
  const existing = process.env.PYTHONPATH;
  return {
    ...process.env,
    PYTHONPATH: existing ? `${paths.join(delimiter)}${delimiter}${existing}` : paths.join(delimiter),
  };
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
