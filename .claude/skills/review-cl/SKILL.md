---
name: review-cl
description: Review a shelved Perforce changelist with the code-reviewer (and the security-advisor when the change touches a sensitive surface) in parallel and return one merged finding list for a single fix round. Use for any Perforce change set instead of the built-in /code-review, which only reads git. Invoke as /review-cl [CL] [slug].
argument-hint: "[changelist] [project slug]"
---

The built-in `/code-review` only reads a git working tree. On a Perforce project
it silently reviews whatever git repo the session sits in (on one project it
reviewed the orchestration repo instead of the change). This skill reviews the
shelved changelist itself, through every review lens at once, so their findings
land in one fix round instead of several rounds days apart.

## Resolve the target

1. Project slug: the argument, else the project in flight in this session, else ask.
2. Read `projects/<slug>/progress.md` for the workspace path, client, stream and
   changelist. A CL number given as an argument overrides the file.
3. Confirm the workspace with the founder per the `CLAUDE.md` location rule if
   it has not been confirmed this session.
4. Check the shelf is current: `p4 describe -S -s <CL>`, run from a shell whose
   working directory is inside the workspace so its client settings resolve. If
   `p4 opened -c <CL>` shows files edited locally after the last shelve, ask
   whether to re-shelve first; a review of a stale shelf is a review of the
   wrong code.

## Dispatch, in parallel, in one message

Every reviewer gets the same target block:
- workspace path, client, stream, CL number;
- read-only p4 only, concrete paths only, no depot wildcards or workspace-wide
  scans;
- review the shelved content (`p4 print -q <path>@=<CL>`) diffed against the
  shelf's base revision from `p4 describe` (not `#have`, which may have moved);
- skip vendored or branch-restored trees, naming them;
- the brief, design, ADRs and decisions for the project as spec context;
- earlier review files in `projects/<slug>/reviews/` and parked backlog rows, so
  they add rather than repeat, and say where they disagree with earlier rulings;
- draft only: post nothing, edit nothing; no em dashes.

Reviewers:
- `code-reviewer` - Standards and Spec axes, with the reminder that a change
  owns untouched code it made dead or pointless.
- `security-advisor` - when the change touches input handling, auth,
  persistence, network, file I/O, or dependencies.
- Any project-specific review agent the founder keeps (for example a reviewer
  that applies the founder's personal taste). None ships with this repo.

## Merge

When all return, log each with `scripts/log-delegation.js`, then write
`projects/<slug>/reviews/review-cl-<CL>-<YYYY-MM-DD>.md` with one list:
- dedupe findings that point at the same hunk; keep the stronger wording;
- rank BLOCKER / SHOULD-FIX / NIT, marking which lens raised each;
- where reviewers disagree, show both and recommend one;
- separate "fix in this CL" from "backlog candidates".

Present the merged list to the founder in one message and ask which go into the
fix round and which to the backlog. Record the answer with
`scripts/log-decision.js`. The fix round then follows the normal build loop
(developer tier, Tester verification with the review's own repro as the done
check).
