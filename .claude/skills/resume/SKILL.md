---
name: resume
description: Restart the Producer in a fresh session from a project's progress file, so the main session's context can be dropped at any phase boundary without losing state. Also defines the progress.md format the Producer keeps current. Use when the founder says "resume <slug>", after a /clear, or when starting a work session on a project already in flight.
argument-hint: "<project slug>"
---

The main session's context is paid for on every turn, so it should not carry a
whole project. Instead, `projects/<slug>/progress.md` holds everything a fresh
Producer needs, and a new session rebuilds from it in a few small reads.

## Resuming

1. Read `projects/<slug>/progress.md`. If the slug is missing, list
   `projects/*/progress.md` and ask which one.
2. Check it against reality before trusting it. Only the slices you need:
   - git projects: `git -C <path> log --oneline -5` and `git status --short`.
   - Perforce projects: `p4 -c <client> opened` and `p4 describe -s <CL>` for the
     changelists it names. Never wildcard depot queries.
   - The backlog rows for this project in `docs/backlog.md` (grep, not a full read).
   - The in-flight agents it lists: their transcripts are gone with the old
     session. Treat any listed as in flight as lost; check their outputs on disk
     (branch, shelf, written report) and redispatch if nothing landed. Log a lost
     one with `log-delegation.js` as an ESTIMATE if it was not logged.
   If reality and the file disagree, reality wins; fix the file first.
3. Confirm the code location with the founder in one question, offering the
   location recorded in the file as the recommended answer. The per-session
   confirmation rule in CLAUDE.md still applies after a resume.
4. Keep `docs/memory/INDEX.md` in context as usual. Read the brief, ADRs, or
   decisions only when the next action needs them, and only the slice it needs.
5. Do the recorded next action.

## Returning after an idle gap

If the founder comes back to a still-open session after a gap longer than the
prompt-cache lifetime and the session holds more than about 100k of context,
the first reply offers `/clear` + `/resume <slug>` before doing more work
(rewrite progress.md first if anything changed). The first turn after such a gap
re-writes the whole cache, so carrying on in the old session costs more than a
fresh resume.

## Keeping progress.md current

Rewrite the file in place (do not append) at every phase boundary: brief
approved, design and testability done, each build wave done, each gate result,
acceptance. Also rewrite it before proposing a restart. Keep it under about 60
lines; link to artifacts by path instead of copying them.

Before proposing a restart, make sure no sub-agent is still running (its
completion notification would land in the dead session) and every finished
agent has been logged with `log-delegation.js`.

## Format

```markdown
# <slug> progress

Updated: <YYYY-MM-DDTHH:MM>
Brief: docs/product/briefs/<slug>.md  |  Mode: iterate live / right first round
Pipeline step: <step number and name from CLAUDE.md>

## Code location (last confirmed <date>)
<path, client or branch, changelist(s) or feature branch, shelf state>

## Tasks
<one line per task: id, owner tier, attempt, status; or "see docs/backlog.md <slug> rows">

## Gates
<brief adversary / testability / QA / code review / security / acceptance: verdict + report path, or pending>

## Decisions this session not yet in decisions.md
<should normally be empty; record them there instead>

## Open questions for the founder
<batched, or none>

## Blockers
<or none>

## In flight
<agents dispatched and not yet returned, or none>

## Next action
<one concrete action, specific enough to run without re-reading the session>
```
