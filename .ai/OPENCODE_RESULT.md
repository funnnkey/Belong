STATUS: DRAFT

Fill this template after each OpenCode task (keep the section headings), then run:

  node .ai/planner.js --record-opencode-result .ai/OPENCODE_RESULT.md

or pipe raw OpenCode output directly:

  <opencode-output.txt  node .ai/planner.js --record-opencode-result

Text with no recognizable section headings is recorded as STATUS: NEEDS_REVIEW with the
raw output placed in CONCERNS (nothing is invented). Do not edit IMPLEMENTATION_RESULT.md
by hand — always use --record-result or --record-opencode-result.

TASK
(what task was given to OpenCode? paste it verbatim)

RESULT
(compact summary of what OpenCode reports it did)

FILES
(files changed or verified — one per line)

VERIFICATION
(tests/checks performed and their results)

CONCERNS
(warnings, failures, unresolved issues — or "none")

NEXT
(optional suggested next step — or "none")
