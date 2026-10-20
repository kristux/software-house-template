# Projects

One directory per project the company works on: `projects/<slug>/`. These hold
the company's **artifacts** for that project - `project.md` (the registry entry),
the brief, design, ADRs, `CONTEXT.md`, and notes. **No project code lives here.**
The code lives wherever the founder keeps it (a git checkout, a Perforce workspace,
possibly on another machine), and its location is confirmed before any work.

This directory ships empty. A project directory typically grows to:

| Path | Written by | Purpose |
|---|---|---|
| `project.md` | Producer, at intake | Identity, VCS, known code locations (template below) |
| `progress.md` | Producer, at every phase boundary | Restart state for a fresh session (format in the `resume` skill) |
| `design.md` | Architect | Approach, structure, data, slice breakdown and tier assignment |
| `adr/NNNN-<slug>.md` | Architect | Expensive-to-reverse decisions |
| `CONTEXT.md` | Architect | Domain glossary |
| `reviews/` | `review-cl` skill | Merged review findings for Perforce changelists |
| notes, test plans, runbooks | any role, via the Producer | Whatever the project needs |

The brief itself lives in `docs/product/briefs/<slug>.md`, its adversary review
next to it as `<slug>-review.md`, and the retro in `docs/retros/`.

## Finding the code (the important rule)

Never assume where a project's code is. The founder runs multiple machines and often
several workspaces over the same codebase, so the path differs by machine and by
workspace. Before any agent touches project code, the main session confirms the
working location:

- **Multiple known workspaces** for the project -> ask which one to use.
- **No known location** on this machine -> ask where it is.
- **A new project** -> ask where it should be created.

`project.md` remembers what we have seen so the question can offer good options,
but the answer is confirmed each work session. Working on the wrong version is
worse than asking.

## `project.md` template

```markdown
# <Project name>

**Slug:** <slug>
**VCS:** git | perforce
**Depot / repo:** <e.g. //depot/foo/... or git@github.com:org/foo.git>
**Description:** one line on what this project is.

## Known locations

Where the code has been found before, so we can offer it when confirming. Paths
are machine-specific; treat them as hints, not gospel.

- <machine/host> - <workspace or branch> - `<absolute path>`

## Working notes

- Build / run / test commands, once known.
- For Perforce: workspace/client names, stream, and the agreed
  work-and-review flow if it differs from the default (sync -> numbered
  changelist -> shelve for review gates -> submit after they pass).
```

## ADRs

Architecture decision records live per project in `projects/<slug>/adr/`,
numbered sequentially and resetting for each project (`0001-<slug>.md`). Written
by the Architect for any decision that is expensive to reverse. One page maximum
each: Context, Decision, Consequences. A superseded ADR is never deleted; it gets
a "Superseded by NNNN" line at the top. Decisions about how the *company itself*
operates belong in `docs/retros/`, not in an ADR.
