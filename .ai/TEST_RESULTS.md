# Test Results

## Browser regression suite (Playwright, Windows harness)
| Test | Result | Notes |
|---|---|---|
| Local happy path (name saved) | PASS | profile 34 |
| Empty-name validation (400 + inline error) | PASS | revealed duplicate-answer bug |
| Whitespace-only name | PASS | profile 35 |
| Traveller regression | PASS | profile 36 |
| Mobile 375px overflow | PASS | no horizontal scroll |
| Retry-after-blocked-save | PASS | profile 38, answers `[3,6,7]`, no duplicates |
| Full smoke (traveller + local + reco order) | PASS | profile 39/40, scores non-increasing |
| Null-name rendering fallback | PASS | "Local in Delhi" for profiles 31/32, profile 41 |

## After landing visual pass
- `node --check script.js` — PASS (script.js unmodified).
- CSS braces balanced — PASS (195/195).
- `backend/server.js` untouched (mtime verified) — PASS.
- DB: read-only check, no writes from the pass — PASS.
- Browser tests — **NOT YET RUN** (deferred by instruction).

## Watch item
Profile 42 appeared with duplicate answers `[1,1,1,4,4,4,5,5,5]` — created outside
the visual-pass session (stale cached `script.js` in a browser tab is the likely
cause). Verify with a hard refresh on next test run.

## Syntax checks
- `node --check script.js` — PASS (every session).
- `node --check .ai/planner.js` — PASS (created this step).
