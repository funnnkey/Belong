#!/usr/bin/env node
"use strict";
/*
 * Belong — local AI dev-loop controller, Steps 1-3 (Planner, result capture,
 * OpenCode handoff conversion).
 *
 * Default mode: reads the six .ai/*.md state files, builds a compact planner
 * context, asks an environment-configured AI planner for EXACTLY ONE
 * implementation prompt, writes it to .ai/NEXT_PROMPT.md, prints it to stdout.
 *
 * Result-capture helper (does NOT launch OpenCode):
 *   node .ai/planner.js --record-result [result.json]
 *   echo '<json>' | node .ai/planner.js --record-result
 *   JSON fields: task (required), result, files, verification, concerns,
 *                next, status (optional, default "RECORDED")
 *   Writes .ai/IMPLEMENTATION_RESULT.md in the fixed section structure so the
 *   planner reads it on the next cycle.
 *
 * OpenCode handoff converter (does NOT launch OpenCode, no external API):
 *   node .ai/planner.js --record-opencode-result [file]
 *   echo '<text>' | node .ai/planner.js --record-opencode-result
 *   Reads .ai/OPENCODE_RESULT.md-style text, extracts task/result/files/
 *   verification/concerns/next/status, and writes IMPLEMENTATION_RESULT.md
 *   through the same path as --record-result. Unparseable input is recorded
 *   as STATUS: NEEDS_REVIEW with the raw output in CONCERNS (nothing invented).
 *
 * No OpenCode automation yet. No dependencies (Node >= 18 built-ins only).
 *
 * Environment configuration (no secrets are stored in this file):
 *   PLANNER_API_URL   required  full endpoint URL (OpenAI-compatible chat/completions)
 *   PLANNER_API_KEY   optional  sent as "Authorization: Bearer <key>" when set
 *   PLANNER_MODEL     optional  model id (default: gpt-4o-mini)
 */
const fs = require("node:fs");
const path = require("node:path");

const AI_DIR = __dirname;
const STATE_FILES = ["PROJECT_STATE.md", "CURRENT_TASK.md", "DECISIONS.md", "TEST_RESULTS.md", "IMPLEMENTATION_RESULT.md", "NEXT_PROMPT.md"];
const OUT_FILE = path.join(AI_DIR, "NEXT_PROMPT.md");
const RESULT_FILE = path.join(AI_DIR, "IMPLEMENTATION_RESULT.md");
const MAX_PER_FILE = 4000;

const SYSTEM_PROMPT = [
  "You are the Planner AI in a local development-loop controller for the Belong project.",
  "You receive a compact context assembled from the project's .ai state files.",
  "Your job: produce the NEXT implementation prompt for OpenCode, an autonomous coding agent that edits this repository.",
  "Context note: IMPLEMENTATION_RESULT.md holds the outcome of the previous task. If its STATUS is RECORDED, use its VERIFICATION and CONCERNS as inputs (unresolved failures come first); if STATUS is PENDING, no implementation result exists yet.",
  "",
  "HARD RULES:",
  "1. Output EXACTLY ONE implementation task as a single prompt. Never offer alternatives, options, menus, or multiple tasks.",
  "2. Respect the existing architecture: static index.html + style.css + script.js front end, Node backend in backend/server.js, MySQL belong_db, no build step, no new frameworks or packages unless unavoidable.",
  "3. Preserve backend matching logic: traveller question-1 tags vs local question-1 tags, score = integer tag overlap, sorted descending, DB-order ties, zero matches last.",
  "4. Preserve travellerProfileId handling in recommendation requests.",
  "5. Preserve Local name validation: role 'local' requires a non-empty trimmed displayName (400 from POST /api/profile).",
  "6. Preserve deterministic matching: no randomness, no timestamps in ranking.",
  "7. Do not invent database fields, tables, endpoints, or product behavior. Existing schema only: users(id, role, email), profiles(id, user_id, display_name, city, bio), profile_answers(id, profile_id, question_id, option_id, custom_text), questions, question_options.",
  "8. Do not weaken or revert existing regression fixes, the recommendation response contract (only id, name, city, email, expertise, matchReason), honesty rules (no fake metrics/percentages/matchScore), or onboarding save-flow behavior.",
  "9. If completing the next step requires an important product decision (new user-facing behavior, a schema change, or reversing a documented decision), output ONLY:",
  "   STATUS: NEEDS_REVIEW",
  "   <one short question naming the decision>",
  "   and no prompt.",
  "10. If the state files show no further implementation work is required, output ONLY:",
  "   STATUS: COMPLETE",
  "11. Otherwise output the single prompt starting with the line 'PROMPT:' followed by the prompt text. The prompt must be self-contained: what to build/fix, exact files to touch, constraints to preserve, and how to verify. Keep it to ONE small increment.",
  "",
  "Output the prompt (or the STATUS line) and nothing else. No preamble, no commentary.",
].join("\n");

function readState() {
  return STATE_FILES.map((name) => {
    const file = path.join(AI_DIR, name);
    let body = "(empty)";
    if (fs.existsSync(file)) {
      body = fs.readFileSync(file, "utf8").trim() || "(empty)";
    }
    if (body.length > MAX_PER_FILE) body = body.slice(0, MAX_PER_FILE) + "\n…(truncated)";
    return `### ${name}\n${body}`;
  }).join("\n\n");
}

function stripFences(text) {
  const m = text.match(/^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n```\s*$/);
  return m ? m[1] : text;
}

// ---- Step 2: implementation-result helper -------------------------------
function section(value) {
  const text = typeof value === "string" ? value.trim()
    : Array.isArray(value) ? value.map(String).join("\n")
    : value == null ? "" : String(value);
  return text || "(not provided)";
}

function renderResult(r) {
  const status = typeof r.status === "string" && r.status.trim() ? r.status.trim() : "RECORDED";
  return [
    "STATUS: " + status,
    "",
    "TASK", section(r.task),
    "",
    "RESULT", section(r.result),
    "",
    "FILES", section(r.files),
    "",
    "VERIFICATION", section(r.verification),
    "",
    "CONCERNS", section(r.concerns),
    "",
    "NEXT", section(r.next),
    "",
  ].join("\n");
}

function commitResult(obj, label) {
  fs.writeFileSync(RESULT_FILE, renderResult(obj), "utf8");
  const written = fs.readFileSync(RESULT_FILE, "utf8").split("\n")[0];
  console.log(label + ": wrote " + path.relative(process.cwd(), RESULT_FILE) + " (" + written + ")");
}

function recordResult(argv) {
  let raw;
  if (argv[1]) {
    raw = fs.readFileSync(argv[1], "utf8");
  } else if (!process.stdin.isTTY) {
    raw = fs.readFileSync(0, "utf8");
  } else {
    console.error('Usage: node .ai/planner.js --record-result [result.json]   (or pipe JSON on stdin)');
    process.exit(1);
  }

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (err) {
    console.error("record-result: invalid JSON — " + err.message);
    process.exit(1);
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    console.error("record-result: expected a JSON object");
    process.exit(1);
  }
  if (typeof obj.task !== "string" || !obj.task.trim()) {
    console.error('record-result: JSON must include a non-empty "task" field');
    process.exit(1);
  }

  commitResult(obj, "record-result");
}

// ---- Step 3: OpenCode handoff converter ---------------------------------
const OPCODE_SECTIONS = ["task", "result", "files", "verification", "concerns", "next"];
const OPCODE_STATUSES = ["PENDING", "RECORDED", "COMPLETE", "NEEDS_REVIEW"];
const RAW_MAX = 3000;

function extractOpenCodeResult(raw) {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return null;

  const lines = text.split("\n");
  const statusMatch = text.match(/^STATUS:\s*(\S+)\s*$/mi);
  let status = "";
  if (statusMatch) {
    const token = statusMatch[1].toUpperCase();
    if (OPCODE_STATUSES.indexOf(token) !== -1) status = token;
  }

  const headerRe = /^#{0,3}\s*(TASK|RESULT|FILES|VERIFICATION|CONCERNS|NEXT)\s*:?\s*$/i;
  const sections = {};
  const headers = [];
  lines.forEach((line, i) => {
    const m = line.match(headerRe);
    if (m) headers.push({ key: m[1].toLowerCase(), idx: i });
  });
  headers.forEach((h, j) => {
    if (h.key in sections) return;
    const start = h.idx + 1;
    const end = j + 1 < headers.length ? headers[j + 1].idx : lines.length;
    sections[h.key] = lines.slice(start, end).join("\n").trim();
  });

  const task = sections.task || "";
  if (!task || /^\([\s\S]*\)$/.test(task)) return null;

  return {
    status: status || "RECORDED",
    task,
    result: sections.result || "",
    files: sections.files || "",
    verification: sections.verification || "",
    concerns: sections.concerns || "",
    next: sections.next || "",
  };
}

function openCodeFallback(raw) {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const snippet = text.slice(0, RAW_MAX);
  const truncated = text.length > RAW_MAX ? "\n…(truncated)" : "";
  return {
    status: "NEEDS_REVIEW",
    task: "(could not be parsed from the supplied OpenCode output)",
    result: "",
    files: "",
    verification: "",
    concerns:
      "Automatic extraction failed — raw OpenCode output recorded below; review it and " +
      "re-record via --record-result with structured JSON if a task was completed.\n\n" +
      snippet +
      truncated,
    next: "Review the raw output in CONCERNS, fill .ai/OPENCODE_RESULT.md, then re-run --record-opencode-result.",
  };
}

function readOpenCodeInput(argv) {
  if (argv[1]) return fs.readFileSync(argv[1], "utf8");
  if (!process.stdin.isTTY) return fs.readFileSync(0, "utf8");
  console.error("Usage: node .ai/planner.js --record-opencode-result [file]   (or pipe result text on stdin)");
  process.exit(1);
}

function recordOpenCodeResult(argv) {
  const raw = readOpenCodeInput(argv);
  if (!raw || !raw.trim()) {
    console.error("record-opencode-result: no input received (empty file or stdin)");
    process.exit(1);
  }
  const obj = extractOpenCodeResult(raw) || openCodeFallback(raw);
  commitResult(obj, "record-opencode-result");
}

async function main() {
  const url = process.env.PLANNER_API_URL;
  const key = process.env.PLANNER_API_KEY;
  const model = process.env.PLANNER_MODEL || "gpt-4o-mini";

  if (!url) {
    console.error("PLANNER_API_URL is not set. Configure the planner API via environment variables:");
    console.error("  PLANNER_API_URL   (required) endpoint URL, e.g. https://api.openai.com/v1/chat/completions");
    console.error("  PLANNER_API_KEY   (optional) bearer token");
    console.error("  PLANNER_MODEL     (optional) model id, default gpt-4o-mini");
    process.exit(1);
  }

  const userMessage =
    "Generate the next single implementation prompt for OpenCode for the Belong project.\n" +
    "Follow your hard rules exactly: exactly one task, or STATUS: NEEDS_REVIEW, or STATUS: COMPLETE.\n\n" +
    "<PROJECT_CONTEXT>\n" +
    readState() +
    "\n</PROJECT_CONTEXT>";

  const payload = {
    model,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  };

  const headers = { "content-type": "application/json" };
  if (key) headers["authorization"] = `Bearer ${key}`;

  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  } catch (err) {
    console.error("Planner API request failed:", err.message);
    process.exit(1);
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    console.error(`Planner API returned HTTP ${res.status}: ${detail}`);
    process.exit(1);
  }

  const data = await res.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("Planner API response did not contain choices[0].message.content");
    process.exit(1);
  }

  const prompt = stripFences(content.trim());
  fs.writeFileSync(OUT_FILE, prompt + "\n", "utf8");
  console.log(prompt);
}

const argv = process.argv.slice(2);

if (argv[0] === "--help" || argv[0] === "-h") {
  console.log("Usage:");
  console.log("  node .ai/planner.js                                generate next prompt (needs PLANNER_API_URL)");
  console.log('  node .ai/planner.js --record-result [file]          write .ai/IMPLEMENTATION_RESULT.md from JSON (or stdin)');
  console.log('  node .ai/planner.js --record-opencode-result [file] convert OpenCode result text (or stdin) and write IMPLEMENTATION_RESULT.md');
  process.exit(0);
} else if (argv[0] === "--record-result") {
  try {
    recordResult(argv);
    process.exit(0);
  } catch (err) {
    console.error("record-result failed:", err.message);
    process.exit(1);
  }
} else if (argv[0] === "--record-opencode-result") {
  try {
    recordOpenCodeResult(argv);
    process.exit(0);
  } catch (err) {
    console.error("record-opencode-result failed:", err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("planner failed:", err.message);
  process.exit(1);
});
