#!/usr/bin/env node
"use strict";
/*
 * Belong — local AI dev-loop controller, Step 4: ONE-SHOT cycle runner.
 *
 * Executes exactly ONE cycle and then stops (no daemon, no auto-loop):
 *
 *   .ai/NEXT_PROMPT.md
 *       -> opencode run "<prompt>"      (cwd: project root)
 *       -> .ai/OPENCODE_LAST_OUTPUT.md  (raw stdout+stderr capture)
 *       -> planner.js --record-opencode-result
 *       -> .ai/IMPLEMENTATION_RESULT.md
 *       -> STOP  (the planner generation mode is never called from here)
 *
 * Behavior notes:
 *   - OpenCode is resolved via PATH (default binary "opencode").
 *   - Non-zero OpenCode exit: output still saved and recorded, always as
 *     STATUS: NEEDS_REVIEW, no retry.
 *   - Launch failure: useful failure record written, STATUS: NEEDS_REVIEW, exit 1.
 *   - .ai/.cycle.lock prevents concurrent cycles; removed on any process exit.
 *
 * No dependencies (Node >= 18 built-ins only). No external APIs. Not a daemon.
 *
 * Environment overrides (testing / alternate installs):
 *   OPENCODE_BIN      executable to launch (default: "opencode", resolved via PATH)
 *   CYCLE_PROMPT_FILE prompt file to read (default: .ai/NEXT_PROMPT.md)
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const AI_DIR = __dirname;
const PROJECT_ROOT = path.resolve(AI_DIR, "..");
const PROMPT_FILE = process.env.CYCLE_PROMPT_FILE || path.join(AI_DIR, "NEXT_PROMPT.md");
const RAW_OUTPUT_FILE = path.join(AI_DIR, "OPENCODE_LAST_OUTPUT.md");
const LOCK_FILE = path.join(AI_DIR, ".cycle.lock");
const PLANNER = path.join(AI_DIR, "planner.js");
const OPENCODE_BIN = process.env.OPENCODE_BIN || "opencode";
const TASK_MAX = 4000;

let lockHeld = false;

function log(msg) {
  console.log("[cycle] " + msg);
}

function cleanupLock() {
  if (!lockHeld) return;
  lockHeld = false;
  try { fs.unlinkSync(LOCK_FILE); } catch (_) { /* already gone */ }
}
process.on("exit", cleanupLock);
process.on("SIGINT", () => { cleanupLock(); process.exit(130); });
process.on("SIGTERM", () => { cleanupLock(); process.exit(143); });

function acquireLock() {
  try {
    fs.writeFileSync(LOCK_FILE, "pid=" + process.pid + "\nstarted=" + new Date().toISOString() + "\n", { flag: "wx" });
    lockHeld = true;
    log("Lock acquired: .ai/.cycle.lock");
  } catch (err) {
    if (err.code === "EEXIST") {
      let info = "";
      try { info = fs.readFileSync(LOCK_FILE, "utf8").trim().replace(/\s+/g, " "); } catch (_) { /* ignore */ }
      console.error("[cycle] Refusing to start: another cycle appears to be running" + (info ? " (" + info + ")" : ""));
      console.error("[cycle] If no other cycle is running, delete .ai/.cycle.lock and retry.");
      process.exit(1);
    }
    throw err;
  }
}

function noTask(reason) {
  console.error("No executable implementation task is available.");
  if (reason) console.error(reason);
  process.exit(1);
}

function readAndValidatePrompt() {
  const shown = path.relative(PROJECT_ROOT, PROMPT_FILE) || PROMPT_FILE;
  log("Reading " + shown);
  let text;
  try {
    text = fs.readFileSync(PROMPT_FILE, "utf8");
  } catch (err) {
    noTask("[" + shown + "] could not be read: " + err.message);
  }
  const trimmed = text.trim();
  if (!trimmed) noTask("[" + shown + "] is empty.");

  const lines = trimmed.split(/\r?\n/);
  const first = lines.find((l) => l.trim() !== "") || "";
  const statusMatch = first.match(/^STATUS:\s*(COMPLETE|NEEDS_REVIEW)\s*$/i);
  if (statusMatch) {
    let reason = "Planner status: " + statusMatch[1].toUpperCase();
    const extra = lines.slice(1).join(" ").trim();
    if (extra) reason += " — " + extra.slice(0, 300);
    noTask(reason);
  }
  if (!lines.some((l) => /^PROMPT:/.test(l))) {
    noTask("[" + shown + "] does not contain a PROMPT: line.");
  }
  return trimmed;
}

function launchOpenCode(task) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;
    let child;
    try {
      child = spawn(OPENCODE_BIN, ["run", task], {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      resolve({ launchError: err, raw: "" });
      return;
    }
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    const finish = (result) => {
      if (settled) return;
      settled = true;
      result.raw = Buffer.concat(chunks).toString("utf8");
      resolve(result);
    };
    child.on("error", (err) => finish({ launchError: err }));
    child.on("close", (code, signal) => finish({ code, signal }));
  });
}

function recordResult(feedText) {
  const rec = spawnSync(process.execPath, [PLANNER, "--record-opencode-result"], {
    input: feedText,
    encoding: "utf8",
  });
  if (rec.stdout) process.stdout.write(rec.stdout);
  if (rec.error) {
    console.error("[cycle] Failed to record result: " + rec.error.message);
    process.exit(1);
  }
  if (rec.status !== 0) {
    if (rec.stderr) process.stderr.write(rec.stderr);
    console.error("[cycle] Failed to record result (recorder exited with code " + rec.status + ")");
    process.exit(1);
  }
}

function launchFailureRecord(task, err) {
  const message = err && err.message ? err.message : String(err);
  return [
    "STATUS: NEEDS_REVIEW",
    "",
    "TASK", task.slice(0, TASK_MAX),
    "",
    "RESULT", "OpenCode could not be launched — no process output was produced.",
    "",
    "FILES", "(none — OpenCode did not run)",
    "",
    "VERIFICATION", "Not run — OpenCode did not start.",
    "",
    "CONCERNS", "Launch failure: " + message,
    "",
    "NEXT", "Fix the OpenCode executable (PATH or OPENCODE_BIN) and re-run: node .ai/run-cycle.js",
    "",
  ].join("\n");
}

function printHelp() {
  console.log("Usage:");
  console.log("  node .ai/run-cycle.js    run exactly ONE dev-loop cycle, then stop:");
  console.log("                           NEXT_PROMPT.md -> opencode -> OPENCODE_LAST_OUTPUT.md");
  console.log("                           -> IMPLEMENTATION_RESULT.md (via planner.js --record-opencode-result)");
  console.log("                           One-shot command — never auto-starts another cycle.");
  console.log("Environment:");
  console.log("  OPENCODE_BIN       OpenCode executable (default: opencode, resolved via PATH)");
  console.log("  CYCLE_PROMPT_FILE  prompt file to execute (default: .ai/NEXT_PROMPT.md)");
  console.log("Lock:");
  console.log("  .ai/.cycle.lock is created while a cycle runs and removed when the process");
  console.log("  exits; a second cycle is refused while the lock exists.");
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    return;
  }
  if (argv.length) {
    console.error("Unknown argument: " + argv[0]);
    printHelp();
    process.exit(1);
  }

  const task = readAndValidatePrompt();
  acquireLock();

  log("Launching OpenCode (" + OPENCODE_BIN + ")");
  const outcome = await launchOpenCode(task);

  if (outcome.launchError) {
    log("OpenCode could not be launched");
    const note =
      "[run-cycle] OpenCode could not be launched.\n" +
      "binary: " + OPENCODE_BIN + "\n" +
      "error: " + (outcome.launchError.message || String(outcome.launchError)) + "\n";
    fs.writeFileSync(RAW_OUTPUT_FILE, note + outcome.raw, "utf8");
    log("Saved launch-failure note to .ai/OPENCODE_LAST_OUTPUT.md");
    log("Recording implementation result");
    recordResult(launchFailureRecord(task, outcome.launchError));
    console.error("[cycle] Cycle stopped: OpenCode could not be launched");
    process.exit(1);
  }

  const codePart = "code: " + outcome.code + (outcome.signal ? " (signal " + outcome.signal + ")" : "");
  log("OpenCode exited with " + codePart);
  log("Saving raw output");
  fs.writeFileSync(RAW_OUTPUT_FILE, outcome.raw, "utf8");
  log("Saved raw output (" + Buffer.byteLength(outcome.raw) + " bytes) to .ai/OPENCODE_LAST_OUTPUT.md");

  const failed = outcome.code !== 0;
  log("Recording implementation result");
  recordResult(failed ? "STATUS: NEEDS_REVIEW\n\n" + outcome.raw : outcome.raw);

  if (failed) {
    console.error("[cycle] Cycle complete (OpenCode failed — result recorded as STATUS: NEEDS_REVIEW)");
    process.exit(1);
  }
  log("Cycle complete");
}

main().catch((err) => {
  console.error("[cycle] unexpected error: " + err.message);
  cleanupLock();
  process.exit(1);
});
