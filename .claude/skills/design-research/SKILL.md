---
name: design-research
description: DRAFT, provisional (built from one session; re-judge after its second use). Research a question about an existing codebase with the founder in the loop and end with a settled design draft (an interface, an extraction plan, a "should we"), changing nothing in the target code. Map read-only, draft with a recommended answer per open question, grill, then verify the pain points the founder names. Use when the founder wants to investigate or design rather than build, or invokes /design-research.
---

> DRAFT. Extracted from one research session. Follow it, and note where it bent,
> so the second use can confirm or rewrite it.

Research is not a build, so the build pipeline's brief, adversary, Tester, review
and acceptance gates do not run. The founder is in the loop on every decision,
and that makes the founder the spec and acceptance gate. One gate stays:
**claims we relay must be checked.** If the research will run without the
founder (an autonomous assessment or audit), use the build pipeline re-pointed
for a non-build deliverable instead of this skill: the Architect produces the
deliverable, the Tester verifies its citations rather than running software,
Security is N/A with a written rationale, and no developer tiers are dispatched.

## Ground rules

- **Read-only to the target.** No edits, branches, changelists or shelves in the
  code being studied. All output goes under `projects/<slug>/` in this repo.
- Confirm the code location and its **stream/branch and revision** before
  anything reads it. Record them in `decisions.md`, and put them at the top of
  every output doc.
- Keep the main session lean. Explorers return condensed reports, and you read
  slices, not files.

## The loop

1. **Frame.** Restate the question and what the first deliverable is (for
   example "an ideal interface for X"). Record framing and constraints in
   `docs/product/decisions.md` under a dated `<slug>` heading.
2. **Map, broad and read-only.** Dispatch one Explore agent (very thorough) to
   map how the area works today: every case the design will have to carry, the
   boundaries, and the call sites. Ask for `path:line` on every claim. Save the
   report condensed as `current-state.md`. Spot-check its two or three
   load-bearing claims with small slices. Treat any distinction it draws as a
   question for the founder, not a fact: a code map describes the code, and the
   domain may be simpler.
3. **Draft in the main session.** The design needs the founder's framing, so do
   not delegate it. A useful shape: old-to-new mapping, sketch, usage, what it
   buys, what stays out, and **numbered open questions, each with a
   recommendation**. Put it in front of the founder early, because a wrong
   premise costs one sentence to fix at this point.
4. **Grill.** Use the `grilling` skill: one question at a time, in dependency
   order. Prefer questions about the requirement and the pain ("what do consumers
   need", "what goes wrong today") over mechanism choices. When asked to
   elaborate, show a concrete before/after per option. After each answer, append
   it to `decisions.md` (with `scripts/log-decision.js`) and edit the draft in
   the same turn.
5. **Verify what the founder names.** When an answer surfaces a pain point or a
   claim the map cannot settle, dispatch a narrow Explore with a hypothesis and
   the instruction to **confirm OR rule out** it, and to report anything else
   wrong in that path. Spot-check its top claims before relaying. Save the result
   as its own findings doc.
6. **Close.** Mark the draft's status (settled or what is still open), log every
   delegation with `scripts/log-delegation.js`, and offer the next step: stop
   here, start a build from the draft via `/new-project`, or run another dive.

## Evidence labels

Every relayed claim carries one label:

- **VERIFIED** - you re-read the cited code yourself.
- **CONFIRMED** - traced by an explorer, not re-read by you.
- **POSSIBLE** - a hazard visible in the code, not observed happening.

A design argument built on a POSSIBLE hazard says "possible", never "happens".

## If it spans sessions

Keep `projects/<slug>/progress.md` current per the `resume` skill.
