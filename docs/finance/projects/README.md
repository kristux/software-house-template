# Per-project cost records

One file per project, `<slug>.md`, written by the Finance agent at the end of the
cycle. Each records what the project cost and what we paid for (the by-role
breakdown), produced by:

    node scripts/project-cost.js --project <slug> --since <cycle start> --until <cycle end>

The `--since`/`--until` bounds are the cycle window: intake start to acceptance.
Record them at the top of each file so the number is reproducible.

## What is exact and what is estimated

- **Coordination + intake (main session): exact.** Scraped from the durable
  transcripts with the full token split.
- **Delegated work (architect, developer, tester, security, etc.): estimated
  cost, exact tokens.** Sub-agent transcripts are wiped after they finish, so
  the durable record is `docs/finance/delegated-usage.jsonl`, which holds each
  agent's total token count (exact) but not the input/output/cache split. Cost
  is therefore priced with a blended per-model rate.

On Claude Pro the dollar figure is a proxy for how much of the plan a project
consumed, not a bill. The by-role token split is the reliable part.

## Making delegated cost fully automatic (optional, later)

Today the Producer logs each delegated agent by hand on completion. A
`SubagentStop` hook could append these records automatically, but the sub-agent
transcript is not guaranteed to be readable when the hook fires and its format
is version-volatile, so it is a best-effort enhancement rather than a
replacement. Left as a future opt-in.
