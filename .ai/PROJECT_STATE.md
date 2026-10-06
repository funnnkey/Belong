# Belong — Project State

## What Belong is
Local-first MVP matching travellers with locals in their city.
Landing page → role selection → onboarding quiz → profile save → recommendations.

## Stack
- Frontend: single static `index.html` + `style.css` + `script.js` (no framework, no build step).
- Backend: Express-style Node server `backend/server.js` (plain `http`/routing, MySQL via `mysql2`).
- DB: MySQL `belong_db` on localhost:3306 (Windows host), user `root`.
- Animations: GSAP from CDN (landing only).

## Key surfaces
- `GET /api/locals?travellerProfileId=N` — recommendations.
- `POST /api/profile` — saves profile + answers.

## Current status (as of last update)
- Backend matching + full onboarding flow working.
- Local name field (Local role) shipped with validation.
- Duplicate-answer bug fixed (validation/push ordering in `nextQuestionBtn`).
- Null-name rendering fallback shipped (never renders "null").
- Landing-page visual foundation pass applied to `style.css` + `index.html`.
- Browser regression tests NOT yet re-run after the visual pass.

## Environment notes
- Backend runs FROM WINDOWS: `cd ...belong && node backend/server.js`.
- WSL `localhost:5000` does NOT reach it; frontend tests proxy via local harness ports.
- File line endings: `index.html`/`style.css` = CRLF; `script.js`/`backend/server.js` = LF.

## Dev-loop controller (.ai/)
- `planner.js` — Steps 1-3: generates one prompt (default mode → `NEXT_PROMPT.md`),
  records results (`--record-result`, `--record-opencode-result`).
- `run-cycle.js` — Step 4: ONE-SHOT runner: `NEXT_PROMPT.md` → `opencode run <prompt>` →
  `OPENCODE_LAST_OUTPUT.md` → result recorded → STOP. Never auto-loops, never re-invokes
  the planner generation mode; `.cycle.lock` prevents concurrent cycles. See `--help`.
- State files: `PROJECT_STATE.md`, `CURRENT_TASK.md`, `DECISIONS.md`, `TEST_RESULTS.md`,
  `IMPLEMENTATION_RESULT.md`, `NEXT_PROMPT.md`, plus handoff templates
  `OPENCODE_RESULT.md` and generated `OPENCODE_LAST_OUTPUT.md`.
