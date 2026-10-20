---
name: new-project
description: Start a new project or goal in the software house. Runs Product Owner intake to align on what to build and where the code lives, writes the brief, then drives the rest of the pipeline autonomously. Use when the founder wants to kick off a new piece of work.
---

Kick off a new project. There are two distinct phases, and the boundary matters:
**alignment is interactive; execution runs on its own.**

## Phase 1 - Align with the Product Owner (interactive)

You are wearing the Product Owner hat. Use the `grilling` skill: one question at
a time, always offer your recommended answer, and read the relevant slices of
`docs/product/decisions.md` and `docs/product/vision.md` first so you never
re-ask what is already known.

Grill until these are clear (skip any the goal already answers):

0. **Delivery mode** - always the first question: iterate live, or get it right
   the first round? It changes the brief, the gates, and the slice plan (see
   "Delivery mode" in `CLAUDE.md`).
1. **What and why** - what does done look like, in plain language, and what
   problem does it solve.
2. **Scope** - what is explicitly in and out. Cut aggressively.
3. **Success** - how we will know it works, concretely.
4. **Where the code lives** - is this a new codebase or an existing one? Its VCS
   (git or Perforce)? If it exists, which checkout/workspace and where on this
   machine (ask; do not guess - there may be several). If new, where should it be
   created? For every existing checkout or reference source, also verify its
   actual stream/branch and sync revision (e.g. `p4 client -o`, `git status`) and
   check it against what the founder named in the goal; a folder name is not a
   version.

Then:

- Open a `## YYYY-MM-DD <slug>: <topic>` heading in `docs/product/decisions.md`
  and record every answer under it with `scripts/log-decision.js`.
- Create `projects/<slug>/project.md` from the template in `projects/README.md`,
  capturing identity, VCS, and the confirmed code location.
- Create `projects/<slug>/progress.md` in the format from the `resume` skill and
  keep it current at every phase boundary from here on.
- Hand the gathered answers to the `product-owner` agent to write the brief with
  acceptance criteria in `docs/product/briefs/<slug>.md`.
- Hand the draft brief to the `brief-adversary` agent, telling it the delivery
  mode. Route blocking findings back to the `product-owner` agent, or to the
  founder as one batched question when only the founder can settle them.
- Show the founder the brief's goal, scope, and acceptance criteria for a final
  yes. **This is the last routine check-in.** Get explicit approval before Phase 2.

## Phase 2 - Execute autonomously

Once the brief is approved, run the pipeline (see `CLAUDE.md`) as Producer without
asking the founder to babysit. Run Finance first and before any expensive batch.

1. **Architect** - design, ADRs, `CONTEXT.md`, break into vertical slices, assign
   each to the cheapest defensible tier (junior-developer, developer,
   senior-developer, or principal-developer for the named hard classes).
2. **Tester** - testability pass: a "how will I know this works" per slice.
3. Fill `docs/backlog.md` (owner + verification per slice).
4. **Build loop per slice** - confirm the code location is still the agreed one,
   dispatch the assigned tier, then the Tester verifies by running it. A FAIL
   retries once on the same tier with the evidence attached, then escalates one
   tier up. Log each sub-agent's tokens with `scripts/log-delegation.js`.
5. **Tester** - QA manual test of the whole feature.
6. **Code Reviewer** - Standards + Spec (`/review-cl` for a Perforce change).
7. **Security Advisor** - review before it hits production.
8. **Product Owner** - acceptance against the brief.
9. **Chief of Staff** - retrospective and company memory; Finance writes the
   project cost.
10. Report the outcome to the founder.

## When to break autonomy

Only surface to the founder during Phase 2 for things genuinely not derivable from
`docs/product/` or the brief: a scope-changing ambiguity, a blocker you cannot
resolve, a decision that is expensive to reverse and not covered, or Finance
hitting STOP. Batch such questions; do not trickle them. Everything else, decide
and proceed. Report at completion, and at a milestone if the project is large.
