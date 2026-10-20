# Software House

A reference copy of one person's setup for running a small **software
development company staffed by AI agents** inside Claude Code. The founder gives
high-level goals; a Producer session coordinates a Product Owner, a Brief
Adversary, an Architect, four developer tiers, a Tester, a Code Reviewer, a
Security Advisor, a Finance governor, and a Chief of Staff, and hands back
finished, verified software.

It is published for people who asked how the workflow is put together. It is a
curated, generic copy of a working setup, not a template engine and not a
product: take what is useful, ignore the rest. Project data, history, and
project-specific agents and skills have been removed.

This repo is the *orchestration layer only*. No project code lives here - code
stays wherever the founder keeps it (a git checkout, a Perforce workspace,
another machine), and the company's rules require the working location to be
confirmed before any agent touches it.

## How it works

Give the main Claude Code session a goal (or run `/new-project`). It acts as the
Producer and drives a fixed pipeline:

1. **Delivery mode** - the first question is always whether this work should
   *iterate live* (get something running, improve it against real use) or be
   *right the first round*. The answer reshapes the brief, the gates, and the
   slice plan.
2. **Intake** - the main session interviews the founder one question at a time
   (the `grilling` skill) and records every answer in
   `docs/product/decisions.md` with `scripts/log-decision.js`, so the same
   question is never asked twice.
3. **Brief** - the Product Owner writes acceptance criteria into
   `docs/product/briefs/`.
4. **Brief adversary** - a separate agent attacks the brief before design
   starts: ambiguity, unstated assumptions, untestable criteria, scope that will
   not converge. Every later gate checks the software against the brief, so a
   wrong brief is the one failure nothing downstream catches.
5. **Design** - the Architect writes the approach, records expensive-to-reverse
   choices as ADRs, and breaks the work into vertical slices, assigning each to
   the cheapest defensible developer tier.
6. **Testability** - the Tester attaches a concrete "run X, expect Y" to every
   task *before* code is written.
7. **Build loop** - junior-developer (Haiku) / developer (Sonnet) /
   senior-developer (Opus) / principal-developer (Opus at the highest effort,
   reserved for named hard classes such as native integration and concurrency)
   implement with tests; the Tester verifies by actually running the software.
   A failure retries once on the same tier, then escalates one tier up.
8. **Gates** - QA, Code Review, and Security Review, then Product Owner
   acceptance. Only then does it merge.
9. **Retro** - the Chief of Staff records what to improve and files reusable
   lessons as company memory, Finance reports what it cost by role, and a
   tier-ratio analysis tunes the assignment bias for next time.

A few rules carry most of the weight:

- **Every delegation is logged** (`scripts/log-delegation.js` ->
  `docs/finance/delegated-usage.jsonl`), so cost and tier outcomes survive the
  sub-agent transcripts being wiped.
- **The company keeps memory** (`docs/memory/`) of cross-project lessons, which
  the Producer injects into the right agent's context on dispatch.
- **The Producer is restartable.** Each project keeps
  `projects/<slug>/progress.md` current, so the main session can `/clear` and
  `/resume <slug>` at any phase boundary instead of carrying a whole project in
  context.
- **Bounded patience.** No agent waits forever on a command that may not finish;
  a blocked agent stops and reports, and the Producer kills runaways early.
- **Agents report facts.** A failure is reported as a failure; "blocked because
  X" is a good outcome, a false "done" the worst one.

## First 15 minutes

1. **Copy what you want** into your own repo, then open it in Claude Code.
2. **Read `CLAUDE.md`.** It is the company's operating manual and the single
   most important file here. Everything else serves it.
3. **Fill in `docs/product/vision.md`** - who you are as the client and what you
   standingly prefer. The Product Owner reads it before every brief.
4. **Calibrate `docs/finance/budget.md`.** Both spend governors ship unarmed on
   purpose; the file explains the one reading needed to arm each.
5. **Install the general-purpose skills the agents mention, if you want them**
   (see "Not included" below). The agents state the discipline inline, so they
   work without them.
6. **Run `/new-project`** and give it a goal.

## What's load-bearing vs. what's an example

| Load-bearing | Example, change freely |
|---|---|
| `CLAUDE.md` - the pipeline and ground rules | `.claude/skills/qt-headless-verify/` - a sample project-technique skill |
| `.claude/agents/*` - the thirteen roles | `.claude/skills/design-research/` - a draft skill, built from one session |
| `.claude/skills/grilling`, `new-project`, `resume`, `review-cl` | `docs/product/vision.md` - starting preferences |
| `scripts/*.js` - decision log, delegation log, cost reports | `docs/finance/budget.md` - thresholds and plan |
| The empty state files (`decisions.md`, `backlog.md`, `ledger.md`, `delegated-usage.jsonl`) - agents and scripts read and append to them | |

The state files must exist with their headers intact even while empty; the
agents and scripts parse them. `delegated-usage.jsonl` starts with a single
`_schema` line that documents the record format; the readers skip it.

## Layout

| Path | Purpose |
|---|---|
| `CLAUDE.md` | The company's operating manual |
| `.claude/agents/` | The thirteen role definitions |
| `.claude/skills/` | `grilling` (intake), `new-project` (kickoff), `resume` (restart from `progress.md`), `review-cl` (Perforce review), `design-research` (draft), plus a sample technique skill |
| `docs/product/vision.md` | Standing preferences of the founder |
| `docs/product/decisions.md` | Append-only log of every answer, binding on future work |
| `docs/product/briefs/` | One brief per goal, with acceptance criteria and its adversary review |
| `docs/backlog.md` | Task state, kept honest by the Producer |
| `docs/memory/` | Cross-project lessons, indexed in `INDEX.md`, injected on dispatch (ships empty) |
| `docs/retros/` | One retro per project, plus improvement actions |
| `docs/finance/` | Budget, spend ledger, delegation log, per-project cost breakdowns |
| `projects/<slug>/` | Per-project artifacts: `project.md`, `progress.md`, design, `adr/`, `CONTEXT.md` (no code) |
| `scripts/` | Decision logging, delegation logging, token and cost reporting, with tests in `scripts/test/` |

Run the script tests with `node --test scripts/test/*.test.js` (Node 18 or
later).

## Not included

- **Project-specific agents and skills.** The original setup also has agents
  and skills built for specific codebases and for the founder's personal review
  taste. They were removed. `CLAUDE.md` and the `review-cl` skill still say
  where such things plug in.
- **Seed memories, decisions, retros, and cost records.** All state ships empty.

## Skills from mattpocock/skills

A lot of how this company works leans on Matt Pocock's
[mattpocock/skills](https://github.com/mattpocock/skills): relentless grilling
before building, deep modules, and a disciplined TDD and diagnosis loop. Get
them from the source rather than from here, so you stay on his current versions:

```bash
claude plugins install mattpocock-skills
```

or `npx skills@latest add mattpocock/skills` to copy editable files into your
project. See his README for details.

The agents mention these by name: `tdd`, `diagnosing-bugs`, and
`improve-codebase-architecture`. Every agent that mentions one says "if
installed" and carries the core discipline in its own text, so the pipeline runs
without them. `grill-with-docs`, `codebase-design`, and `handoff` are also worth
a look.

Two pieces in this repo are adapted from his skills and changed to fit the
pipeline: the `grilling` skill (one question at a time, reads the decision log
first) and the `code-reviewer` agent (from his `code-review` skill). His license
is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## A note on "the founder"

The agents refer to their single client as **the founder**. If you would rather
they use your name, a find-and-replace across `CLAUDE.md`, `.claude/`, and
`docs/` is all it takes.

## Costs

This runs a lot of model calls. The single biggest cost driver is usually not
the sub-agents - it is the main orchestration session's own context, read on
every turn (in the original deployment, main-session cache reads were well over
80% of project cost on consecutive projects). `CLAUDE.md` codifies the
frugality discipline that keeps it down, the `resume` skill lets the main
session restart cheaply, and Finance exists to stop the company before it runs
into a hard limit. Read `docs/finance/budget.md` before your first real project.

## License

MIT. See `LICENSE`. Material adapted from other projects keeps its own license;
see `THIRD_PARTY_NOTICES.md`.
