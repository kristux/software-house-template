# Company memory

Cross-project operational knowledge the agents accumulate as they work: the
reusable lessons, gotchas, and techniques that are *not* tied to any one
project. This is the long tail of "things we learned the hard way" that isn't
important enough to promote into `CLAUDE.md` but shouldn't evaporate the way an
unread retro does.

The whole point of this store is **recall**, not storage. A lesson only earns
its place if it will land in the right agent's context the next time that
situation comes up. Capture is easy; recall is the job.

## What belongs here (and what does not)

Memory is the **cross-project distillate**. It never duplicates the artifacts
that already own their knowledge:

- Product decisions -> `docs/product/decisions.md`
- Expensive-to-reverse project choices -> `projects/<slug>/adr/`
- Domain glossary -> `projects/<slug>/CONTEXT.md`
- What went well/badly on a project -> `docs/retros/`
- Standing company rules -> `CLAUDE.md`

A memory *cites* those (as its `source`) but holds the generalized, reusable
lesson, not a copy. If a lesson becomes important enough to be a standing rule,
it graduates into `CLAUDE.md` and the memory can be deleted or left as a pointer.
Rule of thumb: if it's specific to one project, it belongs in that project's
docs; if it's a hard company-wide law, it belongs in `CLAUDE.md`; the reusable
middle is memory.

## File shape

One fact per file, `docs/memory/<slug>.md`, Obsidian-style:

```markdown
---
name: <short-kebab-case-slug>          # matches the filename
description: <one-line summary; this is what recall scans>
type: process | gotcha | technique | reference
roles: [tester, architect]             # whose work this informs; [all] if universal
source: docs/retros/YYYY-MM-DD-<project>.md    # where the lesson came from
---

The lesson, stated so it's actionable out of context.

**When it applies:** the trigger.
**What to do:** the action.

Related: [[other-memory-slug]]
```

- **`type`** - `process` (how we run the pipeline), `gotcha` (an environment or
  stack trap that will bite again), `technique` (a reusable how-to), `reference`
  (a pointer to an external or internal resource).
- **`roles`** - the axis that scopes *relevance*, never *access*. Nothing here is
  hidden; `roles` just says whose default view a memory shows up in. Valid values
  are the agent names in `.claude/agents/` (producer, product-owner,
  brief-adversary, architect, tester, code-reviewer, security-advisor,
  junior-developer, developer, senior-developer, principal-developer, finance,
  chief-of-staff) plus `all`. Tag every role the
  lesson genuinely informs, including the seams between them. A lesson lives in
  exactly one file; if two roles care, list both. Never copy a memory into a
  second file.
- **`[[wikilinks]]`** connect memory to memory (the graph). Provenance to a
  retro, ADR, or decision is a normal path reference in `source` or the body, not
  a wikilink, so the graph stays memory-to-memory.

## INDEX.md

`INDEX.md` is the thin, always-loaded layer: one line per memory
(`[[slug]]` + type + roles + hook). Bodies are loaded on demand, never in bulk.
Keep INDEX.md in sync whenever a memory is added, changed, or deleted.

## Capture

- **Chief of Staff, at every retro (pipeline step 9).** Filing durable memories
  is a third output alongside the retro doc and the improvement actions. A
  retro's reusable lessons become memories here; the retro itself stays the
  project-specific record.
- **Any agent, mid-work.** An agent that hits a durable, cross-project lesson
  routes it up to the Producer (agents don't write here directly), who files it.

## Recall

The **Producer** is the recall path. It keeps `INDEX.md` in context and, when
dispatching an agent, injects the relevant memory bodies into that agent's
prompt - the same rail it already uses to pass the confirmed code location.
Filter by the dispatched agent's role (its `roles` tag plus `all`).

Today recall loads the whole index (it's cheap at this scale). If `INDEX.md`
ever crosses ~150-200 entries / ~8-10k tokens, switch to loading only the lines
whose `roles` match the agent being dispatched - a one-line change to the recall
step, no data migration, because the `roles` tag is already on every memory.
Curation keeps that day far off: the Chief of Staff merges duplicates and
deletes memories that proved wrong at each retro, so the store stays small.
