# Decisions & Hard Constraints

## Never change (regression-critical)
1. Backend matching logic: traveller Q1 tags vs local Q1 tags, score = integer
   overlap, sorted descending; tie order = DB order; zero matches last.
2. `travellerProfileId` handling in recommendation requests.
3. Local name validation: `role === "local"` requires non-empty trimmed
   `displayName` (400 from `POST /api/profile`).
4. Deterministic matching — no randomness, no timestamps in ranking.
5. Duplicate-answer fix: name validation + last-question guard run BEFORE
   `answers.push` in `nextQuestionBtn`.

## API contract (recommendations)
Response fields ONLY: `id, name, city, email, expertise, matchReason`.
No `matchScore`, no percentages, no fake metrics anywhere in UI.

## Database
- Existing schema only: `users(id, role, email)`,
  `profiles(id, user_id, display_name, city, bio)`,
  `profile_answers(id, profile_id, question_id, option_id, custom_text)`,
  `questions`, `question_options`.
- DO NOT add columns/tables unless a human explicitly approves.
- DO NOT hand-edit test data.

## Product decisions pending (planner must not decide these)
- Name casing of city fallback ("Local in Delhi" for raw `delhi` — currently
  title-cases first letter; flagged, not corrected).
- Whether hero eyebrow/section-label treatment stays as-is after visual pass.

## Conventions
- `reco-*` class namespace reserved for recommendations.
- Onboarding emoji option icons are functional — do not strip them.
- Copy: Playfair Display + DM Sans, deep green / cream / coral identity.

## Dev-loop controller (Step 4)
- `run-cycle.js` is strictly one-shot: exactly ONE OpenCode task per invocation, then
  STOP. It never re-invokes planner generation and never starts a second cycle.
- OpenCode launches only for prompts containing a `PROMPT:` line; empty prompts or
  `STATUS: COMPLETE` / `STATUS: NEEDS_REVIEW` → "No executable implementation task is
  available." (no launch).
- Non-zero OpenCode exit → output still saved and recorded as `STATUS: NEEDS_REVIEW`,
  no retry. Process failure is judged ONLY by exit code, never by words in the output.
- `.ai/.cycle.lock` prevents concurrent cycles and is always removed on process exit.
